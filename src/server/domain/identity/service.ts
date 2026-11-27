import {
  UserPrincipal,
  UserRole,
  hasCapability,
} from "@/server/auth/principal";
import {
  canManagePeopleAndAccess,
  AuthorizationError,
} from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { AccessJwtPayload } from "@/server/auth/jwt";
import { QuotaService } from "@/server/quota/service";
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const normalize = (email: string) => email.trim().toLowerCase();
const allowed = new Set([
  "ADMIN",
  "OWNER",
  "MANAGER",
  "TEAM_MEMBER",
  "CONSULTANT",
  "MAIN_CLIENT",
  "CLIENT_REP",
]);
export interface ProjectAccess {
  projectId: string;
  roles: UserRole[];
  financeAccess?: boolean;
  financeAuthor?: boolean;
  invoiceIssue?: boolean;
  contractualAuthority?: boolean;
}
export interface InviteUserInput {
  email: string;
  displayName: string;
  role?: UserRole;
  projectId?: string;
  roles?: UserRole[];
  projects?: ProjectAccess[];
  confirmElevation?: boolean;
}
export interface ReassignMainClientInput {
  projectId: string;
  newUserId: string;
  reason: string;
}
export async function digestToken(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function token() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function admin(actor: UserPrincipal) {
  if (!canManagePeopleAndAccess(actor))
    throw new AuthorizationError(
      "Administrator access is required.",
      "ADMIN_REQUIRED",
    );
}
function recent(actor: UserPrincipal, confirmed?: boolean) {
  if (
    !confirmed ||
    !actor.authenticatedAt ||
    Date.now() - actor.authenticatedAt > 15 * 60 * 1000
  )
    throw new AuthorizationError(
      "Confirm the elevation after signing in again.",
      "RECENT_AUTH_REQUIRED",
    );
}
function assertion(db: D1Database, predicate: string, params: any[] = []) {
  return db
    .prepare(
      `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN (${predicate}) THEN 1 ELSE 0 END`,
    )
    .bind(id("guard"), ...params);
}
function auditStatement(db: D1Database, event: any) {
  return db
    .prepare(
      `INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,scope,old_state,new_state,reason,created_at) VALUES(?,?,?,?,?,?,'ORGANIZATION',?,?,?,?)`,
    )
    .bind(
      id("aud"),
      event.orgId,
      event.actorId,
      event.entityType,
      event.entityId,
      event.action,
      event.oldState ? JSON.stringify(event.oldState) : null,
      event.newState ? JSON.stringify(event.newState) : null,
      event.reason ?? null,
      Date.now(),
    );
}
export async function recordAuditEvent(
  db: D1Database,
  event: {
    orgId: string;
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    scope?: string;
    oldState?: any;
    newState?: any;
    reason?: string;
  },
) {
  await auditStatement(db, event).run();
}
async function rateLimit(db: D1Database, key: string, max = 20) {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO security_rate_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start<? THEN 1 ELSE count+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`,
    )
    .bind(key, now, now - 3600000, now - 3600000)
    .run();
  const row = await queryFirst<any>(
    db,
    "SELECT count FROM security_rate_limits WHERE key=?",
    [key],
  );
  if (row.count > max)
    throw new AuthorizationError(
      "Too many attempts. Try again later.",
      "RATE_LIMITED",
    );
}
async function validateGrants(
  db: D1Database,
  orgId: string,
  roles: UserRole[],
  projects: ProjectAccess[],
) {
  if (
    roles.some((r) => !["ADMIN", "OWNER", "TEAM_MEMBER", "MANAGER"].includes(r))
  )
    throw new AuthorizationError(
      "Operational roles must be assigned to specific projects.",
      "INVALID_INPUT",
    );
  for (const p of projects) {
    if (
      !p.projectId ||
      !Array.isArray(p.roles) ||
      p.roles.some((r) => !allowed.has(r) || ["ADMIN", "OWNER"].includes(r))
    )
      throw new AuthorizationError(
        "Choose valid project roles.",
        "INVALID_INPUT",
      );
    if (
      (p.financeAuthor || p.invoiceIssue) &&
      !p.roles.some((r) => r === "TEAM_MEMBER" || r === "MANAGER")
    )
      throw new AuthorizationError(
        "Finance authoring and invoice issue require a team member or manager project grant.",
        "INVALID_INPUT",
      );
    if (p.contractualAuthority && !p.roles.includes("MAIN_CLIENT"))
      throw new AuthorizationError(
        "Contractual authority requires a main-client project grant.",
        "INVALID_INPUT",
      );
    const project = await queryFirst<any>(
      db,
      "SELECT id FROM projects WHERE id=? AND org_id=?",
      [p.projectId, orgId],
    );
    if (!project)
      throw new AuthorizationError("Project not found.", "NOT_FOUND");
  }
}
export async function inviteUser(
  actor: UserPrincipal,
  input: InviteUserInput,
  db: D1Database,
) {
  admin(actor);
  await rateLimit(db, `invite:${actor.id}`);
  const email = normalize(input.email ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !input.displayName?.trim())
    throw new AuthorizationError(
      "Enter a name and valid email.",
      "INVALID_INPUT",
    );
  const roles =
    input.roles ??
    (input.role && ["ADMIN", "OWNER"].includes(input.role) ? [input.role] : []);
  const projects =
    input.projects ??
    (input.projectId && input.role
      ? [{ projectId: input.projectId, roles: [input.role] }]
      : []);
  await validateGrants(db, actor.orgId, roles, projects);
  if (roles.some((r) => ["ADMIN", "OWNER"].includes(r)))
    recent(actor, input.confirmElevation);
  const existing = await queryFirst<any>(
    db,
    "SELECT status FROM users WHERE lower(email)=?",
    [email],
  );
  if (existing?.status === "DISABLED")
    throw new AuthorizationError(
      "A disabled account requires a deliberate recovery.",
      "ACCOUNT_DISABLED",
    );
  await QuotaService.assertAccessSeatAvailable(db, actor.orgId, email);
  const raw = token(),
    invitationId = id("inv"),
    now = Date.now(),
    expiresAt = now + 72 * 3600000;
  await db.batch([
    assertion(
      db,
      `EXISTS(SELECT 1 FROM role_assignments r JOIN users u ON u.id=r.user_id JOIN organization_memberships m ON m.user_id=u.id AND m.org_id=r.org_id WHERE r.user_id=? AND r.org_id=? AND r.role='ADMIN' AND r.revoked_at IS NULL AND u.status='ACTIVE' AND m.is_active=1)`,
      [actor.id, actor.orgId],
    ),
    db
      .prepare(
        `INSERT INTO invitations(id,org_id,email,display_name,intended_role,token,status,expires_at,created_by,created_at,grants_json,admission_status) VALUES(?,?,?,?,'EXPLICIT',?,'PENDING',?,?,?,?,'PENDING_SETUP')`,
      )
      .bind(
        invitationId,
        actor.orgId,
        email,
        input.displayName.trim(),
        await digestToken(raw),
        expiresAt,
        actor.id,
        now,
        JSON.stringify({ roles, projects }),
      ),
    db
      .prepare(
        `INSERT INTO access_admission_jobs(id,org_id,email,desired_state,created_at) VALUES(?,?,?,'ALLOW',?)`,
      )
      .bind(id("edge"), actor.orgId, email, now),
    auditStatement(db, {
      orgId: actor.orgId,
      actorId: actor.id,
      entityType: "INVITATION",
      entityId: invitationId,
      action: "INVITATION_CREATED",
      newState: { roles, projects, expiresAt },
    }),
  ]);
  return {
    invitationId,
    invitationUrl: `/invite/accept#token=${raw}`,
    expiresAt,
    admissionStatus: "PENDING_SETUP",
    deliveryStatus: "COPY_LINK",
  };
}
function grantStatements(
  db: D1Database,
  userId: string,
  orgId: string,
  roles: UserRole[],
  projects: ProjectAccess[],
  actorId: string,
) {
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (const role of roles)
    statements.push(
      db
        .prepare(
          `INSERT INTO role_assignments(id,org_id,user_id,role,scope,granted_by,granted_at) VALUES(?,?,?,?,'GLOBAL',?,?)`,
        )
        .bind(id("role"), orgId, userId, role, actorId, now),
    );
  for (const p of projects)
    for (const role of p.roles) {
      statements.push(
        db
          .prepare(
            `INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at,finance_access,finance_author,invoice_issue) VALUES(?,?,?,?,?,1,?,?,?,?)`,
          )
          .bind(
            id("pm"),
            orgId,
            p.projectId,
            userId,
            role,
            now,
            Number(!!p.financeAccess),
            Number(!!p.financeAuthor),
            Number(!!p.invoiceIssue),
          ),
      );
      if (role === "MAIN_CLIENT" && p.contractualAuthority)
        statements.push(
          db
            .prepare(
              "UPDATE projects SET main_client_user_id=?,revision=revision+1 WHERE id=? AND org_id=?",
            )
            .bind(userId, p.projectId, orgId),
        );
    }
  return statements;
}
export async function acceptInvitation(
  rawToken: string,
  identity: AccessJwtPayload,
  db: D1Database,
) {
  if (!identity || typeof identity !== "object")
    throw new AuthorizationError(
      "Verified Cloudflare Access sign-in is required.",
      "UNAUTHENTICATED",
    );
  await rateLimit(db, `accept:${identity.sub}`, 30);
  const inv = await queryFirst<any>(
    db,
    "SELECT * FROM invitations WHERE token=?",
    [await digestToken(rawToken)],
  );
  if (!inv || inv.status !== "PENDING" || inv.expires_at <= Date.now())
    throw new AuthorizationError(
      "This invitation is invalid, expired, or already used.",
      "INVITATION_INVALID",
    );
  if (normalize(identity.email) !== normalize(inv.email))
    throw new AuthorizationError(
      "Sign out and sign in with the email account invited by your administrator.",
      "WRONG_ACCOUNT",
    );
  if (inv.admission_status !== "READY")
    throw new AuthorizationError(
      "Your invitation is awaiting access setup. Contact your administrator.",
      "ADMISSION_PENDING",
    );
  const grants = JSON.parse(inv.grants_json ?? "{}");
  const roles = grants.roles ?? [];
  const projects = grants.projects ?? [];
  await validateGrants(db, inv.org_id, roles, projects);
  const boot = await queryFirst<any>(
    db,
    "SELECT * FROM bootstrap_state WHERE invitation_id=?",
    [inv.id],
  );
  const existing = await queryFirst<any>(
    db,
    "SELECT * FROM users WHERE lower(email)=?",
    [normalize(identity.email)],
  );
  if (existing?.status === "DISABLED")
    throw new AuthorizationError(
      "This account has been disabled.",
      "ACCOUNT_DISABLED",
    );
  const bound = existing
    ? await queryFirst<any>(
        db,
        "SELECT issuer,subject FROM identities WHERE user_id=?",
        [existing.id],
      )
    : null;
  if (
    bound &&
    (bound.issuer !== identity.iss || bound.subject !== identity.sub)
  )
    throw new AuthorizationError(
      "Identity recovery by an administrator is required.",
      "IDENTITY_CHANGED",
    );
  if (existing?.status === "ACTIVE" && !bound)
    throw new AuthorizationError(
      "An existing account requires controlled identity linking.",
      "IDENTITY_LINK_REQUIRED",
    );
  const userId = existing?.id ?? id("usr"),
    now = Date.now();
  const statements = [
    assertion(
      db,
      `EXISTS(SELECT 1 FROM invitations WHERE id=? AND status='PENDING' AND expires_at>? AND admission_status='READY')`,
      [inv.id, now],
    ),
  ];
  if (boot)
    statements.push(
      assertion(
        db,
        "EXISTS(SELECT 1 FROM bootstrap_state WHERE id=1 AND consumed_at IS NULL AND invitation_id=?)",
        [inv.id],
      ),
    );
  else
    statements.push(
      assertion(
        db,
        `EXISTS(SELECT 1 FROM role_assignments r JOIN users u ON u.id=r.user_id JOIN organization_memberships m ON m.user_id=u.id AND m.org_id=r.org_id WHERE r.user_id=? AND r.org_id=? AND r.role='ADMIN' AND r.revoked_at IS NULL AND u.status='ACTIVE' AND m.is_active=1)`,
        [inv.created_by, inv.org_id],
      ),
    );
  if (!existing)
    statements.push(
      db
        .prepare(
          "INSERT INTO users(id,email,display_name,status,created_at) VALUES(?,?,?,'INVITED',?)",
        )
        .bind(userId, normalize(identity.email), inv.display_name, now),
    );
  if (!bound)
    statements.push(
      db
        .prepare(
          "INSERT INTO identities(id,user_id,provider,issuer,subject,email,created_at) VALUES(?,?,'cloudflare_access',?,?,?,?)",
        )
        .bind(
          id("ident"),
          userId,
          identity.iss,
          identity.sub,
          normalize(identity.email),
          now,
        ),
    );
  statements.push(
    db
      .prepare(
        "UPDATE users SET status='ACTIVE' WHERE id=? AND status='INVITED'",
      )
      .bind(userId),
    db
      .prepare(
        "INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES(?,?,?,1,?) ON CONFLICT(org_id,user_id) DO UPDATE SET is_active=1",
      )
      .bind(id("om"), inv.org_id, userId, now),
  );
  statements.push(
    ...grantStatements(db, userId, inv.org_id, roles, projects, inv.created_by),
  );
  statements.push(
    db
      .prepare(
        "UPDATE invitations SET status='ACCEPTED',accepted_at=? WHERE id=?",
      )
      .bind(now, inv.id),
  );
  if (boot)
    statements.push(
      db
        .prepare("UPDATE bootstrap_state SET consumed_at=? WHERE id=1")
        .bind(now),
    );
  statements.push(
    auditStatement(db, {
      orgId: inv.org_id,
      actorId: userId,
      entityType: "INVITATION",
      entityId: inv.id,
      action: boot ? "BOOTSTRAP_ACCEPTED" : "INVITATION_ACCEPTED",
      newState: { roles, projects },
    }),
  );
  await db.batch(statements);
  return { userId, status: "ACTIVE" };
}
export async function updateGrants(
  actor: UserPrincipal,
  targetId: string,
  input: {
    roles: UserRole[];
    projects: ProjectAccess[];
    reason: string;
    confirmElevation?: boolean;
  },
  db: D1Database,
) {
  admin(actor);
  if (!input.reason?.trim())
    throw new AuthorizationError("A reason is required.", "INVALID_INPUT");
  await validateGrants(db, actor.orgId, input.roles, input.projects);
  if (input.roles.some((r) => ["ADMIN", "OWNER"].includes(r)))
    recent(actor, input.confirmElevation);
  const membership = await queryFirst<any>(
    db,
    "SELECT * FROM organization_memberships WHERE user_id=? AND org_id=? AND is_active=1",
    [targetId, actor.orgId],
  );
  if (!membership)
    throw new AuthorizationError("Account not found.", "NOT_FOUND");
  const before = await query<any>(
    db,
    "SELECT role FROM role_assignments WHERE user_id=? AND org_id=? AND revoked_at IS NULL",
    [targetId, actor.orgId],
  );
  const beforeProjects = await query<any>(
    db,
    "SELECT project_id,project_role,finance_access,finance_author,invoice_issue FROM project_memberships WHERE user_id=? AND org_id=? AND is_active=1",
    [targetId, actor.orgId],
  );
  const now = Date.now();
  await explainLastAdminRemoval(db, actor.orgId, targetId, input.roles.includes("ADMIN"));
  await db.batch([
    currentAdminGuard(db, actor),
    lastAdminGuard(db, actor.orgId, targetId, input.roles.includes("ADMIN")),
    db
      .prepare(
        "UPDATE role_assignments SET revoked_at=? WHERE user_id=? AND org_id=? AND revoked_at IS NULL",
      )
      .bind(now, targetId, actor.orgId),
    db
      .prepare(
        "UPDATE project_memberships SET is_active=0,revoked_at=? WHERE user_id=? AND org_id=? AND is_active=1",
      )
      .bind(now, targetId, actor.orgId),
    db
      .prepare(
        "UPDATE projects SET main_client_user_id=NULL,revision=revision+1 WHERE org_id=? AND main_client_user_id=?",
      )
      .bind(actor.orgId, targetId),
    ...grantStatements(
      db,
      targetId,
      actor.orgId,
      input.roles,
      input.projects,
      actor.id,
    ),
    auditStatement(db, {
      orgId: actor.orgId,
      actorId: actor.id,
      entityType: "USER",
      entityId: targetId,
      action: "GRANTS_CHANGED",
      oldState: { roles: before, projects: beforeProjects },
      newState: input,
      reason: input.reason,
    }),
  ]);
  return { success: true };
}
function currentAdminGuard(db: D1Database, actor: UserPrincipal) {
  return assertion(
    db,
    `EXISTS(SELECT 1 FROM role_assignments r JOIN users u ON u.id=r.user_id JOIN organization_memberships m ON m.user_id=u.id AND m.org_id=r.org_id WHERE r.user_id=? AND r.org_id=? AND r.role='ADMIN' AND r.revoked_at IS NULL AND u.status='ACTIVE' AND m.is_active=1)`,
    [actor.id, actor.orgId],
  );
}
const lastAdminCondition = `?=1 OR NOT EXISTS(SELECT 1 FROM role_assignments WHERE org_id=? AND user_id=? AND role='ADMIN' AND revoked_at IS NULL) OR EXISTS(SELECT 1 FROM role_assignments r JOIN users u ON u.id=r.user_id JOIN organization_memberships m ON m.user_id=u.id AND m.org_id=r.org_id WHERE r.org_id=? AND r.user_id!=? AND r.role='ADMIN' AND r.revoked_at IS NULL AND u.status='ACTIVE' AND m.is_active=1 AND EXISTS(SELECT 1 FROM identities i WHERE i.user_id=u.id AND i.provider='cloudflare_access'))`;
async function explainLastAdminRemoval(db: D1Database, org: string, target: string, keepsAdmin=false) {
  // Friendly early feedback; the same condition remains inside the batch for concurrent requests.
  const result = await db.prepare(`SELECT (${lastAdminCondition}) AS allowed`)
    .bind(Number(keepsAdmin),org,target,org,target).first<{allowed:number}>();
  if (!result?.allowed) throw new AuthorizationError(
    "Keep at least one active administrator. Invite and activate another administrator before removing this access.",
    "LAST_ADMIN_CONFLICT",
  );
}
function lastAdminGuard(
  db: D1Database,
  org: string,
  target: string,
  keepsAdmin = false,
) {
  return assertion(
    db,
    lastAdminCondition,
    [Number(keepsAdmin), org, target, org, target],
  );
}
export async function disableUser(
  actor: UserPrincipal,
  targetUserId: string,
  reason: string,
  db: D1Database,
) {
  admin(actor);
  if (!reason?.trim())
    throw new AuthorizationError("A reason is required.", "INVALID_INPUT");
  const now = Date.now();
  const target = await queryFirst<any>(
    db,
    "SELECT u.* FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=? AND m.org_id=?",
    [targetUserId, actor.orgId],
  );
  if (!target) throw new AuthorizationError("Account not found.", "NOT_FOUND");
  await explainLastAdminRemoval(db, actor.orgId, targetUserId);
  await db.batch([
    currentAdminGuard(db, actor),
    lastAdminGuard(db, actor.orgId, targetUserId),
    db
      .prepare("UPDATE users SET status='DISABLED',disabled_at=? WHERE id=?")
      .bind(now, targetUserId),
    db
      .prepare(
        "UPDATE organization_memberships SET is_active=0 WHERE user_id=? AND org_id=?",
      )
      .bind(targetUserId, actor.orgId),
    db
      .prepare(
        "UPDATE project_memberships SET is_active=0,revoked_at=? WHERE user_id=? AND org_id=?",
      )
      .bind(now, targetUserId, actor.orgId),
    db
      .prepare(
        "INSERT INTO access_admission_jobs(id,org_id,email,desired_state,created_at) VALUES(?,?,?,'REVOKE',?)",
      )
      .bind(id("edge"), actor.orgId, target.email, now),
    auditStatement(db, {
      orgId: actor.orgId,
      actorId: actor.id,
      entityType: "USER",
      entityId: targetUserId,
      action: "USER_DISABLED",
      reason,
    }),
  ]);
  return { success: true };
}
export async function reassignMainClient(
  actor: UserPrincipal,
  input: ReassignMainClientInput,
  db: D1Database,
) {
  admin(actor);
  const p = await queryFirst<any>(
    db,
    "SELECT * FROM projects WHERE id=? AND org_id=?",
    [input.projectId, actor.orgId],
  );
  const m = await queryFirst<any>(
    db,
    "SELECT m.id FROM project_memberships m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND m.user_id=? AND m.is_active=1 AND u.status='ACTIVE'",
    [input.projectId, input.newUserId],
  );
  if (!p || !m || !input.reason?.trim())
    throw new AuthorizationError(
      "Select an active project contact and enter a reason.",
      "INVALID_INPUT",
    );
  await db.batch([
    currentAdminGuard(db, actor),
    db
      .prepare(
        "UPDATE projects SET main_client_user_id=?,revision=revision+1 WHERE id=? AND org_id=?",
      )
      .bind(input.newUserId, p.id, actor.orgId),
    db
      .prepare(
        "UPDATE project_memberships SET project_role='CLIENT_REP' WHERE project_id=? AND project_role='MAIN_CLIENT' AND is_active=1",
      )
      .bind(p.id),
    db
      .prepare(
        "UPDATE project_memberships SET project_role='MAIN_CLIENT' WHERE id=?",
      )
      .bind(m.id),
    auditStatement(db, {
      orgId: actor.orgId,
      actorId: actor.id,
      entityType: "PROJECT",
      entityId: p.id,
      action: "MAIN_CLIENT_REASSIGNED",
      oldState: { userId: p.main_client_user_id },
      newState: { userId: input.newUserId },
      reason: input.reason,
    }),
  ]);
  return { success: true };
}
export async function listPeople(actor: UserPrincipal, db: D1Database) {
  admin(actor);
  const users = await query<any>(
    db,
    "SELECT DISTINCT u.* FROM users u LEFT JOIN organization_memberships m ON m.user_id=u.id LEFT JOIN invitations i ON lower(i.email)=lower(u.email) WHERE m.org_id=? OR i.org_id=? ORDER BY u.created_at DESC",
    [actor.orgId, actor.orgId],
  );
  return Promise.all(
    users.map(async (u) => ({
      id: u.id,
      email: u.email,
      name: u.display_name,
      status: u.status,
      createdAt: u.created_at,
      roles: (
        await query<any>(
          db,
          "SELECT role FROM role_assignments WHERE org_id=? AND user_id=? AND revoked_at IS NULL",
          [actor.orgId, u.id],
        )
      ).map((r) => r.role),
      accessHistory: await query<any>(
        db,
        `SELECT a.action,a.reason,a.created_at,a.old_state,a.new_state,COALESCE(u.display_name,'Infrastructure operator') AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE a.org_id=? AND a.entity_type='USER' AND a.entity_id=? AND a.action IN ('GRANTS_CHANGED','USER_DISABLED','IDENTITY_RECOVERED','IDENTITY_LINKED','MAIN_CLIENT_REASSIGNED') ORDER BY a.created_at DESC LIMIT 50`,
        [actor.orgId, u.id],
      ),
      projects: await query<any>(
        db,
        "SELECT m.project_id,m.project_role,m.finance_access,m.finance_author,m.invoice_issue,CASE WHEN p.main_client_user_id=m.user_id AND m.project_role='MAIN_CLIENT' THEN 1 ELSE 0 END AS contractual_authority FROM project_memberships m JOIN projects p ON p.id=m.project_id AND p.org_id=m.org_id WHERE m.user_id=? AND m.org_id=? AND m.is_active=1",
        [u.id, actor.orgId],
      ),
    })),
  );
}
export async function manageInvitation(
  actor: UserPrincipal,
  invitationId: string,
  action: string,
  db: D1Database,
) {
  admin(actor);
  const inv = await queryFirst<any>(
    db,
    "SELECT * FROM invitations WHERE id=? AND org_id=?",
    [invitationId, actor.orgId],
  );
  if (!inv) throw new AuthorizationError("Invitation not found.", "NOT_FOUND");
  if (action === "READY") {
    await db.batch([
      currentAdminGuard(db, actor),
      db
        .prepare(
          "UPDATE invitations SET admission_status='READY' WHERE id=? AND status='PENDING'",
        )
        .bind(inv.id),
      auditStatement(db, {
        orgId: actor.orgId,
        actorId: actor.id,
        entityType: "INVITATION",
        entityId: inv.id,
        action: "EDGE_ADMISSION_CONFIRMED",
        reason: "Operator confirmed exact-email Cloudflare Access admission",
      }),
    ]);
    return { status: "READY" };
  }
  if (action === "REVOKE") {
    await db.batch([
      currentAdminGuard(db, actor),
      db
        .prepare(
          "UPDATE invitations SET status='REVOKED' WHERE id=? AND status='PENDING'",
        )
        .bind(inv.id),
      auditStatement(db, {
        orgId: actor.orgId,
        actorId: actor.id,
        entityType: "INVITATION",
        entityId: inv.id,
        action: "INVITATION_REVOKED",
      }),
    ]);
    return { status: "REVOKED" };
  }
  if (action === "REISSUE") {
    if (inv.status === "ACCEPTED")
      throw new AuthorizationError(
        "An accepted invitation cannot be reissued.",
        "INVALID_STATE",
      );
    const raw = token();
    await db.batch([
      currentAdminGuard(db, actor),
      db
        .prepare(
          "UPDATE invitations SET token=?,status='PENDING',expires_at=?,admission_status='PENDING_SETUP' WHERE id=? AND status!='ACCEPTED'",
        )
        .bind(await digestToken(raw), Date.now() + 72 * 3600000, inv.id),
      auditStatement(db, {
        orgId: actor.orgId,
        actorId: actor.id,
        entityType: "INVITATION",
        entityId: inv.id,
        action: "INVITATION_REISSUED",
      }),
    ]);
    return { invitationUrl: `/invite/accept#token=${raw}` };
  }
  throw new AuthorizationError("Unsupported action.", "INVALID_INPUT");
}
