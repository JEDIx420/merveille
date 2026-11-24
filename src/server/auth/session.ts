import { UserPrincipal, UserRole } from "./principal";
import { validateAccessJwt, AccessJwtPayload } from "./jwt";
import { query, queryFirst } from "../db";
export interface ResolvedAuth {
  principal: UserPrincipal | null;
  status: "AUTHENTICATED" | "UNAUTHENTICATED" | "DISABLED" | "UNREGISTERED";
  error?: string;
  email?: string;
}
export function assertSameOrigin(request: Request, env: CloudflareEnv) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");

  if (
    !env.APP_ORIGIN ||
    !origin || origin !== new URL(env.APP_ORIGIN).origin
  )
    throw new Error("CROSS_ORIGIN_DENIED");
  // OpenNext may normalize the internal Request URL; the configured browser Origin is authoritative.
}
export async function verifiedIdentity(
  request: Request,
  env: CloudflareEnv,
): Promise<AccessJwtPayload | null> {
  try {
    assertSameOrigin(request, env);
  } catch {
    return null;
  }
  const result = await validateAccessJwt(
    request.headers.get("cf-access-jwt-assertion"),
    env,
  );
  return result.valid && result.payload ? result.payload : null;
}
export async function getSessionPrincipal(
  request: Request,
  env: CloudflareEnv,
): Promise<ResolvedAuth> {
  const identity = await verifiedIdentity(request, env);
  if (!identity) return { principal: null, status: "UNAUTHENTICATED" };
  const binding = await queryFirst<{ user_id: string }>(
    env.DB,
    "SELECT user_id FROM identities WHERE provider='cloudflare_access' AND issuer=? AND subject=?",
    [identity.iss, identity.sub],
  );
  if (!binding) return { principal: null, status: "UNREGISTERED" };
  const result = await loadPrincipalById(binding.user_id, env.DB);
  if (result.principal) result.principal.authenticatedAt = identity.iat * 1000;
  return result;
}
export async function loadPrincipalById(
  id: string,
  db: D1Database,
): Promise<ResolvedAuth> {
  const user = await queryFirst<any>(db, "SELECT * FROM users WHERE id=?", [
    id,
  ]);
  if (!user || user.status !== "ACTIVE")
    return {
      principal: null,
      status: user?.status === "DISABLED" ? "DISABLED" : "UNREGISTERED",
    };
  const org = await queryFirst<any>(
    db,
    "SELECT m.org_id FROM organization_memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=? AND m.is_active=1 AND o.status='ACTIVE'",
    [id],
  );
  if (!org) return { principal: null, status: "DISABLED" };
  const granted = await query<{ role: UserRole }>(
    db,
    "SELECT role FROM role_assignments WHERE user_id=? AND org_id=? AND revoked_at IS NULL AND scope='GLOBAL'",
    [id, org.org_id],
  );
  const intake = await queryFirst<any>(
    db,
    "SELECT id FROM role_assignments WHERE user_id=? AND org_id=? AND scope='INTAKE' AND revoked_at IS NULL",
    [id, org.org_id],
  );
  const roles = granted.map((r) =>
    r.role === "STAFF" ? "TEAM_MEMBER" : r.role,
  ) as UserRole[];
  const members = await query<any>(
    db,
    "SELECT m.*,p.main_client_user_id FROM project_memberships m JOIN projects p ON p.id=m.project_id AND p.org_id=m.org_id WHERE m.user_id=? AND m.org_id=? AND m.is_active=1",
    [id, org.org_id],
  );
  const grouped = new Map<string, any>();
  for (const m of members) {
    const current = grouped.get(m.project_id) ?? {
      projectId: m.project_id,
      projectRole: m.project_role,
      roles: [],
      financeAccess: false,
      financeAuthor: false,
      invoiceIssue: false,
      contractualAuthority: false,
    };
    current.roles.push(
      m.project_role === "STAFF" ? "TEAM_MEMBER" : m.project_role,
    );
    current.financeAccess ||= !!m.finance_access;
    current.financeAuthor ||= !!m.finance_author;
    current.invoiceIssue ||= !!m.invoice_issue;
    current.contractualAuthority ||=
      m.project_role === "MAIN_CLIENT" && m.main_client_user_id === id;
    grouped.set(m.project_id, current);
  }
  // role is retained for legacy presentation only; no default grants are created.
  return {
    principal: {
      id: user.id,
      email: user.email,
      name: user.display_name,
      orgId: org.org_id,
      roles,
      intakeAccess:
        !!intake || roles.includes("TEAM_MEMBER") || roles.includes("MANAGER"),
      role: roles[0] ?? members[0]?.project_role ?? "CLIENT_REP",
      projectMemberships: [...grouped.values()],
    },
    status: "AUTHENTICATED",
  };
}
/** Used by controlled recovery tooling, never as a request identity binding. */
export async function loadPrincipalByEmail(
  email: string,
  db: D1Database,
): Promise<ResolvedAuth> {
  const user = await queryFirst<any>(
    db,
    "SELECT id FROM users WHERE lower(email)=?",
    [email.toLowerCase().trim()],
  );
  return user
    ? loadPrincipalById(user.id, db)
    : { principal: null, status: "UNREGISTERED" };
}
