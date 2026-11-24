/**
 * P07 Acceptance Tests: Quotations, Payment Schedules, Invoices, Receipts, and Commercial Activation.
 * Tests AC-010, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../../src/server/auth/principal";
import { FinanceService } from "../../../src/server/domain/finance/service";

describe("Phase 07: Commercial Finance, Invoices, Receipts, and Activation", () => {
  let db: D1Database;

  const testOrgId = "org_merveille_main";
  const testProjectId = "prj_finance_villa";

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
    name: "Thomas Client",
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

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // 1. Seed org
    await db
      .prepare(
        "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)"
      )
      .bind(testOrgId, "Merveille Designs", Date.now())
      .run();

    // 2. Seed users and memberships
    const allUsers = [adminUser, managerUser, staffUser, clientUser, repUser];
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

    // 3. Seed project in DRAFT status
    await db
      .prepare(
        `INSERT OR IGNORE INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id,
          stage, status, is_archived, revision, created_at
        ) VALUES (?, ?, 'MD-FIN', 'Finance Villa', ?, ?, 'Concept', 'DRAFT', 0, 1, ?)`
      )
      .bind(testProjectId, testOrgId, clientUser.id, managerUser.id, Date.now())
      .run();

    // 4. Seed project memberships
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES ('pm_m1', ?, ?, ?, 'MANAGER', 1, ?)`
      )
      .bind(testOrgId, testProjectId, managerUser.id, Date.now())
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES ('pm_s1', ?, ?, ?, 'STAFF', 1, ?)`
      )
      .bind(testOrgId, testProjectId, staffUser.id, Date.now())
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES ('pm_c1', ?, ?, ?, 'MAIN_CLIENT', 1, ?)`
      )
      .bind(testOrgId, testProjectId, clientUser.id, Date.now())
      .run();
  });

  it("AC-010: Commercial project activation requires accepted quotation and admin-confirmed advance", async () => {
    // 1. Try activation with no quotation -> fails
    await expect(
      FinanceService.activateProject(db, managerUser, testProjectId)
    ).rejects.toThrow(/missing accepted quotation/);

    // 2. Staff creates quotation with required advance of 50,000 INR (5,000,000 paise)
    const { quotationId } = await FinanceService.createQuotation(db, staffUser, {
      projectId: testProjectId,
      title: "Architectural Design Consultancy Proposal",
      requiredAdvanceMinor: 5000000,
      items: [
        { description: "Concept & Schematic Design", unitRateMinor: 10000000 },
        { description: "Detailed Drawings & Sanction", unitRateMinor: 15000000 },
      ],
    });

    // 3. Client rep attempts to accept quotation -> rejected (AC-004)
    await expect(
      FinanceService.acceptQuotation(db, repUser, quotationId)
    ).rejects.toThrow(/Only the assigned primary client can accept contractual quotations/);

    // 4. Primary client accepts quotation -> succeeds
    await FinanceService.acceptQuotation(db, clientUser, quotationId);

    // 5. Try activation before advance is paid -> fails
    await expect(
      FinanceService.activateProject(db, managerUser, testProjectId)
    ).rejects.toThrow(/required advance payment/);

    // 6. Client reports payment transfer -> status is REPORTED, not yet confirmed
    const { receiptId } = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 5000000,
      receivedDate: "2026-11-24",
      paymentMethod: "NEFT",
      referenceNote: "Advance payment transfer UTR12345678",
    });

    // Activation still fails because receipt is only REPORTED, not CONFIRMED
    await expect(
      FinanceService.activateProject(db, managerUser, testProjectId)
    ).rejects.toThrow(/required advance payment/);

    // 7. Admin confirms receipt
    await FinanceService.confirmReceipt(db, adminUser, { receiptId });

    // 8. Manager activates project -> SUCCESS!
    const actResult = await FinanceService.activateProject(db, managerUser, testProjectId);
    expect(actResult.status).toBe("ACTIVE");
    expect(actResult.isCommercialActivated).toBe(true);

    const prj = (await db
      .prepare(`SELECT status, quote_accepted_at, advance_confirmed_at, activated_at FROM projects WHERE id = ?`)
      .bind(testProjectId)
      .first()) as any;
    expect(prj.status).toBe("ACTIVE");
    expect(prj.quote_accepted_at).toBeGreaterThan(0);
    expect(prj.advance_confirmed_at).toBeGreaterThan(0);
    expect(prj.activated_at).toBeGreaterThan(0);
  });

  it("AC-027: Schedule is upfront and versioned; staff denied schedule revisions", async () => {
    // 1. Manager creates initial schedule V1
    const { scheduleId: v1Id, versionNumber: v1Num } =
      await FinanceService.createOrReviseSchedule(db, managerUser, {
        projectId: testProjectId,
        items: [
          {
            description: "Mobilization Advance",
            amountMinor: 5000000,
            triggerType: "DATE_ONLY",
            targetDate: "2026-11-24",
            isAdvance: true,
          },
          {
            description: "Schematic Sign-off",
            amountMinor: 5000000,
            triggerType: "STAGE_ONLY",
            targetStageName: "Schematic Design",
          },
        ],
      });
    expect(v1Num).toBe(1);

    // 2. Staff attempts to revise schedule -> strictly rejected (AC-027)
    await expect(
      FinanceService.createOrReviseSchedule(db, staffUser, {
        projectId: testProjectId,
        items: [
          {
            description: "Unauthorized Revision",
            amountMinor: 6000000,
            triggerType: "DATE_ONLY",
            targetDate: "2026-12-01",
          },
        ],
      })
    ).rejects.toThrow(/Only project managers can create or revise payment schedules/);

    // 3. Manager revises schedule to V2 with documented reason
    const { scheduleId: v2Id, versionNumber: v2Num } =
      await FinanceService.createOrReviseSchedule(db, managerUser, {
        projectId: testProjectId,
        reason: "Adjusted payment milestones due to extended site excavation",
        items: [
          {
            description: "Mobilization Advance",
            amountMinor: 5000000,
            triggerType: "DATE_ONLY",
            targetDate: "2026-11-24",
            isAdvance: true,
          },
          {
            description: "Extended Excavation Milestone",
            amountMinor: 5000000,
            triggerType: "DATE_AND_STAGE",
            targetDate: "2026-12-15",
            targetStageName: "Excavation",
          },
        ],
      });
    expect(v2Num).toBe(2);

    // Verify V1 is SUPERSEDED and V2 is AGREED
    const v1 = (await db
      .prepare(`SELECT status FROM payment_schedules WHERE id = ?`)
      .bind(v1Id)
      .first()) as any;
    expect(v1.status).toBe("SUPERSEDED");

    const v2 = (await db
      .prepare(`SELECT status, revision_reason FROM payment_schedules WHERE id = ?`)
      .bind(v2Id)
      .first()) as any;
    expect(v2.status).toBe("AGREED");
    expect(v2.revision_reason).toBe(
      "Adjusted payment milestones due to extended site excavation"
    );
  });

  it("AC-028: Due rules resolve date/stage disagreement explicitly", () => {
    const dateItem = {
      trigger_type: "DATE_ONLY" as const,
      target_date: "2026-11-20",
    };
    const stageItem = {
      trigger_type: "STAGE_ONLY" as const,
      target_stage_name: "Schematic Design",
    };
    const bothItem = {
      trigger_type: "DATE_AND_STAGE" as const,
      target_date: "2026-11-20",
      target_stage_name: "Schematic Design",
    };
    const eitherItem = {
      trigger_type: "DATE_OR_STAGE" as const,
      target_date: "2026-11-20",
      target_stage_name: "Schematic Design",
    };

    const currentDate = "2026-11-24"; // Date has passed

    // Condition A: Date has passed, but stage is NOT complete
    const stagesIncomplete: string[] = ["Concept"];
    expect(FinanceService.isScheduleItemDue(dateItem, currentDate, stagesIncomplete)).toBe(true);
    expect(FinanceService.isScheduleItemDue(stageItem, currentDate, stagesIncomplete)).toBe(false);
    expect(FinanceService.isScheduleItemDue(bothItem, currentDate, stagesIncomplete)).toBe(false);
    expect(FinanceService.isScheduleItemDue(eitherItem, currentDate, stagesIncomplete)).toBe(true);

    // Condition B: Stage completes
    const stagesComplete: string[] = ["Concept", "Schematic Design"];
    expect(FinanceService.isScheduleItemDue(dateItem, currentDate, stagesComplete)).toBe(true);
    expect(FinanceService.isScheduleItemDue(stageItem, currentDate, stagesComplete)).toBe(true);
    expect(FinanceService.isScheduleItemDue(bothItem, currentDate, stagesComplete)).toBe(true);
    expect(FinanceService.isScheduleItemDue(eitherItem, currentDate, stagesComplete)).toBe(true);
  });

  it("AC-029 & AC-030: Invoice issue uses approved content; unapproved edits rejected; issued invoice immutable", async () => {
    // 1. Staff drafts invoice
    const { invoiceId } = await FinanceService.draftInvoice(db, staffUser, {
      projectId: testProjectId,
      dueDate: "2026-12-10",
      lineItems: [
        { description: "Architectural Fee - Phase 1", unitRateMinor: 1000000 },
      ],
    });

    // 2. Manager approves version 1
    await FinanceService.approveInvoice(db, managerUser, { invoiceId, versionNumber: 1 });

    // 3. Staff edits line items after approval -> creates version 2 in DRAFT status
    const editRes = await FinanceService.editDraftInvoice(db, staffUser, {
      invoiceId,
      lineItems: [
        { description: "Architectural Fee - Phase 1 (Revised)", unitRateMinor: 1200000 },
      ],
    });
    expect(editRes.versionNumber).toBe(2);
    expect(editRes.status).toBe("DRAFT"); // Approval invalidated!

    // 4. Staff attempts to issue version 2 without re-approval -> strictly rejected (AC-029)
    await expect(
      FinanceService.issueInvoice(db, staffUser, { invoiceId, versionNumber: 2 })
    ).rejects.toThrow(/current approved invoice version/);

    // 5. Manager reviews and approves version 2
    await FinanceService.approveInvoice(db, managerUser, { invoiceId, versionNumber: 2 });

    // 6. Staff issues invoice -> succeeds! (AC-029)
    const issueRes = await FinanceService.issueInvoice(db, staffUser, {
      invoiceId,
      versionNumber: 2,
    });
    expect(issueRes.status).toBe("ISSUED");
    expect(issueRes.invoiceNumber).toMatch(/^MD-INV-\d{4}-\d{4}$/);
    expect(issueRes.totalMinor).toBe(1200000);

    // 7. Verify balanced ledger posting was created
    const journal = (await db
      .prepare(
        `SELECT je.*, jl.account_code, jl.debit_minor, jl.credit_minor
         FROM journal_entries je
         JOIN journal_lines jl ON je.id = jl.journal_entry_id
         WHERE je.source_id = ?`
      )
      .bind(invoiceId)
      .all()) as any;
    expect(journal.results).toHaveLength(2);

    // 8. Attempting to edit or reissue issued invoice is strictly rejected (AC-030)
    await expect(
      FinanceService.editDraftInvoice(db, staffUser, {
        invoiceId,
        lineItems: [{ description: "Hacked after issue", unitRateMinor: 2000000 }],
      })
    ).rejects.toThrow(/Issued invoices cannot be edited directly/);

    const replay=await FinanceService.issueInvoice(db,staffUser,{invoiceId,versionNumber:2});
    expect(replay.invoiceNumber).toBe(issueRes.invoiceNumber);
  });

  it("AC-031: Only admin confirms real money", async () => {
    // 1. Staff reports payment transfer
    const { receiptId } = await FinanceService.reportReceipt(db, staffUser, {
      projectId: testProjectId,
      amountMinor: 2500000,
      receivedDate: "2026-11-24",
      paymentMethod: "RTGS",
      referenceNote: "UTR98765432",
    });

    // 2. Staff attempts to confirm receipt -> rejected (AC-031)
    await expect(
      FinanceService.confirmReceipt(db, staffUser, { receiptId })
    ).rejects.toThrow(/Only administrators can confirm receipt of real funds/);

    // 3. Client attempts to confirm receipt -> rejected (AC-031)
    await expect(
      FinanceService.confirmReceipt(db, clientUser, { receiptId })
    ).rejects.toThrow(/Only administrators can confirm receipt of real funds/);

    // 4. Admin confirms receipt -> succeeds
    const confirmRes = await FinanceService.confirmReceipt(db, adminUser, { receiptId });
    expect(confirmRes.status).toBe("CONFIRMED");
    expect(confirmRes.receiptNumber).toMatch(/^MD-RCP-\d{4}-\d{4}$/);
  });

  it("AC-032: Part payment stays exact and excessive allocation is rejected", async () => {
    // 1. Create and issue invoice for INR 10,000.00 (1,000,000 paise)
    const { invoiceId } = await FinanceService.draftInvoice(db, staffUser, {
      projectId: testProjectId,
      dueDate: "2026-12-15",
      lineItems: [
        { description: "Total Professional Fees", unitRateMinor: 1000000 },
      ],
    });
    await FinanceService.approveInvoice(db, managerUser, { invoiceId, versionNumber: 1 });
    await FinanceService.issueInvoice(db, staffUser, { invoiceId, versionNumber: 1 });

    // 2. Create and confirm Receipt 1: INR 3,000.00 (300,000 paise)
    const { receiptId: r1Id } = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 300000,
      receivedDate: "2026-11-20",
      paymentMethod: "UPI",
    });
    await FinanceService.confirmReceipt(db, adminUser, { receiptId: r1Id });

    // 3. Create and confirm Receipt 2: INR 8,000.00 (800,000 paise)
    const { receiptId: r2Id } = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 800000,
      receivedDate: "2026-11-24",
      paymentMethod: "NEFT",
    });
    await FinanceService.confirmReceipt(db, adminUser, { receiptId: r2Id });

    // 4. Allocate Receipt 1 (300,000) to Invoice
    const alloc1 = await FinanceService.allocateReceipt(db, adminUser, {
      receiptId: r1Id,
      invoiceId,
      amountMinor: 300000, idempotencyKey:"allocation-r1",
    });
    expect(alloc1.allocatedMinor).toBe(300000);
    expect(alloc1.invoiceOutstandingMinor).toBe(700000); // 7,000.00 left
    expect(alloc1.invoiceSettlementStatus).toBe("PARTIALLY_PAID");
    expect(alloc1.receiptUnallocatedMinor).toBe(0);

    // 5. Allocate Receipt 2 (800,000) to Invoice (which has only 700,000 outstanding)
    await expect(FinanceService.allocateReceipt(db,adminUser,{receiptId:r2Id,invoiceId,amountMinor:800000,idempotencyKey:'over-allocation'})).rejects.toThrow();
    const alloc2 = await FinanceService.allocateReceipt(db, adminUser, {
      receiptId: r2Id,
      invoiceId,
      amountMinor: 700000, idempotencyKey:'allocation-r2',
    });
    // Explicit allocation: the excessive request was rejected; 700,000 allocated.
    expect(alloc2.allocatedMinor).toBe(700000);
    expect(alloc2.invoiceOutstandingMinor).toBe(0); // Fully settled, not negative!
    expect(alloc2.invoiceSettlementStatus).toBe("PAID");

    // The unallocated 100,000 (INR 1,000.00) remains safely available on the receipt as advance
    expect(alloc2.receiptUnallocatedMinor).toBe(100000);

    const r2Row = (await db
      .prepare(`SELECT allocated_minor, unallocated_minor FROM receipts WHERE id = ?`)
      .bind(r2Id)
      .first()) as any;
    expect(r2Row.allocated_minor).toBe(700000);
    expect(r2Row.unallocated_minor).toBe(100000);
  });

  it("AC-033: Duplicate receipt confirmation is idempotent", async () => {
    const idempotencyKey = "idem_key_receipt_9999";

    const { receiptId } = await FinanceService.reportReceipt(db, clientUser, {
      projectId: testProjectId,
      amountMinor: 1500000,
      receivedDate: "2026-11-24",
      paymentMethod: "NEFT",
      idempotencyKey,
    });

    // First confirmation
    const res1 = await FinanceService.confirmReceipt(db, adminUser, {
      receiptId,
      idempotencyKey,
    });
    expect(res1.status).toBe("CONFIRMED");

    // Replay confirmation with same idempotency key
    const res2 = await FinanceService.confirmReceipt(db, adminUser, {
      receiptId,
      idempotencyKey,
    });
    expect(res2.status).toBe("CONFIRMED");
    expect(res2.receiptNumber).toBe(res1.receiptNumber);

    // Ensure only one journal entry was posted
    const countRow = (await db
      .prepare(
        `SELECT COUNT(*) as c FROM journal_entries WHERE source_type = 'RECEIPT_CONFIRMED' AND source_id = ?`
      )
      .bind(receiptId)
      .first()) as any;
    expect(countRow.c).toBe(1);
  });
});
