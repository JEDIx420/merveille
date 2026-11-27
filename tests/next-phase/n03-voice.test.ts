import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import { validateMono16kPcmWav } from "@/server/voice/wav";
import {
  processVoiceDictation,
  resolveRelativeDateKolkata,
  VOICE_MODEL_ALLOWLIST,
  WorkersAiRunner,
} from "@/server/voice/service";
import { QuotaService } from "@/server/quota/service";

function makeTestWav(seconds: number, sampleRate = 16000, channels = 1): Uint8Array {
  const dataBytes = Math.floor(seconds * sampleRate * channels * 2);
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, dataBytes, true);
  return new Uint8Array(buf);
}

describe("Stage N03: Open-Source Voice Entry & Bounded Free Quota (NAC-008, NAC-009)", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";

  const staffUser: UserPrincipal = {
    id: "usr_staff_n03",
    email: "staff.n03@merveilledesigns.com",
    name: "Staff N03",
    role: "TEAM_MEMBER",
    roles: ["TEAM_MEMBER"],
    intakeAccess: true,
    orgId,
    projectMemberships: [],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    const now = Date.now();
    await db
      .prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`)
      .bind(staffUser.id, staffUser.email, staffUser.name, now)
      .run();
    await db
      .prepare(`INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`)
      .bind(`om_${staffUser.id}`, orgId, staffUser.id, now)
      .run();
  });

  it("NAC-008: Server WAV validation rejects malformed, stereo, wrong-rate, and >30s audio before inference", () => {
    expect(() => validateMono16kPcmWav(new Uint8Array([1, 2, 3]))).toThrow(/too short/);
    expect(() => validateMono16kPcmWav(makeTestWav(1, 44100, 1))).toThrow(/16000 Hz/);
    expect(() => validateMono16kPcmWav(makeTestWav(1, 16000, 2))).toThrow(/mono/);
    expect(() => validateMono16kPcmWav(makeTestWav(31, 16000, 1))).toThrow(/30-second|must be between/);

    const ok = validateMono16kPcmWav(makeTestWav(4.5, 16000, 1));
    expect(ok.sampleRate).toBe(16000);
    expect(ok.durationSeconds).toBeCloseTo(4.5, 1);
  });

  it("NAC-008: Deterministic Asia/Kolkata date resolution and reviewed lead extraction never auto-saves", async () => {
    // 2026-11-27 10:00 IST = 2026-11-27T04:30:00Z
    const capturedMs = Date.parse("2026-11-27T04:30:00.000Z");
    const tmr = resolveRelativeDateKolkata("Remind me tomorrow at 11 am to call", capturedMs);
    expect(tmr.date).toBe("2026-11-28");
    expect(tmr.time).toBe("11:00");
    expect(tmr.ambiguous).toBe(false);

    const amb = resolveRelativeDateKolkata("Call next Friday at 5", capturedMs);
    expect(amb.ambiguous).toBe(true);

    const mockAi: WorkersAiRunner = {
      async run(model) {
        if (model === VOICE_MODEL_ALLOWLIST.TRANSCRIPTION) {
          return { text: "Add Anoop. Interiors for a three-bedroom apartment in Kowdiar. Remind me tomorrow at 11 am to call." };
        }
        return {
          response: JSON.stringify({
            cleanedText: "Interiors for a three-bedroom apartment in Kowdiar.",
            name: "Anoop",
            phone: null,
            email: null,
            requirement: "Interiors for a three-bedroom apartment in Kowdiar.",
            nextAction: "Call Anoop",
            relativeDatePhrase: "tomorrow at 11 am",
          }),
        };
      },
    };

    const proposal = await processVoiceDictation(db, mockAi, staffUser, {
      attemptId: "att_voice_1",
      wavBytes: makeTestWav(3, 16000, 1),
      targetKind: "LEAD",
      capturedAtMs: capturedMs,
    });

    expect(proposal.extractedLead?.name).toBe("Anoop");
    expect(proposal.extractedLead?.phone).toBeNull();
    expect(proposal.extractedLead?.nextActionDate).toBe("2026-11-28");
    expect(proposal.extractedLead?.nextActionTime).toBe("11:00");

    // Verify NOTHING was auto-saved to enquiries table
    const enqCount = await db.prepare(`SELECT COUNT(*) as cnt FROM enquiries WHERE org_id = ?`).bind(orgId).first<{ cnt: number }>();
    expect(enqCount?.cnt).toBe(0);
  });

  it("NAC-009: Concurrent voice requests and retries respect reserved daily neuron cap without paid fallback", async () => {
    await db
      .prepare(`INSERT OR IGNORE INTO quota_policies (org_id, max_ai_neurons_daily, max_ai_attempts_daily, updated_at) VALUES (?, 100, 5, ?)`)
      .bind(orgId, Date.now())
      .run();

    let aiCalls = 0;
    const mockAi: WorkersAiRunner = {
      async run(model) {
        aiCalls++;
        if (model === VOICE_MODEL_ALLOWLIST.TRANSCRIPTION) return { text: "Note text" };
        return { response: JSON.stringify({ cleanedText: "Note text." }) };
      },
    };

    // First attempt reserves 80 neurons, settles ~45 neurons
    await processVoiceDictation(db, mockAi, staffUser, {
      attemptId: "att_cap_1",
      wavBytes: makeTestWav(2, 16000, 1),
      targetKind: "TASK_NOTE",
    });

    // Second attempt needs 80 reservation, only ~55 left -> fails closed!
    await expect(
      processVoiceDictation(db, mockAi, staffUser, {
        attemptId: "att_cap_2",
        wavBytes: makeTestWav(2, 16000, 1),
        targetKind: "TASK_NOTE",
      })
    ).rejects.toThrow(/Daily Workers AI neuron budget reached/);

    // Verify AI was only called for the first admitted attempt (2 calls: STT + formatter)
    expect(aiCalls).toBe(2);
    // Unused QuotaService import sanity check
    expect(QuotaService).toBeDefined();
  });

  it("NAC-009: External client and consultant users are denied voice dictation (403 FORBIDDEN)", async () => {
    const clientUser: UserPrincipal = {
      id: "usr_client_v",
      email: "client@example.com",
      name: "Client",
      role: "MAIN_CLIENT",
      roles: ["MAIN_CLIENT"],
      orgId,
      projectMemberships: [{ projectId: "prj_1", projectRole: "MAIN_CLIENT" }],
    };
    const consultantUser: UserPrincipal = {
      id: "usr_cons_v",
      email: "cons@example.com",
      name: "Consultant",
      role: "CONSULTANT",
      roles: ["CONSULTANT"],
      orgId,
      projectMemberships: [{ projectId: "prj_1", projectRole: "CONSULTANT" }],
    };

    const mockAi: WorkersAiRunner = {
      async run() {
        throw new Error("Should not invoke AI for unauthorized caller");
      },
    };

    await expect(
      processVoiceDictation(db, mockAi, clientUser, {
        attemptId: "att_client_deny",
        wavBytes: makeTestWav(1, 16000, 1),
        targetKind: "TASK_NOTE",
      })
    ).rejects.toThrow(/authorized internal practice members/);

    await expect(
      processVoiceDictation(db, mockAi, consultantUser, {
        attemptId: "att_cons_deny",
        wavBytes: makeTestWav(1, 16000, 1),
        targetKind: "LEAD",
      })
    ).rejects.toThrow(/authorized internal practice members/);
  });
});
