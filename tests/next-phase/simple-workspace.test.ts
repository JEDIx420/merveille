import { beforeEach, describe, it, expect } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  preferences,
  savePreferences,
  projectProgress,
  personalDetail,
} from "@/server/workspace/service";
import {
  createTask,
  completeTask,
  getTask,
  startTask,
} from "@/server/domain/tasks/service";
import {
  createPersonalTask,
  updatePersonalTask,
  addTaskChecklistItem,
} from "@/server/domain/tasks/personal-service";
import {listProjects} from "@/server/domain/projects/service";
import { POST as disabledVoice } from "@/app/api/voice/dictate/route";
const org = "org_merveille_main",
  project = "simple_project";
const principal = (id: string, role: string): UserPrincipal => ({
  id,
  name: id,
  email: `${id}@example.invalid`,
  orgId: org,
  role: role as any,
  roles: [],
  projectMemberships: [
    { projectId: project, projectRole: role as any, roles: [role as any] },
  ],
});
const manager = principal("simple_manager", "MANAGER"),
  staff = principal("simple_staff", "TEAM_MEMBER"),
  client = principal("simple_client", "MAIN_CLIENT");
let db: D1Database;
beforeEach(async () => {
  db = await setupMigratedTestDb();
  for (const p of [manager, staff, client]) {
    await db
      .prepare(
        "INSERT INTO users(id,email,display_name,status,created_at) VALUES(?,?,?,'ACTIVE',1)",
      )
      .bind(p.id, p.email, p.name)
      .run();
    await db
      .prepare(
        "INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES(?,?,?,1,1)",
      )
      .bind("om_" + p.id, org, p.id)
      .run();
  }
  await db
    .prepare(
      "INSERT INTO projects(id,org_id,code,name,status,stage,created_at) VALUES(?,?,?,'Fictional studio project','ACTIVE','Design Development',1)",
    )
    .bind(project, org, "SIMPLE")
    .run();
  for(const p of [manager,staff,client]) await db.prepare('INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES(?,?,?,?,?,1,1)').bind('pm_'+p.id,org,project,p.id,p.projectMemberships[0].projectRole).run();
});
describe("Simpler workspace boundaries", () => {
  it("persists separate personal view/favorites and rejects unavailable project IDs", async () => {
    expect(await preferences(db, staff)).toEqual({
      view: "LIST",
      favorites: [],
    });
    await savePreferences(db, staff, { view: "BOARD", favorites: [project] });
    expect((await preferences(db, staff)).view).toBe("BOARD");
    expect((await preferences(db, manager)).favorites).toEqual([]);
    await expect(
      savePreferences(db, staff, { favorites: ["not_assigned"] }),
    ).rejects.toThrow("Project unavailable");
    await expect(
      savePreferences(db, staff, { view: "INVALID" }),
    ).rejects.toThrow("valid workspace");
  });
  it("progress uses project tasks, excludes cancellation, and never exposes private personal work", async () => {
    const t = await createTask(
      manager,
      { projectId: project, title: "Issue plan", proposedAssigneeId: staff.id },
      db,
    );
    await completeTask(
      staff,
      t.id,
      { completionNote: "Checked and finished", expectedRevision: 1 },
      db,
    );
    await createTask(
      manager,
      { projectId: project, title: "Coordinate details" },
      db,
    );
    await createPersonalTask(staff, { title: "Private note" }, db);
    const d = await projectProgress(db, staff, project);
    expect(d.total).toBe(2);
    expect(d.completed).toBe(1);
    expect(d.percent).toBe(50);
    const clientProjects=await listProjects(client,db);
    expect(clientProjects).toHaveLength(1);
    expect(clientProjects[0]).not.toHaveProperty("task_count");
    expect(clientProjects[0]).not.toHaveProperty("member_names");
    expect(d.weeks.reduce((s, w) => s + w.count, 0)).toBe(1);
    await expect(projectProgress(db, client, project)).rejects.toThrow(
      /internal/,
    );
    await expect(
      projectProgress(db, { ...staff, projectMemberships: [] }, project),
    ).rejects.toThrow();
  });
  it("only an owner can read personal details/comments and stale personal updates fail", async () => {
    const t = await createPersonalTask(staff, { title: "Private sketch" }, db);
    await db
      .prepare("INSERT INTO personal_task_comments VALUES(?,?,?,?)")
      .bind("comment", t.id, "Private comment", 1)
      .run();
    expect((await personalDetail(db, staff, t.id)).comments[0].body_text).toBe(
      "Private comment",
    );
    await expect(personalDetail(db, manager, t.id)).rejects.toThrow(/private/);
    await updatePersonalTask(
      staff,
      t.id,
      { status: "IN_PROGRESS", expectedRevision: 1 },
      db,
    );
    await expect(
      updatePersonalTask(
        staff,
        t.id,
        { status: "COMPLETED", expectedRevision: 1 },
        db,
      ),
    ).rejects.toThrow(/concurrently/);
    await expect(
      updatePersonalTask(staff, t.id, { dueDate: "bad" }, db),
    ).rejects.toThrow(/valid date/);
  });
  it("action metadata retains manager authority and archived task extensions stay read-only", async () => {
    const t = await createTask(
      manager,
      {
        projectId: project,
        title: "Prepare elevations",
        proposedAssigneeId: staff.id,
      },
      db,
    );
    expect((await getTask(staff, t.id, db)).allowedActions.assign).toBe(false);
    expect((await getTask(manager, t.id, db)).allowedActions.assign).toBe(true);
    await startTask(staff, t.id, db, 1);
    await expect(startTask(staff, t.id, db, 1)).rejects.toThrow(/changed/);
    await db
      .prepare("UPDATE projects SET is_archived=1 WHERE id=?")
      .bind(project)
      .run();
    expect((await getTask(manager, t.id, db)).allowedActions.complete).toBe(
      false,
    );
    await expect(
      addTaskChecklistItem(staff, t.id, "New archived item", db),
    ).rejects.toThrow(/archived/i);
  });
  it("retired voice endpoint rejects before parsing audio or obtaining any AI binding", async () => {
    const r = await disabledVoice();
    expect(r.status).toBe(410);
    expect((await r.json()).code).toBe("VOICE_DISABLED");
  });
});
