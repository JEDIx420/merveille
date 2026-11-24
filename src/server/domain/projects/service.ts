/**
 * Project portfolio, lifecycle, and guarded activation domain service for Merveille Designs.
 * Enforces strict role scopes, commercial activation gates, and optimistic concurrency.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "../identity/service";
import { FinanceService } from "../finance/service";
import { ArchiveService } from "../archive/service";
import { atomicGuard } from "../../db/atomic";

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
 * List projects with strict role-based portfolio filtering.
 */
export async function listProjects(
  principal: UserPrincipal,
  db: D1Database,
  options: { query?: string; stage?: string; includeArchived?: boolean } = {},
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
  if (
    !hasCapability(principal, "ADMIN") &&
    !hasCapability(principal, "OWNER")
  ) {
    sql += ` AND p.id IN (
      SELECT project_id FROM project_memberships
      WHERE user_id = ? AND is_active = 1
    )`;
    params.push(principal.id);
  }

  // Search filter
  if (options.query && options.query.trim().length > 0) {
    sql +=
      " AND (lower(p.name) LIKE ? OR lower(p.code) LIKE ? OR lower(p.site_location) LIKE ?)";
    const q = `%${options.query.toLowerCase().trim()}%`;
    params.push(q, q, q);
  }

  if (options.stage) {
    sql += " AND p.stage = ?";
    params.push(options.stage);
  }

  sql += " ORDER BY p.created_at DESC";

  const result = await query<any>(db, sql, params);
  return result.map((p) => {
    const internal =
      hasCapability(principal, "ADMIN") ||
      hasCapability(principal, "OWNER") ||
      hasCapability(principal, "MANAGER", p.id) ||
      hasCapability(principal, "TEAM_MEMBER", p.id);
    if (internal) return p;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      stage: p.stage,
      is_archived: p.is_archived,
      site_location: p.site_location,
      manager_name: p.manager_name,
    };
  });
}

/**
 * Get project details and ordered stage timeline.
 */
export async function getProject(
  principal: UserPrincipal,
  projectId: string,
  db: D1Database,
) {
  assertProjectAccess(principal, projectId);

  const project = await queryFirst<any>(
    db,
    `SELECT p.*, u.display_name as manager_name, mc.display_name as main_client_name
     FROM projects p
     LEFT JOIN users u ON u.id = p.manager_user_id
     LEFT JOIN users mc ON mc.id = p.main_client_user_id
     WHERE p.id = ? AND p.org_id = ?`,
    [projectId, principal.orgId],
  );

  if (!project) {
    throw new AuthorizationError("Project not found.", "NOT_FOUND");
  }

  const stages = await query(
    db,
    "SELECT * FROM project_stages WHERE project_id = ? ORDER BY stage_order ASC",
    [projectId],
  );

  const members = await query(
    db,
    `SELECT pm.*, u.display_name, u.email
     FROM project_memberships pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ? AND pm.is_active = 1`,
    [projectId],
  );

  const events = await query(
    db,
    `SELECT pe.*, u.display_name as actor_name
     FROM project_events pe
     JOIN users u ON u.id = pe.actor_id
     WHERE pe.project_id = ?
     ORDER BY pe.created_at DESC`,
    [projectId],
  );

  const internal =
    hasCapability(principal, "ADMIN") ||
    hasCapability(principal, "OWNER") ||
    hasCapability(principal, "MANAGER", projectId) ||
    hasCapability(principal, "TEAM_MEMBER", projectId);
  if (!internal)
    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        site_location: project.site_location,
        status: project.status,
        stage: project.stage,
        is_archived: project.is_archived,
        main_client_user_id: project.main_client_user_id,
        manager_name: project.manager_name,
        main_client_name: project.main_client_name,
      },
      stages: stages.map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        status: stage.status,
        stage_order: stage.stage_order,
        planned_start_date: stage.planned_start_date,
        planned_completion_date: stage.planned_completion_date,
        actual_completion_date: stage.actual_completion_date,
      })),
      members: [],
      events: [],
    };
  return {
    project,
    stages,
    members: members.map((m: any) => ({
      id: m.user_id,
      display_name: m.display_name,
      project_role: m.project_role,
    })),
    events,
  };
}

/**
 * Activate a project (REQ-PRJ-002, DEC-007, AC-010).
 * Guarded manager command: CANNOT activate without BOTH accepted quotation AND confirmed advance.
 */
export async function activateProject(
  actor: UserPrincipal,
  projectId: string,
  db: D1Database,
) {
  return FinanceService.activateProject(db, actor, projectId);
}

/**
 * Update and advance project stages with optimistic concurrency.
 */
