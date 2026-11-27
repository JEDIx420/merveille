/**
 * Private Personal Tasks, Canonical Subtasks, Checklists, and Collaborators (Stage N01, NAC-003).
 * Personal tasks belong strictly to their owner; colleagues/managers/admins cannot inspect them.
 * Promoting a personal task into a project uses canonical project task commands without
 * silently turning personal dates into official manager deadlines.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import {
  assertProjectAccess,
  AuthorizationError,
  canReadInternalNotes,
} from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { createTask, computeIsOverdue } from "./service";
import { recordAuditEvent } from "@/server/domain/identity/service";

export interface CreatePersonalTaskInput {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  sectionLabel?: string;
  parentTaskId?: string;
  sourceExternalId?: string;
}

export async function listPersonalTasks(
  actor: UserPrincipal,
  db: D1Database
) {
  return query<any>(
    db,
    `SELECT * FROM personal_tasks
     WHERE owner_user_id = ? AND org_id = ? AND status != 'PROMOTED'
     ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at DESC`,
    [actor.id, actor.orgId]
  );
}

export async function createPersonalTask(
  actor: UserPrincipal,
  input: CreatePersonalTaskInput,
  db: D1Database
) {
  if (!input.title?.trim()) {
    throw new AuthorizationError("Task title is required.", "INVALID_INPUT");
  }

  if (input.parentTaskId) {
    const parent = await queryFirst<any>(
      db,
      `SELECT id, owner_user_id, parent_task_id FROM personal_tasks WHERE id = ? AND org_id = ?`,
      [input.parentTaskId, actor.orgId]
    );
    if (!parent || parent.owner_user_id !== actor.id) {
      throw new AuthorizationError("Personal parent task not found.", "NOT_FOUND");
    }
    if (parent.parent_task_id) {
      throw new AuthorizationError(
        "Only one visible nesting level is supported for subtasks.",
        "INVALID_INPUT"
      );
    }
  }

  const id = `ptsk_${crypto.randomUUID()}`;
  const now = Date.now();
  await execute(
    db,
    `INSERT INTO personal_tasks (
      id, org_id, owner_user_id, title, description, priority, status, due_date, section_label, parent_task_id, source_external_id, revision, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?, 1, ?)`,
    [
      id,
      actor.orgId,
      actor.id,
      input.title.trim(),
      input.description?.trim() || null,
      input.priority || "MEDIUM",
      input.dueDate || null,
      input.sectionLabel?.trim() || null,
      input.parentTaskId || null,
      input.sourceExternalId || null,
      now,
    ]
  );

  return queryFirst<any>(db, `SELECT * FROM personal_tasks WHERE id = ?`, [id]);
}

export async function getPersonalTask(
  actor: UserPrincipal,
  personalTaskId: string,
  db: D1Database
) {
  const task = await queryFirst<any>(
    db,
    `SELECT * FROM personal_tasks WHERE id = ? AND org_id = ?`,
    [personalTaskId, actor.orgId]
  );
  if (!task) {
    throw new AuthorizationError("Task not found.", "NOT_FOUND");
  }
  if (task.owner_user_id !== actor.id) {
    throw new AuthorizationError(
      "Personal tasks are strictly private to their owner.",
      "FORBIDDEN"
    );
  }
  return task;
}

export async function updatePersonalTask(
  actor: UserPrincipal,
  personalTaskId: string,
  patch: {
    title?: string;
    description?: string | null;
    status?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate?: string | null;
    sectionLabel?: string | null;
    expectedRevision?: number;
  },
  db: D1Database
) {
  const existing = await getPersonalTask(actor, personalTaskId, db);
  if (
    patch.expectedRevision !== undefined &&
    existing.revision !== patch.expectedRevision
  ) {
    throw new AuthorizationError(
      "Task was updated concurrently. Reload before saving.",
      "CONCURRENCY_CONFLICT"
    );
  }

  if (patch.status === "COMPLETED") {
    const openChild = await queryFirst<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM personal_tasks
       WHERE parent_task_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [personalTaskId]
    );
    if ((openChild?.cnt ?? 0) > 0) {
      throw new AuthorizationError(
        "Complete or cancel unfinished subtasks before completing the parent task.",
        "HAS_UNFINISHED_SUBTASKS"
      );
    }
  }

  const nextStatus = patch.status ?? existing.status;
  const completedAt =
    nextStatus === "COMPLETED" ? existing.completed_at || Date.now() : null;

  await execute(
    db,
    `UPDATE personal_tasks
     SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, section_label = ?, completed_at = ?, revision = revision + 1
     WHERE id = ? AND owner_user_id = ?`,
    [
      patch.title?.trim() || existing.title,
      patch.description !== undefined ? patch.description : existing.description,
      nextStatus,
      patch.priority ?? existing.priority,
      patch.dueDate !== undefined ? patch.dueDate : existing.due_date,
      patch.sectionLabel !== undefined ? patch.sectionLabel : existing.section_label,
      completedAt,
      personalTaskId,
      actor.id,
    ]
  );

  return getPersonalTask(actor, personalTaskId, db);
}

/**
 * Deliberate, reviewed transition from a private personal task into a shared project task (NAC-003).
 * Uses canonical createTask() so staff proposals remain PENDING_ASSIGNMENT for manager review.
 */
