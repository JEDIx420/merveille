import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import { hasCapability } from "@/server/auth/principal";
import { canViewFinancials } from "@/server/auth/policy";
export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal: p } = await getSessionPrincipal(request, env);
  if (!p)
    return NextResponse.json(
      { error: "Sign in to continue." },
      { status: 401 },
    );
  const global = hasCapability(p, "ADMIN") || hasCapability(p, "OWNER");
  const rows = await env.DB.prepare(
    `SELECT p.id,p.code,p.name,p.status,p.is_archived,p.archive_reason,p.archived_at,
 (SELECT COUNT(DISTINCT d.id) FROM drawings d JOIN drawing_versions v ON v.drawing_id=d.id WHERE d.project_id=p.id AND v.status IN('RELEASED','SUPERSEDED') AND v.released_at IS NOT NULL AND d.is_withdrawn=0) AS drawing_count,
 (SELECT COUNT(*) FROM invoices i WHERE i.project_id=p.id AND i.status='ISSUED' AND i.outstanding_minor>0) AS unpaid_invoices_count,
 (SELECT COALESCE(SUM(i.outstanding_minor),0) FROM invoices i WHERE i.project_id=p.id AND i.status='ISSUED' AND i.outstanding_minor>0) AS total_unpaid_minor
 FROM projects p WHERE p.org_id=? AND p.is_archived=1 ${global ? "" : "AND EXISTS(SELECT 1 FROM project_memberships m WHERE m.project_id=p.id AND m.org_id=p.org_id AND m.user_id=? AND m.is_active=1)"} ORDER BY p.archived_at DESC`,
  )
    .bind(...(global ? [p.orgId] : [p.orgId, p.id]))
    .all<any>();
  const projects = (rows.results || []).map((row) =>
    canViewFinancials(p, row.id, "CLIENT_COMMERCIAL")
      ? row
      : { ...row, unpaid_invoices_count: null, total_unpaid_minor: null },
  );
  return NextResponse.json({ ok: true, projects });
}
