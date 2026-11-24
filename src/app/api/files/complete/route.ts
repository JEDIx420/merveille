import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { completeUploadSession, abortUploadSession } from "@/server/files/service";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    if (body.action === "ABORT") {
      const result = await abortUploadSession(auth.principal, body.sessionId, env.DB, env.PROJECT_FILES);
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await completeUploadSession(
      auth.principal,
      {
        sessionId: body.sessionId,
        parts: body.parts,
      },
      env.DB,
      env.PROJECT_FILES
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
