/**
 * Open-Source Voice Entry & Structured Draft Extraction Service (Stage N03, NAC-008, NAC-009).
 * Uses allowlisted open-source models on Cloudflare Workers AI Free tier:
 * - Transcription: @cf/openai/whisper-large-v3-turbo (MIT)
 * - Cleanup/Extraction: @cf/openai/gpt-oss-20b (Apache 2.0)
 * Never stores raw audio in R2, never logs transcripts, never auto-saves business records,
 * and fails closed when daily neuron quota is exhausted (no paid fallback).
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { QuotaService } from "@/server/quota/service";
import { assertLeadAccess } from "@/server/domain/enquiries/leads-service";
import { validateMono16kPcmWav } from "./wav";

export const VOICE_MODEL_ALLOWLIST = {
  TRANSCRIPTION: "@cf/openai/whisper-large-v3-turbo",
  FORMATTER: "@cf/openai/gpt-oss-20b",
} as const;

export const CONSERVATIVE_NEURONS_PER_ATTEMPT = 80; // 30s audio (~24) + 2000 in (~37) + 512 out (~14) + headroom

export interface VoiceDraftProposal {
  targetKind: "LEAD" | "FOLLOWUP" | "TASK_NOTE";
  rawTranscript: string;
  cleanedText: string;
  extractedLead?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    requirement: string;
    stage: "NEW";
    nextAction: string | null;
    nextActionDate: string | null; // YYYY-MM-DD in Asia/Kolkata
    nextActionTime: string | null; // HH:MM
    ambiguousFields: string[];
  };
  quota: {
    reservedNeurons: number;
    actualNeurons: number;
    remainingNeurons: number;
  };
}

export interface WorkersAiRunner {
  run(model: string, input: any): Promise<any>;
}

/**
 * Resolve relative dates ("today", "tomorrow", "next Friday") deterministically in Asia/Kolkata.
 */
export function resolveRelativeDateKolkata(
  phrase: string,
  capturedAtMs = Date.now()
): { date: string | null; time: string | null; ambiguous: boolean; note?: string } {
  const lower = phrase.toLowerCase();
  // Format capturedAt in Asia/Kolkata (+05:30)
  const istMs = capturedAtMs + 5.5 * 3600 * 1000;
  const istDate = new Date(istMs);

  let date: string | null = null;
  let ambiguous = false;
  let note: string | undefined;

  if (/\btoday\b/.test(lower)) {
    date = istDate.toISOString().slice(0, 10);
  } else if (/\btomorrow\b/.test(lower)) {
    const tmr = new Date(istMs + 86400 * 1000);
    date = tmr.toISOString().slice(0, 10);
  } else if (/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) {
    ambiguous = true;
    note = "Relative weekday ('next ...') needs calendar date confirmation.";
  }

  let time: string | null = null;
  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const min = Number(timeMatch[2] || "0");
    const mer = timeMatch[3];
    if (mer === "pm" && hour < 12) hour += 12;
    else if (mer === "am" && hour === 12) hour = 0;
    else if (!mer && hour >= 1 && hour <= 11) {
      ambiguous = true;
      note = (note ? note + " " : "") + `Time "${timeMatch[1]}:${String(min).padStart(2, "0")}" needs AM/PM confirmation.`;
    }
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
  }

  return { date, time, ambiguous, note };
}

