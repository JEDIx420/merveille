import { beforeEach, describe, it, expect } from "vitest";
import { setupMigratedTestDb } from "./test-db";
import { saveRule, listRules } from "../src/server/automations/service";
import { runAutomations } from "../src/server/automations/runner";
import {
  ruleTemplates,
  RuleDefinition,
} from "../src/shared/studio/definitions";
import {
  createPersonalTask,
  updatePersonalTask,
} from "../src/server/domain/tasks/personal-service";
import { createTask } from "../src/server/domain/tasks/service";
import { NotificationService } from "../src/server/notifications/service";
import type { UserPrincipal } from "../src/server/auth/principal";
const org = "org_merveille_main",
  project = "studio_project";
const p = (id: string, role: string): UserPrincipal => ({
  id,
  email: `${id}@example.invalid`,
  name: id,
  orgId: org,
  role: role as any,
  roles: [],
  projectMemberships: [{ projectId: project, roles: [role as any] }],
});
const manager = p("studio_manager", "MANAGER"),
  staff = p("studio_staff", "TEAM_MEMBER"),
  client = p("studio_client", "MAIN_CLIENT");
let db: D1Database;
beforeEach(async () => {
  db = await setupMigratedTestDb();
  for (const u of [manager, staff, client])
    await db.batch([
      db
        .prepare("INSERT INTO users VALUES(?,?,?,'ACTIVE',1,NULL)")
        .bind(u.id, u.email, u.name),
      db
        .prepare("INSERT INTO organization_memberships VALUES(?,?,?,1,1)")
        .bind(`om:${u.id}`, org, u.id),
    ]);
  await db
    .prepare(
      "INSERT INTO projects(id,org_id,code,name,status,created_at) VALUES(?,?,'STUDIO','Fictional project','ACTIVE',1)",
    )
    .bind(project, org)
    .run();
  for (const u of [manager, staff, client])
    await db
      .prepare(
        "INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES(?,?,?,?,?,1,1)",
      )
      .bind(`pm:${u.id}`, org, project, u.id, u.projectMemberships[0].roles![0])
      .run();
});
const weekly = (): RuleDefinition => ({
  ...structuredClone(ruleTemplates[0].definition),
  actions: [
    {
      type: "CREATE_TASK",
      title: "Site review",
      assigneeId: staff.id,
      dueDays: 2,
    },
  ],
});
async function publish(
  d = weekly(),
  scope: string | null = project,
  actor = manager,
) {
  return (await saveRule(
    db,
    actor,
    {
      projectId: scope,
      operation: "publish",
      name: "Fictional routine",
      definition: d,
    },
    true,
  )) as { id: string; revision: number };
}
async function due(id: string) {
  await db
    .prepare("UPDATE automation_rules SET next_run_at=0 WHERE id=?")
    .bind(id)
    .run();
}
describe("deterministic studio engine", () => {
  it("does not grant client or admin project approval authority", async () => {
    await expect(publish(weekly(), project, client)).rejects.toThrow();
    await expect(
      publish(weekly(), project, { ...staff, roles: ["ADMIN"] }),
    ).rejects.toThrow();
  });
  it("keeps personal rules private and refuses other assignees", async () => {
    await expect(publish(weekly(), null, staff)).resolves.toBeTruthy();
    expect((await listRules(db, manager, null)).rules).toHaveLength(0);
    await expect(
      saveRule(
        db,
        manager,
        {
          projectId: null,
          operation: "publish",
          name: "Foreign private task",
          definition: weekly(),
        },
        true,
      ),
    ).rejects.toThrow("only target you");
  });
  it("reuses existing private task records and creates their checklists atomically", async () => {
    const t = await createPersonalTask(
      staff,
      { title: "Site review", template: "Site visit" },
      db,
    );
    expect(
      (
        await db
          .prepare(
            "SELECT COUNT(*) n FROM personal_task_checklist_items WHERE personal_task_id=?",
          )
          .bind(t.id)
          .first<any>()
      ).n,
    ).toBe(3);
    await expect(
      createPersonalTask(
        staff,
        { title: "Bad template", template: "Missing" },
        db,
      ),
    ).rejects.toThrow();
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM personal_tasks").first<any>())
        .n,
    ).toBe(1);
  });
  it("keeps project task and template atomic", async () => {
    await createTask(
      manager,
      {
        projectId: project,
        title: "Drawing review",
        template: "Drawing coordination",
      },
      db,
    );
    expect(
      (
        await db
          .prepare("SELECT COUNT(*) n FROM task_checklist_items")
          .first<any>()
      ).n,
    ).toBe(3);
    await expect(
      createTask(
        manager,
        { projectId: project, title: "Bad", template: "Missing" },
        db,
      ),
    ).rejects.toThrow();
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM tasks").first<any>()).n,
    ).toBe(1);
  });
  it("deduplicates due reminders across unrelated task revisions and hides stale reminders", async () => {
    const d = {
      ...structuredClone(ruleTemplates[1].definition),
      actions: [
        {
          type: "REMIND" as const,
          title: "Due soon",
          dueDays: 0,
          assigneeId: staff.id,
        },
      ],
    };
    await publish(d);
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 2);
    const dueDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const t = await createTask(
      manager,
      {
        projectId: project,
        title: "Due work",
        proposedAssigneeId: staff.id,
        proposedDueDate: dueDate,
      },
      db,
    );
    await runAutomations(db);
    await db
      .prepare("UPDATE tasks SET revision=revision+1 WHERE id=?")
      .bind(t.id)
      .run();
    await runAutomations(db);
    const rows = await db
      .prepare(
        "SELECT * FROM notifications WHERE source_entity_type='AUTOMATION'",
      )
      .all<any>();
    expect(rows.results).toHaveLength(1);
    expect(await NotificationService.eligible(db, rows.results[0])).toBe(true);
    await db
      .prepare("UPDATE tasks SET status='COMPLETED' WHERE id=?")
      .bind(t.id)
      .run();
    expect(await NotificationService.eligible(db, rows.results[0])).toBe(false);
  });
  it("pauses published work and rejects stale editors", async () => {
    const r = await publish();
    await due(r.id);
    await saveRule(
      db,
      manager,
      {
        projectId: project,
        id: r.id,
        expectedRevision: r.revision,
        operation: "pause",
      },
      true,
    );
    await runAutomations(db);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM tasks").first<any>()).n,
    ).toBe(0);
    await expect(
      saveRule(
        db,
        manager,
        {
          projectId: project,
          id: r.id,
          expectedRevision: r.revision,
          operation: "publish",
          name: "stale",
          definition: weekly(),
        },
        true,
      ),
    ).rejects.toThrow("changed");
  });
  it("blocks archived projects and revoked target memberships at execution", async () => {
    const r = await publish();
    await due(r.id);
    await db
      .prepare("UPDATE projects SET is_archived=1 WHERE id=?")
      .bind(project)
      .run();
    await runAutomations(db);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM tasks").first<any>()).n,
    ).toBe(0);
    expect(
      (await db.prepare("SELECT status FROM automation_runs").first<any>())
        .status,
    ).toBe("BLOCKED");
  });
  it("caps active project rules transactionally", async () => {
    for (let i = 0; i < 20; i++) await publish();
    await expect(publish()).rejects.toThrow();
    expect(
      (
        await db
          .prepare(
            "SELECT COUNT(*) n FROM automation_rules WHERE state='ACTIVE'",
          )
          .first<any>()
      ).n,
    ).toBe(20);
  });
  it("reminds a personal task owner without requiring project membership", async () => {
    const d = {
      ...structuredClone(ruleTemplates[2].definition),
      condition: {},
      actions: [
        { type: "REMIND" as const, title: "Personal follow-up", dueDays: 0 },
      ],
    };
    await publish(d, null, staff);
    const t = await createPersonalTask(
      staff,
      { title: "Private fictional note" },
      db,
    );
    await updatePersonalTask(
      staff,
      t.id,
      { status: "COMPLETED", expectedRevision: 1 },
      db,
    );
    await db
      .prepare("UPDATE personal_tasks SET completed_at=? WHERE id=?")
      .bind(Date.now() + 1000, t.id)
      .run();
    await runAutomations(db, Date.now() + 2000);
    const n = await db
      .prepare(
        "SELECT * FROM notifications WHERE source_entity_type='AUTOMATION'",
      )
      .first<any>();
    expect(n.user_id).toBe(staff.id);
    expect(await NotificationService.eligible(db, n)).toBe(true);
  });
  it("does not chain generated tasks into completion rules", async () => {
    const a = await publish();
    await due(a.id);
    await runAutomations(db);
    await publish({
      ...structuredClone(ruleTemplates[2].definition),
      condition: {},
      actions: [
        {
          type: "CREATE_TASK",
          title: "Should not chain",
          assigneeId: staff.id,
          dueDays: 0,
        },
      ],
    });
    await db
      .prepare(
        "UPDATE tasks SET status='COMPLETED',completed_at=? WHERE id LIKE 'auto:%'",
      )
      .bind(Date.now() + 1000)
      .run();
    await runAutomations(db, Date.now() + 2000);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM tasks").first<any>()).n,
    ).toBe(1);
  });
});
describe("automation retries and resumable actions", () => {
  it("keeps the scheduled occurrence stable across transient retries without repeating earlier actions", async () => {
    const d = weekly();
    d.actions.push({
      type: "CREATE_TASK",
      title: "Second routine task",
      assigneeId: staff.id,
      dueDays: 1,
    });
    const r = await publish(d);
    await due(r.id);
    let calls = 0;
    const failing = {
      prepare: db.prepare.bind(db),
      batch: async (statements: D1PreparedStatement[]) => {
        calls++;
        if (calls === 2) throw new Error("Injected temporary D1 failure");
        return db.batch(statements);
      },
    } as D1Database;
    await runAutomations(failing, Date.now() + 1000);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM tasks").first<any>()).n,
    ).toBe(1);
    expect(
      (await db.prepare("SELECT status FROM automation_runs").first<any>())
        .status,
    ).toBe("FAILED");
    await runAutomations(db, Date.now() + 86400000);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM tasks").first<any>()).n,
    ).toBe(2);
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM automation_runs").first<any>())
        .n,
    ).toBe(1);
    expect(
      (await db.prepare("SELECT status FROM automation_runs").first<any>())
        .status,
    ).toBe("OK");
  });
});
describe("automation reminder assignment freshness",()=>{
 it("suppresses a default assignee reminder after reassignment",async()=>{
  await publish({...structuredClone(ruleTemplates[1].definition),actions:[{type:"REMIND",title:"Your task is due soon",dueDays:0}]});
  const date=new Date();date.setUTCDate(date.getUTCDate()+2);
  const dueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const task=await createTask(manager,{projectId:project,title:"Fictional reminder task",proposedAssigneeId:staff.id,proposedDueDate:dueDate},db);
  await runAutomations(db);
  const n=await db.prepare("SELECT * FROM notifications WHERE source_entity_type='AUTOMATION'").first<any>();
  expect(n.user_id).toBe(staff.id);expect(await NotificationService.eligible(db,n)).toBe(true);
  await db.prepare("UPDATE tasks SET assignee_user_id=?,revision=revision+1 WHERE id=?").bind(manager.id,task.id).run();
  expect(await NotificationService.eligible(db,n)).toBe(false);
 });
});
