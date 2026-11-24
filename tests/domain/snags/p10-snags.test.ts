/**
 * P10 Acceptance Tests: Site Issues, Snag Tracking, Evidence Verification,
 * Confidential Internal Remediation Isolation, and Charged Remediation Change Gates.
 * Tests AC-044, AC-045, AC-070.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../../src/server/auth/principal";
import { SnagsService } from "../../../src/server/domain/snags/service";
import { ChangesService } from "../../../src/server/domain/changes/service";
import { FinanceService } from "../../../src/server/domain/finance/service";
import { createTask, startTask } from "../../../src/server/domain/tasks/service";

describe("Phase 10: Site Issues, Snag Resolution, and Verification Controls", () => {
  let db: D1Database;

  const testOrgId = "org_merveille_main";
  const testProjectId = "prj_snag_villa";
  const foreignProjectId = "prj_foreign_site";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Merveille Admin",
    orgId: testOrgId,
    role: "ADMIN", roles: ["ADMIN"],
    projectMemberships: [{ projectId: testProjectId, projectRole: "ADMIN" }],
    isSynthetic: true,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Vipin Manager",
    orgId: testOrgId,
    role: "MANAGER", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "MANAGER" }],
    isSynthetic: true,
  };

  const staffUser: UserPrincipal = {
    id: "usr_stf_001",
    email: "staff@merveilledesigns.com",
    name: "Nithya Architect",
    orgId: testOrgId,
    role: "STAFF", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "STAFF" }],
    isSynthetic: true,
  };

  const clientUser: UserPrincipal = {
    id: "usr_cli_001",
    email: "client@example.com",
    name: "Thomas Client (Main Client)",
    orgId: testOrgId,
    role: "MAIN_CLIENT", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "MAIN_CLIENT", contractualAuthority: true }],
    isSynthetic: true,
  };

  const consultantUser: UserPrincipal = {
    id: "usr_cons_001",
    email: "consultant@example.com",
    name: "Structural Consultant",
    orgId: testOrgId,
    role: "CONSULTANT", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "CONSULTANT" }],
    isSynthetic: true,
  };

  const foreignStaffUser: UserPrincipal = {
    id: "usr_stf_foreign",
    email: "other@merveilledesigns.com",
    name: "Foreign Staff",
    orgId: testOrgId,
    role: "STAFF", roles: [],
    projectMemberships: [{ projectId: foreignProjectId, projectRole: "STAFF" }],
    isSynthetic: true,
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // 1. Seed org
    await db
      .prepare("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)")
      .bind(testOrgId, "Merveille Designs", Date.now())
      .run();

    // 2. Seed users
    const allUsers = [adminUser, managerUser, staffUser, clientUser, consultantUser, foreignStaffUser];
    for (const u of allUsers) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, display_name, status, created_at)
           VALUES (?, ?, ?, 'ACTIVE', ?)`
        )
        .bind(u.id, u.email, u.name, Date.now())
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at)
           VALUES (?, ?, ?, 1, ?)`
        )
        .bind(`om_${u.id}`, testOrgId, u.id, Date.now())
        .run();
    }

    // 3. Seed project
    await db
      .prepare(
        `INSERT INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`
      )
      .bind(
        testProjectId,
        testOrgId,
        "PRJ-SNG",
        "Villa Snag Controls",
        clientUser.id,
        managerUser.id,
        Date.now()
      )
      .run();

    // 4. Seed memberships for test project
    const projectUsers = [adminUser, managerUser, staffUser, clientUser, consultantUser];
    for (const u of projectUsers) {
      const pRole = u.projectMemberships[0].projectRole;
      await db
        .prepare(
          `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`pm_${u.id}`, testOrgId, testProjectId, u.id, pRole, Date.now())
        .run();
    }

    // 5. Seed foreign project & foreign membership
    await db
      .prepare(
        `INSERT INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id, status, created_at
        ) VALUES (?, ?, 'PRJ-FOR', 'Foreign Site', ?, ?, 'ACTIVE', ?)`
      )
      .bind(foreignProjectId, testOrgId, clientUser.id, managerUser.id, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`
      )
      .bind("pm_foreign", testOrgId, foreignProjectId, foreignStaffUser.id, "STAFF", Date.now())
      .run();
  });

  // ---------------------------------------------------------------------------
  // AC-044 — Snag resolution needs verification
  // ---------------------------------------------------------------------------
  it("AC-044: snag resolution distinguishes resolved from verified closed; manager verifies or reopens; history retained", async () => {
    // 1. Client reports site issue with location and description
    const snag = await SnagsService.reportSnag(db, clientUser, {
      projectId: testProjectId,
      title: "Hairline plaster crack near window lintel",
      description: "Observed vertical crack extending 40cm downward from master bedroom east window.",
      locationArea: "Master Bedroom East Wall",
      severity: "HIGH",
    });
    expect(snag.snagNumber).toBe("SNG-001");
    expect(snag.status).toBe("REPORTED");

    // 2. Manager triage: Attempting to assign foreign user from another project -> REJECTED (SCR-17)
    await expect(
      SnagsService.triageSnag(db, managerUser, {
        snagId: snag.id,
        assignedToUserId: foreignStaffUser.id,
      })
    ).rejects.toThrow("Assignee must be an active member of this project");

    // Manager assigns to project staff member with official target date
    const triaged = await SnagsService.triageSnag(db, managerUser, {
      snagId: snag.id,
      assignedToUserId: staffUser.id,
      targetDate: "2026-12-05",
      severity: "HIGH",
    });
    expect(triaged.status).toBe("OPEN");
    expect(triaged.assignedToUserId).toBe(staffUser.id);

    // 3. Staff starts work on remediation
    const started = await SnagsService.startSnagWork(db, staffUser, snag.id);
    expect(started.status).toBe("IN_PROGRESS");

    // 4. Staff submits resolution evidence
    const resolution = await SnagsService.submitResolution(db, staffUser, {
      snagId: snag.id,
      resolutionEvidence: "Chipped out loose plaster, injected epoxy grout, applied mesh and skim coat.",
    });
    // States distinguish resolved from verified closed (AC-044)
    expect(resolution.status).toBe("READY_FOR_VERIFICATION");

    // Staff cannot verify or close the snag themselves -> REJECTED
    await expect(
      SnagsService.verifyCloseSnag(db, staffUser, { snagId: snag.id })
    ).rejects.toThrow("Only project managers can verify and close site snags");

    // 5. Manager reviews on site and reopens due to paint shade mismatch
    const reopenRes = await SnagsService.reopenSnag(db, managerUser, {
      snagId: snag.id,
      reason: "Paint shade mismatch under raking light. Sand down and apply full-wall finish coat.",
      newTargetDate: "2026-12-08",
    });
    expect(reopenRes.status).toBe("OPEN");
    expect(reopenRes.reopenCount).toBe(1);

    // Verify detail preserves earlier resolution evidence and increments reopen count
    let detail = await SnagsService.getSnag(db, managerUser, snag.id);
    expect(detail.status).toBe("OPEN");
    expect(detail.reopen_count).toBe(1);
    expect(detail.target_date).toBe("2026-12-08");

    // Verify audit events preserve both resolution submission and reopen event
    const eventTypes = detail.events.map((e: any) => e.event_type);
    expect(eventTypes).toContain("SNAG_REPORTED");
    expect(eventTypes).toContain("SNAG_TRIAGED");
    expect(eventTypes).toContain("SNAG_RESOLUTION_SUBMITTED");
    expect(eventTypes).toContain("SNAG_REOPENED");

    // 6. Staff re-submits second resolution
    await SnagsService.submitResolution(db, staffUser, {
      snagId: snag.id,
      resolutionEvidence: "Full-wall finish coat applied with calibrated shade swatch.",
    });

    // 7. Manager inspects on site and marks verified closed
    const verified = await SnagsService.verifyCloseSnag(db, managerUser, {
      snagId: snag.id,
      notes: "Inspected in person; surface flush and color uniform under morning light.",
    });
    expect(verified.status).toBe("CLOSED");

    // Final audit inspection
    detail = await SnagsService.getSnag(db, managerUser, snag.id);
    expect(detail.status).toBe("CLOSED");
    expect(detail.events.map((e: any) => e.event_type)).toContain("SNAG_VERIFIED_CLOSED");
  });

  // ---------------------------------------------------------------------------
  // AC-045 — Shared snag hides internal remediation
  // ---------------------------------------------------------------------------
  it("AC-045: shared snag hides internal remediation notes, private costs, and internal attachments from client/consultant views", async () => {
    // 1. Create an internal-only snag (is_client_shared = 0) with confidential cost note
    const internalSnag = await SnagsService.reportSnag(db, staffUser, {
      projectId: testProjectId,
      title: "Subcontractor tile misalignment",
      description: "Guest bathroom tiles laid out of level by 5mm.",
      locationArea: "Guest Bathroom",
    });

    await SnagsService.triageSnag(db, managerUser, {
      snagId: internalSnag.id,
      assignedToUserId: staffUser.id,
      isClientShared: false,
      internalCostMinor: 1500000, // ₹15,000 backcharge
      internalNotes: "Contractor negligence; backcharge full amount to tiling team invoice.",
    });

    // 2. Create a shared snag (is_client_shared = 1) with confidential cost note and internal comments
    const sharedSnag = await SnagsService.reportSnag(db, staffUser, {
      projectId: testProjectId,
      title: "Terrace door latch stiffness",
      description: "Brass hardware latch requires excess force to engage.",
      locationArea: "Terrace Sitout",
    });

    await SnagsService.triageSnag(db, managerUser, {
      snagId: sharedSnag.id,
      assignedToUserId: staffUser.id,
      isClientShared: true, // Approved for broader client/consultant viewing
      internalCostMinor: 350000, // ₹3,500 internal replacement cost
      internalNotes: "Hardware supplier dispute: replace under warranty or swallow cost internally.",
    });

    // Add internal-only comment
    await SnagsService.addComment(db, managerUser, {
      snagId: sharedSnag.id,
      commentText: "Internal note: do not discuss supplier warranty dispute with client.",
      isInternalOnly: true,
    });

    // Add client-visible comment
    await SnagsService.addComment(db, staffUser, {
      snagId: sharedSnag.id,
      commentText: "Technician scheduled for tomorrow 11 AM to adjust latch striker.",
      isInternalOnly: false,
    });

    // 3. Client attempts to access internal-only snag (which they did NOT report) -> REJECTED
    await expect(
      SnagsService.getSnag(db, clientUser, internalSnag.id)
    ).rejects.toThrow("This site issue has not been approved for client/consultant viewing");

    // 4. Client accesses shared snag:
    const clientView = await SnagsService.getSnag(db, clientUser, sharedSnag.id);
    expect(clientView.id).toBe(sharedSnag.id);
    // Confidential cost notes and internal notes are strictly undefined (AC-045)
    expect(clientView.internal_notes).toBeUndefined();
    expect(clientView.internal_cost_minor).toBeUndefined();

    // Internal comment is excluded; only client-visible comment appears
    expect(clientView.comments.length).toBe(1);
    expect(clientView.comments[0].comment_text).toContain("Technician scheduled");
    expect(clientView.comments[0].comment_text).not.toContain("warranty dispute");

    // 5. Consultant accesses shared snag:
    const consultantView = await SnagsService.getSnag(db, consultantUser, sharedSnag.id);
    expect(consultantView.internal_notes).toBeUndefined();
    expect(consultantView.internal_cost_minor).toBeUndefined();
    expect(consultantView.comments.length).toBe(1);

    // 6. Practice Staff accesses shared snag:
    const staffView = await SnagsService.getSnag(db, staffUser, sharedSnag.id);
    expect(staffView.internal_notes).toContain("Hardware supplier dispute");
    expect(staffView.internal_cost_minor).toBe(350000);
    expect(staffView.comments.length).toBe(2);

    // 7. Client queries list of snags:
    // Only shared snag appears; internal-only snag is completely omitted
    const clientList = await SnagsService.listSnags(db, clientUser, testProjectId);
    const clientListIds = clientList.map((s: any) => s.id);
    expect(clientListIds).toContain(sharedSnag.id);
    expect(clientListIds).not.toContain(internalSnag.id);
    // Even in list view, internal cost notes are stripped
    expect(clientList[0].internal_cost_minor).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // AC-070 — Charged snag remediation obeys the change gate
  // ---------------------------------------------------------------------------
  it("AC-070: charged snag remediation blocks work execution until change estimate, payment, and authorization pass", async () => {
    // 1. Issue reported: Work outside accepted contract scope
    const snag = await SnagsService.reportSnag(db, clientUser, {
      projectId: testProjectId,
      title: "Terrace Waterproofing Membrane Renewal",
      description: "Client requested addition of comprehensive liquid polyurethane membrane outside agreed base scope.",
      locationArea: "Open Roof Terrace",
      severity: "URGENT",
    });

    // 2. Manager triages as charged work outside scope
    await SnagsService.triageSnag(db, managerUser, {
      snagId: snag.id,
      assignedToUserId: staffUser.id,
      isChargedWork: true, // Remediation requires additional payment
    });

    // 3. Attempt to start snag work before change request exists -> REJECTED (AC-070)
    await expect(
      SnagsService.startSnagWork(db, staffUser, snag.id)
    ).rejects.toThrow("Charged snag remediation requires an authorized change request before starting work");

    // 4. Manager prepares linked task for remediation
    const task = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "Apply Terrace Waterproofing Membrane",
        snagId: snag.id,
        proposedAssigneeId: staffUser.id,
      },
      db
    );

    // Starting linked task before change request exists -> REJECTED (AC-070)
    await expect(startTask(staffUser, task.id, db)).rejects.toThrow(
      "Charged snag remediation requires an authorized change request before starting work"
    );

    // 5. Create and link Change Request
    const cr = await ChangesService.createChangeRequest(db, managerUser, {
      projectId: testProjectId,
      title: "Terrace Waterproofing Membrane Extra Scope",
      description: "Additional scope for polyurethane membrane waterproofing.",
      sourceType: "SITE_CONDITION",
      sourceReferenceId: snag.id,
    });

    // Link change request to snag
    await db
      .prepare("UPDATE snags SET change_request_id = ? WHERE id = ?")
      .bind(cr.id, snag.id)
      .run();

    // 6. Issue estimate for ₹85,000 with required advance ₹40,000
    await ChangesService.startEstimating(db, managerUser, cr.id);
    await ChangesService.issueEstimate(db, managerUser, {
      changeRequestId: cr.id,
      scopeSummary: "Apply 2 coats of elastomeric PU membrane with geotextile reinforcement.",
      priceMinor: 8500000, // ₹85,000
      requiredPreworkPaymentMinor: 4000000, // ₹40,000 required advance
    });

    // Attempting work while change request is AWAITING_CLIENT -> REJECTED
    await expect(SnagsService.startSnagWork(db, staffUser, snag.id)).rejects.toThrow(
      "Charged snag remediation work remains blocked until change request is authorized and paid"
    );
    await expect(startTask(staffUser, task.id, db)).rejects.toThrow(
      "Charged snag remediation work remains blocked until change request is authorized and paid"
    );

    // 7. Main client accepts estimate
    await ChangesService.acceptEstimate(db, clientUser, {
      changeRequestId: cr.id,
      versionNumber: 1,
    });

    // Attempting work before payment confirmed -> REJECTED
    await expect(SnagsService.startSnagWork(db, staffUser, snag.id)).rejects.toThrow(
      "Charged snag remediation work remains blocked until change request is authorized and paid"
    );

    // 8. Admin confirms receipt and allocates advance
    const receipt = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 4000000,
      receivedDate: "2026-11-24",
      paymentMethod: "NEFT",
      referenceNote: "Terrace Waterproofing Advance",
    });
    await FinanceService.confirmReceipt(db, adminUser, { receiptId: receipt.receiptId });
    await ChangesService.confirmChangePayment(db, adminUser, {
      changeRequestId: cr.id,
      receiptId: receipt.receiptId,
      amountMinor: 4000000,
    });

    // Attempting work before manager authorization -> REJECTED
    await expect(SnagsService.startSnagWork(db, staffUser, snag.id)).rejects.toThrow(
      "Charged snag remediation work remains blocked until change request is authorized and paid"
    );

    // 9. Manager authorizes change request -> ALL GATES SATISFIED
    await ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id });

    // 10. Operational work on snag and task can now start -> SUCCEEDS
    const snagStarted = await SnagsService.startSnagWork(db, staffUser, snag.id);
    expect(snagStarted.status).toBe("IN_PROGRESS");

    const taskStarted = await startTask(staffUser, task.id, db);
    expect(taskStarted.status).toBe("IN_PROGRESS");
  });
});
