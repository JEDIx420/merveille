/**
 * Project Tasks, Deadlines, Completion History, and Internal Evidence Domain Service.
 * Enforces manager deadline authority, staff creation/completion, manager reopening,
 * optimistic concurrency, and strict internal confidentiality (clients/consultants denied).
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError, canReadInternalNotes } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "../identity/service";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus =
  | "PENDING_ASSIGNMENT"
  | "TODO"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";

export interface CreateTaskInput {
  projectId: string;
  stageId?: string;
  changeRequestId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  proposedAssigneeId?: string;
  proposedDueDate?: string; // YYYY-MM-DD
}

export interface AssignTaskInput {
  assigneeUserId: string;
  dueDate: string; // YYYY-MM-DD
  priority?: TaskPriority;
  reason?: string;
  expectedRevision?: number;
}

export interface ChangeDeadlineInput {
  dueDate: string; // YYYY-MM-DD
  reason: string;
  expectedRevision?: number;
}

export interface CompleteTaskInput {
  completionNote?: string;
  expectedRevision?: number;
}

export interface ReopenTaskInput {
  reason: string;
  category: "CORRECTION_DEFECT" | "CLIENT_SCOPE_CHANGE" | "EXTERNAL_DEPENDENCY" | "ADMINISTRATIVE";
  newDueDate?: string;
  expectedRevision?: number;
}

export interface BlockTaskInput {
  reason: string;
  expectedRevision?: number;
}

function createEventId() {
  return `tev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Check that actor can view/manage internal practice tasks (AC-015).
 * Clients and consultants are strictly denied.
 */
export function assertTaskAccess(actor: UserPrincipal, projectId: string) {
  assertProjectAccess(actor, projectId);

  if (!canReadInternalNotes(actor, projectId)) {
    throw new AuthorizationError(
      "Tasks and completion history are internal practice records.",
      "FORBIDDEN"
    );
  }
}

/**
 * Check if a task is overdue based on current date.
 */
export function computeIsOverdue(task: { status: string; effective_due_date: string | null }): boolean {
  if (task.status === "COMPLETED" || task.status === "CANCELLED" || !task.effective_due_date) {
    return false;
  }
  const today = new Date().toISOString().split("T")[0];
  return task.effective_due_date < today;
}

/**
 * Create a new task (REQ-TSK-001, AC-013).
 * Staff can propose tasks; managers can directly assign and set official deadline.
 */
export async function createTask(
  actor: UserPrincipal,
  input: CreateTaskInput,
  db: D1Database
) {
  assertTaskAccess(actor, input.projectId);

  if (!input.title || input.title.trim().length === 0) {
    throw new AuthorizationError("Task title is required.", "INVALID_INPUT");
  }

  const taskId = `tsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  const isManagerOrAdmin = actor.role === "MANAGER" || actor.role === "ADMIN" || actor.role === "OWNER";
  const initialStatus: TaskStatus = isManagerOrAdmin && input.proposedAssigneeId ? "TODO" : "PENDING_ASSIGNMENT";
  const officialAssignee = isManagerOrAdmin ? input.proposedAssigneeId || null : null;
  const officialDueDate = isManagerOrAdmin ? input.proposedDueDate || null : null;

  await execute(
    db,
    `INSERT INTO tasks (id, org_id, project_id, stage_id, change_request_id, title, description, priority, status, creator_user_id, assignee_user_id, original_due_date, effective_due_date, reopen_count, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
    [
      taskId,
      actor.orgId,
      input.projectId,
      input.stageId || null,
      input.changeRequestId || null,
      input.title.trim(),
      input.description || null,
      input.priority || "MEDIUM",
      initialStatus,
      actor.id,
      officialAssignee,
      officialDueDate,
      officialDueDate,
      now,
    ]
  );

  // Record creation event
  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_CREATED', ?, 'Task proposed by practice member', ?)`,
    [createEventId(), taskId, actor.id, initialStatus, now]
  );

  return { id: taskId, status: initialStatus };
}

/**
 * Assign task to an assigned team member with official manager deadline (AC-013).
 * Guarded: Only MANAGER, ADMIN, or OWNER can set or change official assignments.
 */
