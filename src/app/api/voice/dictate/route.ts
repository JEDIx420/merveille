import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { processVoiceDictation } from "@/server/voice/service";
import { publicError, errorStatus } from "@/server/http/errors";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const audioFile = form.get("audio");
    const attemptId = String(form.get("attemptId") || "");
    const targetKind = String(form.get("targetKind") || "TASK_NOTE") as
      | "LEAD"
      | "FOLLOWUP"
      | "TASK_NOTE";
    const capturedAtMs = form.get("capturedAtMs")
      ? Number(form.get("capturedAtMs"))
      : Date.now();

    if (!(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "Audio WAV blob is required.", code: "INVALID_AUDIO" },
        { status: 400 }
      );
    }

    const wavBytes = new Uint8Array(await audioFile.arrayBuffer());
    const proposal = await processVoiceDictation(
      env.DB,
      (env as any).AI,
      auth.principal,
      {
        attemptId,
        wavBytes,
        targetKind,
        capturedAtMs,
      }
    );

    return NextResponse.json({ ok: true, proposal });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "VOICE_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
