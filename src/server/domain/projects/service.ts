/**
 * Project portfolio, lifecycle, and guarded activation domain service for Merveille Designs.
 * Enforces strict role scopes, commercial activation gates, and optimistic concurrency.
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "../identity/service";

export interface UpdateStageInput {
  stageId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  actualCompletionDate?: string;
  expectedRevision?: number;
}

export interface ProjectLifecycleInput {
  reason: string;
}

/**
 * List projects with strict role-based portfolio filtering (AC-002, AC-011).
 */
export async function listProjects(
  principal: UserPrincipal,
  db: D1Database,
  options: { query?: string; stage?: string; includeArchived?: boolean } = {}
) {
  let sql = `
    SELECT p.*, u.display_name as manager_name, mc.display_name as main_client_name
    FROM projects p
    LEFT JOIN users u ON u.id = p.manager_user_id
    LEFT JOIN users mc ON mc.id = p.main_client_user_id
    WHERE p.org_id = ?
  `;
  const params: any[] = [principal.orgId];

  // Archive filtering
  if (!options.includeArchived) {
    sql += " AND p.is_archived = 0";
  }

  // Permission boundary: Global roles see all operational projects; others see only assigned
  if (principal.role !== "ADMIN" && principal.role !== "OWNER") {
    sql += ` AND p.id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = ? AND is_active = 1
    )`;
    params.push(principal.id);
  }

  // Search filter
  if (options.query && options.query.trim().length > 0) {
    sql += " AND (lower(p.name) LIKE ? OR lower(p.code) LIKE ? OR lower(p.site_location) LIKE ?)";
    const q = `%${options.query.toLowerCase().trim()}%`;
    params.push(q, q, q);
  }

  if (options.stage) {
    sql += " AND p.stage = ?";
    params.push(options.stage);
  }

  sql += " ORDER BY p.created_at DESC";

  return await query(db, sql, params);
}

/**
 * Get project details and ordered stage timeline.
 */
export async function getProject(
  principal: UserPrincipal,
  projectId: string,
  db: D1Database
) {
  assertProjectAccess(principal, projectId);

  const project = await queryFirst<any>(
    db,
    `SELECT p.*, u.display_name as manager_name, mc.display_name as main_client_name
     FROM projects p
     LEFT JOIN users u ON u.id = p.manager_user_id
     LEFT JOIN users mc ON mc.id = p.main_client_user_id
     WHERE p.id = ? AND p.org_id = ?`,
    [projectId, principal.orgId]
  );

  if (!project) {
    throw new AuthorizationError("Project not found.", "NOT_FOUND");
  }

  const stages = await query(
    db,
    "SELECT * FROM project_stages WHERE project_id = ? ORDER BY stage_order ASC",
    [projectId]
  );

  const members = await query(
    db,
    `SELECT pm.*, u.display_name, u.email
     FROM project_memberships pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ? AND pm.is_active = 1`,
    [projectId]
  );

  const events = await query(
    db,
    `SELECT pe.*, u.display_name as actor_name
     FROM project_events pe
     JOIN users u ON u.id = pe.actor_id
     WHERE pe.project_id = ?
     ORDER BY pe.created_at DESC`,
    [projectId]
  );

  return { project, stages, members, events };
}

/**
 * Activate a project (REQ-PRJ-002, DEC-007, AC-010).
 * Guarded manager command: CANNOT activate without BOTH accepted quotation AND confirmed advance.
 */
export async function activateProject(
  actor: UserPrincipal,
  projectId: string,
  db: D1Database
) {
  assertProjectAccess(actor, projectId);

  // Only manager or admin can activate
  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only assigned project managers or administrators can activate work.", "FORBIDDEN");
  }

  const project = await queryFirst<{
    id: string;
    org_id: string;
    status: string;
    quote_accepted_at: number | null;
    advance_confirmed_at: number | null;
    revision: number;
  }>(db, "SELECT id, org_id, status, quote_accepted_at, advance_confirmed_at, revision FROM projects WHERE id = ?", [
    projectId,
  ]);

  if (!project) {
    throw new AuthorizationError("Project not found.", "NOT_FOUND");
  }

  if (project.status === "ACTIVE") {
    return { success: true, status: "ACTIVE", message: "Project is already active" };
  }

  // Strict commercial gate checks (REQ-PRJ-002)
  const isQuoteAccepted = !!project.quote_accepted_at;
  const isAdvanceConfirmed = !!project.advance_confirmed_at;

  if (!isQuoteAccepted || !isAdvanceConfirmed) {
    const missing: string[] = [];
    if (!isQuoteAccepted) missing.push("Accepted client quotation");
    if (!isAdvanceConfirmed) missing.push("Admin-confirmed advance receipt");

    throw new AuthorizationError(
      `Cannot activate project. Missing required commercial gates: ${missing.join(" and ")}.`,
      "ACTIVATION_GATES_UNMET"
    );
  }

  const now = Date.now();
  await execute(
    db,
    `UPDATE projects
     SET status = 'ACTIVE', activated_at = ?, activated_by_user_id = ?, revision = revision + 1
     WHERE id = ?`,
    [now, actor.id, projectId]
  );

  // Record lifecycle event
  await execute(
    db,
    `INSERT INTO project_events (id, project_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'PROJECT_ACTIVATED', ?, 'ACTIVE', 'Commercial gates satisfied; manager activated project baseline', ?)`,
    [`pe_act_${Date.now()}`, projectId, actor.id, project.status, now]
  );

  await recordAuditEvent(db, {
    orgId: project.org_id,
    actorId: actor.id,
    entityType: "PROJECT",
    entityId: projectId,
    action: "PROJECT_ACTIVATED",
    oldState: { status: project.status },
    newState: { status: "ACTIVE", activatedAt: now },
  });

  return { success: true, status: "ACTIVE", activatedAt: now };
}

