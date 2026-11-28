import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { assertTaskAccess } from "@/server/domain/tasks/service";
import { getPersonalTask } from "@/server/domain/tasks/personal-service";
import { labels, taskTemplates } from "@/shared/studio/definitions";
export async function studioPreferences(
  db: D1Database,
  p: UserPrincipal,
  scope: string,
  settings?: unknown,
) {
  if (scope !== "personal") {
    assertTaskAccess(p, scope);
    const project = await db
      .prepare("SELECT id FROM projects WHERE id=? AND org_id=?")
      .bind(scope, p.orgId)
      .first();
    if (!project)
      throw new AuthorizationError("Project unavailable.", "NOT_FOUND");
  }
  if (settings !== undefined) {
    const s = settings as Record<string, unknown>;
    if (
      !s ||
      JSON.stringify(s).length > 12000 ||
      !Array.isArray(s.views) ||
      s.views.length > 10 ||
      s.views.some(
        (v: any) =>
          !v ||
          ["labelFilter", "projectFilter", "assigneeFilter"].some(
            (k) =>
              v[k] !== undefined &&
              (typeof v[k] !== "string" || v[k].length > 200),
          ) ||
          typeof v.name !== "string" ||
          v.name.length > 40 ||
          !["LIST", "BOARD", "CALENDAR"].includes(v.view) ||
          !["NONE", "STATUS", "ASSIGNEE", "DUE"].includes(v.group) ||
          !["COMFORTABLE", "COMPACT"].includes(v.density) ||
          typeof v.search !== "string" ||
          v.search.length > 200 ||
          !["ALL", "UPCOMING", "OVERDUE", "COMPLETED", "CANCELLED"].includes(
            v.filter,
          ) ||
          !["DUE", "TITLE"].includes(v.sort),
      )
    )
      throw new AuthorizationError(
        "Choose up to ten valid saved views.",
        "INVALID_INPUT",
      );
    await db
      .prepare(
        "INSERT INTO studio_views VALUES(?,?,?,?,?) ON CONFLICT(org_id,user_id,scope_key) DO UPDATE SET settings_json=excluded.settings_json,updated_at=excluded.updated_at",
      )
      .bind(
        p.orgId,
        p.id,
        scope,
        JSON.stringify({ views: s.views }),
        Date.now(),
      )
      .run();
  }
  const row = await db
    .prepare(
      "SELECT settings_json FROM studio_views WHERE org_id=? AND user_id=? AND scope_key=?",
    )
    .bind(p.orgId, p.id, scope)
    .first<{ settings_json: string }>();
  return row ? JSON.parse(row.settings_json) : { views: [] };
}
export async function taskStudio(
  db: D1Database,
  p: UserPrincipal,
  id: string,
  scope: string,
  input?: any,
) {
  let projectId: string | undefined;
  if (scope === "PERSONAL") {
    const task = await getPersonalTask(p, id, db);
    if (input !== undefined && task.status === "PROMOTED")
      throw new AuthorizationError(
        "This task was moved to a project.",
        "INVALID_STATE",
      );
  } else if (scope === "PROJECT") {
    const task = await db
      .prepare("SELECT project_id FROM tasks WHERE id=? AND org_id=?")
      .bind(id, p.orgId)
      .first<{ project_id: string }>();
    if (!task) throw new AuthorizationError("Task unavailable.", "NOT_FOUND");
    projectId = task.project_id;
    assertTaskAccess(p, projectId);
  } else throw new AuthorizationError("Choose a task scope.", "INVALID_INPUT");
  if (input?.title !== undefined) {
    if (
      !projectId ||
      !hasCapability(p, "MANAGER", projectId) ||
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 300
    )
      throw new AuthorizationError(
        "Only a project manager can edit a valid project task title.",
        "FORBIDDEN",
      );
    const guard = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM tasks t JOIN projects p ON p.id=t.project_id JOIN project_memberships m ON m.project_id=p.id AND m.org_id=p.org_id WHERE t.id=? AND t.org_id=? AND t.revision=? AND t.status NOT IN ('COMPLETED','CANCELLED') AND p.is_archived=0 AND m.user_id=? AND m.project_role='MANAGER' AND m.is_active=1) THEN 1 ELSE 0 END",
        )
        .bind(guard, id, p.orgId, input.expectedRevision, p.id),
      db
        .prepare("UPDATE tasks SET title=?,revision=revision+1 WHERE id=?")
        .bind(input.title.trim(), id),
      db
        .prepare(
          "INSERT INTO task_events(id,task_id,actor_id,event_type,new_state,reason,created_at) VALUES(?,?,?,'TASK_TITLE_CHANGED',?,'Edited from task workspace',?)",
        )
        .bind(crypto.randomUUID(), id, p.id, input.title.trim(), Date.now()),
      db.prepare("DELETE FROM command_assertions WHERE id=?").bind(guard),
    ]);
    return { ok: true };
  }
  if (input !== undefined) {
    if (projectId && !hasCapability(p, "MANAGER", projectId))
      throw new AuthorizationError(
        "A project manager manages task labels and templates.",
        "FORBIDDEN",
      );
    const selected = input.labels;
    if (
      !Array.isArray(selected) ||
      selected.length > 5 ||
      selected.some((l: any) => !labels.includes(l))
    )
      throw new AuthorizationError("Choose supported labels.", "INVALID_INPUT");
    const statements: D1PreparedStatement[] = [];
    const guard = crypto.randomUUID();
    if (projectId)
      statements.push(
        db
          .prepare(
            "INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM projects p JOIN project_memberships m ON m.project_id=p.id JOIN users u ON u.id=m.user_id WHERE p.id=? AND p.org_id=? AND p.is_archived=0 AND m.user_id=? AND m.is_active=1 AND m.project_role='MANAGER' AND u.status='ACTIVE') THEN 1 ELSE 0 END",
          )
          .bind(guard, projectId, p.orgId, p.id),
      );
    statements.push(
      db
        .prepare(
          "INSERT INTO studio_task_labels VALUES(?,?,?,?) ON CONFLICT(org_id,task_id,task_scope) DO UPDATE SET labels_json=excluded.labels_json",
        )
        .bind(p.orgId, id, scope, JSON.stringify([...new Set(selected)])),
    );
    if (input.template !== undefined) {
      const template = taskTemplates.find((t) => t.name === input.template);
      if (!template)
        throw new AuthorizationError(
          "Choose a task template.",
          "INVALID_INPUT",
        );
      // Stable IDs make reapplying the same checklist template safe.
      for (const [i, label] of template.checklist.entries())
        statements.push(
          scope === "PERSONAL"
            ? db
                .prepare(
                  "INSERT OR IGNORE INTO personal_task_checklist_items(id,personal_task_id,label,is_completed,item_order,created_at) VALUES(?,?,?,0,?,?)",
                )
                .bind(
                  `tpl:${id}:${template.name}:${i}`,
                  id,
                  label,
                  i,
                  Date.now(),
                )
            : db
                .prepare(
                  "INSERT OR IGNORE INTO task_checklist_items(id,task_id,label,is_completed,item_order,created_at) VALUES(?,?,?,0,?,?)",
                )
                .bind(
                  `tpl:${id}:${template.name}:${i}`,
                  id,
                  label,
                  i,
                  Date.now(),
                ),
        );
    }
    if (projectId)
      statements.push(
        db.prepare("DELETE FROM command_assertions WHERE id=?").bind(guard),
      );
    await db.batch(statements);
  }
  const row = await db
    .prepare(
      "SELECT labels_json FROM studio_task_labels WHERE org_id=? AND task_id=? AND task_scope=?",
    )
    .bind(p.orgId, id, scope)
    .first<{ labels_json: string }>();
  return { labels: row ? JSON.parse(row.labels_json) : [] };
}
