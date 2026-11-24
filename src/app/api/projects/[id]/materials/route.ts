import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { MaterialsService } from "@/server/domain/materials/service";
import { assertProjectAccess } from "@/server/auth/policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: projectId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertProjectAccess(auth.principal, projectId);
    const references = await MaterialsService.listReferences(
      env.DB,
      auth.principal,
      projectId,
    );
    const selectionItems = await MaterialsService.listSelectionItems(
      env.DB,
      auth.principal,
      projectId,
    );

    return NextResponse.json({
      ok: true,
      references,
      selectionItems,
    });
  } catch (err: any) {
    const status =
      err.code === "CROSS_PROJECT_DENIED" || err.code === "FORBIDDEN"
        ? 403
        : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      case "add_reference": {
        const result = await MaterialsService.addReference(
          env.DB,
          auth.principal,
          {
            projectId,
            caption: body.caption,
            fileId: body.fileId,
            externalUrl: body.externalUrl,
            roomArea: body.roomArea,
            category: body.category,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      case "add_reference_comment": {
        const result = await MaterialsService.addReferenceComment(
          env.DB,
          auth.principal,
          {
            referenceId: body.referenceId,
            commentText: body.commentText,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      case "create_selection": {
        const result = await MaterialsService.createSelectionItem(
          env.DB,
          auth.principal,
          {
            projectId,
            title: body.title,
            location: body.location,
            question: body.question,
            neededByDate: body.neededByDate,
            internalNotes: body.internalNotes,
            options: body.options,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      case "select_option": {
        const result = await MaterialsService.selectOption(
          env.DB,
          auth.principal,
          {
            selectionItemId: body.selectionItemId,
            optionId: body.optionId,
            comment: body.comment,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      case "record_suggestion": {
        const result = await MaterialsService.recordSuggestion(
          env.DB,
          auth.principal,
          {
            selectionItemId: body.selectionItemId,
            optionId: body.optionId,
            suggestionType: body.suggestionType,
            commentText: body.commentText,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      case "mark_ready": {
        const result = await MaterialsService.markReadyForExecution(
          env.DB,
          auth.principal,
          body.selectionItemId,
        );
        return NextResponse.json({ ok: true, result });
      }

      case "link_change": {
        const result = await MaterialsService.linkChangeRequest(
          env.DB,
          auth.principal,
          {
            selectionItemId: body.selectionItemId,
            changeRequestId: body.changeRequestId,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      case "request_changes": {
        const result = await MaterialsService.requestChanges(
          env.DB,
          auth.principal,
          {
            selectionItemId: body.selectionItemId,
            reason: body.reason,
          },
        );
        return NextResponse.json({ ok: true, result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    const status =
      err.code === "CROSS_PROJECT_DENIED" ||
      err.code === "FORBIDDEN" ||
      err.code === "MAIN_CLIENT_SELECTION_REQUIRED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}
