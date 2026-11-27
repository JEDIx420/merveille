import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  createPersonalTask,
  getPersonalTask,
  updatePersonalTask,
  promotePersonalTaskToProject,
  addTaskChecklistItem,
  addTaskCollaborator,
  getMyTasksUnified,
} from "@/server/domain/tasks/personal-service";
import { listProjectTasks } from "@/server/domain/tasks/service";
import { FinanceService } from "@/server/domain/finance/service";
import { AccountingService } from "@/server/domain/accounting/service";
import {
  setCommercialMode,
  recordExternalClearance,
  updateExternalClearanceStatus,
} from "@/server/domain/finance/external-clearance";
import { ChangesService } from "@/server/domain/changes/service";

describe("Stage N01: Simple Workspace, Personal Tasks, and External-Commercial Cutover (NAC-003, NAC-004, NAC-005)", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";
  const projectId = "prj_n01_workspace";

  const adminUser: UserPrincipal = {
    id: "usr_admin_n01",
    email: "admin.n01@merveilledesigns.com",
    name: "Admin N01",
    role: "ADMIN",
    roles: ["ADMIN"],
    orgId,
    projectMemberships: [{ projectId, projectRole: "ADMIN" }],
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_n01",
    email: "mgr.n01@merveilledesigns.com",
    name: "Manager N01",
    role: "MANAGER",
    roles: ["MANAGER"],
    orgId,
    projectMemberships: [{ projectId, projectRole: "MANAGER", roles: ["MANAGER"], financeAuthor: true }],
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_n01",
    email: "staff.n01@merveilledesigns.com",
    name: "Staff N01",
    role: "TEAM_MEMBER",
    roles: ["TEAM_MEMBER"],
    orgId,
    projectMemberships: [{ projectId, projectRole: "TEAM_MEMBER", roles: ["TEAM_MEMBER"], financeAuthor: true }],
  };

  const outsiderUser: UserPrincipal = {
    id: "usr_outsider_n01",
    email: "outsider.n01@example.com",
    name: "Outsider",
    role: "TEAM_MEMBER",
    roles: ["TEAM_MEMBER"],
    orgId,
    projectMemberships: [],
  };

  const mainClient: UserPrincipal = {
    id: "usr_client_n01",
    email: "client.n01@example.com",
    name: "Main Client",
    role: "MAIN_CLIENT",
    roles: ["MAIN_CLIENT"],
    orgId,
    projectMemberships: [{ projectId, projectRole: "MAIN_CLIENT", roles: ["MAIN_CLIENT"], contractualAuthority: true }],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    const now = Date.now();
    for (const u of [adminUser, managerUser, staffUser, outsiderUser, mainClient]) {
      await db
        .prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`)
        .bind(u.id, u.email, u.name, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`)
        .bind(`om_${u.id}`, orgId, u.id, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at) VALUES (?, ?, ?, ?, 'GLOBAL', ?)`)
        .bind(`ra_${u.id}`, orgId, u.id, u.role, now)
        .run();
    }

    await db
      .prepare(
        `INSERT INTO projects (id, org_id, code, name, stage, status, is_archived, manager_user_id, main_client_user_id, revision, created_at)
         VALUES (?, ?, 'N01-01', 'Kowdiar Residence', 'DESIGN', 'DRAFT', 0, ?, ?, 1, ?)`
      )
      .bind(projectId, orgId, managerUser.id, mainClient.id, now)
      .run();

    for (const [uid, role] of [
      [managerUser.id, "MANAGER"],
      [staffUser.id, "TEAM_MEMBER"],
      [mainClient.id, "MAIN_CLIENT"],
    ]) {
      await db
        .prepare(
          `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`pm_${uid}`, orgId, projectId, uid, role, now)
        .run();
    }
  });

  it("NAC-003: Private personal tasks stay strictly owner-only, enforce 1-level subtasks, and promote deliberately into PENDING_ASSIGNMENT", async () => {
    const parent = await createPersonalTask(
      staffUser,
      { title: "Review tile samples", dueDate: "2026-12-01", sectionLabel: "Today" },
      db
    );
    const child = await createPersonalTask(
      staffUser,
      { title: "Call vendor for samples", parentTaskId: parent.id },
      db
    );

    // 2nd level nesting rejected
    await expect(
      createPersonalTask(staffUser, { title: "Sub-subtask", parentTaskId: child.id }, db)
    ).rejects.toThrow(/Only one visible nesting level/);

    // Manager and Admin CANNOT inspect staffUser's private personal tasks
    await expect(getPersonalTask(managerUser, parent.id, db)).rejects.toThrow(/strictly private/);
    await expect(getPersonalTask(adminUser, parent.id, db)).rejects.toThrow(/strictly private/);

    // Parent cannot complete while child is unfinished
    await expect(
      updatePersonalTask(staffUser, parent.id, { status: "COMPLETED" }, db)
    ).rejects.toThrow(/unfinished subtasks/);

    await updatePersonalTask(staffUser, child.id, { status: "COMPLETED" }, db);
    const completedParent = await updatePersonalTask(staffUser, parent.id, { status: "COMPLETED" }, db);
    expect(completedParent.status).toBe("COMPLETED");

    // Promote a personal task into a project -> creates canonical PENDING_ASSIGNMENT proposal
    const draftPersonal = await createPersonalTask(
      staffUser,
      { title: "Prepare kitchen elevation", dueDate: "2026-12-05" },
      db
    );
    const promoted = await promotePersonalTaskToProject(
      staffUser,
      draftPersonal.id,
      { projectId },
      db
    );
    expect(promoted.status).toBe("PENDING_ASSIGNMENT");

    const projTasks = await listProjectTasks(managerUser, projectId, db);
    const found = projTasks.find((t: any) => t.id === promoted.projectTaskId);
    expect(found).toBeDefined();
    expect(found.status).toBe("PENDING_ASSIGNMENT");
    // Personal due date is NOT silently promoted to official manager deadline
    expect(found.effective_due_date).toBeNull();

    // Checklists and collaborators (collaborator cannot grant project access to outsider)
    const chk = await addTaskChecklistItem(staffUser, promoted.projectTaskId, "Verify plumbing shaft", db);
    expect(chk.label).toBe("Verify plumbing shaft");

    await expect(
      addTaskCollaborator(staffUser, promoted.projectTaskId, outsiderUser.id, db)
    ).rejects.toThrow(/already be an active internal member/);

    const unified = await getMyTasksUnified(staffUser, db);
    expect(unified.items.some((i) => i.id === parent.id && i.scope === "PERSONAL")).toBe(true);
  });

  it("NAC-005: External-commercial cutover disables new portal billing while preserving version-bound clearance and manager activation", async () => {
    // 1. Switch org to EXTERNAL mode (non-admin denied)
    await expect(
      setCommercialMode(db, managerUser, orgId, "EXTERNAL", "Cutover")
    ).rejects.toThrow(/Only administrators/);

    await setCommercialMode(db, adminUser, orgId, "EXTERNAL", "Billing handled externally in Refrens/Zoho");

    // 2. New in-portal invoices, schedules, expenses, payroll are rejected on server
    await expect(
      FinanceService.draftInvoice(db, staffUser, {
        projectId,
        dueDate: "2026-12-15",
        lineItems: [{ description: "Stage 1", unitRateMinor: 100000 }],
      })
    ).rejects.toThrow(/billing is handled externally/);

    await expect(
      AccountingService.submitExpense(db, staffUser, {
        projectId,
        category: "TRAVEL",
        description: "Site visit",
        amountMinor: 50000,
        incurredDate: "2026-11-27",
      })
    ).rejects.toThrow(/billing is handled externally/);

    // 3. Create & accept quotation V1
    const q1 = await FinanceService.createQuotation(db, managerUser, {
      projectId,
      title: "Concept & Design Fee",
      requiredAdvanceMinor: 10000000,
      items: [{ description: "Design scope", unitRateMinor: 50000000 }],
    });
    await FinanceService.acceptQuotation(db, mainClient, q1.quotationId);

    // Manager cannot activate yet without ADMIN external clearance
    await expect(
      FinanceService.activateProject(db, managerUser, projectId)
    ).rejects.toThrow(/ADMIN-confirmed external commercial clearance/);

    // Non-admin cannot record external clearance
    await expect(
      recordExternalClearance(db, managerUser, {
        projectId,
        entityType: "QUOTATION",
        entityId: q1.quotationId,
        versionNumber: 1,
        clearanceType: "ADVANCE_RECEIVED",
        externalReference: "EXT-INV-101",
      })
    ).rejects.toThrow(/Only administrators/);

    // Admin records clearance on Q1 V1
    const cl1 = await recordExternalClearance(db, adminUser, {
      projectId,
      entityType: "QUOTATION",
      entityId: q1.quotationId,
      versionNumber: 1,
      clearanceType: "ADVANCE_RECEIVED",
      externalReference: "REF-2026-001",
    });

    // Admin revokes clearance -> manager activation must be rejected!
    await updateExternalClearanceStatus(db, adminUser, {
      clearanceId: cl1.id,
      action: "REVOKED",
      reason: "Cheque bounced",
    });
    await expect(
      FinanceService.activateProject(db, managerUser, projectId)
    ).rejects.toThrow(/ADMIN-confirmed external commercial clearance/);

    // Admin re-confirms clearance -> manager activates successfully!
    await recordExternalClearance(db, adminUser, {
      projectId,
      entityType: "QUOTATION",
      entityId: q1.quotationId,
      versionNumber: 1,
      clearanceType: "ADVANCE_RECEIVED",
      externalReference: "NEFT-2026-889",
    });
    const activated = await FinanceService.activateProject(db, managerUser, projectId);
    expect(activated.status).toBe("ACTIVE");

    // 4. Extra-work Change Request version-bound clearance
    const cr = await ChangesService.createChangeRequest(db, staffUser, {
      projectId,
      sourceType: "CLIENT_REQUEST",
      title: "Add courtyard pergola",
      description: "Timber pergola addition",
    });
    await ChangesService.startEstimating(db, managerUser, cr.id);
    await ChangesService.issueEstimate(db, managerUser, {
      changeRequestId: cr.id,
      priceMinor: 2500000,
      requiredPreworkPaymentMinor: 1000000,
      scheduleImpactDays: 5,
      scopeSummary: "Pergola fabrication",
    });
    await ChangesService.acceptEstimate(db, mainClient, {
      changeRequestId: cr.id,
      versionNumber: 1,
    });

    // Manager cannot authorize without clearance
    await expect(
      ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id })
    ).rejects.toThrow(/ADMIN-confirmed external commercial clearance/);

    await recordExternalClearance(db, adminUser, {
      projectId,
      entityType: "CHANGE_REQUEST",
      entityId: cr.id,
      versionNumber: 1,
      clearanceType: "PAYMENT_CLEARED",
      externalReference: "EXT-CR-11",
    });
    const authCr = await ChangesService.authorizeChangeWork(db, managerUser, {
      changeRequestId: cr.id,
    });
    expect(authCr.status).toBe("AUTHORIZED");
  });
});
