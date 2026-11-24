/**
 * P09 Acceptance Tests: Client References, Material Decisions, Suggestions, Change Requests,
 * Three-Gate Additional Work Authorization, and Revision Invalidation.
 * Tests AC-039, AC-040, AC-041, AC-042, AC-043.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../../src/server/auth/principal";
import { MaterialsService } from "../../../src/server/domain/materials/service";
import { ChangesService } from "../../../src/server/domain/changes/service";
import { FinanceService } from "../../../src/server/domain/finance/service";
import { createTask, startTask } from "../../../src/server/domain/tasks/service";

describe("Phase 09: References, Material Selections, and Commercial Change Gates", () => {
  let db: D1Database;

  const testOrgId = "org_merveille_main";
  const testProjectId = "prj_changes_villa";

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
    projectMemberships: [{ projectId: testProjectId, projectRole: "STAFF", financeAccess:true, financeAuthor:true, invoiceIssue:true }],
    isSynthetic: true,
  };

  const clientUser: UserPrincipal = {
    id: "usr_cli_001",
    email: "client@example.com",
    name: "Thomas Client (Main Client)",
    orgId: testOrgId,
    role: "MAIN_CLIENT", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "MAIN_CLIENT", contractualAuthority:true }],
    isSynthetic: true,
  };

  const repUser: UserPrincipal = {
    id: "usr_rep_001",
    email: "rep@example.com",
    name: "Representative John",
    orgId: testOrgId,
    role: "CLIENT_REP", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "CLIENT_REP" }],
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

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // 1. Seed org
    await db
      .prepare("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)")
      .bind(testOrgId, "Merveille Designs", Date.now())
      .run();

    // 2. Seed users and org memberships
    const allUsers = [adminUser, managerUser, staffUser, clientUser, repUser, consultantUser];
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

    // 3. Seed active project
    await db
      .prepare(
        `INSERT INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`
      )
      .bind(
        testProjectId,
        testOrgId,
        "PRJ-CHG",
        "Villa Change Controls",
        clientUser.id,
        managerUser.id,
        Date.now()
      )
      .run();

    // 4. Seed project memberships
    for (const u of allUsers) {
      const pRole = u.projectMemberships[0].projectRole;
      await db
        .prepare(
          `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`pm_${u.id}`, testOrgId, testProjectId, u.id, pRole, Date.now())
        .run();
    }
  });

  // ---------------------------------------------------------------------------
  // AC-039 — Only main client accepts additional estimate
  // ---------------------------------------------------------------------------
  it("AC-039: only main client accepts additional estimate version; others can comment", async () => {
    // 1. Create a change request
    const cr = await ChangesService.createChangeRequest(db, repUser, {
      projectId: testProjectId,
      title: "Master Suite Hardwood Flooring",
      description: "Upgrade vitrified tiles to engineered walnut hardwood.",
      sourceType: "CLIENT_REQUEST",
    });
    expect(cr.requestNumber).toBe("CR-001");
    expect(cr.status).toBe("REQUESTED");

    // 2. Manager starts estimating and issues estimate
    await ChangesService.startEstimating(db, managerUser, cr.id);
    const estimate = await ChangesService.issueEstimate(db, managerUser, {
      changeRequestId: cr.id,
      scopeSummary: "Procure and install 450 sq ft engineered walnut flooring.",
      priceMinor: 18000000, // ₹1,80,000
      taxMinor: 3240000, // 18% GST = ₹32,400
      requiredPreworkPaymentMinor: 10000000, // ₹1,00,000 advance
      scheduleImpactDays: 5,
    });
    expect(estimate.totalMinor).toBe(21240000);
    expect(estimate.versionNumber).toBe(1);

    // 3. Representative attempts to accept estimate -> REJECTED
    await expect(
      ChangesService.acceptEstimate(db, repUser, {
        changeRequestId: cr.id,
        versionNumber: 1,
      })
    ).rejects.toThrow("Only the main client has authority to accept additional cost");

    // 4. Consultant attempts to accept estimate -> REJECTED
    await expect(
      ChangesService.acceptEstimate(db, consultantUser, {
        changeRequestId: cr.id,
        versionNumber: 1,
      })
    ).rejects.toThrow("Only the main client has authority to accept additional cost");

    // 5. Representative and consultant can add comments
    const repComment = await ChangesService.addComment(db, repUser, {
      changeRequestId: cr.id,
      commentText: "Client prefers matte satin finish for the walnut planks.",
    });
    expect(repComment.id).toBeDefined();

    const consComment = await ChangesService.addComment(db, consultantUser, {
      changeRequestId: cr.id,
      commentText: "Floor screed level verified and moisture content within 3% tolerance.",
    });
    expect(consComment.id).toBeDefined();

    // 6. Main client accepts estimate version 1 -> SUCCEEDS
    const acceptance = await ChangesService.acceptEstimate(db, clientUser, {
      changeRequestId: cr.id,
      versionNumber: 1,
      notes: "Accepted with matte satin finish.",
    });
    expect(acceptance.status).toBe("ACCEPTED_AWAITING_PAYMENT");
    expect(acceptance.acceptedByUserId).toBe(clientUser.id);

    // Verify detail retrieval shows acceptance
    const detail = await ChangesService.getChangeRequest(db, clientUser, cr.id);
    expect(detail.currentVersion.status).toBe("ACCEPTED");
    expect(detail.currentVersion.accepted_by_user_id).toBe(clientUser.id);
    expect(detail.comments.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // AC-040 — Extra work gate requires all conditions
  // ---------------------------------------------------------------------------
  it("AC-040: extra work gate requires main-client acceptance, admin-confirmed payment, and manager authorization", async () => {
    // 1. Create change request and task
    const cr = await ChangesService.createChangeRequest(db, clientUser, {
      projectId: testProjectId,
      title: "Pergola Structure Addition",
      description: "MS Pergola over terrace sitout.",
      sourceType: "DESIGN_REVISION",
    });

    await ChangesService.startEstimating(db, managerUser, cr.id);
    await ChangesService.issueEstimate(db, managerUser, {
      changeRequestId: cr.id,
      scopeSummary: "Fabricate and coat MS box sections for pergola.",
      priceMinor: 9500000, // ₹95,000
      requiredPreworkPaymentMinor: 5000000, // ₹50,000 required pre-work payment
      scheduleImpactDays: 4,
    });

    const task = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "Fabricate Terrace Pergola",
        changeRequestId: cr.id,
        proposedAssigneeId: staffUser.id,
      },
      db
    );

    // Gate 1: Attempt authorization / starting task BEFORE client acceptance -> REJECTED
    await expect(
      ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id })
    ).rejects.toThrow("Change request requires main client estimate acceptance before authorization");

    await expect(startTask(staffUser, task.id, db)).rejects.toThrow(
      "Cannot start task linked to unauthorized change request"
    );

    // 2. Client accepts estimate
    await ChangesService.acceptEstimate(db, clientUser, {
      changeRequestId: cr.id,
      versionNumber: 1,
    });

    // Gate 2: Attempt authorization BEFORE payment confirmation -> REJECTED
    await expect(
      ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id })
    ).rejects.toThrow("Change request requires administrator-confirmed payment allocation before authorization");

    await expect(startTask(staffUser, task.id, db)).rejects.toThrow(
      "Cannot start task linked to unauthorized change request"
    );

    // 3. Client reports payment, but not confirmed by admin yet
    const reportedReceipt = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 5000000,
      receivedDate: "2026-11-24",
      paymentMethod: "BANK_TRANSFER",
      referenceNote: "Pergola Advance UTR #998877",
    });

    // Attempting allocation of unconfirmed receipt -> REJECTED
    await expect(
      ChangesService.confirmChangePayment(db, adminUser, {
        changeRequestId: cr.id,
        receiptId: reportedReceipt.receiptId,
      })
    ).rejects.toThrow("Accepted estimate and matching confirmed receipt required");

    // Non-admin cannot confirm receipt (AC-031)
    await expect(
      FinanceService.confirmReceipt(db, managerUser, { receiptId: reportedReceipt.receiptId })
    ).rejects.toThrow("Only administrators can confirm receipt of real funds");

    // Admin confirms receipt
    await FinanceService.confirmReceipt(db, adminUser, { receiptId: reportedReceipt.receiptId });

    // 4. Test Partial Payment: Allocate ₹20,000 out of ₹50,000 required
    const partialAlloc = await ChangesService.confirmChangePayment(db, adminUser, {
      changeRequestId: cr.id,
      receiptId: reportedReceipt.receiptId,
      amountMinor: 2000000,
    });
    expect(partialAlloc.isFullySatisfied).toBe(false);
    expect(partialAlloc.newStatus).toBe("ACCEPTED_AWAITING_PAYMENT");

    // Attempting authorization with only partial payment -> REJECTED
    await expect(
      ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id })
    ).rejects.toThrow("Change request requires administrator-confirmed payment allocation before authorization");

    await expect(startTask(staffUser, task.id, db)).rejects.toThrow(
      "Cannot start task linked to unauthorized change request"
    );

    // 5. Allocate remaining ₹30,000 to fully satisfy pre-work payment
    const fullAlloc = await ChangesService.confirmChangePayment(db, adminUser, {
      changeRequestId: cr.id,
      receiptId: reportedReceipt.receiptId,
      amountMinor: 3000000,
    });
    expect(fullAlloc.isFullySatisfied).toBe(true);
    expect(fullAlloc.newStatus).toBe("PAYMENT_CONFIRMED");

    // Gate 3: Before manager authorization, staff cannot start task
    await expect(startTask(staffUser, task.id, db)).rejects.toThrow(
      "Cannot start task linked to unauthorized change request"
    );

    // 6. Manager authorizes additional change work -> ALL GATES SATISFIED
    const authResult = await ChangesService.authorizeChangeWork(db, managerUser, {
      changeRequestId: cr.id,
      notes: "Fabrication drawings approved and materials ready.",
    });
    expect(authResult.status).toBe("AUTHORIZED");
    expect(authResult.authorizedByUserId).toBe(managerUser.id);

    // 7. Staff now starts the linked task -> SUCCEEDS
    const startRes = await startTask(staffUser, task.id, db);
    expect(startRes.status).toBe("IN_PROGRESS");

    // Check readiness panel in detail
    const detail = await ChangesService.getChangeRequest(db, clientUser, cr.id);
    expect(detail.readiness.condition1_estimateAccepted).toBe(true);
    expect(detail.readiness.condition2_paymentConfirmed).toBe(true);
    expect(detail.readiness.condition3_managerAuthorized).toBe(true);
    expect(detail.readiness.readyToStart).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // AC-041 — Change revision cannot reuse old acceptance
  // ---------------------------------------------------------------------------
  it("AC-041: revising estimate scope/price invalidates old consent and requires fresh acceptance and authorization", async () => {
    // 1. Setup change request, accepted, paid, and authorized
    const cr = await ChangesService.createChangeRequest(db, clientUser, {
      projectId: testProjectId,
      title: "Home Theatre Acoustic Panelling",
      description: "Fabric acoustic panels on rear wall.",
      sourceType: "CLIENT_REQUEST",
    });

    await ChangesService.startEstimating(db, managerUser, cr.id);
    await ChangesService.issueEstimate(db, managerUser, {
      changeRequestId: cr.id,
      scopeSummary: "Rear wall acoustic panelling.",
      priceMinor: 12000000, // ₹1,20,000
      requiredPreworkPaymentMinor: 6000000, // ₹60,000
    });

    await ChangesService.acceptEstimate(db, clientUser, {
      changeRequestId: cr.id,
      versionNumber: 1,
    });

    const receipt = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 20000000, // ₹2,00,000 confirmed receipt available
      receivedDate: "2026-11-24",
      paymentMethod: "RTGS",
    });
    await FinanceService.confirmReceipt(db, adminUser, { receiptId: receipt.receiptId });

    await ChangesService.confirmChangePayment(db, adminUser, {
      changeRequestId: cr.id,
      receiptId: receipt.receiptId,
      amountMinor: 6000000,
    });

    await ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id });

    // 2. Manager revises estimate: Scope expands to include side walls and bass traps
    const revision = await ChangesService.reviseEstimate(db, managerUser, {
      changeRequestId: cr.id,
      scopeSummary: "Rear and side walls acoustic panelling with 4 corner bass traps.",
      priceMinor: 22000000, // ₹2,20,000
      requiredPreworkPaymentMinor: 11000000, // ₹1,10,000 required
      reason: "Client requested full surround acoustic treatment after demo.",
    });

    expect(revision.versionNumber).toBe(2);
    expect(revision.status).toBe("AWAITING_CLIENT");

    // 3. Stale consent cannot authorize revised version:
    // Attempting to authorize version 2 without fresh main-client acceptance -> REJECTED
    await expect(
      ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id })
    ).rejects.toThrow("Change request requires main client estimate acceptance before authorization");

    // Work start also rejected
    await expect(ChangesService.startChangeWork(db, staffUser, cr.id)).rejects.toThrow(
      "Cannot start work before change request is fully authorized"
    );

    // Verify version 1 is marked SUPERSEDED and version 2 is ISSUED
    const detail = await ChangesService.getChangeRequest(db, clientUser, cr.id);
    const v1 = detail.versions.find((v: any) => v.version_number === 1);
    const v2 = detail.versions.find((v: any) => v.version_number === 2);
    expect(v1.status).toBe("SUPERSEDED");
    expect(v2.status).toBe("ISSUED");
    expect(v2.accepted_by_user_id).toBeNull();
    expect(v2.authorized_by_user_id).toBeNull();

    // 4. Main client provides fresh acceptance for version 2
    await ChangesService.acceptEstimate(db, clientUser, {
      changeRequestId: cr.id,
      versionNumber: 2,
    });

    // Re-evaluate payment: ₹1,10,000 required, currently allocated is 0 for version 2
    await expect(
      ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id })
    ).rejects.toThrow("Change request requires administrator-confirmed payment allocation before authorization");

    // Admin allocates ₹1,10,000 from available confirmed receipt funds
    await ChangesService.confirmChangePayment(db, adminUser, {
      changeRequestId: cr.id,
      receiptId: receipt.receiptId,
      amountMinor: 11000000,
    });

    // 5. Manager authorizes revised version 2
    const finalAuth = await ChangesService.authorizeChangeWork(db, managerUser, {
      changeRequestId: cr.id,
    });
    expect(finalAuth.status).toBe("AUTHORIZED");
    expect(finalAuth.versionNumber).toBe(2);

    // Operational work can now start
    const workStart = await ChangesService.startChangeWork(db, staffUser, cr.id);
    expect(workStart.status).toBe("IN_PROGRESS");
  });

  // ---------------------------------------------------------------------------
  // AC-042 — References and material decisions
  // ---------------------------------------------------------------------------
  it("AC-042: main client and representative upload inspiration; representative comments/suggests; only main client selects", async () => {
    // 1. Main client uploads inspiration reference
    const clientRef = await MaterialsService.addReference(db, clientUser, {
      projectId: testProjectId,
      caption: "Scandi Minimal Living Room with Fluted Oak",
      roomArea: "Living Room",
      category: "Joinery",
    });
    expect(clientRef.id).toBeDefined();

    // 2. Representative uploads inspiration reference
    const repRef = await MaterialsService.addReference(db, repUser, {
      projectId: testProjectId,
      caption: "Concealed ambient LED profiles in coffered ceiling",
      roomArea: "Dining Room",
      category: "Lighting",
    });
    expect(repRef.id).toBeDefined();

    // Representative adds comment to client's reference
    await MaterialsService.addReferenceComment(db, repUser, {
      referenceId: clientRef.id,
      commentText: "We should consider lighter oak grain to match the flooring.",
    });

    const retrievedRef = await MaterialsService.getReference(db, clientUser, clientRef.id);
    expect(retrievedRef.comments.length).toBe(1);
    expect(retrievedRef.comments[0].comment_text).toContain("lighter oak grain");

    // 3. Staff frames a material selection item with options and internal notes
    const item = await MaterialsService.createSelectionItem(db, staffUser, {
      projectId: testProjectId,
      title: "Master Bedroom Headboard Cladding",
      location: "Master Bedroom",
      question: "Please choose between Fabric Upholstery vs Fluted Charcoal Wood.",
      neededByDate: "2026-12-15",
      internalNotes: "Vendor gives 18% trade discount on fluted panels; fabric takes 2 extra weeks lead time.",
      options: [
        {
          label: "Acoustic Suede Fabric Upholstery",
          description: "Muted taupe suede with brass inlay strips.",
          costImplicationMinor: 0,
          isRecommended: true,
        },
        {
          label: "Fluted Charcoal Wood Panelling",
          description: "Solid ash wood with matte charcoal polyurethane finish.",
          costImplicationMinor: 3500000, // ₹35,000 extra
          isRecommended: false,
        },
      ],
    });
    expect(item.status).toBe("AWAITING_MAIN_CLIENT");

    // 4. Confidentiality projection: Client and Representative CANNOT see internal sourcing notes (AC-042, SCR-13)
    const clientView = await MaterialsService.getSelectionItem(db, clientUser, item.id);
    expect(clientView.internal_notes).toBeUndefined();

    const repView = await MaterialsService.getSelectionItem(db, repUser, item.id);
    expect(repView.internal_notes).toBeUndefined();

    // Staff CAN see internal sourcing notes
    const staffView = await MaterialsService.getSelectionItem(db, staffUser, item.id);
    expect(staffView.internal_notes).toContain("trade discount");

    // 5. Representative attempts binding selection -> REJECTED (AC-042)
    const optionAId = clientView.options[0].id;
    const optionBId = clientView.options[1].id;

    await expect(
      MaterialsService.selectOption(db, repUser, {
        selectionItemId: item.id,
        optionId: optionBId,
      })
    ).rejects.toThrow("Only the main client has authority to make binding material decisions");

    // 6. Representative records suggestion -> SUCCEEDS and status remains AWAITING_MAIN_CLIENT
    const suggestion = await MaterialsService.recordSuggestion(db, repUser, {
      selectionItemId: item.id,
      optionId: optionBId,
      suggestionType: "SUGGESTION",
      commentText: "Representative preference: Fluted charcoal wood looks much more luxurious.",
    });
    expect(suggestion.suggestionType).toBe("SUGGESTION");

    const itemAfterSuggestion = await MaterialsService.getSelectionItem(db, clientUser, item.id);
    expect(itemAfterSuggestion.status).toBe("AWAITING_MAIN_CLIENT");
    expect(itemAfterSuggestion.selected_option_id).toBeNull();
    expect(itemAfterSuggestion.suggestions.length).toBe(1);

    // 7. Main client makes binding selection of Option A -> SUCCEEDS
    const selection = await MaterialsService.selectOption(db, clientUser, {
      selectionItemId: item.id,
      optionId: optionAId,
    });
    expect(selection.status).toBe("SELECTED");
    expect(selection.selectedOptionId).toBe(optionAId);

    const finalItem = await MaterialsService.getSelectionItem(db, clientUser, item.id);
    expect(finalItem.status).toBe("SELECTED");
    expect(finalItem.selected_option_id).toBe(optionAId);
    expect(finalItem.selected_by_user_id).toBe(clientUser.id);
  });

  // ---------------------------------------------------------------------------
  // AC-043 — Material selection respects commercial gates
  // ---------------------------------------------------------------------------
  it("AC-043: cost-impacting selection enters change request process; representative cannot overwrite; execution blocked until change is authorized", async () => {
    // 1. Staff creates selection item with cost implication
    const item = await MaterialsService.createSelectionItem(db, staffUser, {
      projectId: testProjectId,
      title: "Kitchen Island Countertop Slab",
      location: "Kitchen",
      question: "Select preferred island countertop slab.",
      options: [
        {
          label: "Engineered Quartz (Standard Scope)",
          description: "Pure white 20mm quartz included in agreed contract.",
          costImplicationMinor: 0,
        },
        {
          label: "Calacatta Gold Italian Marble (Upgrade)",
          description: "Imported Italian natural marble with golden veins.",
          costImplicationMinor: 12500000, // ₹1,25,000 additional cost
        },
      ],
    });

    const itemDetails = await MaterialsService.getSelectionItem(db, clientUser, item.id);
    const standardOptionId = itemDetails.options[0].id;
    const upgradeOptionId = itemDetails.options[1].id;

    // 2. Main client selects the upgrade option
    const selectRes = await MaterialsService.selectOption(db, clientUser, {
      selectionItemId: item.id,
      optionId: upgradeOptionId,
    });
    expect(selectRes.status).toBe("SELECTED");
    expect(selectRes.requiresChangeRequest).toBe(true);

    // 3. Representative attempts to overwrite main client's selection -> REJECTED
    await expect(
      MaterialsService.selectOption(db, repUser, {
        selectionItemId: item.id,
        optionId: standardOptionId,
      })
    ).rejects.toThrow("Only the main client has authority to make binding material decisions");

    // 4. Manager attempts to mark item ready for execution without change request -> BLOCKED
    await expect(
      MaterialsService.markReadyForExecution(db, managerUser, item.id)
    ).rejects.toThrow("Cost-impacting selection requires an authorized change request before execution readiness");

    // 5. Manager creates change request linked to this selection item
    const cr = await ChangesService.createChangeRequest(db, managerUser, {
      projectId: testProjectId,
      title: "Kitchen Countertop Upgrade to Calacatta Marble",
      description: "Additional cost for imported Calacatta Gold Marble slab.",
      sourceType: "MATERIAL_SELECTION",
      sourceReferenceId: item.id,
    });

    await MaterialsService.linkChangeRequest(db, managerUser, {
      selectionItemId: item.id,
      changeRequestId: cr.id,
    });

    // 6. Attempt execution while change request is still in ESTIMATING / AWAITING_CLIENT -> BLOCKED
    await ChangesService.startEstimating(db, managerUser, cr.id);
    await ChangesService.issueEstimate(db, managerUser, {
      changeRequestId: cr.id,
      scopeSummary: "Procure and fabricate Calacatta Gold marble slab.",
      priceMinor: 12500000,
      requiredPreworkPaymentMinor: 12500000,
    });

    await expect(
      MaterialsService.markReadyForExecution(db, managerUser, item.id)
    ).rejects.toThrow("Cannot mark selection ready for execution: linked change request is not authorized");

    // 7. Complete the change request gate: Acceptance + Payment + Manager Authorization
    await ChangesService.acceptEstimate(db, clientUser, {
      changeRequestId: cr.id,
      versionNumber: 1,
    });

    const receipt = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 12500000,
      receivedDate: "2026-11-24",
      paymentMethod: "NEFT",
      referenceNote: "Calacatta Marble Full Advance",
    });
    await FinanceService.confirmReceipt(db, adminUser, { receiptId: receipt.receiptId });

    await ChangesService.confirmChangePayment(db, adminUser, {
      changeRequestId: cr.id,
      receiptId: receipt.receiptId,
      amountMinor: 12500000,
    });

    await ChangesService.authorizeChangeWork(db, managerUser, { changeRequestId: cr.id });

    // 8. Now manager marks selection item ready for execution -> SUCCEEDS
    const readyRes = await MaterialsService.markReadyForExecution(db, managerUser, item.id);
    expect(readyRes.status).toBe("READY_FOR_EXECUTION");

    const finalItem = await MaterialsService.getSelectionItem(db, clientUser, item.id);
    expect(finalItem.status).toBe("READY_FOR_EXECUTION");
  });
});
