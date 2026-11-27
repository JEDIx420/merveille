import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst } from "@/server/db";
import {
  assertTaskAccess,
  computeIsOverdue,
  listProjectTasks,
} from "@/server/domain/tasks/service";
import { getPersonalTask } from "@/server/domain/tasks/personal-service";
import { businessDateISO } from "@/shared/config";

export async function preferences(db: D1Database, actor: UserPrincipal) {
  const row = await queryFirst<any>(
    db,
    "SELECT * FROM workspace_preferences WHERE org_id=? AND user_id=?",
    [actor.orgId, actor.id],
  );
  return {
    view: row?.view_mode || "LIST",
    favorites: row ? JSON.parse(row.favorite_projects) : [],
  };
}
export async function savePreferences(
  db: D1Database,
  actor: UserPrincipal,
  input: any,
) {
  const old = await preferences(db, actor);
  const view = input.view ?? old.view;
  const favorites = input.favorites ?? old.favorites;
  if (
    !["LIST", "BOARD", "CALENDAR"].includes(view) ||
    !Array.isArray(favorites) ||
    favorites.length > 30 ||
    favorites.some((id: any) => typeof id !== "string")
  )
    throw new AuthorizationError(
      "Choose a valid workspace preference.",
      "INVALID_INPUT",
    );
  const ids = [...new Set<string>(favorites)];
  for (const id of ids) {
    const project = await queryFirst<any>(
      db,
      "SELECT org_id FROM projects WHERE id=?",
      [id],
    );
    if (
      !project ||
      project.org_id !== actor.orgId ||
      !(
        hasCapability(actor, "ADMIN") ||
        hasCapability(actor, "OWNER") ||
        actor.projectMemberships.some((m) => m.projectId === id)
      )
    )
      throw new AuthorizationError("Project unavailable.", "FORBIDDEN");
  }
  await db
    .prepare(
      `INSERT INTO workspace_preferences VALUES(?,?,?,?,?) ON CONFLICT(org_id,user_id) DO UPDATE SET view_mode=excluded.view_mode,favorite_projects=excluded.favorite_projects,updated_at=excluded.updated_at`,
    )
    .bind(actor.orgId, actor.id, view, JSON.stringify(ids), Date.now())
    .run();
  return { view, favorites: ids };
}
export async function projectProgress(
  db: D1Database,
  actor: UserPrincipal,
  projectId: string,
) {
  const tasks = await listProjectTasks(actor, projectId, db);
  const current = tasks.filter((t) => t.status !== "CANCELLED");
  const completed = current.filter((t) => t.status === "COMPLETED").length;
  const today = businessDateISO();
  const end = new Date(today + "T00:00:00Z");
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 55);
  const events = await query<any>(
    db,
    `SELECT e.created_at FROM task_events e JOIN tasks t ON t.id=e.task_id WHERE t.project_id=? AND t.org_id=? AND e.event_type='TASK_COMPLETED' AND e.created_at>=? ORDER BY e.created_at`,
    [projectId, actor.orgId, start.getTime() - 19800000],
  );
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return { date: d.toISOString().slice(0, 10), count: 0 };
  });
  for (const e of events) {
    const day = businessDateISO(new Date(e.created_at));
    const index = Math.floor((Date.parse(day) - start.getTime()) / 604800000);
    if (index >= 0 && index < 8) weeks[index].count++;
  }
  return {
    total: current.length,
    completed,
    open: current.length - completed,
    overdue: current.filter(computeIsOverdue).length,
    percent: current.length
      ? Math.round((completed / current.length) * 100)
      : 0,
    weeks,
    historyAvailable: events.length > 0,
  };
}
export async function personalDetail(
  db: D1Database,
  actor: UserPrincipal,
  id: string,
) {
  const task = await getPersonalTask(actor, id, db);
  const [checklists, comments, subtasks] = await Promise.all([
    query<any>(
      db,
      "SELECT * FROM personal_task_checklist_items WHERE personal_task_id=? ORDER BY item_order",
      [id],
    ),
    query<any>(
      db,
      "SELECT * FROM personal_task_comments WHERE personal_task_id=? ORDER BY created_at",
      [id],
    ),
    query<any>(
      db,
      "SELECT * FROM personal_tasks WHERE parent_task_id=? AND owner_user_id=? AND org_id=? AND status!='PROMOTED'",
      [id, actor.id, actor.orgId],
    ),
  ]);
  return { task, checklists, comments, subtasks, events: [], personal: true };
}