export async function assignTask(
  actor: UserPrincipal,
  taskId: string,
  input: AssignTaskInput,
  db: D1Database
) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only project managers can assign tasks or set official deadlines.", "FORBIDDEN");
  }

  // Concurrency check
  if (input.expectedRevision && task.revision !== input.expectedRevision) {
    throw new AuthorizationError("Task was modified concurrently. Refresh and retry.", "CONCURRENCY_CONFLICT");
  }

  // Validate assignee project membership
  const membership = await queryFirst(
    db,
    "SELECT id FROM project_memberships WHERE project_id = ? AND user_id = ? AND is_active = 1",
    [task.project_id, input.assigneeUserId]
  );
  if (!membership) {
    throw new AuthorizationError("Assignee is not an active member of this project.", "INVALID_ASSIGNEE");
  }

  const now = Date.now();
  const originalDueDate = task.original_due_date || input.dueDate;
  const newStatus: TaskStatus = task.status === "PENDING_ASSIGNMENT" ? "TODO" : task.status;

  await execute(
    db,
    `UPDATE tasks
     SET assignee_user_id = ?, original_due_date = ?, effective_due_date = ?, priority = COALESCE(?, priority), status = ?, revision = revision + 1
     WHERE id = ?`,
    [input.assigneeUserId, originalDueDate, input.dueDate, input.priority || null, newStatus, taskId]
  );

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_ASSIGNED', ?, ?, ?, ?)`,
    [
      createEventId(),
      taskId,
      actor.id,
      task.assignee_user_id || "UNASSIGNED",
      input.assigneeUserId,
      input.reason || `Assigned with due date ${input.dueDate}`,
      now,
    ]
  );

  return { success: true, taskId, assigneeId: input.assigneeUserId, dueDate: input.dueDate, status: newStatus };
}

/**
 * Revise official task deadline (AC-013).
 * Manager-only action; prior due dates and reason are preserved in task_events.
 */
export async function changeTaskDeadline(
  actor: UserPrincipal,
  taskId: string,
  input: ChangeDeadlineInput,
  db: D1Database
) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only project managers can change official task deadlines.", "FORBIDDEN");
  }

  if (input.expectedRevision && task.revision !== input.expectedRevision) {
    throw new AuthorizationError("Task was modified concurrently. Refresh and retry.", "CONCURRENCY_CONFLICT");
  }

  const now = Date.now();
  await execute(
    db,
    "UPDATE tasks SET effective_due_date = ?, revision = revision + 1 WHERE id = ?",
    [input.dueDate, taskId]
  );

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_DEADLINE_CHANGED', ?, ?, ?, ?)`,
    [createEventId(), taskId, actor.id, task.effective_due_date || "NONE", input.dueDate, input.reason, now]
  );

  return { success: true, taskId, effectiveDueDate: input.dueDate };
}

/**
 * Start work on a task.
 */
export async function startTask(actor: UserPrincipal, taskId: string, db: D1Database) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  if (task.change_request_id) {
    const cr = await queryFirst<any>(db, "SELECT status FROM change_requests WHERE id = ?", [task.change_request_id]);
    if (!cr || (cr.status !== "AUTHORIZED" && cr.status !== "IN_PROGRESS" && cr.status !== "COMPLETED")) {
      throw new AuthorizationError(
        "Cannot start task linked to unauthorized change request. Manager authorization and payment confirmation required.",
        "CHANGE_REQUEST_NOT_AUTHORIZED"
      );
    }
  }

  const now = Date.now();
  await execute(db, "UPDATE tasks SET status = 'IN_PROGRESS', revision = revision + 1 WHERE id = ?", [taskId]);

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_STARTED', ?, 'IN_PROGRESS', 'Work started', ?)`,
    [createEventId(), taskId, actor.id, task.status, now]
  );

  return { success: true, taskId, status: "IN_PROGRESS" };
}

/**
 * Complete a task (AC-014).
 * Assignee or manager marks task as completed.
 */
export async function completeTask(
  actor: UserPrincipal,
  taskId: string,
  input: CompleteTaskInput,
  db: D1Database
) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  if (input.expectedRevision && task.revision !== input.expectedRevision) {
    throw new AuthorizationError("Task was modified concurrently. Refresh and retry.", "CONCURRENCY_CONFLICT");
  }

  const now = Date.now();
  await execute(
    db,
    "UPDATE tasks SET status = 'COMPLETED', completed_at = ?, completed_by_user_id = ?, revision = revision + 1 WHERE id = ?",
    [now, actor.id, taskId]
  );

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_COMPLETED', ?, 'COMPLETED', ?, ?)`,
    [createEventId(), taskId, actor.id, task.status, input.completionNote || "Work completed by assignee", now]
  );

  return { success: true, taskId, status: "COMPLETED", completedAt: now };
}

/**
 * Reopen a completed task (AC-014).
 * Guarded: Only MANAGER, ADMIN, or OWNER can reopen completed work.
 * Preserves original completion and records rework event with reason and category.
 */
export async function reopenTask(
  actor: UserPrincipal,
  taskId: string,
  input: ReopenTaskInput,
  db: D1Database
) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only project managers can reopen completed tasks.", "FORBIDDEN");
  }

  if (input.expectedRevision && task.revision !== input.expectedRevision) {
    throw new AuthorizationError("Task was modified concurrently. Refresh and retry.", "CONCURRENCY_CONFLICT");
  }

  const now = Date.now();
  const effectiveDueDate = input.newDueDate || task.effective_due_date;

  await execute(
    db,
    `UPDATE tasks
     SET status = 'TODO', effective_due_date = ?, reopen_count = reopen_count + 1, revision = revision + 1
     WHERE id = ?`,
    [effectiveDueDate, taskId]
  );

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_REOPENED', 'COMPLETED', 'TODO', ?, ?)`,
    [createEventId(), taskId, actor.id, `[${input.category}] ${input.reason}`, now]
  );

  return { success: true, taskId, status: "TODO", reopenCount: task.reopen_count + 1 };
}

