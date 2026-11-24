import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { FinanceService } from "@/server/domain/finance/service";
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
    const receipts = (await env.DB
      .prepare(
        `SELECT r.*, rep.display_name as reporter_name, conf.display_name as confirmer_name
         FROM receipts r
         JOIN users rep ON r.reported_by_user_id = rep.id
         LEFT JOIN users conf ON r.confirmed_by_user_id = conf.id
         WHERE r.project_id = ?
         ORDER BY r.created_at DESC`
      )
      .bind(projectId)
      .all()) as any;

    const list = receipts.results || [];
    for (const r of list) {
      const allocations = (await env.DB
        .prepare(
          `SELECT ra.*, inv.invoice_number, u.display_name as allocator_name
           FROM receipt_allocations ra
           JOIN invoices inv ON ra.invoice_id = inv.id
           JOIN users u ON ra.allocated_by_user_id = u.id
           WHERE ra.receipt_id = ?`
        )
        .bind(r.id)
        .all()) as any;
      r.allocations = allocations.results || [];
    }

    return NextResponse.json({ ok: true, receipts: list });
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
    const action = body.action || "REPORT";

    switch (action) {
      case "REPORT": {
        const result = await FinanceService.reportReceipt(
          env.DB,
          auth.principal,
          {
            projectId,
            amountMinor: body.amountMinor,
            receivedDate: body.receivedDate,
            paymentMethod: body.paymentMethod,
            referenceNote: body.referenceNote,
            evidenceFileId: body.evidenceFileId,
            idempotencyKey: body.idempotencyKey,
          }
        );
        return NextResponse.json({ ok: true, ...result }, { status: 201 });
      }

      case "CONFIRM": {
        const result = await FinanceService.confirmReceipt(
          env.DB,
          auth.principal,
          {
            receiptId: body.receiptId,
            idempotencyKey: body.idempotencyKey,
          }
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "ALLOCATE": {
        const result = await FinanceService.allocateReceipt(
          env.DB,
          auth.principal,
          {
            receiptId: body.receiptId,
            invoiceId: body.invoiceId,
            amountMinor: body.amountMinor,
          }
        );
        return NextResponse.json({ ok: true, ...result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" || err.code === "CROSS_PROJECT_DENIED" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
