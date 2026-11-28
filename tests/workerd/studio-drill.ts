import { saveRule, listRules } from "../../src/server/automations/service";
import { runAutomations } from "../../src/server/automations/runner";
import {
  studioPreferences,
  taskStudio,
} from "../../src/server/workspace/studio";
import { ruleTemplates } from "../../src/shared/studio/definitions";
import { NotificationService } from "../../src/server/notifications/service";
import type { UserPrincipal } from "../../src/server/auth/principal";
export async function studioDrill(
  db: D1Database,
  manager: UserPrincipal,
  staff: UserPrincipal,
  projectId: string,
  passed: string[],
) {
  const check = (v: unknown, m: string) => {
    if (!v) throw new Error(m);
  };
  const reject = async (fn: () => Promise<unknown>, m: string) => {
    let denied = false;
    try {
      await fn();
    } catch {
      denied = true;
    }
    check(denied, m);
  };
  await studioPreferences(db, staff, projectId, {
    views: [
      {
        name: "Site work",
        view: "BOARD",
        group: "STATUS",
        density: "COMPACT",
        search: "",
        filter: "ALL",
        sort: "DUE",
      },
    ],
  });
  check(
    (await studioPreferences(db, staff, projectId)).views[0].name ===
      "Site work",
    "Studio view lost",
  );
  check(
    !(await studioPreferences(db, manager, projectId)).views.length,
    "View leaked to colleague",
  );
  let d = structuredClone(ruleTemplates[0].definition);
  d.actions[0].assigneeId = staff.id;
  await reject(
    () =>
      saveRule(
        db,
        staff,
        { projectId, operation: "publish", name: "Denied rule", definition: d },
        true,
      ),
    "Staff published a project rule",
  );
  await reject(
    () =>
      saveRule(
        db,
        manager,
        { projectId, operation: "publish", name: "Gated rule", definition: d },
        false,
      ),
    "Runtime gate bypassed",
  );
  const draft: any = await saveRule(
    db,
    staff,
    { projectId, operation: "save", name: "Site visit routine", definition: d },
    false,
  );
  check(
    (await listRules(db, manager, projectId)).rules.length === 1,
    "Draft unavailable to manager",
  );
  await saveRule(
    db,
    manager,
    {
      projectId,
      id: draft.id,
      expectedRevision: draft.revision,
      operation: "publish",
      name: "Site visit routine",
      definition: d,
    },
    true,
  );
  await db
    .prepare("UPDATE automation_rules SET next_run_at=0 WHERE id=?")
    .bind(draft.id)
    .run();
  const now = Date.now() + 1000;
  await Promise.all([runAutomations(db, now), runAutomations(db, now)]);
  const count = await db
    .prepare("SELECT COUNT(*) n FROM tasks WHERE id LIKE 'auto:%'")
    .first<{ n: number }>();
  check(count?.n === 1, "Concurrent recurring runs duplicated task or failed");
  const task = await db
    .prepare("SELECT * FROM tasks WHERE id LIKE 'auto:%'")
    .first<any>();
  check(
    task.assignee_user_id === staff.id &&
      task.status === "TODO" &&
      task.effective_due_date,
    "Routine assignment missing",
  );
  const audit = await db
    .prepare(
      "SELECT actor_id FROM audit_events WHERE action='AUTOMATION_EFFECT' LIMIT 1",
    )
    .first<any>();
  check(
    audit.actor_id === "system:automation",
    "Runner impersonated publisher",
  );
  await taskStudio(db, manager, task.id, "PROJECT", {
    labels: ["Coordination"],
    template: "Site visit",
  });
  await taskStudio(db, manager, task.id, "PROJECT", {
    labels: ["Coordination"],
    template: "Site visit",
  });
  check(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM task_checklist_items WHERE task_id=?")
        .bind(task.id)
        .first<any>()
    ).n === 3,
    "Template duplicated checklist",
  );
  await reject(
    () =>
      taskStudio(db, staff, task.id, "PROJECT", { labels: ["Architecture"] }),
    "Staff changed controlled project labels",
  );
  passed.push(
    "studio: saved views private; staff draft/manager publication; Free gate; concurrent weekly idempotency; system audit; checklist replay",
  );
  // Completion events only after publication; labels constrain matching. Generated tasks never chain.
  d = {
    ...structuredClone(ruleTemplates[2].definition),
    actions: [
      {
        type: "REMIND",
        title: "Review coordination",
        dueDays: 0,
        assigneeId: staff.id,
      },
    ],
  };
  const event: any = await saveRule(
    db,
    manager,
    {
      projectId,
      operation: "publish",
      name: "Coordination reminder",
      definition: d,
    },
    true,
  );
  await db
    .prepare(
      "INSERT INTO tasks(id,org_id,project_id,title,status,creator_user_id,assignee_user_id,completed_at,created_at) VALUES('studio-source',?,?,'Fictional coordination','COMPLETED',?,?,?,?)",
    )
    .bind(
      manager.orgId,
      projectId,
      staff.id,
      staff.id,
      Date.now() + 2000,
      Date.now(),
    )
    .run();
  await taskStudio(db, manager, "studio-source", "PROJECT", {
    labels: ["Coordination"],
  });
  await runAutomations(db, Date.now() + 3000);
  await runAutomations(db, Date.now() + 3000);
  const n = await db
    .prepare(
      "SELECT * FROM notifications WHERE source_entity_type='AUTOMATION'",
    )
    .all<any>();
  check(n.results.length === 1, "Completion reminder duplicate/missing");
  check(
    await NotificationService.eligible(db, n.results[0]),
    "Current internal automation reminder hidden",
  );
  await db
    .prepare(
      "UPDATE project_memberships SET is_active=0 WHERE project_id=? AND user_id=?",
    )
    .bind(projectId, staff.id)
    .run();
  check(
    !(await NotificationService.eligible(db, n.results[0])),
    "Revoked member retained automation reminder",
  );
  await db
    .prepare(
      "UPDATE project_memberships SET is_active=1 WHERE project_id=? AND user_id=?",
    )
    .bind(projectId, staff.id)
    .run();
  const live: any = (await listRules(db, manager, projectId)).rules.find(
    (r) => r.id === event.id,
  );
  await saveRule(
    db,
    manager,
    {
      projectId,
      id: live.id,
      expectedRevision: live.revision,
      operation: "save",
      name: "Changed draft",
      definition: {
        ...d,
        actions: [
          {
            type: "CREATE_TASK",
            title: "Must stay draft",
            assigneeId: staff.id,
            dueDays: 0,
          },
        ],
      },
    },
    true,
  );
  const pub = await db
    .prepare(
      "SELECT definition_json FROM automation_publications WHERE rule_id=? AND revision=?",
    )
    .bind(event.id, event.revision)
    .first<any>();
  check(
    JSON.parse(pub.definition_json).actions[0].type === "REMIND",
    "Draft edited immutable publication",
  );
  // Revoke manager between publication and next scheduled attempt.
  await db
    .prepare("UPDATE automation_rules SET next_run_at=0 WHERE id=?")
    .bind(draft.id)
    .run();
  await db
    .prepare(
      "UPDATE project_memberships SET is_active=0 WHERE project_id=? AND user_id=?",
    )
    .bind(projectId, manager.id)
    .run();
  await runAutomations(db, now + 86400000);
  check(
    (
      await db
        .prepare("SELECT COUNT(*) n FROM tasks WHERE id LIKE 'auto:%'")
        .first<any>()
    ).n === 1,
    "Revoked manager delegation ran",
  );
  await db
    .prepare(
      "UPDATE project_memberships SET is_active=1 WHERE project_id=? AND user_id=?",
    )
    .bind(projectId, manager.id)
    .run();
  passed.push(
    "studio: completion matching, label condition, generated-task loop prevention, notification revocation, immutable publication, revoked manager blocked",
  );
  // Keep subsequent historical test snapshots independent of these automation fixtures.
  await db.prepare("UPDATE automation_rules SET state='PAUSED'").run();
}
