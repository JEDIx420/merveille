import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "@/server/auth/principal";
import { DashboardService } from "@/server/domain/dashboard/service";

describe("Phase 12: Role Dashboards, Waiting-on-you, and Owner Performance", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";
  const projectId = "prj_villa_azure";

  const ownerUser: UserPrincipal = {
    id: "usr_owner_p12",
    email: "owner.p12@merveilledesigns.com",
    name: "Vikram Owner",
    role: "OWNER", roles: ["OWNER"],
    orgId,
    projectMemberships: [{ projectId, projectRole: "DIRECTOR" }],
  };

  const adminUser: UserPrincipal = {
    id: "usr_admin_p12",
    email: "admin.p12@merveilledesigns.com",
    name: "Anita Admin",
    role: "ADMIN", roles: ["ADMIN"],
    orgId,
    projectMemberships: [{ projectId, projectRole: "FINANCE" }],
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_p12",
    email: "manager.p12@merveilledesigns.com",
    name: "Mohan Manager",
    role: "MANAGER", roles: [],
    orgId,
    projectMemberships: [{ projectId, projectRole: "MANAGER" }],
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_p12",
    email: "staff.p12@merveilledesigns.com",
    name: "Suresh Staff",
    role: "STAFF", roles: [],
    orgId,
    projectMemberships: [{ projectId, projectRole: "TEAM_MEMBER" }],
  };

  const consultantUser: UserPrincipal = {
    id: "usr_cons_p12",
    email: "structural.p12@cons.com",
    name: "Cyrus Structural",
    role: "CONSULTANT", roles: [],
    orgId,
    projectMemberships: [{ projectId, projectRole: "CONSULTANT" }],
  };

  const clientUser: UserPrincipal = {
    id: "usr_client_p12",
    email: "client.p12@gmail.com",
    name: "Dr. K. R. Nambiar",
    role: "MAIN_CLIENT", roles: [],
    orgId,
    projectMemberships: [{ projectId, projectRole: "MAIN_CLIENT", contractualAuthority: true }],
  };

  const clientRepUser: UserPrincipal = {
    id: "usr_rep_p12",
    email: "rep.p12@gmail.com",
    name: "Rahul Representative",
    role: "CLIENT_REP", roles: [],
    orgId,
    projectMemberships: [{ projectId, projectRole: "CLIENT_REP" }],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // 1. Seed org
    await db
      .prepare(`INSERT OR IGNORE INTO organizations (id, name, timezone, base_currency, status, created_at) VALUES (?, ?, 'Asia/Kolkata', 'INR', 'ACTIVE', ?)`)
      .bind(orgId, "Merveille Designs", Date.now())
      .run();

    // 2. Seed users
    const users = [ownerUser, adminUser, managerUser, staffUser, consultantUser, clientUser, clientRepUser];
    for (const u of users) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`
        )
        .bind(u.id, u.email, u.name, Date.now())
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`
        )
        .bind(`om_${u.id}`, orgId, u.id, Date.now())
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at) VALUES (?, ?, ?, ?, 'GLOBAL', ?)`
        )
        .bind(`ra_${u.id}`, orgId, u.id, u.role, Date.now())
        .run();
    }

    // 3. Seed project
    await db
      .prepare(
        `INSERT INTO projects (id, org_id, code, name, status, created_at)
         VALUES (?, ?, 'VA-01', 'Villa Azure', 'ACTIVE', ?)`
      )
      .bind(projectId, orgId, Date.now())
      .run();

    // 4. Seed project memberships
    for (const u of users) {
      await db
        .prepare(
          `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`pm_${u.id}`, orgId, projectId, u.id, u.projectMemberships[0]?.projectRole || u.role, Date.now())
        .run();
    }

    // 5. Seed project stages
    await db
      .prepare(
        `INSERT INTO project_stages (id, project_id, stage_order, name, status, planned_start_date, planned_completion_date)
         VALUES ('stg_01', ?, 1, 'Schematic Design', 'COMPLETED', '2026-10-01', '2026-10-31')`
      )
      .bind(projectId)
      .run();
    await db
      .prepare(
        `INSERT INTO project_stages (id, project_id, stage_order, name, status, planned_start_date, planned_completion_date)
         VALUES ('stg_02', ?, 2, 'Design Development', 'IN_PROGRESS', '2026-11-01', '2026-11-30')`
      )
      .bind(projectId)
      .run();
  });

  it("AC-051: Waiting on you is actionable and strictly role-scoped", async () => {
    // 1. Overdue task for staffUser
    await db
      .prepare(
        `INSERT INTO tasks (id, org_id, project_id, title, description, assignee_user_id, creator_user_id, status, original_due_date, effective_due_date, created_at)
         VALUES ('tsk_overdue_01', ?, ?, 'Structural column coordination', 'Coordinate column placement with consultant', ?, ?, 'TODO', '2026-11-20', '2026-11-20', ?)`
      )
      .bind(orgId, projectId, staffUser.id, managerUser.id, Date.now() - 500000)
      .run();

    // Need a dummy file for drawing version
    await db
      .prepare(
        `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, created_at)
         VALUES ('fil_dummy_01', ?, ?, ?, 'PDF', 'A-101.pdf', 'application/pdf', 1000, 'drawings/a101.pdf', ?)`
      )
      .bind(orgId, projectId, staffUser.id, Date.now())
      .run();

    // 2. Drawing review for consultantUser
    await db
      .prepare(
        `INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, is_withdrawn, created_at)
         VALUES ('dwg_01', ?, ?, 'A-101', 'Ground Floor Layout', 'ARCHITECTURAL', 0, ?)`
      )
      .bind(orgId, projectId, Date.now())
      .run();
    await db
      .prepare(
        `INSERT INTO drawing_versions (id, drawing_id, version_label, file_id, author_user_id, status, created_at)
         VALUES ('ver_01', 'dwg_01', 'V1', 'fil_dummy_01', ?, 'IN_REVIEW', ?)`
      )
      .bind(staffUser.id, Date.now())
      .run();
    await db
      .prepare(
        `INSERT INTO drawing_reviews (id, version_id, consultant_user_id, is_required, status, created_at)
         VALUES ('rev_01', 'ver_01', ?, 1, 'PENDING', ?)`
      )
      .bind(consultantUser.id, Date.now())
      .run();

    // 3. Drawing awaiting manager release (reviews approved)
    await db
      .prepare(
        `INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, is_withdrawn, created_at)
         VALUES ('dwg_02', ?, ?, 'S-201', 'Foundation Details', 'STRUCTURAL', 0, ?)`
      )
      .bind(orgId, projectId, Date.now())
      .run();
    await db
      .prepare(
        `INSERT INTO drawing_versions (id, drawing_id, version_label, file_id, author_user_id, status, created_at)
         VALUES ('ver_02', 'dwg_02', 'V1', 'fil_dummy_01', ?, 'CONSULTANT_APPROVED', ?)`
      )
      .bind(consultantUser.id, Date.now())
      .run();

    // 4. Invoice awaiting manager approval
    await db
      .prepare(
        `INSERT INTO invoices (id, org_id, project_id, invoice_number, status, total_minor, outstanding_minor, due_date, created_by_user_id, created_at)
         VALUES ('inv_01', ?, ?, 'INV-2026-001', 'DRAFT', 15000000, 15000000, '2026-12-15', ?, ?)`
      )
      .bind(orgId, projectId, staffUser.id, Date.now())
      .run();

    // 5. Change request estimate awaiting client decision
    await db
      .prepare(
        `INSERT INTO change_requests (id, org_id, project_id, request_number, title, description, source_type, status, current_version_number, requested_by_user_id, created_at, updated_at)
         VALUES ('cr_01', ?, ?, 'CR-001', 'Pergola Addition', 'Add timber pergola to terrace', 'CLIENT_REQUEST', 'AWAITING_CLIENT', 1, ?, ?, ?)`
      )
      .bind(orgId, projectId, managerUser.id, Date.now(), Date.now())
      .run();
    await db
      .prepare(
        `INSERT INTO change_request_versions (id, change_request_id, version_number, scope_summary, price_minor, total_minor, schedule_impact_days, status, created_at)
         VALUES ('crv_01', 'cr_01', 1, 'Pergola timber frame and fixings', 8500000, 8500000, 14, 'ISSUED', ?)`
      )
      .bind(Date.now())
      .run();

    // --- TEST STAFF VIEW ---
    const staffQueue = await DashboardService.getWaitingOnYou(db, staffUser);
    expect(staffQueue.length).toBeGreaterThan(0);
    const staffTask = staffQueue.find((i) => i.entityId === "tsk_overdue_01");
    expect(staffTask).toBeDefined();
    expect(staffTask?.isOverdue).toBe(true);
    expect(staffTask?.urgency).toBe("URGENT");
    expect(staffTask?.link).toContain("/projects/prj_villa_azure/tasks?taskId=tsk_overdue_01");
    // Staff should NOT see consultant reviews, manager releases, invoice approvals, or client decisions
    expect(staffQueue.some((i) => i.entityType === "DRAWING_REVIEW")).toBe(false);
    expect(staffQueue.some((i) => i.entityType === "DRAWING_RELEASE")).toBe(false);
    expect(staffQueue.some((i) => i.entityType === "INVOICE_APPROVAL")).toBe(false);
    expect(staffQueue.some((i) => i.entityType === "CHANGE_DECISION")).toBe(false);

    // --- TEST CONSULTANT VIEW ---
    const consultantQueue = await DashboardService.getWaitingOnYou(db, consultantUser);
    expect(consultantQueue.length).toBe(1);
    expect(consultantQueue[0].entityType).toBe("DRAWING_REVIEW");
    expect(String(consultantQueue[0].entityVersion)).toMatch(/1/);
    expect(consultantQueue[0].link).toContain("/projects/prj_villa_azure/drawings?drawingId=dwg_01");
    // Consultant cannot see tasks or approvals
    expect(consultantQueue.some((i) => i.entityId === "tsk_overdue_01")).toBe(false);
    expect(consultantQueue.some((i) => i.entityType === "INVOICE_APPROVAL")).toBe(false);

    // --- TEST MANAGER VIEW ---
    const managerQueue = await DashboardService.getWaitingOnYou(db, managerUser);
    const managerRelease = managerQueue.find((i) => i.entityType === "DRAWING_RELEASE");
    expect(managerRelease).toBeDefined();
    expect(String(managerRelease?.entityVersion)).toMatch(/1/);
    expect(managerRelease?.link).toContain("/projects/prj_villa_azure/drawings?drawingId=dwg_02");

    const managerInvoice = managerQueue.find((i) => i.entityType === "INVOICE_APPROVAL");
    expect(managerInvoice).toBeDefined();
    expect(managerInvoice?.entityId).toBe("inv_01");
    // Manager does not see pending consultant review or client change decision
    expect(managerQueue.some((i) => i.entityType === "DRAWING_REVIEW")).toBe(false);
    expect(managerQueue.some((i) => i.entityType === "CHANGE_DECISION")).toBe(false);

    // --- TEST MAIN CLIENT VIEW ---
    const clientQueue = await DashboardService.getWaitingOnYou(db, clientUser);
    const clientDecision = clientQueue.find((i) => i.entityType === "CHANGE_DECISION");
    expect(clientDecision).toBeDefined();
    expect(clientDecision?.entityVersion).toBe(1);
    expect(clientDecision?.link).toContain("/projects/prj_villa_azure/changes?changeId=cr_01&version=1");
    // Main client NEVER has drawing approval or internal tasks
    expect(clientQueue.some((i) => i.entityType === "DRAWING_REVIEW")).toBe(false);
    expect(clientQueue.some((i) => i.entityType === "DRAWING_RELEASE")).toBe(false);
    expect(clientQueue.some((i) => i.entityType === "TASK")).toBe(false);

    // --- TEST CLIENT REPRESENTATIVE VIEW ---
    // Representatives are strictly excluded from binding decisions
    const repQueue = await DashboardService.getWaitingOnYou(db, clientRepUser);
    expect(repQueue.some((i) => i.entityType === "CHANGE_DECISION")).toBe(false);
    expect(repQueue.some((i) => i.entityType === "DRAWING_REVIEW")).toBe(false);
    expect(repQueue.some((i) => i.entityType === "DRAWING_RELEASE")).toBe(false);
  });

  it("AC-052: Performance is evidence-based and owner-only; client changes are not scored as employee errors", async () => {
    // 1. Seed tasks with diverse outcomes for staffUser
    // Task A: Completed on time
    await db
      .prepare(
        `INSERT INTO tasks (id, org_id, project_id, title, assignee_user_id, creator_user_id, status, original_due_date, effective_due_date, completed_at, reopen_count, created_at)
         VALUES ('tsk_a', ?, ?, 'Schematic drawings', ?, ?, 'COMPLETED', '2026-11-10', '2026-11-10', ?, 0, ?)`
      )
      .bind(orgId, projectId, staffUser.id, managerUser.id, new Date("2026-11-09").getTime(), Date.now())
      .run();

    // Task B: Reopened due to internal quality defect
    await db
      .prepare(
        `INSERT INTO tasks (id, org_id, project_id, title, assignee_user_id, creator_user_id, status, original_due_date, effective_due_date, completed_at, reopen_count, created_at)
         VALUES ('tsk_b', ?, ?, 'Staircase detail', ?, ?, 'IN_PROGRESS', '2026-11-15', '2026-11-15', NULL, 2, ?)`
      )
      .bind(orgId, projectId, staffUser.id, managerUser.id, Date.now())
      .run();

    // Task C: Deadline extended due to client-requested scope change
    await db
      .prepare(
        `INSERT INTO tasks (id, org_id, project_id, title, assignee_user_id, creator_user_id, status, original_due_date, effective_due_date, completed_at, reopen_count, created_at)
         VALUES ('tsk_c', ?, ?, 'Additional balcony rendering', ?, ?, 'COMPLETED', '2026-11-12', '2026-11-20', ?, 0, ?)`
      )
      .bind(orgId, projectId, staffUser.id, managerUser.id, new Date("2026-11-19").getTime(), Date.now())
      .run();

    // Record deadline changed event with client reason
    await db
      .prepare(
        `INSERT INTO task_events (id, task_id, actor_id, event_type, old_state, new_state, reason, created_at)
         VALUES ('te_01', 'tsk_c', ?, 'TASK_DEADLINE_CHANGED', '2026-11-12', '2026-11-20', 'Client requested additional scope variation', ?)`
      )
      .bind(managerUser.id, Date.now())
      .run();

    // --- TEST ACCESS RESTRICTION ---
    // Staff attempt -> FORBIDDEN
    await expect(
      DashboardService.getOwnerPerformanceMetrics(db, staffUser, orgId)
    ).rejects.toThrow(/restricted to the practice Owner/);

    // Manager attempt -> FORBIDDEN
    await expect(
      DashboardService.getOwnerPerformanceMetrics(db, managerUser, orgId)
    ).rejects.toThrow(/restricted to the practice Owner/);

    // Admin attempt -> FORBIDDEN (Admin without Owner cannot view individual performance - AC-005, REQ-DAS-002)
    await expect(
      DashboardService.getOwnerPerformanceMetrics(db, adminUser, orgId)
    ).rejects.toThrow(/restricted to the practice Owner/);

    // Owner attempt -> SUCCESS
    const metrics = await DashboardService.getOwnerPerformanceMetrics(db, ownerUser, orgId);
    expect(metrics).toBeDefined();
    expect(metrics.definitions).toBeDefined();
    expect(metrics.definitions.deadlineAdherence).toBeDefined();
    expect(metrics.definitions.reworkVsClientScope).toBeDefined();

    const staffMetric = metrics.teamMetrics.find((m) => m.userId === staffUser.id);
    expect(staffMetric).toBeDefined();
    expect(staffMetric?.completedTasksCount).toBe(2); // tsk_a and tsk_c
    expect(staffMetric?.onTimeCount).toBe(2); // tsk_a on time, tsk_c on time against client-extended deadline
    expect(staffMetric?.reopenedTasksCount).toBe(2); // tsk_b reopened 2x
    expect(staffMetric?.clientScopeRevisionsCount).toBe(1); // tsk_c client-driven, not staff defect

    // Verify task C is marked as isClientScopeChange
    const taskCEvidence = staffMetric?.tasks.find((t) => t.id === "tsk_c");
    expect(taskCEvidence?.isClientScopeChange).toBe(true);

    // Verify project stage progress exists and is transparent
    expect(metrics.projectStageProgress.length).toBeGreaterThan(0);
    const stage1 = metrics.projectStageProgress.find((s) => s.stageName === "Schematic Design");
    expect(stage1?.status).toBe("COMPLETED");
  });

  it("AC-053: Client overview is calm and private; published progress, drawings and payments shown without leakage", async () => {
    // 1. Published update vs draft update
    await db
      .prepare(
        `INSERT INTO project_updates (id, org_id, project_id, author_id, current_published_version_id, created_at)
         VALUES ('upd_pub', ?, ?, ?, 'ver_upd_pub', ?)`
      )
      .bind(orgId, projectId, managerUser.id, Date.now() - 100000)
      .run();

    await db
      .prepare(
        `INSERT INTO update_versions (id, update_id, version_number, title, body_text, status, published_at, published_by_user_id, created_at)
         VALUES ('ver_upd_pub', 'upd_pub', 1, 'Foundation Milestone Completed', 'Detailed site report...', 'PUBLISHED', ?, ?, ?)`
      )
      .bind(Date.now() - 100000, managerUser.id, Date.now() - 100000)
      .run();

    await db
      .prepare(
        `INSERT INTO project_updates (id, org_id, project_id, author_id, current_published_version_id, created_at)
         VALUES ('upd_draft', ?, ?, ?, NULL, ?)`
      )
      .bind(orgId, projectId, staffUser.id, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO update_versions (id, update_id, version_number, title, body_text, status, created_at)
         VALUES ('ver_upd_draft', 'upd_draft', 1, 'Draft Internal Update', 'Internal contractor delay notes...', 'DRAFT', ?)`
      )
      .bind(Date.now())
      .run();

    // 2. Released drawing vs draft drawing
    await db
      .prepare(
        `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, created_at)
         VALUES ('fil_rel_01', ?, ?, ?, 'PDF', 'A-101_Ground_Floor.pdf', 'application/pdf', 2500000, 'drawings/a101.pdf', ?)`
      )
      .bind(orgId, projectId, staffUser.id, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, is_withdrawn, current_released_version_id, created_at)
         VALUES ('dwg_client_01', ?, ?, 'A-101', 'Ground Floor Layout', 'ARCHITECTURAL', 0, 'ver_rel_01', ?)`
      )
      .bind(orgId, projectId, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO drawing_versions (id, drawing_id, version_label, file_id, author_user_id, status, released_at, released_by_user_id, created_at)
         VALUES ('ver_rel_01', 'dwg_client_01', 'V1', 'fil_rel_01', ?, 'RELEASED', ?, ?, ?)`
      )
      .bind(staffUser.id, Date.now(), managerUser.id, Date.now())
      .run();

    // Unreleased draft drawing
    await db
      .prepare(
        `INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, is_withdrawn, current_released_version_id, created_at)
         VALUES ('dwg_draft_01', ?, ?, 'A-102', 'First Floor Draft', 'ARCHITECTURAL', 0, NULL, ?)`
      )
      .bind(orgId, projectId, Date.now())
      .run();

    // 3. Billing: active invoice with balance due
    await db
      .prepare(
        `INSERT INTO invoices (id, org_id, project_id, invoice_number, status, total_minor, allocated_minor, outstanding_minor, due_date, created_by_user_id, created_at)
         VALUES ('inv_client_01', ?, ?, 'INV-2026-001', 'ISSUED', 10000000, 6000000, 4000000, '2026-12-10', ?, ?)`
      )
      .bind(orgId, projectId, staffUser.id, Date.now())
      .run();

    // 4. Internal items that must NEVER leak: internal task, internal expense, internal snag
    await db
      .prepare(
        `INSERT INTO tasks (id, org_id, project_id, title, description, assignee_user_id, creator_user_id, status, created_at)
         VALUES ('tsk_internal', ?, ?, 'Secret internal task', 'Vendor price dispute', ?, ?, 'IN_PROGRESS', ?)`
      )
      .bind(orgId, projectId, staffUser.id, managerUser.id, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO expenses (id, org_id, project_id, category, description, amount_minor, status, incurred_date, submitted_by_user_id, created_at)
         VALUES ('exp_secret', ?, ?, 'PRINTING_STATIONERY', 'High end blueprint plotting', 450000, 'POSTED', '2026-11-20', ?, ?)`
      )
      .bind(orgId, projectId, staffUser.id, Date.now())
      .run();

    // Execute Client Overview Query
    const overview = await DashboardService.getClientProjectOverview(db, clientUser, projectId);

    // 1. Verify Project Header & Stage
    expect(overview.project.code).toBe("VA-01");
    expect(overview.project.name).toBe("Villa Azure");
    expect(overview.project.currentStageName).toBe("Design Development");

    // 2. Verify Published Updates (ONLY published, NO draft)
    expect(overview.publishedUpdates.length).toBe(1);
    expect(overview.publishedUpdates[0].id).toBe("upd_pub");
    expect(overview.publishedUpdates[0].title).toBe("Foundation Milestone Completed");
    expect(overview.publishedUpdates.some((u) => u.id === "upd_draft")).toBe(false);

    // 3. Verify Current Released Drawings (ONLY released, NO draft)
    expect(overview.releasedDrawings.length).toBe(1);
    expect(overview.releasedDrawings[0].drawingNumber).toBe("A-101");
    expect(String(overview.releasedDrawings[0].versionNumber)).toMatch(/1/);
    expect(overview.releasedDrawings[0].fileName).toBe("A-101_Ground_Floor.pdf");
    expect(overview.releasedDrawings.some((d) => d.drawingNumber === "A-102")).toBe(false);

    // 4. Verify Billing Summary
    expect(overview.billingSummary).toBeDefined();
    expect(overview.billingSummary?.nextDueInvoice?.invoiceNumber).toBe("INV-2026-001");
    expect(overview.billingSummary?.nextDueInvoice?.balanceMinor).toBe(4000000);
    expect(overview.billingSummary?.outstandingBalanceMinor).toBe(4000000);

    // 5. Verify Zero Leakage of Internal Information
    const overviewJson = JSON.stringify(overview);
    expect(overviewJson).not.toContain("Secret internal task");
    expect(overviewJson).not.toContain("Draft Internal Update");
    expect(overviewJson).not.toContain("Vendor price dispute");
    expect(overviewJson).not.toContain("High end blueprint plotting");
    expect(overviewJson).not.toContain("exp_secret");
    expect(overviewJson).not.toContain("tsk_internal");

    // 6. Verify Client Representative without financial grant receives null billingSummary
    const repOverview = await DashboardService.getClientProjectOverview(db, clientRepUser, projectId);
    expect(repOverview.billingSummary).toBeNull();
    // But still sees published progress and released drawings calmly
    expect(repOverview.publishedUpdates.length).toBe(1);
    expect(repOverview.releasedDrawings.length).toBe(1);
  });
});
