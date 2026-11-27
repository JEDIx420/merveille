"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { Button, readResponse } from "@/components/ui";
import type { VoiceDraftProposal } from "@/server/voice/service";

export function VoiceDictationButton({
  targetKind,
  onApplyDraft,
}: {
  targetKind: "LEAD" | "FOLLOWUP" | "TASK_NOTE";
  onApplyDraft: (proposal: VoiceDraftProposal) => void;
}) {
  const [state, setState] = useState<"IDLE" | "RECORDING" | "PROCESSING" | "REVIEW" | "ERROR">("IDLE");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<VoiceDraftProposal | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<any>(null);
  const attemptIdRef = useRef<string>("");

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  function cleanupAudio() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      ctxRef.current.close().catch(() => {});
    }
    ctxRef.current = null;
  }

  async function startRecording() {
    setError("");
    setProposal(null);
    chunksRef.current = [];
    attemptIdRef.current = `vatt_${crypto.randomUUID()}`;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (ev) => {
        chunksRef.current.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);

      setSeconds(0);
      setState("RECORDING");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= 30) {
            stopAndProcess();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      cleanupAudio();
      setError("Microphone access denied or unavailable. You can type your note instead.");
      setState("ERROR");
    }
  }

  async function stopAndProcess() {
    const sampleRate = ctxRef.current?.sampleRate || 16000;
    cleanupAudio();
    setState("PROCESSING");

    try {
      const wavBlob = encodeMono16kWav(chunksRef.current, sampleRate);
      chunksRef.current = [];

      const form = new FormData();
      form.append("audio", wavBlob, "dictation.wav");
      form.append("attemptId", attemptIdRef.current);
      form.append("targetKind", targetKind);
      form.append("capturedAtMs", String(Date.now()));

      const res = await fetch("/api/voice/dictate", { method: "POST", body: form });
      const json: any = await readResponse(res);
      if (!res.ok) {
        throw new Error(json.error || "Voice transcription unavailable; please type manually.");
      }

      setProposal(json.proposal);
      setState("REVIEW");
    } catch (e: any) {
      setError(e.message);
      setState("ERROR");
    }
  }

  function handleCancel() {
    cleanupAudio();
    chunksRef.current = [];
    setProposal(null);
    setError("");
    setState("IDLE");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {state === "IDLE" || state === "ERROR" ? (
          <Button type="button" secondary onClick={startRecording}>
            <Mic size={15} aria-hidden="true" />
            <span>Dictate (max 30s)</span>
          </Button>
        ) : state === "RECORDING" ? (
          <>
            <Button type="button" onClick={stopAndProcess}>
              <Square size={14} aria-hidden="true" />
              <span>Stop &amp; Transcribe ({seconds}s / 30s)</span>
            </Button>
            <Button type="button" secondary onClick={handleCancel}>
              Cancel
            </Button>
          </>
        ) : state === "PROCESSING" ? (
          <span className="text-muted" style={{ fontSize: "0.82rem" }}>
            Transcribing via Cloudflare Workers AI (open-source Whisper)…
          </span>
        ) : null}
        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
          Audio is processed on Cloudflare Workers AI and discarded after review.
        </span>
      </div>

      {error && (
        <div role="alert" style={{ padding: "0.55rem 0.75rem", borderRadius: "6px", border: "1px solid var(--merveille-danger)", color: "var(--merveille-danger)", fontSize: "0.82rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <span>{error}</span>
          <Button type="button" secondary onClick={startRecording}>
            <RotateCcw size={13} aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      {state === "REVIEW" && proposal && (
        <div className="card" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>Review Voice Draft (Nothing saved yet)</div>
          <div style={{ fontSize: "0.84rem" }}>{proposal.cleanedText}</div>
          {proposal.extractedLead?.ambiguousFields?.length ? (
            <div style={{ fontSize: "0.78rem", color: "var(--merveille-warning)" }}>
              Confirm: {proposal.extractedLead.ambiguousFields.join(" ")}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              type="button"
              onClick={() => {
                onApplyDraft(proposal);
                setState("IDLE");
                setProposal(null);
              }}
            >
              Apply to Form
            </Button>
            <Button type="button" secondary onClick={handleCancel}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function encodeMono16kWav(chunks: Float32Array[], sourceRate: number): Blob {
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  // Downsample linearly to 16 kHz if browser AudioContext ignored sampleRate hint
  const targetRate = 16000;
  const ratio = sourceRate / targetRate;
  const targetLen = Math.floor(merged.length / ratio);
  const resampled = new Int16Array(targetLen);
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.min(merged.length - 1, Math.floor(i * ratio));
    const sample = Math.max(-1, Math.min(1, merged[idx]));
    resampled[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const dataBytes = resampled.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  const out = new Int16Array(buffer, 44);
  out.set(resampled);
  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
