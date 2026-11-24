import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { initUploadSession } from "@/server/files/service";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const session = await initUploadSession(
      auth.principal,
      {
        projectId: body.projectId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        fileClass: body.fileClass,
        isInternalOnly: body.isInternalOnly,
        referenceType: body.referenceType,
        referenceId: body.referenceId,
        isSettlementEvidence: body.isSettlementEvidence,
      },
      env.DB,
      env.PROJECT_FILES
    );
    return NextResponse.json({ ok: true, ...session }, { status: 201 });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
