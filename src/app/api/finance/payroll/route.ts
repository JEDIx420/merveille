import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { AccountingService } from "@/server/domain/accounting/service";
import { canViewPayrollAndProfit } from "@/server/auth/policy";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // STRICT ADMIN ONLY (AC-005, AC-035)
  if (!canViewPayrollAndProfit(auth.principal)) {
    return NextResponse.json(
      { error: "Access denied: Payroll is strictly restricted to administrators", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  try {
    const rows = (await env.DB
      .prepare(
        `SELECT pr.*, u.display_name as employee_name, p.name as project_name
         FROM payroll_records pr
         JOIN users u ON pr.user_id = u.id
         LEFT JOIN projects p ON pr.project_id = p.id
         ORDER BY pr.period_month DESC, pr.created_at DESC`
      )
      .all()) as any;

    return NextResponse.json({ ok: true, payroll: rows.results || [] });
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
    const result = await AccountingService.recordPayroll(
      env.DB,
      auth.principal,
      {
        projectId: body.projectId,
        userId: body.userId,
        periodMonth: body.periodMonth,
        grossSalaryMinor: body.grossSalaryMinor,
        currency: body.currency,
      }
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err: any) {
    const status = err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      { error: err.message, code: err.code || "BAD_REQUEST" },
      { status }
    );
  }
}
