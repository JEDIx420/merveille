import { publicError } from "@/server/http/errors";
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { FinanceService } from "@/server/domain/finance/service";
import {
  assertProjectAccess,
  canViewFinancials,
  canReadInternalNotes,
  hasCapability,
  AuthorizationError,
} from "@/server/auth/policy";

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
    if (!canViewFinancials(auth.principal, projectId, "CLIENT_COMMERCIAL"))
      throw new AuthorizationError("Financial access is not granted.");
    const scope = await env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND org_id=?",
    )
      .bind(projectId, auth.principal.orgId)
      .first();
    if (!scope) throw new AuthorizationError("Project not found.", "NOT_FOUND");
    const schedules = (await env.DB.prepare(
      `SELECT ps.*, u.display_name as creator_name
         FROM payment_schedules ps
         JOIN users u ON ps.created_by_user_id = u.id
         WHERE ps.project_id = ?
         ORDER BY ps.version_number DESC`,
    )
      .bind(projectId)
      .all()) as any;

    const list = schedules.results || [];
    for (const sch of list) {
      const items = (await env.DB.prepare(
        `SELECT * FROM payment_schedule_items WHERE schedule_id = ? ORDER BY item_order ASC`,
      )
        .bind(sch.id)
        .all()) as any;
      sch.items = items.results || [];
    }

    return NextResponse.json({ ok: true, schedules: list });
  } catch (err: any) {
    const status = err.code === "CROSS_PROJECT_DENIED" ? 403 : 400;
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
    const body = (await request.json()) as any;
    const result = await FinanceService.createOrReviseSchedule(
      env.DB,
      auth.principal,
      {
        projectId,
        quotationId: body.quotationId,
        reason: body.reason,
        items: body.items,
      },
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
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
