import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { UpdatesService } from "@/server/domain/updates/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { updateId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const action = body.action;

    switch (action) {
      case "CREATE_VERSION": {
        const result = await UpdatesService.createUpdateVersion(
          env.DB,
          auth.principal,
          {
            updateId,
            title: body.title,
            bodyText: body.bodyText,
            observedDate: body.observedDate,
            fileIds: body.fileIds,
          },
        );
        return NextResponse.json({ ok: true, ...result }, { status: 201 });
      }

      case "SUBMIT_REVIEW": {
        const result = await UpdatesService.submitUpdateForReview(
          env.DB,
          auth.principal,
          body.versionId,
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "RETURN": {
        const result = await UpdatesService.returnUpdate(
          env.DB,
          auth.principal,
          {
            versionId: body.versionId,
            feedback: body.feedback,
          },
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "PUBLISH": {
        const result = await UpdatesService.publishUpdate(
          env.DB,
          auth.principal,
          body.versionId,
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "RETRACT": {
        const result = await UpdatesService.retractUpdate(
          env.DB,
          auth.principal,
          {
            updateId,
            reason: body.reason,
          },
        );
        return NextResponse.json({ ok: true, ...result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err: any) {
    const status =
      err.code === "FORBIDDEN" || err.code === "CROSS_PROJECT_DENIED"
        ? 403
        : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}
