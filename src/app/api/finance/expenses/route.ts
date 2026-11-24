import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { AccountingService } from "@/server/domain/accounting/service";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || undefined;

  try {
    let sql = `SELECT e.*, u.display_name as submitter_name, app.display_name as approver_name, p.name as project_name
               FROM expenses e
               JOIN users u ON e.submitted_by_user_id = u.id
               LEFT JOIN users app ON e.approved_by_user_id = app.id
               LEFT JOIN projects p ON e.project_id = p.id`;
    const params: any[] = [];
    if (projectId) {
      sql += ` WHERE e.project_id = ?`;
      params.push(projectId);
    }
    sql += ` ORDER BY e.created_at DESC`;

    const rows = (await env.DB.prepare(sql).bind(...params).all()) as any;
    return NextResponse.json({ ok: true, expenses: rows.results || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    const action = body.action || "SUBMIT";

    switch (action) {
      case "SUBMIT": {
        const result = await AccountingService.submitExpense(
          env.DB,
          auth.principal,
          {
            projectId: body.projectId,
            category: body.category,
            description: body.description,
            supplierName: body.supplierName,
            amountMinor: body.amountMinor,
            currency: body.currency,
            incurredDate: body.incurredDate,
            evidenceFileId: body.evidenceFileId,
          }
        );
        return NextResponse.json({ ok: true, ...result }, { status: 201 });
      }

      case "APPROVE": {
        const result = await AccountingService.approveExpense(
          env.DB,
          auth.principal,
          body.expenseId
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "POST": {
        const result = await AccountingService.postExpense(
          env.DB,
          auth.principal,
          body.expenseId
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
    const status = err.code === "FORBIDDEN" || err.code === "CLOSED_PERIOD_WRITE_DENIED" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
