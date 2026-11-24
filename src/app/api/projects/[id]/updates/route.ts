import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { UpdatesService } from "@/server/domain/updates/service";
import { canReadInternalNotes } from "@/server/auth/policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updates = await UpdatesService.listProjectUpdates(env.DB, auth.principal, projectId);
    let internalNotes: any[] = [];
    if (canReadInternalNotes(auth.principal, projectId)) {
      internalNotes = await UpdatesService.listInternalNotes(env.DB, auth.principal, projectId);
    }

    return NextResponse.json({ ok: true, updates, internalNotes });
  } catch (err: any) {
    const status = err.code === "CROSS_PROJECT_DENIED" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
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
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    if (body.type === "INTERNAL_NOTE") {
      const result = await UpdatesService.createInternalNote(env.DB, auth.principal, {
        projectId,
        title: body.title,
        bodyText: body.bodyText,
        attachmentFileId: body.attachmentFileId,
        isConfidential: Boolean(body.isConfidential),
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    } else {
      const result = await UpdatesService.createProjectUpdate(env.DB, auth.principal, {
        projectId,
        stageId: body.stageId,
        title: body.title,
        bodyText: body.bodyText,
        observedDate: body.observedDate,
        fileIds: body.fileIds,
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" || err.code === "CROSS_PROJECT_DENIED" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
