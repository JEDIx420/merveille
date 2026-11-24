import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  assertProjectAccess,
  canReadInternalNotes,
} from "@/server/auth/policy";
import { query } from "@/server/db";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { env } = await getCloudflareContext({ async: true });
  const { principal } = await getSessionPrincipal(request, env);
  if (!principal)
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const { id } = await params;
    assertProjectAccess(principal, id);
    if (!canReadInternalNotes(principal, id))
      throw new Error("Only project staff can select participants.");
    const rows = await query<any>(
      env.DB,
      `SELECT u.id,u.display_name AS name,m.project_role FROM project_memberships m JOIN users u ON u.id=m.user_id JOIN organization_memberships om ON om.user_id=u.id AND om.org_id=m.org_id WHERE m.org_id=? AND m.project_id=? AND m.is_active=1 AND om.is_active=1 AND u.status='ACTIVE'`,
      [principal.orgId, id],
    );
    const grouped = new Map<string, any>();
    for (const r of rows) {
      const p = grouped.get(r.id) ?? { id: r.id, name: r.name, roles: [] };
      p.roles.push(r.project_role);
      grouped.set(r.id, p);
    }
    return Response.json({ participants: [...grouped.values()] });
  } catch {
    return Response.json(
      { error: "You cannot access participants for this project." },
      { status: 403 },
    );
  }
}