export async function promotePersonalTaskToProject(
  actor: UserPrincipal,
  personalTaskId: string,
  input: { projectId: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" },
  db: D1Database
) {
  const personal = await getPersonalTask(actor, personalTaskId, db);
  if (personal.status === "PROMOTED") {
    throw new AuthorizationError("Personal task has already been moved to a project.", "CONFLICT");
  }

  assertProjectAccess(actor, input.projectId);
  if (!canReadInternalNotes(actor, input.projectId)) {
    throw new AuthorizationError("Only internal project members can create project tasks.", "FORBIDDEN");
  }

  const created = await createTask(
    actor,
    {
      projectId: input.projectId,
      title: personal.title,
      description: personal.description || undefined,
      priority: input.priority || personal.priority || "MEDIUM",
      proposedDueDate: personal.due_date || undefined,
    },
    db
  );

  await execute(
    db,
    `UPDATE personal_tasks SET status = 'PROMOTED', promoted_project_task_id = ?, revision = revision + 1 WHERE id = ? AND owner_user_id = ?`,
    [created.id, personalTaskId, actor.id]
  );

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "PERSONAL_TASK",
    entityId: personalTaskId,
    action: "PERSONAL_TASK_PROMOTED_TO_PROJECT",
    scope: "PROJECT",
    newState: { projectId: input.projectId, projectTaskId: created.id },
  });

  return { personalTaskId, projectTaskId: created.id, status: created.status };
}

/**
 * Canonical task extensions: checklists, 1-level subtasks, and project-scoped collaborators.
 */
