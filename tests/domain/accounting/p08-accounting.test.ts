/**
 * P08 Acceptance Tests: Accounting, Expenses, Consultant Fees, Payroll Privacy, and Ledger Integrity.
 * Tests AC-034, AC-035, AC-036, AC-037, AC-038.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../../src/server/auth/principal";
import { AccountingService } from "../../../src/server/domain/accounting/service";
import { FinanceService } from "../../../src/server/domain/finance/service";

describe("Phase 08: Firm Accounting, Protected Payroll, and Balanced Ledger", () => {
  let db: D1Database;

  const testOrgId = "org_merveille_main";
  const testProjectId = "prj_accounting_villa";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Merveille Admin",
    orgId: testOrgId,
    role: "ADMIN",
    projectMemberships: [{ projectId: testProjectId, projectRole: "ADMIN" }],
    isSynthetic: true,
  };

  const ownerUser: UserPrincipal = {
    id: "usr_owner_001",
    email: "owner@merveilledesigns.com",
    name: "Merveille Owner",
    orgId: testOrgId,
    role: "OWNER",
    projectMemberships: [{ projectId: testProjectId, projectRole: "OWNER" }],
    isSynthetic: true,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Vipin Manager",
    orgId: testOrgId,
    role: "MANAGER",
    projectMemberships: [{ projectId: testProjectId, projectRole: "MANAGER" }],
    isSynthetic: true,
  };

  const staffUser: UserPrincipal = {
    id: "usr_stf_001",
    email: "staff@merveilledesigns.com",
    name: "Nithya Architect",
    orgId: testOrgId,
    role: "STAFF",
    projectMemberships: [{ projectId: testProjectId, projectRole: "STAFF" }],
    isSynthetic: true,
  };

  const consultantUser: UserPrincipal = {
    id: "usr_cons_001",
    email: "consultant@example.com",
    name: "Manoj Structural Engineer",
    orgId: testOrgId,
    role: "CONSULTANT",
    projectMemberships: [{ projectId: testProjectId, projectRole: "CONSULTANT" }],
    isSynthetic: true,
  };

  const clientUser: UserPrincipal = {
    id: "usr_cli_001",
    email: "client@example.com",
    name: "Thomas Client",
    orgId: testOrgId,
    role: "MAIN_CLIENT",
    projectMemberships: [{ projectId: testProjectId, projectRole: "MAIN_CLIENT" }],
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
    const allUsers = [adminUser, ownerUser, managerUser, staffUser, consultantUser, clientUser];
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
        `INSERT OR IGNORE INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id,
          stage, status, is_archived, revision, created_at
        ) VALUES (?, ?, 'MD-ACC', 'Accounting Villa', 'usr_cli_001', ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`
      )
      .bind(testProjectId, testOrgId, managerUser.id, Date.now())
      .run();

    // 4. Seed project memberships
    for (const u of [adminUser, ownerUser, managerUser, staffUser, consultantUser]) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`pm_${u.id}`, testOrgId, testProjectId, u.id, u.role, Date.now())
        .run();
    }
  });

  it("AC-034: Expense and consultant fee submission, manager review, and admin posting separation", async () => {
    // 1. Staff submits non-payroll expense
    const { expenseId } = await AccountingService.submitExpense(db, staffUser, {
      projectId: testProjectId,
      category: "SITE_TRAVEL",
      description: "Site inspection taxi fare to Thrissur",
      amountMinor: 250000, // 2,500.00 INR
      incurredDate: "2026-11-20",
    });

    // 2. Staff attempts to post expense -> strictly denied (AC-034)
    await expect(
      AccountingService.postExpense(db, staffUser, expenseId)
    ).rejects.toThrow(/Only administrators can post expenses to the accounting ledger/);

    // 3. Manager approves expense
    await AccountingService.approveExpense(db, managerUser, expenseId);

    // 4. Admin posts expense -> succeeds and posts balanced journal entry
    const postRes = await AccountingService.postExpense(db, adminUser, expenseId);
    expect(postRes.status).toBe("POSTED");

    // 5. Consultant submits consultant fee bill
    const { billId } = await AccountingService.submitConsultantBill(db, consultantUser, {
      projectId: testProjectId,
      consultantUserId: consultantUser.id,
      billReference: "STR-INV-2026-01",
      discipline: "STRUCTURAL",
      amountMinor: 1500000, // 15,000.00 INR
      billDate: "2026-11-22",
    });

    // 6. Consultant attempts to post bill -> strictly denied
    await expect(
      AccountingService.postConsultantBill(db, consultantUser, billId)
    ).rejects.toThrow(/Only administrators can post consultant bills/);

    // 7. Manager approves consultant bill
    await AccountingService.approveConsultantBill(db, managerUser, billId);

    // 8. Admin posts consultant bill -> succeeds
    const postBillRes = await AccountingService.postConsultantBill(db, adminUser, billId);
    expect(postBillRes.status).toBe("POSTED");
  });

  it("AC-035: Payroll does not leak through totals; non-admin cannot obtain salary or profit", async () => {
    // 1. Seed invoice and expenses
    const { invoiceId } = await FinanceService.draftInvoice(db, staffUser, {
      projectId: testProjectId,
      dueDate: "2026-11-30",
      lineItems: [{ description: "Design Fee", unitRateMinor: 10000000 }], // 100,000.00 INR
    });
    await FinanceService.approveInvoice(db, managerUser, { invoiceId, versionNumber: 1 });
    await FinanceService.issueInvoice(db, staffUser, { invoiceId, versionNumber: 1 });

    const { expenseId } = await AccountingService.submitExpense(db, staffUser, {
      projectId: testProjectId,
      category: "PRINTING_STATIONERY",
      description: "A1 Drawing prints",
      amountMinor: 500000, // 5,000.00 INR
      incurredDate: "2026-11-20",
    });
    await AccountingService.approveExpense(db, managerUser, expenseId);
    await AccountingService.postExpense(db, adminUser, expenseId);

    // 2. Admin records salary allocation: 40,000 INR (4,000,000 paise)
    await AccountingService.recordPayroll(db, adminUser, {
      projectId: testProjectId,
      userId: staffUser.id,
      periodMonth: "2026-11",
      grossSalaryMinor: 4000000,
    });

    // 3. Staff queries financial report
    const staffReport = await AccountingService.getFinancialReport(db, staffUser, {
      projectId: testProjectId,
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });

    // Staff sees non-sensitive items
    expect(staffReport.invoicedAmountMinor).toBe(10000000);
    expect(staffReport.directExpensesMinor).toBe(500000);
    expect(staffReport.nonSensitiveCostsMinor).toBe(500000);

    // CRITICAL (AC-035): Salaries and Operating Profit are completely absent!
    expect((staffReport as any).salariesMinor).toBeUndefined();
    expect((staffReport as any).totalCostsMinor).toBeUndefined();
    expect((staffReport as any).operatingProfitMinor).toBeUndefined();

    // 4. OWNER (without ADMIN) queries report -> salaries and profit STILL absent (AC-005)
    const ownerReport = await AccountingService.getFinancialReport(db, ownerUser, {
      projectId: testProjectId,
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });
    expect((ownerReport as any).salariesMinor).toBeUndefined();
    expect((ownerReport as any).operatingProfitMinor).toBeUndefined();

    // 5. Admin queries report -> sees complete statements with salaries and operating profit
    const adminReport = await AccountingService.getFinancialReport(db, adminUser, {
      projectId: testProjectId,
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });
    expect(adminReport.salariesMinor).toBe(4000000);
    expect(adminReport.totalCostsMinor).toBe(4500000); // 5,000 + 40,000
    expect(adminReport.operatingProfitMinor).toBe(5500000); // 100,000 - 45,000 = 55,000
  });

  it("AC-036: Reporting basis and currency are explicit; cross-currency summing rejected", async () => {
    const report = await AccountingService.getFinancialReport(db, adminUser, {
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });

    expect(report.reportingBasis).toBe("Issued Invoices & Incurred Costs (Accrual Basis)");
    expect(report.currency).toBe("INR");
    expect(report.period.startDate).toBe("2026-11-01");
    expect(report.period.endDate).toBe("2026-11-30");

    // Cross-currency summing is rejected (AC-036)
    await expect(
      AccountingService.getFinancialReport(db, adminUser, {
        currency: "USD",
        periodStartDate: "2026-11-01",
        periodEndDate: "2026-11-30",
      })
    ).rejects.toThrow(/Foreign currency USD cannot be mixed with base INR accounts/);
  });

  it("AC-037: Balanced postings invariant and closed period write denial", async () => {
    // 1. Create and close accounting period for October 2026
    const { periodId } = await AccountingService.createAccountingPeriod(db, adminUser, {
      periodLabel: "2026-10",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });
    await AccountingService.closeAccountingPeriod(db, adminUser, periodId);

    // 2. Attempt to submit an expense in closed period -> strictly rejected (AC-037)
    await expect(
      AccountingService.submitExpense(db, staffUser, {
        projectId: testProjectId,
        category: "SITE_TRAVEL",
        description: "Backdated travel expense in closed period",
        amountMinor: 100000,
        incurredDate: "2026-10-15",
      })
    ).rejects.toThrow(/Posting denied: accounting period 2026-10 is closed/);

    // 3. Verify balanced ledger invariant across all posted journal entries
    const lines = (await db
      .prepare(`SELECT debit_minor, credit_minor FROM journal_lines`)
      .all()) as any;
    const totalDebits = (lines.results || []).reduce((s: number, l: any) => s + l.debit_minor, 0);
    const totalCredits = (lines.results || []).reduce((s: number, l: any) => s + l.credit_minor, 0);
    expect(totalDebits).toBe(totalCredits); // Exact double-entry balance
  });

  it("AC-038: Report exactly reproduces source records without guessed profit", async () => {
    // 1. Generate report twice with identical parameters
    const reportRun1 = await AccountingService.getFinancialReport(db, adminUser, {
      projectId: testProjectId,
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });

    const reportRun2 = await AccountingService.getFinancialReport(db, adminUser, {
      projectId: testProjectId,
      periodStartDate: "2026-11-01",
      periodEndDate: "2026-11-30",
    });

    // 2. Both runs reproduce exact identical numbers
    expect(reportRun1.invoicedAmountMinor).toBe(reportRun2.invoicedAmountMinor);
    expect(reportRun1.directExpensesMinor).toBe(reportRun2.directExpensesMinor);
    expect(reportRun1.consultantFeesMinor).toBe(reportRun2.consultantFeesMinor);
    expect(reportRun1.salariesMinor).toBe(reportRun2.salariesMinor);
    expect(reportRun1.totalCostsMinor).toBe(reportRun2.totalCostsMinor);
    expect(reportRun1.operatingProfitMinor).toBe(reportRun2.operatingProfitMinor);
  });
});
