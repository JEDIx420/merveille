import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { ArchiveService } from "@/server/domain/archive/service";
import { AuthorizationError } from "@/server/auth/policy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await ArchiveService.getArchivedProjectRecords(
      env.DB,
      auth.principal,
      id,
    );
    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    const status =
      err instanceof AuthorizationError ||
      err.code === "CROSS_PROJECT_DENIED" ||
      err.code === "FORBIDDEN"
        ? 403
        : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "REQUEST_ERROR" },
      { status },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: any = await request.json();
    const action = body.action;

    if (action === "archive") {
      const result = await ArchiveService.archiveProject(
        env.DB,
        auth.principal,
        {
          projectId: id,
          reason: body.reason,
          expectedRevision: body.expectedRevision,
          idempotencyKey: body.idempotencyKey,
        },
      );
      return NextResponse.json({ ok: true, result });
    }

    if (action === "reopen") {
      const result = await ArchiveService.reopenProject(
        env.DB,
        auth.principal,
        {
          projectId: id,
          reason: body.reason,
          expectedRevision: body.expectedRevision,
          idempotencyKey: body.idempotencyKey,
        },
      );
      return NextResponse.json({ ok: true, result });
    }

    if (action === "settle") {
      const result = await ArchiveService.settleArchivedInvoice(
        env.DB,
        auth.principal,
        {
          projectId: id,
          invoiceId: body.invoiceId,
          amountMinor: body.amountMinor,
          receiptId: body.receiptId,
          notes: body.notes,
          idempotencyKey: body.idempotencyKey,
        },
      );
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (err: any) {
    const status =
      err instanceof AuthorizationError ||
      err.code === "FORBIDDEN" ||
      err.code === "PROJECT_ARCHIVED_READ_ONLY"
        ? 403
        : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "ARCHIVE_ERROR" },
      { status },
    );
  }
}
