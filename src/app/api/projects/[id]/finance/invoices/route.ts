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
    const invoices = (await env.DB.prepare(
      `SELECT inv.*, u.display_name as creator_name, iss.display_name as issuer_name
         FROM invoices inv
         JOIN users u ON inv.created_by_user_id = u.id
         LEFT JOIN users iss ON inv.issued_by_user_id = iss.id
         WHERE inv.project_id = ?
         ORDER BY inv.created_at DESC`,
    )
      .bind(projectId)
      .all()) as any;

    const internal = canReadInternalNotes(auth.principal, projectId);
    const list = (invoices.results || []).filter(
      (i: any) => internal || i.status === "ISSUED",
    );
    for (const inv of list) {
      const versions = (await env.DB.prepare(
        `SELECT iv.*, app.display_name as approver_name
           FROM invoice_versions iv
           LEFT JOIN users app ON iv.approved_by_user_id = app.id
           WHERE iv.invoice_id = ?
           ORDER BY iv.version_number DESC`,
      )
        .bind(inv.id)
        .all()) as any;

      for (const ver of versions.results || []) {
        const lineItems = (await env.DB.prepare(
          `SELECT * FROM invoice_line_items WHERE invoice_version_id = ?`,
        )
          .bind(ver.id)
          .all()) as any;
        ver.lineItems = lineItems.results || [];
      }
      inv.versions = (versions.results || []).filter(
        (v: any) => internal || v.version_number === inv.issued_version_number,
      );
      if (!internal) for (const v of inv.versions) delete v.notes;
    }

    return NextResponse.json({ ok: true, invoices: list });
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
    const result = await FinanceService.draftInvoice(env.DB, auth.principal, {
      projectId,
      scheduleItemId: body.scheduleItemId,
      dueDate: body.dueDate,
      notes: body.notes,
      currency: body.currency,
      lineItems: body.lineItems,
    });
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
