/**
 * Identity & access management domain service for Merveille Designs.
 * All mutations require ADMIN capability and produce immutable audit events.
 */

import { UserPrincipal } from "@/server/auth/principal";
import { canManagePeopleAndAccess, AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";

export interface InviteUserInput {
  email: string;
  displayName: string;
  role: "ADMIN" | "OWNER" | "MANAGER" | "STAFF" | "CONSULTANT" | "MAIN_CLIENT" | "CLIENT_REP";
  projectId?: string;
}

export interface ReassignMainClientInput {
  projectId: string;
  newUserId: string;
  reason: string;
}

/**
 * Record an immutable audit log entry.
 */
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
  }
): Promise<void> {
  const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await execute(
    db,
    `INSERT INTO audit_events (id, org_id, actor_id, entity_type, entity_id, action, scope, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      event.orgId,
      event.actorId,
      event.entityType,
      event.entityId,
      event.action,
      event.scope || "ORGANIZATION",
      event.oldState ? JSON.stringify(event.oldState) : null,
      event.newState ? JSON.stringify(event.newState) : null,
      event.reason || null,
      Date.now(),
    ]
  );
}

/**
 * Invite a new user to the organization with explicit role and project grants.
 */
export async function inviteUser(
  actor: UserPrincipal,
  input: InviteUserInput,
  db: D1Database
) {
  if (!canManagePeopleAndAccess(actor)) {
    throw new AuthorizationError("Only administrators can invite users.", "ADMIN_REQUIRED");
  }

  const normalizedEmail = input.email.toLowerCase().trim();
  const orgId = actor.orgId;

  // Check if user already exists
  let user = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM users WHERE lower(email) = ?",
    [normalizedEmail]
  );

  let userId: string;
  if (!user) {
    userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await execute(
      db,
      "INSERT INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'INVITED', ?)",
      [userId, normalizedEmail, input.displayName, Date.now()]
    );
  } else {
    userId = user.id;
  }

  // Create single-use invitation token expiring in 7 days
  const token = `inv_${crypto.randomUUID().replace(/-/g, "")}`;
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const invitationId = `inv_id_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  await execute(
    db,
    `INSERT INTO invitations (id, org_id, email, display_name, intended_role, project_id, token, status, expires_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    [
      invitationId,
      orgId,
      normalizedEmail,
      input.displayName,
      input.role,
      input.projectId || null,
      token,
      expiresAt,
      actor.id,
      Date.now(),
    ]
  );

  await recordAuditEvent(db, {
    orgId,
    actorId: actor.id,
    entityType: "USER",
    entityId: userId,
    action: "USER_INVITED",
    newState: {
      email: normalizedEmail,
      role: input.role,
      projectId: input.projectId,
      expiresAt,
    },
    reason: `Invited as ${input.role}`,
  });

  return {
    invitationId,
    userId,
    email: normalizedEmail,
    role: input.role,
    token,
    expiresAt,
    invitationUrl: `/invite/accept?token=${token}`,
  };
}

/**
 * Accept an invitation using its single-use token.
 */
export async function acceptInvitation(
  token: string,
  subjectId: string,
  db: D1Database
) {
  const invitation = await queryFirst<{
    id: string;
    org_id: string;
    email: string;
    display_name: string;
    intended_role: string;
    project_id: string | null;
    status: string;
    expires_at: number;
  }>(db, "SELECT * FROM invitations WHERE token = ?", [token]);

  if (!invitation) {
    throw new AuthorizationError("Invitation not found or invalid token.", "INVALID_TOKEN");
  }

  if (invitation.status !== "PENDING") {
    throw new AuthorizationError(
      `Invitation has already been ${invitation.status.toLowerCase()}.`,
      "INVITATION_USED"
    );
  }

  if (invitation.expires_at < Date.now()) {
    await execute(db, "UPDATE invitations SET status = 'EXPIRED' WHERE id = ?", [invitation.id]);
    throw new AuthorizationError("Invitation token has expired.", "INVITATION_EXPIRED");
  }

  const user = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM users WHERE lower(email) = ?",
    [invitation.email.toLowerCase()]
  );

  if (!user) {
    throw new AuthorizationError("Linked user record not found.", "USER_NOT_FOUND");
  }

  const now = Date.now();

  // 1. Mark invitation accepted
  await execute(
    db,
    "UPDATE invitations SET status = 'ACCEPTED', accepted_at = ? WHERE id = ?",
    [now, invitation.id]
  );

  // 2. Activate user
  await execute(
    db,
    "UPDATE users SET status = 'ACTIVE' WHERE id = ?",
    [user.id]
  );

  // 3. Create or update Identity record
  const identityId = `ident_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await execute(
    db,
    `INSERT OR REPLACE INTO identities (id, user_id, provider, issuer, subject, email, created_at)
     VALUES (?, ?, 'cloudflare_access', 'access_provider', ?, ?, ?)`,
    [identityId, user.id, subjectId, invitation.email, now]
  );

  // 4. Bind organization membership
  const orgMemId = `om_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await execute(
    db,
    `INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at)
     VALUES (?, ?, ?, 1, ?)`,
    [orgMemId, invitation.org_id, user.id, now]
  );

  // 5. Grant intended role
  const roleId = `ra_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await execute(
    db,
    `INSERT INTO role_assignments (id, org_id, user_id, role, scope, granted_at)
     VALUES (?, ?, ?, ?, 'GLOBAL', ?)`,
    [roleId, invitation.org_id, user.id, invitation.intended_role, now]
  );

  // 6. Bind project membership if scoped
  if (invitation.project_id) {
    const pmId = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await execute(
      db,
      `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [pmId, invitation.org_id, invitation.project_id, user.id, invitation.intended_role, now]
    );
  }

  await recordAuditEvent(db, {
    orgId: invitation.org_id,
    actorId: user.id,
    entityType: "USER",
    entityId: user.id,
    action: "INVITATION_ACCEPTED",
    newState: {
      role: invitation.intended_role,
      projectId: invitation.project_id,
    },
    reason: "Accepted invitation token",
  });

  return {
    userId: user.id,
    email: invitation.email,
    role: invitation.intended_role,
    projectId: invitation.project_id,
  };
}

/**
 * Disable a user account across all portal surfaces (AC-006).
 */
export async function disableUser(
  actor: UserPrincipal,
  targetUserId: string,
  reason: string,
  db: D1Database
) {
  if (!canManagePeopleAndAccess(actor)) {
    throw new AuthorizationError("Only administrators can deactivate accounts.", "ADMIN_REQUIRED");
  }

  const target = await queryFirst<{ id: string; email: string; status: string }>(
    db,
    "SELECT id, email, status FROM users WHERE id = ?",
    [targetUserId]
  );

  if (!target) {
    throw new AuthorizationError("User not found.", "NOT_FOUND");
  }

  // Guard against disabling the last remaining active ADMIN
  const activeAdmins = await query<{ user_id: string }>(
    db,
    `SELECT ra.user_id FROM role_assignments ra
     JOIN users u ON u.id = ra.user_id
     WHERE ra.role = 'ADMIN' AND ra.revoked_at IS NULL AND u.status = 'ACTIVE'`
  );

  if (activeAdmins.length === 1 && activeAdmins[0].user_id === targetUserId) {
    throw new AuthorizationError(
      "Cannot disable the sole remaining active administrator.",
      "CANNOT_DISABLE_LAST_ADMIN"
    );
  }

  const now = Date.now();
  await execute(
    db,
    "UPDATE users SET status = 'DISABLED', disabled_at = ? WHERE id = ?",
    [now, targetUserId]
  );

  // Deactivate memberships
  await execute(
    db,
    "UPDATE organization_memberships SET is_active = 0 WHERE user_id = ?",
    [targetUserId]
  );

  await execute(
    db,
    "UPDATE project_memberships SET is_active = 0, revoked_at = ? WHERE user_id = ?",
    [now, targetUserId]
  );

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "USER",
    entityId: targetUserId,
    action: "USER_DISABLED",
    reason,
  });

  return { success: true, disabledUserId: targetUserId };
}

/**
 * Reassign the main client for a project (AC-007).
 */
export async function reassignMainClient(
  actor: UserPrincipal,
  input: ReassignMainClientInput,
  db: D1Database
) {
  if (!canManagePeopleAndAccess(actor)) {
    throw new AuthorizationError("Only administrators can reassign main client authority.", "ADMIN_REQUIRED");
  }

  const project = await queryFirst<{ id: string; org_id: string; main_client_user_id: string }>(
    db,
    "SELECT id, org_id, main_client_user_id FROM projects WHERE id = ?",
    [input.projectId]
  );

  if (!project) {
    throw new AuthorizationError("Project not found.", "PROJECT_NOT_FOUND");
  }

  const oldClientUserId = project.main_client_user_id;

  // Update project main client pointer
  await execute(
    db,
    "UPDATE projects SET main_client_user_id = ?, revision = revision + 1 WHERE id = ?",
    [input.newUserId, input.projectId]
  );

  // Ensure new user has project membership as MAIN_CLIENT
  const existingMem = await queryFirst<{ id: string }>(
    db,
    "SELECT id FROM project_memberships WHERE project_id = ? AND user_id = ? AND is_active = 1",
    [input.projectId, input.newUserId]
  );

  if (!existingMem) {
    await execute(
      db,
      `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
       VALUES (?, ?, ?, ?, 'MAIN_CLIENT', 1, ?)`,
      [`pm_${Date.now()}`, project.org_id, input.projectId, input.newUserId, Date.now()]
    );
  }

  await recordAuditEvent(db, {
    orgId: project.org_id,
    actorId: actor.id,
    entityType: "PROJECT",
    entityId: input.projectId,
    action: "MAIN_CLIENT_REASSIGNED",
    scope: "PROJECT",
    oldState: { mainClientUserId: oldClientUserId },
    newState: { mainClientUserId: input.newUserId },
    reason: input.reason,
  });

  return { success: true, projectId: input.projectId, newMainClientUserId: input.newUserId };
}

/**
 * List all users with their roles and active status for ADMINs (SCR-18).
 */
export async function listPeople(actor: UserPrincipal, db: D1Database) {
  if (!canManagePeopleAndAccess(actor)) {
    throw new AuthorizationError("Only administrators can view the people register.", "ADMIN_REQUIRED");
  }

  const users = await query<{
    id: string;
    email: string;
    display_name: string;
    status: string;
    created_at: number;
    disabled_at: number | null;
  }>(db, "SELECT id, email, display_name, status, created_at, disabled_at FROM users ORDER BY created_at DESC");

  const results = [];
  for (const u of users) {
    const roles = await query<{ role: string }>(
      db,
      "SELECT role FROM role_assignments WHERE user_id = ? AND revoked_at IS NULL",
      [u.id]
    );
    const projectMems = await query<{ project_id: string; project_role: string }>(
      db,
      "SELECT project_id, project_role FROM project_memberships WHERE user_id = ? AND is_active = 1",
      [u.id]
    );

    results.push({
      id: u.id,
      email: u.email,
      name: u.display_name,
      status: u.status,
      roles: roles.map((r) => r.role),
      projectCount: projectMems.length,
      createdAt: u.created_at,
      disabledAt: u.disabled_at,
    });
  }

  return results;
}
