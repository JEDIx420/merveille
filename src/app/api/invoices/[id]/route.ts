import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { FinanceService } from "@/server/domain/finance/service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  const { id: invoiceId } = await params;

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const action = body.action;

    switch (action) {
      case "EDIT": {
        const result = await FinanceService.editDraftInvoice(
          env.DB,
          auth.principal,
          {
            invoiceId,
            lineItems: body.lineItems,
            dueDate: body.dueDate,
            notes: body.notes,
            expectedVersion: body.expectedVersion,
          },
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "APPROVE": {
        const result = await FinanceService.approveInvoice(
          env.DB,
          auth.principal,
          {
            invoiceId,
            versionNumber: body.versionNumber,
          },
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "ISSUE": {
        const result = await FinanceService.issueInvoice(
          env.DB,
          auth.principal,
          {
            invoiceId,
            versionNumber: body.versionNumber,
            idempotencyKey: body.idempotencyKey,
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
    const status = err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: publicError(err), code: err.code || "BAD_REQUEST" },
      { status },
    );
  }
}
