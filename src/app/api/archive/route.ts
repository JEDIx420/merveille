import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);

  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = auth.principal;

  try {
    let sql = "";
    let params: any[] = [];

    if (p.role === "OWNER" || p.role === "ADMIN") {
      sql = `SELECT p.id, p.code, p.name, p.status, p.is_archived, p.archive_reason, p.archived_at,
                    (SELECT COUNT(*) FROM drawings d WHERE d.project_id = p.id) as drawing_count,
                    (SELECT COUNT(*) FROM invoices inv WHERE inv.project_id = p.id AND inv.status = 'ISSUED' AND inv.outstanding_minor > 0) as unpaid_invoices_count,
                    (SELECT COALESCE(SUM(inv.outstanding_minor), 0) FROM invoices inv WHERE inv.project_id = p.id AND inv.status = 'ISSUED' AND inv.outstanding_minor > 0) as total_unpaid_minor
             FROM projects p
             WHERE p.org_id = ? AND (p.is_archived = 1 OR p.status = 'ARCHIVED')
             ORDER BY p.archived_at DESC, p.name ASC`;
      params = [p.orgId];
    } else {
      sql = `SELECT p.id, p.code, p.name, p.status, p.is_archived, p.archive_reason, p.archived_at,
                    pm.project_role,
                    (SELECT COUNT(*) FROM drawings d WHERE d.project_id = p.id) as drawing_count,
                    (SELECT COUNT(*) FROM invoices inv WHERE inv.project_id = p.id AND inv.status = 'ISSUED' AND inv.outstanding_minor > 0) as unpaid_invoices_count,
                    (SELECT COALESCE(SUM(inv.outstanding_minor), 0) FROM invoices inv WHERE inv.project_id = p.id AND inv.status = 'ISSUED' AND inv.outstanding_minor > 0) as total_unpaid_minor
             FROM projects p
             JOIN project_memberships pm ON pm.project_id = p.id AND pm.user_id = ? AND pm.is_active = 1
             WHERE p.org_id = ? AND (p.is_archived = 1 OR p.status = 'ARCHIVED')
             ORDER BY p.archived_at DESC, p.name ASC`;
      params = [p.id, p.orgId];
    }

    const rows = await env.DB.prepare(sql).bind(...params).all();
    return NextResponse.json({ ok: true, projects: rows.results || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, code: err.code || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
