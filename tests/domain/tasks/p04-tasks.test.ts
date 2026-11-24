import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { execute, query, queryFirst } from "@/server/db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  createTask,
  assignTask,
  changeTaskDeadline,
  completeTask,
  reopenTask,
  addTaskComment,
  getTask,
  listProjectTasks,
  computeIsOverdue,
} from "@/server/domain/tasks/service";

describe("Phase P04: Tasks, Manager Deadlines, Reopening, and Internal Evidence", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";
  const projectId = "prj_pavilion_01";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Operations Admin",
    orgId,
    role: "ADMIN",
    projectMemberships: [],
    isSynthetic: false,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Project Manager",
    orgId,
    role: "MANAGER",
    projectMemberships: [{ projectId }],
    isSynthetic: false,
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_001",
    email: "architect.staff@merveilledesigns.com",
    name: "Staff Architect",
    orgId,
    role: "STAFF",
    projectMemberships: [{ projectId }],
    isSynthetic: false,
  };

  const consultantUser: UserPrincipal = {
    id: "usr_cons_001",
    email: "structural@engineers.example",
    name: "Structural Consultant",
    orgId,
    role: "CONSULTANT",
    projectMemberships: [{ projectId }],
    isSynthetic: false,
  };

  const clientUser: UserPrincipal = {
    id: "usr_client_001",
    email: "client@clientfamily.example",
    name: "Client Owner",
    orgId,
    role: "MAIN_CLIENT",
    projectMemberships: [{ projectId }],
    isSynthetic: false,
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // Seed org
    await execute(
      db,
      "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
      [orgId, "Merveille Designs", Date.now()]
    );

    // Seed users
    const users = [adminUser, managerUser, staffUser, consultantUser, clientUser];
    for (const u of users) {
      await execute(
        db,
        "INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)",
        [u.id, u.email, u.name, Date.now()]
      );
      await execute(
        db,
        "INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
        [`om_${u.id}`, orgId, u.id, Date.now()]
      );
    }

    // Seed project
    await execute(
      db,
      `INSERT OR IGNORE INTO projects (id, org_id, code, name, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
       VALUES (?, ?, 'MD-PAV', 'Pavilion House', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
      [projectId, orgId, clientUser.id, managerUser.id, Date.now()]
    );

    // Seed memberships
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_m1', ?, ?, ?, 'MANAGER', 1, ?)",
      [orgId, projectId, managerUser.id, Date.now()]
    );
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_s1', ?, ?, ?, 'STAFF', 1, ?)",
      [orgId, projectId, staffUser.id, Date.now()]
    );
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_c1', ?, ?, ?, 'MAIN_CLIENT', 1, ?)",
      [orgId, projectId, clientUser.id, Date.now()]
    );
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_con1', ?, ?, ?, 'CONSULTANT', 1, ?)",
      [orgId, projectId, consultantUser.id, Date.now()]
    );
  });

  describe("AC-013: Staff Task Creation and Manager Deadline Authority", () => {
    it("allows staff to propose tasks, restricts assignment and deadlines to managers, and retains prior values", async () => {
      // 1. Staff proposes a task
      const { id: taskId, status: initialStatus } = await createTask(
        staffUser,
        {
          projectId,
          title: "Model central rainwater courtyard detail",
          description: "3D CAD model and drain invert levels",
          priority: "HIGH",
          proposedDueDate: "2026-03-01",
        },
        db
      );

      expect(taskId).toBeDefined();
      expect(initialStatus).toBe("PENDING_ASSIGNMENT");

      // Verify task in DB
      const taskInDb = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
      expect(taskInDb.title).toBe("Model central rainwater courtyard detail");
      expect(taskInDb.status).toBe("PENDING_ASSIGNMENT");
      expect(taskInDb.creator_user_id).toBe(staffUser.id);
      expect(taskInDb.assignee_user_id).toBeNull(); // Not officially assigned yet

      // 2. Non-manager staff attempts to officially assign or set deadline -> REJECTED
      await expect(
        assignTask(
          staffUser,
          taskId,
          {
            assigneeUserId: staffUser.id,
            dueDate: "2026-03-05",
          },
          db
        )
      ).rejects.toThrow("Only project managers can assign tasks or set official deadlines");

      // 3. Manager officially assigns task to staff architect with official baseline deadline
      const assignRes = await assignTask(
        managerUser,
        taskId,
        {
          assigneeUserId: staffUser.id,
          dueDate: "2026-03-10",
          reason: "Assigned as part of Schematic Design sprint",
        },
        db
      );

      expect(assignRes.success).toBe(true);
      expect(assignRes.status).toBe("TODO");

      const taskAssigned = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
      expect(taskAssigned.status).toBe("TODO");
      expect(taskAssigned.assignee_user_id).toBe(staffUser.id);
      expect(taskAssigned.original_due_date).toBe("2026-03-10");
      expect(taskAssigned.effective_due_date).toBe("2026-03-10");

      // 4. Staff attempts to change deadline -> REJECTED
      await expect(
        changeTaskDeadline(
          staffUser,
          taskId,
          {
            dueDate: "2026-03-25",
            reason: "I need more time",
          },
          db
        )
      ).rejects.toThrow("Only project managers can change official task deadlines");

      // 5. Manager changes official deadline with reason (AC-013)
      await changeTaskDeadline(
        managerUser,
        taskId,
        {
          dueDate: "2026-03-15",
          reason: "Client delayed structural survey handover by 5 days",
        },
        db
      );

      const taskRevised = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
      expect(taskRevised.original_due_date).toBe("2026-03-10"); // Original plan preserved!
      expect(taskRevised.effective_due_date).toBe("2026-03-15"); // Effective date updated

      // Verify event history retains both old and new deadlines and reason
      const deadlineEvents = await query(
        db,
        "SELECT * FROM task_events WHERE task_id = ? AND event_type = 'TASK_DEADLINE_CHANGED'",
        [taskId]
      );
      expect(deadlineEvents).toHaveLength(1);
      expect(deadlineEvents[0].old_state).toBe("2026-03-10");
      expect(deadlineEvents[0].new_state).toBe("2026-03-15");
      expect(deadlineEvents[0].reason).toContain("Client delayed structural survey handover");
    });
  });

  describe("AC-014: Complete and Reopen Tasks with Overdue Computation", () => {
    it("completes task, reopens with structured category, preserves history, and computes overdue state", async () => {
      // 1. Create and assign task
      const { id: taskId } = await createTask(
        managerUser,
        {
          projectId,
          title: "Draft municipal setback cross-section",
          proposedAssigneeId: staffUser.id,
          proposedDueDate: "2026-02-01", // Past due date
        },
        db
      );

      await assignTask(
        managerUser,
        taskId,
        {
          assigneeUserId: staffUser.id,
          dueDate: "2026-02-01",
        },
        db
      );

      // Verify initial overdue computation: Due date 2026-02-01 is past
      expect(computeIsOverdue({ status: "TODO", effective_due_date: "2026-02-01" })).toBe(true);

      // 2. Staff completes task with note
      const completeRes = await completeTask(
        staffUser,
        taskId,
        { completionNote: "Section drafted in DWG and uploaded to documents" },
        db
      );
      expect(completeRes.status).toBe("COMPLETED");

      const completedInDb = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
      expect(completedInDb.status).toBe("COMPLETED");
      expect(completedInDb.completed_at).toBeGreaterThan(0);
      expect(completedInDb.completed_by_user_id).toBe(staffUser.id);

      // Once completed, task is NOT overdue
      expect(computeIsOverdue({ status: "COMPLETED", effective_due_date: "2026-02-01" })).toBe(false);

      // 3. Manager reopens task due to quality defect (AC-014)
      const reopenRes = await reopenTask(
        managerUser,
        taskId,
        {
          reason: "Boundary wall setback is 2.5m instead of mandated 3.0m in K-SMART rules",
          category: "CORRECTION_DEFECT",
          newDueDate: "2026-02-10",
        },
        db
      );

      expect(reopenRes.status).toBe("TODO");
      expect(reopenRes.reopenCount).toBe(1);

      const reopenedInDb = await queryFirst<any>(db, "SELECT * FROM tasks WHERE id = ?", [taskId]);
      expect(reopenedInDb.status).toBe("TODO");
      expect(reopenedInDb.reopen_count).toBe(1);
      expect(reopenedInDb.effective_due_date).toBe("2026-02-10");

      // Verify reopen event recorded
      const reopenEvents = await query(
        db,
        "SELECT * FROM task_events WHERE task_id = ? AND event_type = 'TASK_REOPENED'",
        [taskId]
      );
      expect(reopenEvents).toHaveLength(1);
      expect(reopenEvents[0].reason).toContain("[CORRECTION_DEFECT]");
      expect(reopenEvents[0].reason).toContain("Boundary wall setback is 2.5m");

      // Verify overdue computation on reopened task with past deadline
      expect(computeIsOverdue({ status: "TODO", effective_due_date: "2026-02-10" })).toBe(true);
    });
  });

  describe("AC-015: Internal Task Evidence Stays Internal", () => {
    it("denies clients and consultants access to tasks, comments, and internal notes", async () => {
      // 1. Create task with internal comments
      const { id: taskId } = await createTask(
        managerUser,
        {
          projectId,
          title: "Internal fee negotiation review",
          description: "Internal discussion regarding consultant quote markup",
        },
        db
      );

      await addTaskComment(
        managerUser,
        taskId,
        "Structural consultant quote came in 15% higher than budgeted. Negotiating before client presentation.",
        undefined,
        db
      );

      // 2. Main Client attempts to read task -> DENIED
      await expect(getTask(clientUser, taskId, db)).rejects.toThrow(
        "Tasks and completion history are internal practice records"
      );

      // 3. Client attempts to list tasks -> DENIED
      await expect(listProjectTasks(clientUser, projectId, db)).rejects.toThrow(
        "Tasks and completion history are internal practice records"
      );

      // 4. Consultant attempts to read task or comments -> DENIED
      await expect(getTask(consultantUser, taskId, db)).rejects.toThrow(
        "Tasks and completion history are internal practice records"
      );
      await expect(listProjectTasks(consultantUser, projectId, db)).rejects.toThrow(
        "Tasks and completion history are internal practice records"
      );

      // 5. Staff and Manager can access tasks and internal comments
      const staffView = await getTask(staffUser, taskId, db);
      expect(staffView.task.id).toBe(taskId);
      expect(staffView.comments).toHaveLength(1);
      expect(staffView.comments[0].comment_text).toContain("Structural consultant quote came in 15% higher");

      const managerTasks = await listProjectTasks(managerUser, projectId, db);
      expect(managerTasks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