/**
 * Block a task with a reason.
 */
export async function blockTask(
  actor: UserPrincipal,
  taskId: string,
  input: BlockTaskInput,
  db: D1Database
) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  const now = Date.now();
  await execute(
    db,
    "UPDATE tasks SET status = 'BLOCKED', blocker_reason = ?, revision = revision + 1 WHERE id = ?",
    [input.reason, taskId]
  );

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_BLOCKED', ?, 'BLOCKED', ?, ?)`,
    [createEventId(), taskId, actor.id, task.status, input.reason, now]
  );

  return { success: true, taskId, status: "BLOCKED", reason: input.reason };
}

/**
 * Cancel a task (manager-only).
 */
export async function cancelTask(
  actor: UserPrincipal,
  taskId: string,
  reason: string,
  db: D1Database
) {
  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only project managers can cancel tasks.", "FORBIDDEN");
  }

  const now = Date.now();
  await execute(
    db,
    "UPDATE tasks SET status = 'CANCELLED', revision = revision + 1 WHERE id = ?",
    [taskId]
  );

  await execute(
    db,
    `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
     VALUES (?, ?, ?, 'TASK_CANCELLED', ?, 'CANCELLED', ?, ?)`,
    [createEventId(), taskId, actor.id, task.status, reason, now]
  );

  return { success: true, taskId, status: "CANCELLED" };
}

/**
 * Add an internal comment to a task (AC-015).
 */
export async function addTaskComment(
  actor: UserPrincipal,
  taskId: string,
  commentText: string,
  attachmentFileId?: string,
  db?: D1Database
) {
  if (!db) throw new Error("Database instance required");

  const task = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  const commentId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await execute(
    db,
    `INSERT INTO task_comments (id, task_id, author_id, comment_text, attachment_file_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [commentId, taskId, actor.id, commentText, attachmentFileId || null, now]
  );

  return { commentId, taskId };
}

/**
 * Get task details, events history, and comments (AC-014, AC-015).
 */
export async function getTask(actor: UserPrincipal, taskId: string, db: D1Database) {
  const task = await queryFirst<any>(
    db,
    `SELECT t.*,
            c.display_name as creator_name,
            a.display_name as assignee_name,
            cmp.display_name as completed_by_name,
            s.name as stage_name
     FROM tasks t
     LEFT JOIN users c ON c.id = t.creator_user_id
     LEFT JOIN users a ON a.id = t.assignee_user_id
     LEFT JOIN users cmp ON cmp.id = t.completed_by_user_id
     LEFT JOIN project_stages s ON s.id = t.stage_id
     WHERE t.id = ?`,
    [taskId]
  );

  if (!task) throw new AuthorizationError("Task not found.", "NOT_FOUND");

  assertTaskAccess(actor, task.project_id);

  const events = await query(
    db,
    `SELECT te.*, u.display_name as actor_name
     FROM task_events te
     LEFT JOIN users u ON u.id = te.actor_id
     WHERE te.task_id = ?
     ORDER BY te.created_at ASC`,
    [taskId]
  );

  const comments = await query(
    db,
    `SELECT tc.*, u.display_name as author_name, f.file_name as attachment_name
     FROM task_comments tc
     LEFT JOIN users u ON u.id = tc.author_id
     LEFT JOIN files f ON f.id = tc.attachment_file_id
     WHERE tc.task_id = ?
     ORDER BY tc.created_at ASC`,
    [taskId]
  );

  const isOverdue = computeIsOverdue(task);

  return { task: { ...task, isOverdue }, events, comments };
}

/**
 * List tasks for an authorized project with filters (AC-015).
 */
export async function listProjectTasks(
  actor: UserPrincipal,
  projectId: string,
  db: D1Database,
  options: { status?: string; assigneeId?: string } = {}
) {
  assertTaskAccess(actor, projectId);

  let sql = `
    SELECT t.*,
           c.display_name as creator_name,
           a.display_name as assignee_name,
           s.name as stage_name
    FROM tasks t
    LEFT JOIN users c ON c.id = t.creator_user_id
    LEFT JOIN users a ON a.id = t.assignee_user_id
    LEFT JOIN project_stages s ON s.id = t.stage_id
    WHERE t.project_id = ?
  `;
  const params: any[] = [projectId];

  if (options.status && options.status !== "ALL") {
    sql += " AND t.status = ?";
    params.push(options.status);
  }

  if (options.assigneeId) {
    sql += " AND t.assignee_user_id = ?";
    params.push(options.assigneeId);
  }

  sql += " ORDER BY t.created_at DESC";

  const rows = await query<any>(db, sql, params);

  return rows.map((r) => ({
    ...r,
    isOverdue: computeIsOverdue(r),
  }));
}
