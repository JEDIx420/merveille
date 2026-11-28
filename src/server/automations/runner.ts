import { candidates } from "./service";
import {
  validateRule,
  nextWeekly,
  RuleDefinition,
} from "@/shared/studio/definitions";
import { businessDateISO } from "@/shared/config";
type Published = {
  id: string;
  org_id: string;
  project_id: string | null;
  owner_id: string;
  publisher_id: string;
  published_revision: number;
  next_run_at: number | null;
  definition_json: string;
  published_at: number;
};
// This runner never constructs a user session or impersonates a publisher. Each effect
// carries explicit system attribution and checks the persisted delegation in its transaction.
export async function runAutomations(db: D1Database, now = Date.now()) {
  const rules = await db
    .prepare(
      "SELECT r.*,p.definition_json,p.published_at FROM automation_rules r JOIN automation_publications p ON p.rule_id=r.id AND p.revision=r.published_revision WHERE r.state='ACTIVE' AND (r.next_run_at IS NULL OR r.next_run_at<=?) ORDER BY r.updated_at LIMIT 3",
    )
    .bind(now)
    .all<Published>();
  let effects = 0;
  for (const r of rules.results) {
    await db
      .prepare("UPDATE automation_rules SET updated_at=? WHERE id=?")
      .bind(now, r.id)
      .run();
    const d = validateRule(JSON.parse(r.definition_json));
    let retryWeekly = false;
    const sources = await candidates(db, r, d, now, r.published_at);
    for (const source of sources) {
      const runId = `${r.id}:${r.published_revision}:${source.key}`;
      await db
        .prepare(
          "INSERT OR IGNORE INTO automation_runs(id,rule_id,revision,source_key,status,detail,created_at) VALUES(?,?,?,?,'PENDING','Waiting for execution',?)",
        )
        .bind(runId, r.id, r.published_revision, source.key, now)
        .run();
      const previous = await db
        .prepare("SELECT status,attempts FROM automation_runs WHERE id=?")
        .bind(runId)
        .first<{ status: string; attempts: number }>();
      if (
        previous?.status === "OK" ||
        previous?.status === "BLOCKED" ||
        (previous?.attempts || 0) >= 5
      )
        continue;
      let failed = false,
        blocked = false;
      await db
        .prepare("UPDATE automation_runs SET attempts=attempts+1 WHERE id=?")
        .bind(runId)
        .run();
      for (const [index, action] of d.actions.entries()) {
        const prior = await db
          .prepare(
            "SELECT entity_id FROM automation_effects WHERE run_id=? AND action_index=?",
          )
          .bind(runId, index)
          .first();
        if (prior) continue;
        if (effects >= 3) return { rules: rules.results.length, effects };
        const recipient = action.assigneeId || source.assigneeId || r.owner_id;
        const entityId = `auto:${runId}:${index}`,
          guard = crypto.randomUUID();
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() + action.dueDays);
        const due = businessDateISO(date);
        try {
          const stmts: D1PreparedStatement[] = [];
          const authority = r.project_id
            ? `EXISTS(SELECT 1 FROM projects p JOIN project_memberships m ON m.project_id=p.id AND m.org_id=p.org_id WHERE p.id=ar.project_id AND p.org_id=ar.org_id AND p.is_archived=0 AND m.user_id=ar.publisher_id AND m.is_active=1 AND m.project_role='MANAGER') AND EXISTS(SELECT 1 FROM project_memberships m JOIN users u ON u.id=m.user_id JOIN organization_memberships o ON o.user_id=u.id AND o.org_id=m.org_id AND o.is_active=1 WHERE m.project_id=ar.project_id AND m.org_id=ar.org_id AND m.user_id=? AND m.is_active=1 AND m.project_role IN ('MANAGER','TEAM_MEMBER','STAFF') AND u.status='ACTIVE')`
            : "ar.owner_id=ar.publisher_id AND ar.owner_id=?";
          stmts.push(
            db
              .prepare(
                `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM automation_rules ar JOIN users u ON u.id=ar.publisher_id JOIN organization_memberships om ON om.user_id=u.id AND om.org_id=ar.org_id AND om.is_active=1 JOIN organizations org ON org.id=ar.org_id AND org.status='ACTIVE' WHERE ar.id=? AND ar.state='ACTIVE' AND ar.published_revision=? AND ar.publisher_id=? AND u.status='ACTIVE' AND ${authority}) AND NOT EXISTS(SELECT 1 FROM automation_effects WHERE run_id=? AND action_index=?) THEN 1 ELSE 0 END`,
              )
              .bind(
                guard,
                r.id,
                r.published_revision,
                r.publisher_id,
                recipient,
                runId,
                index,
              ),
          );
          if (source.taskId)
            stmts.push(
              db
                .prepare(
                  `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM ${r.project_id ? "tasks" : "personal_tasks"} WHERE id=? AND org_id=? AND revision=? AND status${d.trigger === "TASK_COMPLETED" ? "='COMPLETED'" : " NOT IN ('COMPLETED','CANCELLED','PROMOTED')"}) THEN 1 ELSE 0 END`,
                )
                .bind(
                  guard + ":source",
                  source.taskId,
                  r.org_id,
                  source.revision,
                ),
            );
          if (d.condition.label && source.taskId)
            stmts.push(
              db
                .prepare(
                  "INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM studio_task_labels l,json_each(l.labels_json) j WHERE l.org_id=? AND l.task_id=? AND l.task_scope=? AND j.value=?) THEN 1 ELSE 0 END",
                )
                .bind(
                  guard + ":label",
                  r.org_id,
                  source.taskId,
                  r.project_id ? "PROJECT" : "PERSONAL",
                  d.condition.label,
                ),
            );
          if (d.trigger === "DRAWING_RELEASED")
            stmts.push(
              db
                .prepare(
                  "INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM drawing_versions WHERE id=? AND status='RELEASED') THEN 1 ELSE 0 END",
                )
                .bind(guard + ":drawing", source.key.slice(8)),
            );
          if (action.type === "CREATE_TASK") {
            stmts.push(
              r.project_id
                ? db
                    .prepare(
                      "INSERT INTO tasks(id,org_id,project_id,title,description,priority,status,creator_user_id,assignee_user_id,original_due_date,effective_due_date,revision,created_at) VALUES(?,?,?,?,?,'MEDIUM','TODO',?,?,?,?,1,?)",
                    )
                    .bind(
                      entityId,
                      r.org_id,
                      r.project_id,
                      action.title,
                      `Created by automation ${r.id}; authorized by ${r.publisher_id}.`,
                      r.publisher_id,
                      recipient,
                      due,
                      due,
                      now,
                    )
                : db
                    .prepare(
                      "INSERT INTO personal_tasks(id,org_id,owner_user_id,title,description,priority,status,due_date,revision,created_at) VALUES(?,?,?,?,?,'MEDIUM','TODO',?,1,?)",
                    )
                    .bind(
                      entityId,
                      r.org_id,
                      r.owner_id,
                      action.title,
                      `Created by your automation ${r.id}.`,
                      due,
                      now,
                    ),
            );
            if (r.project_id)
              stmts.push(
                db
                  .prepare(
                    "INSERT INTO task_events(id,task_id,actor_id,event_type,new_state,reason,created_at) VALUES(?,?,?,'AUTOMATION_TASK_CREATED','TODO','System automation; authorizing manager recorded in actor field',?)",
                  )
                  .bind(crypto.randomUUID(), entityId, r.publisher_id, now),
              );
          } else if (action.type === "REMIND") {
            // Internal inbox only. No outbound provider or WhatsApp work is queued.
            const target = source.taskId
              ? r.project_id
                ? `/projects/${r.project_id}/tasks?taskId=${encodeURIComponent(source.taskId)}`
                : `/waiting?personalTaskId=${encodeURIComponent(source.taskId)}`
              : r.project_id
                ? `/projects/${r.project_id}/drawings`
                : "/waiting";
            stmts.push(
              db
                .prepare(
                  "INSERT INTO notifications(id,org_id,user_id,project_id,source_entity_type,source_entity_id,dedupe_key,channel,title,body_text,target_url,status,created_at) VALUES(?,?,?,?,'AUTOMATION',?,?,'PORTAL',?,?,?,'DELIVERED',?)",
                )
                .bind(
                  entityId,
                  r.org_id,
                  recipient,
                  r.project_id,
                  r.id,
                  entityId,
                  action.title,
                  `Automation reminder: ${source.title}`,
                  target,
                  now,
                ),
            );
            stmts.push(
              db
                .prepare(
                  "INSERT INTO automation_notification_sources VALUES(?,?,?,?,?,?)",
                )
                .bind(
                  entityId,
                  r.id,
                  d.trigger,
                  source.taskId || null,
                  d.trigger === "DRAWING_RELEASED" ? source.key.slice(8) : null,
                  r.owner_id,
                ),
            );
          } else if (source.taskId) {
            stmts.push(
              db
                .prepare(
                  "INSERT INTO studio_task_labels VALUES(?,?,?,json_array(?)) ON CONFLICT(org_id,task_id,task_scope) DO UPDATE SET labels_json=(SELECT json_group_array(value) FROM (SELECT value FROM json_each(studio_task_labels.labels_json) UNION SELECT ?))",
                )
                .bind(
                  r.org_id,
                  source.taskId,
                  r.project_id ? "PROJECT" : "PERSONAL",
                  action.label!,
                  action.label!,
                ),
            );
          }
          stmts.push(
            db
              .prepare("INSERT INTO automation_effects VALUES(?,?,?,?)")
              .bind(
                runId,
                index,
                action.type === "LABEL" ? source.taskId! : entityId,
                now,
              ),
          );
          stmts.push(
            db
              .prepare(
                "INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,scope,new_state,reason,created_at) VALUES(?,?,'system:automation','AUTOMATION',?,'AUTOMATION_EFFECT',?,?,?,?)",
              )
              .bind(
                crypto.randomUUID(),
                r.org_id,
                r.id,
                r.project_id ? "PROJECT" : "PERSONAL",
                JSON.stringify({
                  runId,
                  index,
                  type: action.type,
                  authorizedBy: r.publisher_id,
                  revision: r.published_revision,
                }),
                "Routine rule execution; no human approval or publication implied.",
                now,
              ),
          );
          for (const key of [
            guard,
            guard + ":source",
            guard + ":drawing",
            guard + ":label",
          ])
            stmts.push(
              db.prepare("DELETE FROM command_assertions WHERE id=?").bind(key),
            );
          await db.batch(stmts);
          effects++;
        } catch (error) {
          const concurrent = await db
            .prepare(
              "SELECT entity_id FROM automation_effects WHERE run_id=? AND action_index=?",
            )
            .bind(runId, index)
            .first();
          if (!concurrent) {
            failed = true;
            blocked = /CHECK constraint failed/.test(String(error));
            break;
          }
        }
      }
      if (failed && !blocked) retryWeekly = true;
      await db
        .prepare("UPDATE automation_runs SET status=?,detail=? WHERE id=?")
        .bind(
          failed ? (blocked ? "BLOCKED" : "FAILED") : "OK",
          failed
            ? blocked
              ? "Execution stopped: rule, source, assignee or authorization changed. Review and republish to resume; earlier successful actions are retained."
              : "Temporary failure; up to five attempts. Completed actions will not repeat."
            : "All actions completed",
          runId,
        )
        .run();
    }
    if (d.trigger === "WEEKLY" && !retryWeekly)
      await db
        .prepare(
          "UPDATE automation_rules SET next_run_at=? WHERE id=? AND published_revision=? AND state='ACTIVE'",
        )
        .bind(nextWeekly(d, now), r.id, r.published_revision)
        .run();
    // Fair rotation across a bounded batch without changing the definition or publication.
    await db
      .prepare("UPDATE automation_rules SET updated_at=? WHERE id=?")
      .bind(now, r.id)
      .run();
  }
  return { rules: rules.results.length, effects };
}