/**
 * Update and advance project stages with optimistic concurrency (AC-012).
 */
export async function updateProjectStage(
  actor: UserPrincipal,
  projectId: string,
  input: UpdateStageInput,
  db: D1Database
) {
  assertProjectAccess(actor, projectId);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only assigned project managers can complete project stages.", "FORBIDDEN");
  }

  const stage = await queryFirst<{
    id: string;
    project_id: string;
    name: string;
    status: string;
    revision: number;
    stage_order: number;
  }>(db, "SELECT * FROM project_stages WHERE id = ? AND project_id = ?", [
    input.stageId,
    projectId,
  ]);

  if (!stage) {
    throw new AuthorizationError("Stage not found.", "NOT_FOUND");
  }

  // Optimistic concurrency check
  if (input.expectedRevision && stage.revision !== input.expectedRevision) {
    throw new AuthorizationError("Stage revision conflict. Refresh and reapply.", "CONCURRENCY_CONFLICT");
  }

  const now = Date.now();
  const completionDate = input.actualCompletionDate || new Date().toISOString().split("T")[0];

  await execute(
    db,
    `UPDATE project_stages
     SET status = ?, actual_completion_date = ?, completed_by_user_id = ?, revision = revision + 1
     WHERE id = ?`,
    [input.status, completionDate, actor.id, input.stageId]
  );

  // If completed, check and advance current project stage
  if (input.status === "COMPLETED") {
    const nextStage = await queryFirst<{ name: string }>(
      db,
      "SELECT name FROM project_stages WHERE project_id = ? AND stage_order > ? ORDER BY stage_order ASC LIMIT 1",
      [projectId, stage.stage_order]
    );

    if (nextStage) {
      await execute(
        db,
        "UPDATE projects SET stage = ?, revision = revision + 1 WHERE id = ?",
        [nextStage.name, projectId]
      );
    }
  }

  // Record audit event and lifecycle event
  await execute(
    db,
    `INSERT INTO project_events (id, project_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'STAGE_COMPLETED', ?, ?, ?, ?)`,
    [
      `pe_stg_${Date.now()}`,
      projectId,
      actor.id,
      stage.status,
      input.status,
      `Completed stage: ${stage.name}`,
      now,
    ]
  );

  return { success: true, stageId: input.stageId, status: input.status };
}

/**
 * Pause an active project (AC-012).
 */
export async function pauseProject(
  actor: UserPrincipal,
  projectId: string,
  input: ProjectLifecycleInput,
  db: D1Database
) {
  assertProjectAccess(actor, projectId);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only managers can pause project delivery.", "FORBIDDEN");
  }

  const project = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM projects WHERE id = ?",
    [projectId]
  );

  if (!project) throw new AuthorizationError("Project not found.", "NOT_FOUND");

  const now = Date.now();
  await execute(
    db,
    "UPDATE projects SET status = 'PAUSED', pause_reason = ?, revision = revision + 1 WHERE id = ?",
    [input.reason, projectId]
  );

  await execute(
    db,
    `INSERT INTO project_events (id, project_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'PROJECT_PAUSED', ?, 'PAUSED', ?, ?)`,
    [`pe_pau_${now}`, projectId, actor.id, project.status, input.reason, now]
  );

  return { success: true, status: "PAUSED", reason: input.reason };
}

/**
 * Resume a paused project (AC-012).
 */
export async function resumeProject(
  actor: UserPrincipal,
  projectId: string,
  input: ProjectLifecycleInput,
  db: D1Database
) {
  assertProjectAccess(actor, projectId);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only managers can resume paused delivery.", "FORBIDDEN");
  }

  const project = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM projects WHERE id = ?",
    [projectId]
  );

  if (!project) throw new AuthorizationError("Project not found.", "NOT_FOUND");

  const now = Date.now();
  await execute(
    db,
    "UPDATE projects SET status = 'ACTIVE', pause_reason = NULL, revision = revision + 1 WHERE id = ?",
    [projectId]
  );

  await execute(
    db,
    `INSERT INTO project_events (id, project_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'PROJECT_RESUMED', ?, 'ACTIVE', ?, ?)`,
    [`pe_res_${now}`, projectId, actor.id, project.status, input.reason, now]
  );

  return { success: true, status: "ACTIVE", reason: input.reason };
}
