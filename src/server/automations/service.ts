import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError, canReadInternalNotes } from "@/server/auth/policy";
import {
  RuleDefinition,
  validateRule,
  nextWeekly,
  ruleSentence,
} from "@/shared/studio/definitions";
import { businessDateISO } from "@/shared/config";
type Rule = {
  id: string;
  org_id: string;
  project_id: string | null;
  owner_id: string;
  name: string;
  draft_json: string;
  revision: number;
  published_revision: number | null;
  publisher_id: string | null;
  state: string;
  next_run_at: number | null;
  created_at: number;
  updated_at: number;
};
function invalid(message: string): never {
  throw new AuthorizationError(message, "INVALID_INPUT");
}
function parse(input: unknown) {
  try {
    return validateRule(input);
  } catch (e) {
    return invalid((e as Error).message);
  }
}
export async function assertScope(
  db: D1Database,
  p: UserPrincipal,
  projectId: string | null,
  publish = false,
) {
  if (!projectId) return;
  const project = await db
    .prepare(
      "SELECT id FROM projects WHERE id=? AND org_id=? AND is_archived=0",
    )
    .bind(projectId, p.orgId)
    .first();
  if (!project || !canReadInternalNotes(p, projectId))
    throw new AuthorizationError(
      "Project automations are internal to an active project.",
      "FORBIDDEN",
    );
  if (publish && !hasCapability(p, "MANAGER", projectId))
    throw new AuthorizationError(
      "Only a project manager can publish or pause project rules.",
      "FORBIDDEN",
    );
}
export async function listRules(
  db: D1Database,
  p: UserPrincipal,
  projectId: string | null,
) {
  await assertScope(db, p, projectId);
  const rows = await db
    .prepare(
      `SELECT r.*,p.definition_json AS live_json FROM automation_rules r LEFT JOIN automation_publications p ON p.rule_id=r.id AND p.revision=r.published_revision WHERE r.org_id=? AND ${projectId ? "r.project_id=?" : "r.project_id IS NULL AND r.owner_id=?"} ORDER BY CASE WHEN r.state='ACTIVE' THEN 0 ELSE 1 END,r.updated_at DESC LIMIT 200`,
    )
    .bind(p.orgId, projectId || p.id)
    .all<Rule>();
  const ids = rows.results.map((r) => r.id);
  const runs = ids.length
    ? (
        await db
          .prepare(
            `SELECT * FROM automation_runs WHERE rule_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at DESC LIMIT 30`,
          )
          .bind(...ids)
          .all()
      ).results
    : [];
  return {
    rules: rows.results.map((r) => ({
      ...r,
      liveSentence: (r as Rule & { live_json?: string }).live_json
        ? ruleSentence(
            JSON.parse((r as Rule & { live_json: string }).live_json),
          )
        : null,
      definition: JSON.parse(r.draft_json),
      sentence: ruleSentence(JSON.parse(r.draft_json)),
    })),
    runs,
  };
}
async function assignees(
  db: D1Database,
  p: UserPrincipal,
  projectId: string | null,
  d: RuleDefinition,
) {
  for (const a of d.actions) {
    if (!projectId && a.assigneeId && a.assigneeId !== p.id)
      invalid("Personal rules can only target you.");
    if (projectId && a.type === "CREATE_TASK" && !a.assigneeId)
      invalid("Choose a project assignee before publishing.");
    if (projectId && a.assigneeId) {
      const member = await db
        .prepare(
          "SELECT m.id FROM project_memberships m JOIN users u ON u.id=m.user_id JOIN organization_memberships o ON o.user_id=u.id AND o.org_id=m.org_id AND o.is_active=1 WHERE m.project_id=? AND m.org_id=? AND m.user_id=? AND m.is_active=1 AND m.project_role IN ('MANAGER','TEAM_MEMBER','STAFF') AND u.status='ACTIVE' LIMIT 1",
        )
        .bind(projectId, p.orgId, a.assigneeId)
        .first();
      if (!member) invalid("Choose a current internal project member.");
    }
  }
  if (["WEEKLY", "DRAWING_RELEASED"].includes(d.trigger) && d.condition.label)
    invalid("Label conditions apply to task triggers only.");
  if (!projectId && d.trigger === "DRAWING_RELEASED")
    invalid("Drawing release rules need a project.");
}
export async function saveRule(
  db: D1Database,
  p: UserPrincipal,
  b: any,
  enabled: boolean,
) {
  const projectId = typeof b.projectId === "string" ? b.projectId : null;
  await assertScope(db, p, projectId);
  const now = Date.now();
  if (b.operation === "simulate") {
    const d = parse(b.definition);
    await assignees(db, p, projectId, d);
    const sample = await candidates(
      db,
      { project_id: projectId, owner_id: p.id, org_id: p.orgId },
      d,
      now,
      now - 7 * 86400000,
    );
    return {
      sentence: ruleSentence(d),
      matches: sample.map((s) => ({ key: s.key, title: s.title })),
      nextRun: d.trigger === "WEEKLY" ? nextWeekly(d, now) : null,
      actions: d.actions,
      notice:
        "Preview only. No records were changed. Live access and state are checked again at execution.",
    };
  }
  let old: Rule | null = null;
  if (b.id) {
    old = await db
      .prepare("SELECT * FROM automation_rules WHERE id=? AND org_id=?")
      .bind(b.id, p.orgId)
      .first<Rule>();
    if (
      !old ||
      old.project_id !== projectId ||
      (!projectId && old.owner_id !== p.id)
    )
      throw new AuthorizationError("Rule unavailable.", "NOT_FOUND");
    if (old.revision !== b.expectedRevision)
      throw new AuthorizationError(
        "Rule changed. Reload before editing.",
        "CONCURRENCY_CONFLICT",
      );
  }
  if (b.operation === "pause") {
    if (!old) invalid("Choose a rule.");
    await assertScope(db, p, projectId, true);
    const pauseGuard = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM automation_rules r JOIN users u ON u.id=? JOIN organization_memberships o ON o.user_id=u.id AND o.org_id=r.org_id AND o.is_active=1 WHERE r.id=? AND r.revision=? AND u.status='ACTIVE' AND ${projectId ? "EXISTS(SELECT 1 FROM project_memberships m WHERE m.project_id=r.project_id AND m.org_id=r.org_id AND m.user_id=u.id AND m.is_active=1 AND m.project_role='MANAGER')" : "r.owner_id=u.id"}) THEN 1 ELSE 0 END`,
        )
        .bind(pauseGuard, p.id, old.id, old.revision),
      db
        .prepare(
          "UPDATE automation_rules SET state='PAUSED',revision=revision+1,updated_at=? WHERE id=?",
        )
        .bind(now, old.id),
      db
        .prepare(
          "INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,scope,created_at) VALUES(?,?,?,'AUTOMATION',?,'RULE_PAUSED',?,?)",
        )
        .bind(
          crypto.randomUUID(),
          p.orgId,
          p.id,
          old.id,
          projectId ? "PROJECT" : "PERSONAL",
          now,
        ),
      db.prepare("DELETE FROM command_assertions WHERE id=?").bind(pauseGuard),
    ]);
    return { ok: true };
  }
  const d = parse(b.definition);
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 100)
    invalid("Give the rule a name (up to 100 characters).");
  const publish = b.operation === "publish";
  if (!["save", "publish"].includes(b.operation))
    invalid("Choose a rule action.");
  if (publish && !enabled)
    throw new AuthorizationError(
      "Rule execution is awaiting the Free-plan runtime check. You can save and simulate drafts.",
      "UNAVAILABLE",
    );
  if (publish) {
    await assertScope(db, p, projectId, true);
    await assignees(db, p, projectId, d);
  }
  const id = old?.id || crypto.randomUUID(),
    revision = (old?.revision || 0) + 1;
  const guard = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];
  if (!old)
    stmts.push(
      db
        .prepare(
          "INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN (SELECT COUNT(*) FROM automation_rules WHERE org_id=?)<200 THEN 1 ELSE 0 END",
        )
        .bind(guard + ":total", p.orgId),
    );
  if (publish) {
    // Counts and authority are checked in the same D1 transaction as publication.
    stmts.push(
      db
        .prepare(
          `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN (SELECT COUNT(*) FROM automation_rules WHERE org_id=? AND state='ACTIVE' AND id!=?)<100 AND (SELECT COUNT(*) FROM automation_rules WHERE org_id=? AND project_id IS ? AND state='ACTIVE' AND id!=?)<20 THEN 1 ELSE 0 END`,
        )
        .bind(guard, p.orgId, id, p.orgId, projectId, id),
    );
    // New rule row inserted below; final authority assertion uses its persisted scope.
  }
  if (old)
    stmts.push(
      db
        .prepare(
          "INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM automation_rules WHERE id=? AND revision=?) THEN 1 ELSE 0 END",
        )
        .bind(guard + ":revision", id, old.revision),
    );
  stmts.push(
    db
      .prepare(
        `INSERT INTO automation_rules VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,draft_json=excluded.draft_json,revision=excluded.revision,published_revision=excluded.published_revision,publisher_id=excluded.publisher_id,state=excluded.state,next_run_at=excluded.next_run_at,updated_at=excluded.updated_at`,
      )
      .bind(
        id,
        p.orgId,
        projectId,
        old?.owner_id || p.id,
        b.name.trim(),
        JSON.stringify(d),
        revision,
        publish ? revision : old?.published_revision || null,
        publish ? p.id : old?.publisher_id || null,
        publish ? "ACTIVE" : old?.state || "DRAFT",
        publish && d.trigger === "WEEKLY"
          ? nextWeekly(d, now)
          : old?.next_run_at || null,
        old?.created_at || now,
        now,
      ),
  );
  if (publish) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM automation_rules r JOIN users u ON u.id=? JOIN organization_memberships o ON o.user_id=u.id AND o.org_id=r.org_id AND o.is_active=1 WHERE r.id=? AND u.status='ACTIVE' AND ${projectId ? "EXISTS(SELECT 1 FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.project_id=r.project_id AND m.user_id=u.id AND m.is_active=1 AND m.project_role='MANAGER' AND p.is_archived=0)" : "r.owner_id=u.id"}) THEN 1 ELSE 0 END`,
        )
        .bind(guard + ":authority", p.id, id),
    );
    stmts.push(
      db
        .prepare("INSERT INTO automation_publications VALUES(?,?,?,?,?)")
        .bind(id, revision, JSON.stringify(d), p.id, now),
    );
  }
  stmts.push(
    db
      .prepare(
        "INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,scope,new_state,created_at) VALUES(?,?,?,'AUTOMATION',?,?,?, ?,?)",
      )
      .bind(
        crypto.randomUUID(),
        p.orgId,
        p.id,
        id,
        publish ? "RULE_PUBLISHED" : "RULE_DRAFT_SAVED",
        projectId ? "PROJECT" : "PERSONAL",
        JSON.stringify({ revision }),
        now,
      ),
  );
  for (const key of [
    guard,
    guard + ":revision",
    guard + ":authority",
    guard + ":total",
  ])
    stmts.push(
      db.prepare("DELETE FROM command_assertions WHERE id=?").bind(key),
    );
  await db.batch(stmts);
  return { ok: true, id, revision };
}
export type Candidate = {
  key: string;
  taskId?: string;
  title: string;
  assigneeId?: string;
  revision?: number;
};
export async function candidates(
  db: D1Database,
  r: {
    project_id: string | null;
    owner_id: string;
    org_id: string;
    id?: string;
    published_revision?: number;
    next_run_at?: number | null;
  },
  d: RuleDefinition,
  now: number,
  since: number,
): Promise<Candidate[]> {
  if (d.trigger === "WEEKLY")
    return [
      {
        key: `week:${r.next_run_at ?? businessDateISO(new Date(now))}`,
        title: "Scheduled task",
      },
    ];
  if (d.trigger === "DRAWING_RELEASED") {
    const rows = await db
      .prepare(
        "SELECT v.id,v.version_label FROM drawing_versions v JOIN drawings g ON g.id=v.drawing_id WHERE g.project_id=? AND g.org_id=? AND v.status='RELEASED' AND v.released_at>? AND NOT EXISTS(SELECT 1 FROM automation_runs ar WHERE ar.rule_id=? AND ar.revision=? AND ar.source_key='drawing:'||v.id AND (ar.status IN ('OK','BLOCKED') OR ar.attempts>=5)) ORDER BY v.released_at LIMIT 3",
      )
      .bind(
        r.project_id,
        r.org_id,
        since,
        r.id || "",
        r.published_revision || 0,
      )
      .all<{ id: string; version_label: string }>();
    return rows.results.map((v) => ({
      key: `drawing:${v.id}`,
      title: `Released drawing version ${v.version_label}`,
    }));
  }
  const personal = !r.project_id,
    table = personal ? "personal_tasks" : "tasks",
    date = personal ? "due_date" : "effective_due_date";
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
  const condition =
    d.trigger === "TASK_COMPLETED"
      ? "status='COMPLETED' AND completed_at>?"
      : d.trigger === "DUE_SOON"
        ? `status NOT IN ('COMPLETED','CANCELLED','PROMOTED') AND ${date}=?`
        : `status NOT IN ('COMPLETED','CANCELLED','PROMOTED') AND ${date}<?`;
  const keyExpr =
    d.trigger === "TASK_COMPLETED"
      ? `'TASK_COMPLETED:'||${table}.id||':'||${table}.completed_at`
      : `'${d.trigger}:'||${table}.id||':'||${table}.${date}`;
  const rows = await db
    .prepare(
      `SELECT id,title,revision,${keyExpr} AS source_key,${personal ? "owner_user_id" : "assignee_user_id"} AS assignee FROM ${table} WHERE org_id=? AND ${personal ? "owner_user_id" : "project_id"}=? AND ${condition} AND id NOT LIKE 'auto:%' AND NOT EXISTS(SELECT 1 FROM automation_runs ar WHERE ar.rule_id=? AND ar.revision=? AND ar.source_key=(${keyExpr}) AND (ar.status IN ('OK','BLOCKED') OR ar.attempts>=5)) ${d.condition.label ? `AND EXISTS(SELECT 1 FROM studio_task_labels l WHERE l.task_id=${table}.id AND l.org_id=${table}.org_id AND l.task_scope=? AND EXISTS(SELECT 1 FROM json_each(l.labels_json) WHERE value=?))` : ""} ORDER BY created_at ASC LIMIT 3`,
    )
    .bind(
      r.org_id,
      r.project_id || r.owner_id,
      d.trigger === "TASK_COMPLETED"
        ? since
        : d.trigger === "DUE_SOON"
          ? businessDateISO(tomorrow)
          : businessDateISO(new Date(now)),
      r.id || "",
      r.published_revision || 0,
      ...(d.condition.label
        ? [personal ? "PERSONAL" : "PROJECT", d.condition.label]
        : []),
    )
    .all<{
      id: string;
      title: string;
      revision: number;
      assignee: string;
      source_key: string;
    }>();
  return rows.results.map((t) => ({
    key: t.source_key,
    taskId: t.id,
    title: t.title,
    revision: t.revision,
    assigneeId: t.assignee,
  }));
}
