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
    const quotes = (await env.DB
      .prepare(
        `SELECT q.*, u.display_name as creator_name, acc.display_name as accepted_by_name
         FROM quotations q
         JOIN users u ON q.created_by_user_id = u.id
         LEFT JOIN users acc ON q.accepted_by_user_id = acc.id
         WHERE q.project_id = ?
         ORDER BY q.version_number DESC`
      )
      .bind(projectId)
      .all()) as any;

    const list = quotes.results || [];
    for (const q of list) {
      const items = (await env.DB
        .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY item_order ASC`)
        .bind(q.id)
        .all()) as any;
      q.items = items.results || [];
    }

    return NextResponse.json({ ok: true, quotations: list });
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
    const action = body.action || "CREATE";

    if (action === "ACCEPT") {
      const result = await FinanceService.acceptQuotation(
        env.DB,
        auth.principal,
        body.quotationId
      );
      return NextResponse.json({ ok: true, ...result });
    } else {
      const result = await FinanceService.createQuotation(
        env.DB,
        auth.principal,
        {
          projectId,
          title: body.title,
          currency: body.currency,
          requiredAdvanceMinor: body.requiredAdvanceMinor,
          items: body.items,
        }
      );
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
