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

  try {
    const rows = (await env.DB
      .prepare(
        `SELECT ap.*, u.display_name as closed_by_name
         FROM accounting_periods ap
         LEFT JOIN users u ON ap.closed_by_user_id = u.id
         ORDER BY ap.start_date DESC`
      )
      .all()) as any;

    return NextResponse.json({ ok: true, periods: rows.results || [] });
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
    const action = body.action || "CREATE";

    if (action === "CREATE") {
      const result = await AccountingService.createAccountingPeriod(
        env.DB,
        auth.principal,
        {
          periodLabel: body.periodLabel,
          startDate: body.startDate,
          endDate: body.endDate,
        }
      );
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    } else if (action === "CLOSE") {
      const result = await AccountingService.closeAccountingPeriod(
        env.DB,
        auth.principal,
        body.periodId
      );
      return NextResponse.json({ ok: true, ...result });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
