import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { SnagsService } from "@/server/domain/snags/service";
import { assertProjectAccess } from "@/server/auth/policy";

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
    assertProjectAccess(auth.principal, projectId);
    const snags = await SnagsService.listSnags(env.DB, auth.principal, projectId);
    return NextResponse.json({ ok: true, snags });
  } catch (err: any) {
    const status = err.code === "CROSS_PROJECT_DENIED" || err.code === "FORBIDDEN" ? 403 : 400;
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
    assertProjectAccess(auth.principal, projectId);
    const body = (await request.json()) as any;
    const action = body.action;

    switch (action) {
      case "report": {
        const result = await SnagsService.reportSnag(env.DB, auth.principal, {
          projectId,
          title: body.title,
          description: body.description,
          locationArea: body.locationArea,
          severity: body.severity,
          relatedDrawingId: body.relatedDrawingId,
          fileIds: body.fileIds,
          caption: body.caption,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "triage": {
        const result = await SnagsService.triageSnag(env.DB, auth.principal, {
          snagId: body.snagId,
          severity: body.severity,
          assignedToUserId: body.assignedToUserId,
          targetDate: body.targetDate,
          isClientShared: body.isClientShared,
          isChargedWork: body.isChargedWork,
          changeRequestId: body.changeRequestId,
          internalCostMinor: body.internalCostMinor,
          internalNotes: body.internalNotes,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "start_work": {
        const result = await SnagsService.startSnagWork(
          env.DB,
          auth.principal,
          body.snagId
        );
        return NextResponse.json({ ok: true, result });
      }

      case "submit_resolution": {
        const result = await SnagsService.submitResolution(env.DB, auth.principal, {
          snagId: body.snagId,
          resolutionEvidence: body.resolutionEvidence,
          afterPhotoFileIds: body.afterPhotoFileIds,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "verify_close": {
        const result = await SnagsService.verifyCloseSnag(env.DB, auth.principal, {
          snagId: body.snagId,
          notes: body.notes,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "reopen": {
        const result = await SnagsService.reopenSnag(env.DB, auth.principal, {
          snagId: body.snagId,
          reason: body.reason,
          newTargetDate: body.newTargetDate,
          newAssigneeId: body.newAssigneeId,
        });
        return NextResponse.json({ ok: true, result });
      }

      case "comment": {
        const result = await SnagsService.addComment(env.DB, auth.principal, {
          snagId: body.snagId,
          commentText: body.commentText,
          isInternalOnly: body.isInternalOnly,
        });
        return NextResponse.json({ ok: true, result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    const status =
      err.code === "CROSS_PROJECT_DENIED" ||
      err.code === "FORBIDDEN" ||
      err.code === "INVALID_ASSIGNEE"
        ? 403
        : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