export async function updateProjectStage(
  actor: UserPrincipal,
  projectId: string,
  input: UpdateStageInput,
  db: D1Database,
) {
  assertProjectAccess(actor, projectId);
  await ArchiveService.assertProjectNotArchived(db, projectId);

  if (!hasCapability(actor, "MANAGER", projectId)) {
    throw new AuthorizationError(
      "Only assigned project managers can complete project stages.",
      "FORBIDDEN",
    );
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
    throw new AuthorizationError(
      "Stage revision conflict. Refresh and reapply.",
      "CONCURRENCY_CONFLICT",
    );
  }

  if (!["PENDING", "IN_PROGRESS", "COMPLETED"].includes(input.status))
    throw new AuthorizationError("Invalid stage status.", "INVALID_INPUT");
  const now = Date.now(),
    completionDate =
      input.status === "COMPLETED"
        ? input.actualCompletionDate || new Date().toISOString().slice(0, 10)
        : null;
  const nextStage =
    input.status === "COMPLETED"
      ? await queryFirst<{ name: string }>(
          db,
          "SELECT name FROM project_stages WHERE project_id=? AND stage_order>? ORDER BY stage_order LIMIT 1",
          [projectId, stage.stage_order],
        )
      : null;
  const plan = [
    FinanceService.activeGuard(db, actor),
    atomicGuard(
      db,
      "EXISTS(SELECT 1 FROM project_stages s JOIN projects p ON p.id=s.project_id WHERE s.id=? AND s.project_id=? AND s.revision=? AND p.org_id=? AND p.is_archived=0)",
      [input.stageId, projectId, stage.revision, actor.orgId],
    ),
    db
      .prepare(
        "UPDATE project_stages SET status=?,actual_completion_date=?,completed_by_user_id=?,revision=revision+1 WHERE id=?",
      )
      .bind(
        input.status,
        completionDate,
        input.status === "COMPLETED" ? actor.id : null,
        input.stageId,
      ),
    db
      .prepare(
        "INSERT INTO project_events(id,project_id,actor_id,event_type,old_state,new_state,reason,created_at) VALUES (?,?,?,'STAGE_CHANGED',?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        projectId,
        actor.id,
        stage.status,
        input.status,
        "Stage: " + stage.name,
        now,
      ),
    FinanceService.audit(db, actor, "PROJECT", projectId, "STAGE_CHANGED", {
      stageId: stage.id,
      status: input.status,
    }),
  ];
  if (nextStage)
    plan.push(
      db
        .prepare("UPDATE projects SET stage=?,revision=revision+1 WHERE id=?")
        .bind(nextStage.name, projectId),
    );
  await FinanceService.commit(db, plan);

  return { success: true, stageId: input.stageId, status: input.status };
}

/**
 * Pause an active project.
 */
export async function pauseProject(
  actor: UserPrincipal,
  projectId: string,
  input: ProjectLifecycleInput,
  db: D1Database,
) {
  assertProjectAccess(actor, projectId);
  await ArchiveService.assertProjectNotArchived(db, projectId);

  if (!hasCapability(actor, "MANAGER", projectId)) {
    throw new AuthorizationError(
      "Only managers can pause project delivery.",
      "FORBIDDEN",
    );
  }

  const project = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM projects WHERE id = ?",
    [projectId],
  );

  if (!project) throw new AuthorizationError("Project not found.", "NOT_FOUND");

  if (!input.reason?.trim())
    throw new AuthorizationError("A reason is required.", "INVALID_INPUT");
  const now = Date.now();
  await FinanceService.commit(db, [
    FinanceService.activeGuard(db, actor),
    atomicGuard(
      db,
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND org_id=? AND status='ACTIVE' AND is_archived=0)",
      [projectId, actor.orgId],
    ),
    db
      .prepare(
        "UPDATE projects SET status='PAUSED',pause_reason = ?,revision=revision+1 WHERE id=?",
      )
      .bind(input.reason, projectId),
    db
      .prepare(
        "INSERT INTO project_events(id,project_id,actor_id,event_type,old_state,new_state,reason,created_at) VALUES (?,?,?,'PROJECT_PAUSED',?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        projectId,
        actor.id,
        "ACTIVE",
        "PAUSED",
        input.reason,
        now,
      ),
    FinanceService.audit(db, actor, "PROJECT", projectId, "PROJECT_PAUSED", {
      reason: input.reason,
    }),
  ]);

  return { success: true, status: "PAUSED", reason: input.reason };
}

/**
 * Resume a paused project.
 */
export async function resumeProject(
  actor: UserPrincipal,
  projectId: string,
  input: ProjectLifecycleInput,
  db: D1Database,
) {
  assertProjectAccess(actor, projectId);
  await ArchiveService.assertProjectNotArchived(db, projectId);

  if (!hasCapability(actor, "MANAGER", projectId)) {
    throw new AuthorizationError(
      "Only managers can resume paused delivery.",
      "FORBIDDEN",
    );
  }

  const project = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM projects WHERE id = ?",
    [projectId],
  );

  if (!project) throw new AuthorizationError("Project not found.", "NOT_FOUND");

  if (!input.reason?.trim())
    throw new AuthorizationError("A reason is required.", "INVALID_INPUT");
  const now = Date.now();
  await FinanceService.commit(db, [
    FinanceService.activeGuard(db, actor),
    atomicGuard(
      db,
      "EXISTS(SELECT 1 FROM projects WHERE id=? AND org_id=? AND status='PAUSED' AND is_archived=0)",
      [projectId, actor.orgId],
    ),
    db
      .prepare(
        "UPDATE projects SET status='ACTIVE',pause_reason = NULL,revision=revision+1 WHERE id=?",
      )
      .bind(projectId),
    db
      .prepare(
        "INSERT INTO project_events(id,project_id,actor_id,event_type,old_state,new_state,reason,created_at) VALUES (?,?,?,'PROJECT_ACTIVE',?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        projectId,
        actor.id,
        "PAUSED",
        "ACTIVE",
        input.reason,
        now,
      ),
    FinanceService.audit(db, actor, "PROJECT", projectId, "PROJECT_ACTIVE", {
      reason: input.reason,
    }),
  ]);

  return { success: true, status: "ACTIVE", reason: input.reason };
}