export async function addTaskChecklistItem(
  actor: UserPrincipal,
  taskId: string,
  label: string,
  db: D1Database
) {
  const task = await queryFirst<any>(
    db,
    `SELECT id, project_id, org_id FROM tasks WHERE id = ? AND org_id = ?`,
    [taskId, actor.orgId]
  );
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");
  if (!canReadInternalNotes(actor, task.project_id)) {
    throw new AuthorizationError("Forbidden", "FORBIDDEN");
  }
  if (!label?.trim()) {
    throw new AuthorizationError("Checklist item label is required.", "INVALID_INPUT");
  }

  const countRow = await queryFirst<{ cnt: number }>(
    db,
    `SELECT COUNT(*) as cnt FROM task_checklist_items WHERE task_id = ?`,
    [taskId]
  );
  const id = `chk_${crypto.randomUUID()}`;
  await execute(
    db,
    `INSERT INTO task_checklist_items (id, task_id, label, is_completed, item_order, created_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [id, taskId, label.trim(), (countRow?.cnt ?? 0) + 1, Date.now()]
  );
  return { id, taskId, label: label.trim(), isCompleted: false };
}

export async function toggleTaskChecklistItem(
  actor: UserPrincipal,
  itemId: string,
  isCompleted: boolean,
  db: D1Database
) {
  const item = await queryFirst<any>(
    db,
    `SELECT c.*, t.project_id, t.org_id FROM task_checklist_items c JOIN tasks t ON t.id = c.task_id WHERE c.id = ?`,
    [itemId]
  );
  if (!item || item.org_id !== actor.orgId) {
    throw new AuthorizationError("Checklist item not found.", "NOT_FOUND");
  }
  if (!canReadInternalNotes(actor, item.project_id)) {
    throw new AuthorizationError("Forbidden", "FORBIDDEN");
  }
  await execute(
    db,
    `UPDATE task_checklist_items SET is_completed = ? WHERE id = ?`,
    [isCompleted ? 1 : 0, itemId]
  );
  return { id: itemId, isCompleted };
}

export async function addTaskCollaborator(
  actor: UserPrincipal,
  taskId: string,
  collaboratorUserId: string,
  db: D1Database
) {
  const task = await queryFirst<any>(
    db,
    `SELECT id, project_id, org_id FROM tasks WHERE id = ? AND org_id = ?`,
    [taskId, actor.orgId]
  );
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");
  if (!canReadInternalNotes(actor, task.project_id)) {
    throw new AuthorizationError("Forbidden", "FORBIDDEN");
  }

  // Collaborator MUST already be an active internal member of the project (cannot grant access)
  const member = await queryFirst<any>(
    db,
    `SELECT project_role FROM project_memberships
     WHERE project_id = ? AND user_id = ? AND is_active = 1
       AND project_role IN ('MANAGER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'STAFF', 'ARCHITECT', 'DIRECTOR')`,
    [task.project_id, collaboratorUserId]
  );
  if (!member) {
    throw new AuthorizationError(
      "Collaborator must already be an active internal member of this project.",
      "FORBIDDEN"
    );
  }

  await execute(
    db,
    `INSERT OR IGNORE INTO task_collaborators (task_id, user_id, added_by_user_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [taskId, collaboratorUserId, actor.id, Date.now()]
  );
  return { taskId, userId: collaboratorUserId };
}

/**
 * Unified My Tasks read combining assigned project tasks (only for active project memberships)
 * and the owner's private personal tasks.
 */
export async function getMyTasksUnified(
  actor: UserPrincipal,
  db: D1Database
) {
  const projectTasks = await query<any>(
    db,
    `SELECT t.*, p.name as project_name, p.code as project_code, u.display_name as assignee_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN project_memberships pm ON pm.project_id = t.project_id AND pm.user_id = ? AND pm.is_active = 1
       AND pm.project_role IN ('MANAGER', 'PROJECT_MANAGER', 'TEAM_MEMBER', 'STAFF', 'ARCHITECT', 'DIRECTOR')
     LEFT JOIN users u ON u.id = t.assignee_user_id
     WHERE t.org_id = ? AND (t.assignee_user_id = ? OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = t.id AND tc.user_id = ?))
       AND p.is_archived = 0
     ORDER BY CASE WHEN t.effective_due_date IS NULL THEN 1 ELSE 0 END, t.effective_due_date ASC, t.created_at DESC`,
    [actor.id, actor.orgId, actor.id, actor.id]
  );

  const personal = await listPersonalTasks(actor, db);

  const items = [
    ...projectTasks.map((t) => ({
      id: t.id,
      scope: "PROJECT" as const,
      projectId: t.project_id,
      projectCode: t.project_code,
      projectName: t.project_name,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.effective_due_date,
      isOverdue: computeIsOverdue(t),
      sectionLabel: t.section_label || null,
      assigneeName: t.assignee_name || actor.name,
      revision: t.revision,
      link: `/projects/${t.project_id}/tasks?taskId=${t.id}`,
    })),
    ...personal.map((pt) => ({
      id: pt.id,
      scope: "PERSONAL" as const,
      projectId: null,
      projectCode: "PERSONAL",
      projectName: "Personal (Private)",
      title: pt.title,
      status: pt.status,
      priority: pt.priority,
      dueDate: pt.due_date,
      isOverdue: computeIsOverdue({ status: pt.status, effective_due_date: pt.due_date }),
      sectionLabel: pt.section_label || null,
      assigneeName: actor.name,
      revision: pt.revision,
      link: `/waiting?personalTaskId=${pt.id}`,
    })),
  ];

  return { items };
}

/**
 * Authorized Team-Member Task View (NAC-003 / 02-simple-workspace.md).
 * Shows only shared project tasks assigned to targetUserId in projects where actor also holds
 * internal read access. Never exposes private personal_tasks or out-of-scope projects.
 */
export async function getTeamMemberProjectTasks(
  actor: UserPrincipal,
  targetUserId: string,
  db: D1Database
) {
  const isInternalActor =
    hasCapability(actor, "ADMIN") ||
    hasCapability(actor, "OWNER") ||
    actor.projectMemberships.some((m) =>
      (m.roles || [m.projectRole]).some((r) =>
        ["MANAGER", "PROJECT_MANAGER", "TEAM_MEMBER", "STAFF", "ARCHITECT", "DIRECTOR"].includes(r || "")
      )
    );
  if (!isInternalActor) {
    throw new AuthorizationError(
      "Team task views are restricted to internal practice members.",
      "FORBIDDEN"
    );
  }

  const rows = await query<any>(
    db,
    `SELECT t.*, p.name as project_name, p.code as project_code, u.display_name as assignee_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN project_memberships target_pm ON target_pm.project_id = t.project_id AND target_pm.user_id = ? AND target_pm.is_active = 1
     LEFT JOIN users u ON u.id = t.assignee_user_id
     WHERE t.org_id = ? AND p.is_archived = 0
       AND (t.assignee_user_id = ? OR EXISTS (SELECT 1 FROM task_collaborators tc WHERE tc.task_id = t.id AND tc.user_id = ?))
     ORDER BY CASE WHEN t.effective_due_date IS NULL THEN 1 ELSE 0 END, t.effective_due_date ASC`,
    [targetUserId, actor.orgId, targetUserId, targetUserId]
  );

  // Filter strictly to projects the viewing actor has internal permission to read
  const visible = rows.filter((t) => canReadInternalNotes(actor, t.project_id));
  return {
    targetUserId,
    items: visible.map((t) => ({
      id: t.id,
      scope: "PROJECT" as const,
      projectId: t.project_id,
      projectCode: t.project_code,
      projectName: t.project_name,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.effective_due_date,
      isOverdue: computeIsOverdue(t),
      assigneeName: t.assignee_name || "Unassigned",
      link: `/projects/${t.project_id}/tasks?taskId=${t.id}`,
    })),
  };
}
