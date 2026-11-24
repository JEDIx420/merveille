import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { getDrawing, createDrawingVersion, withdrawDrawing } from "@/server/domain/drawings/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: drawingId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getDrawing(auth.principal, drawingId, env.DB);
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "FORBIDDEN" },
      { status }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: drawingId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as any;
    const action = body.action;

    switch (action) {
      case "CREATE_VERSION": {
        const result = await createDrawingVersion(
          auth.principal,
          {
            drawingId,
            versionLabel: body.versionLabel,
            fileId: body.fileId,
            cadFileId: body.cadFileId,
            submissionNote: body.submissionNote,
            requiredConsultantIds: body.requiredConsultantIds || [],
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result }, { status: 201 });
      }

      case "WITHDRAW": {
        const result = await withdrawDrawing(
          auth.principal,
          {
            drawingId,
            reason: body.reason || "Drawing withdrawn by manager",
          },
          env.DB
        );
        return NextResponse.json({ ok: true, ...result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    const status = err.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: err.message, code: err.code || "OPERATION_FAILED" },
      { status }
    );
  }
}