export async function processVoiceDictation(
  db: D1Database,
  ai: WorkersAiRunner | undefined,
  actor: UserPrincipal,
  input: {
    attemptId: string;
    wavBytes: Uint8Array;
    targetKind: "LEAD" | "FOLLOWUP" | "TASK_NOTE";
    capturedAtMs?: number;
  }
): Promise<VoiceDraftProposal> {
  // Authorization: clients and external consultants may not consume internal AI neuron quota
  const isInternalVoiceUser =
    hasCapability(actor, "ADMIN") ||
    hasCapability(actor, "OWNER") ||
    Boolean(actor.intakeAccess) ||
    actor.projectMemberships.some((m) =>
      (m.roles || [m.projectRole]).some((r) =>
        ["MANAGER", "PROJECT_MANAGER", "TEAM_MEMBER", "STAFF", "ARCHITECT", "DIRECTOR"].includes(r || "")
      )
    );
  if (!isInternalVoiceUser) {
    throw new AuthorizationError(
      "Voice dictation is restricted to authorized internal practice members.",
      "FORBIDDEN"
    );
  }
  if (input.targetKind === "LEAD" || input.targetKind === "FOLLOWUP") {
    assertLeadAccess(actor);
  }

  if (!input.attemptId?.trim()) {
    throw new AuthorizationError("Attempt ID is required.", "INVALID_INPUT");
  }

  // 1. Validate mono 16kHz 16-bit PCM WAV & <=30s BEFORE quota/inference
  const wavInfo = validateMono16kPcmWav(input.wavBytes);

  if (!ai) {
    throw new AuthorizationError(
      "Workers AI binding is not configured in this environment. Use ordinary typing instead.",
      "AI_UNAVAILABLE"
    );
  }

  // 2. Atomic, idempotent daily Free-tier neuron reservation (8,000/day ceiling)
  const reservation = await QuotaService.reserveAiNeurons(
    db,
    actor.orgId,
    input.attemptId,
    CONSERVATIVE_NEURONS_PER_ATTEMPT
  );

  let actualNeurons = Math.ceil(wavInfo.durationSeconds * (46.63 / 60));

  try {
    // 3. Transcribe with allowlisted MIT Whisper model
    const sttResult = await ai.run(VOICE_MODEL_ALLOWLIST.TRANSCRIPTION, {
      audio: Array.from(input.wavBytes),
    });

    const rawTranscript = typeof sttResult?.text === "string" ? sttResult.text.trim() : "";
    if (!rawTranscript) {
      await QuotaService.settleAiNeurons(db, actor.orgId, input.attemptId, Math.max(10, actualNeurons));
      throw new AuthorizationError(
        "No speech was detected in the recording. Please retry or type your note.",
        "EMPTY_TRANSCRIPT"
      );
    }

    // 4. Clean & extract structured draft with allowlisted Apache 2.0 model
    let cleanedText = rawTranscript;
    let extractedLead: VoiceDraftProposal["extractedLead"] | undefined;

    const prompt = [
      "Clean fillers/false starts while preserving all negation, uncertainty, names, numbers, and dates.",
      input.targetKind === "LEAD"
        ? 'Return JSON only: {"cleanedText": string, "name": string|null, "phone": string|null, "email": string|null, "requirement": string, "nextAction": string|null, "relativeDatePhrase": string|null}'
        : 'Return JSON only: {"cleanedText": string}',
      `Transcript: ${rawTranscript.slice(0, 1500)}`,
    ].join("\n");

    const llmResult = await ai.run(VOICE_MODEL_ALLOWLIST.FORMATTER, {
      messages: [
        { role: "system", content: "You format short architectural practice dictation into strict JSON. Never invent contact details or mark anything approved." },
        { role: "user", content: prompt },
      ],
      max_tokens: 512,
      reasoning: { effort: "low" },
    });

    actualNeurons += 40; // conservative accounting for bounded LLM call

    const rawResponseText =
      typeof llmResult?.response === "string"
        ? llmResult.response
        : llmResult?.choices?.[0]?.message?.content || "";

    if (rawResponseText) {
      const jsonMatch = rawResponseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AuthorizationError(
          "Voice structuring returned malformed output; raw transcript preserved for manual review.",
          "MALFORMED_EXTRACTION"
        );
      }
      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new AuthorizationError(
          "Voice structuring returned truncated JSON; please retry or type manually.",
          "MALFORMED_EXTRACTION"
        );
      }

      if (typeof parsed.cleanedText === "string" && parsed.cleanedText.trim()) {
        cleanedText = parsed.cleanedText.trim();
      }

      if (input.targetKind === "LEAD") {
        const ambiguousFields: string[] = [];
        const relPhrase = parsed.relativeDatePhrase || rawTranscript;
        const dateResolved = resolveRelativeDateKolkata(relPhrase, input.capturedAtMs ?? Date.now());
        if (dateResolved.ambiguous) {
          ambiguousFields.push(dateResolved.note || "Confirm follow-up date/time");
        }
        extractedLead = {
          name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null,
          phone: typeof parsed.phone === "string" && parsed.phone.trim() ? parsed.phone.trim() : null,
          email: typeof parsed.email === "string" && parsed.email.trim() ? parsed.email.trim() : null,
          requirement:
            typeof parsed.requirement === "string" && parsed.requirement.trim()
              ? parsed.requirement.trim()
              : cleanedText,
          stage: "NEW",
          nextAction:
            typeof parsed.nextAction === "string" && parsed.nextAction.trim()
              ? parsed.nextAction.trim()
              : null,
          nextActionDate: dateResolved.date,
          nextActionTime: dateResolved.time,
          ambiguousFields,
        };
      }
    }

    await QuotaService.settleAiNeurons(db, actor.orgId, input.attemptId, actualNeurons);

    return {
      targetKind: input.targetKind,
      rawTranscript,
      cleanedText,
      extractedLead,
      quota: {
        reservedNeurons: reservation.reservedNeurons,
        actualNeurons,
        remainingNeurons: reservation.remainingNeurons,
      },
    };
  } catch (err) {
    // Settle conservatively on error (never replenish failed inference as 0)
    await QuotaService.settleAiNeurons(db, actor.orgId, input.attemptId, Math.max(20, actualNeurons));
    throw err;
  }
}
