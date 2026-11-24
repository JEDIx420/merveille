import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { execute, query, queryFirst } from "@/server/db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  createEnquiry,
  recordFeasibilityStudy,
  closeEnquiry,
  convertEnquiryToProject,
  listEnquiries,
  getEnquiry,
} from "@/server/domain/enquiries/service";
import {
  listProjects,
  getProject,
  activateProject,
  updateProjectStage,
  pauseProject,
  resumeProject,
} from "@/server/domain/projects/service";

describe("Phase P02: Project Portfolios, Lifecycle, and Enquiry Intake", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";

  // Principals
  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Merveille Admin",
    orgId,
    role: "ADMIN",
    projectMemberships: [],
    isSynthetic: false,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_p02",
    email: "lead.architect.p02@merveilledesigns.com",
    name: "Lead Architect",
    orgId,
    role: "MANAGER",
    projectMemberships: [{ projectId: "prj_1" }, { projectId: "prj_2" }, { projectId: "prj_demo" }, { projectId: "prj_gate" }],
    isSynthetic: false,
  };

  const mainClientUser: UserPrincipal = {
    id: "usr_client_multi",
    email: "george.kurian@clientfamily.com",
    name: "George Kurian",
    orgId,
    role: "MAIN_CLIENT",
    projectMemberships: [{ projectId: "prj_1" }, { projectId: "prj_2" }, { projectId: "prj_demo" }, { projectId: "prj_gate" }],
    isSynthetic: false,
  };

  const clientRepUser: UserPrincipal = {
    id: "usr_rep_single",
    email: "mathew.kurian@clientfamily.com",
    name: "Mathew Kurian",
    orgId,
    role: "CLIENT_REP",
    projectMemberships: [{ projectId: "prj_1" }],
    isSynthetic: false,
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // Seed org (if not already seeded by migration)
    await execute(
      db,
      "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
      [orgId, "Merveille Designs", Date.now()]
    );

    // Seed users
    const users = [adminUser, managerUser, mainClientUser, clientRepUser];
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
  });

  describe("AC-009: Enquiry Closed Lost/Declined Without Active Project", () => {
    it("records feasibility studies and closes enquiry lost or declined without creating a project", async () => {
      // 1. Practice member records enquiry
      const { id: enqId } = await createEnquiry(
        managerUser,
        {
          contactName: "Sunil Varma",
          contactEmail: "sunil@example.com",
          siteLocation: "Kumarakom, Kottayam",
          requirementsText: "Lakefront holiday villa with local vernacular styling",
        },
        db
      );

      // Verify open status
      const enqBefore = await getEnquiry(managerUser, enqId, db);
      expect(enqBefore.enquiry.status).toBe("OPEN");
      expect(enqBefore.studies).toHaveLength(0);

      // 2. Record feasibility study
      await recordFeasibilityStudy(
        managerUser,
        enqId,
        {
          observations: "Site lies in strict CRZ zone along Vembanad Lake",
          siteConstraints: "50m CRZ buffer restricts permanent construction on lake frontage",
          recommendations: "Recommend stilt-supported wooden pavilions or acquiring adjacent land",
        },
        db
      );

      const enqWithStudy = await getEnquiry(managerUser, enqId, db);
      expect(enqWithStudy.enquiry.status).toBe("FEASIBILITY_REVIEW");
      expect(enqWithStudy.studies).toHaveLength(1);
      expect(enqWithStudy.studies[0].recommendations).toContain("stilt-supported wooden pavilions");

      // 3. Close enquiry as DECLINED due to regulatory feasibility
      const closeResult = await closeEnquiry(
        managerUser,
        enqId,
        {
          status: "DECLINED",
          reason: "Environmental buffer and CRZ setbacks preclude requested built footprint",
        },
        db
      );

      expect(closeResult.hasActiveProject).toBe(false);
      expect(closeResult.status).toBe("DECLINED");

      // 4. Verify in DB: Status is DECLINED, reason recorded, linked_project_id is NULL
      const enqClosed = await queryFirst<any>(db, "SELECT * FROM enquiries WHERE id = ?", [enqId]);
      expect(enqClosed.status).toBe("DECLINED");
      expect(enqClosed.decline_reason).toBe("Environmental buffer and CRZ setbacks preclude requested built footprint");
      expect(enqClosed.linked_project_id).toBeNull();

      // 5. Ensure NO projects were created in the database
      const projectCount = await queryFirst<{ count: number }>(db, "SELECT count(*) as count FROM projects");
      expect(projectCount?.count).toBe(0);
    });
  });

  describe("AC-011: Multi-Project Client Visibility and Singular Client Authority", () => {
    it("ensures main client sees all their projects, rep sees only assigned, and rep cannot assume main client authority", async () => {
      // 1. Create Project 1 (assigned to mainClientUser and clientRepUser)
      await execute(
        db,
        `INSERT INTO projects (id, org_id, code, name, site_location, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
         VALUES ('prj_1', ?, 'PRJ-2026-001', 'Kurian Waterfront Villa', 'Kochi', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
        [orgId, mainClientUser.id, managerUser.id, Date.now()]
      );

      // Project 1 memberships
      await execute(
        db,
        "INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_1', ?, 'prj_1', ?, 'MAIN_CLIENT', 1, ?)",
        [orgId, mainClientUser.id, Date.now()]
      );
      await execute(
        db,
        "INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_2', ?, 'prj_1', ?, 'CLIENT_REP', 1, ?)",
        [orgId, clientRepUser.id, Date.now()]
      );

      // 2. Create Project 2 (assigned to mainClientUser ONLY, NOT clientRepUser)
      await execute(
        db,
        `INSERT INTO projects (id, org_id, code, name, site_location, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
         VALUES ('prj_2', ?, 'PRJ-2026-002', 'Kurian Plantation Retreat', 'Wayanad', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
        [orgId, mainClientUser.id, managerUser.id, Date.now()]
      );

      await execute(
        db,
        "INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_3', ?, 'prj_2', ?, 'MAIN_CLIENT', 1, ?)",
        [orgId, mainClientUser.id, Date.now()]
      );

      // 3. Test portfolio visibility: Main client must see BOTH projects
      const mainClientProjects = await listProjects(mainClientUser, db);
      expect(mainClientProjects).toHaveLength(2);
      const codes = mainClientProjects.map((p: any) => p.code);
      expect(codes).toContain("PRJ-2026-001");
      expect(codes).toContain("PRJ-2026-002");

      // 4. Test portfolio visibility: Client Representative must see ONLY Project 1
      const repProjects = await listProjects(clientRepUser, db);
      expect(repProjects).toHaveLength(1);
      expect(repProjects[0].code).toBe("PRJ-2026-001");

      // 5. Representative trying to access Project 2 detail is blocked
      await expect(getProject(clientRepUser, "prj_2", db)).rejects.toThrow("Access denied: You are not assigned to this project");
    });
  });

  describe("AC-012: Manager Stage Progression, Optimistic Concurrency, and Pause/Resume", () => {
    it("handles stage completion, auto-stage advancement, optimistic concurrency conflict, and pause/resume", async () => {
      // 1. Create project with two stages
      await execute(
        db,
        `INSERT INTO projects (id, org_id, code, name, site_location, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
         VALUES ('prj_demo', ?, 'PRJ-DEMO', 'Demo House', 'Kochi', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
        [orgId, mainClientUser.id, managerUser.id, Date.now()]
      );

      await execute(
        db,
        `INSERT INTO project_stages (id, project_id, stage_order, name, status, revision)
         VALUES ('stg_1', 'prj_demo', 1, 'Schematic Design', 'IN_PROGRESS', 1),
                ('stg_2', 'prj_demo', 2, 'Design Development', 'PENDING', 1)`
      );

      // 2. Manager completes Stage 1
      const updateRes = await updateProjectStage(
        managerUser,
        "prj_demo",
        {
          stageId: "stg_1",
          status: "COMPLETED",
          actualCompletionDate: "2026-02-15",
          expectedRevision: 1,
        },
        db
      );

      expect(updateRes.success).toBe(true);
      expect(updateRes.status).toBe("COMPLETED");

      // Verify stage 1 is completed and project stage auto-advanced to Stage 2 ("Design Development")
      const projAfterStage = await queryFirst<any>(db, "SELECT stage FROM projects WHERE id = 'prj_demo'");
      expect(projAfterStage.stage).toBe("Design Development");

      // 3. Optimistic concurrency conflict test: Trying to update stg_1 with expectedRevision 1 should fail because revision was incremented to 2
      await expect(
        updateProjectStage(
          managerUser,
          "prj_demo",
          {
            stageId: "stg_1",
            status: "IN_PROGRESS",
            expectedRevision: 1, // Stale!
          },
          db
        )
      ).rejects.toThrow("Stage revision conflict");

      // 4. Pause project with reason
      const pauseRes = await pauseProject(
        managerUser,
        "prj_demo",
        { reason: "Waiting on municipal building permit approval" },
        db
      );
      expect(pauseRes.status).toBe("PAUSED");

      const pausedProj = await queryFirst<any>(db, "SELECT status, pause_reason FROM projects WHERE id = 'prj_demo'");
      expect(pausedProj.status).toBe("PAUSED");
      expect(pausedProj.pause_reason).toBe("Waiting on municipal building permit approval");

      // 5. Resume project with reason
      const resumeRes = await resumeProject(
        managerUser,
        "prj_demo",
        { reason: "Municipal permit cleared by local body" },
        db
      );
      expect(resumeRes.status).toBe("ACTIVE");

      const resumedProj = await queryFirst<any>(db, "SELECT status, pause_reason FROM projects WHERE id = 'prj_demo'");
      expect(resumedProj.status).toBe("ACTIVE");
      expect(resumedProj.pause_reason).toBeNull();

      // Check event log history
      const events = await query(db, "SELECT * FROM project_events WHERE project_id = 'prj_demo' ORDER BY created_at ASC");
      expect(events.length).toBeGreaterThanOrEqual(3); // STAGE_COMPLETED, PROJECT_PAUSED, PROJECT_RESUMED
    });
  });

  describe("AC-010 Commercial Gate Baseline Activation", () => {
    it("blocks activation when quotation or advance is missing, and activates when both are confirmed", async () => {
      // 1. Create draft project without commercial gates
      await execute(
        db,
        `INSERT INTO projects (id, org_id, code, name, site_location, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
         VALUES ('prj_gate', ?, 'PRJ-GATE', 'Gated Residence', 'Thrissur', ?, ?, 'Schematic Design', 'DRAFT', 0, 1, ?)`,
        [orgId, mainClientUser.id, managerUser.id, Date.now()]
      );

      // Attempt activation without gates -> Fails
      await expect(activateProject(managerUser, "prj_gate", db)).rejects.toThrow(
        "Cannot activate project. Missing required commercial gates: Accepted client quotation and Admin-confirmed advance receipt"
      );

      // Set quotation accepted only
      await execute(db, "UPDATE projects SET quote_accepted_at = ? WHERE id = 'prj_gate'", [Date.now()]);
      await expect(activateProject(managerUser, "prj_gate", db)).rejects.toThrow(
        "Cannot activate project. Missing required commercial gates: Admin-confirmed advance receipt"
      );

      // Set advance confirmed
      await execute(db, "UPDATE projects SET advance_confirmed_at = ? WHERE id = 'prj_gate'", [Date.now()]);

      // Now activation succeeds
      const actRes = await activateProject(managerUser, "prj_gate", db);
      expect(actRes.status).toBe("ACTIVE");

      const activeProj = await queryFirst<any>(db, "SELECT status, activated_at FROM projects WHERE id = 'prj_gate'");
      expect(activeProj.status).toBe("ACTIVE");
      expect(activeProj.activated_at).toBeGreaterThan(0);
    });
  });
});
