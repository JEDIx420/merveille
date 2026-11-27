import { assertProjectOrganisation } from "../../auth/policy";
/**
 * Domain service for firm accounting, expense approvals, consultant bills,
 * admin-only payroll/profit reporting, period closure, and reproducible financial statements.
 */

import { D1Database } from "@cloudflare/workers-types";
import {
  UserPrincipal,
  hasCapability,
  projectGrant,
} from "../../auth/principal";
import {
  assertProjectAccess,
  canPublishProjectUpdates,
  canViewPayrollAndProfit,
  AuthorizationError,
} from "../../auth/policy";
import { FinanceService, money } from "../finance/service";
import { atomicGuard } from "../../db/atomic";
import { ArchiveService } from "../archive/service";
import { assertLegacyBillingAllowed } from "../finance/external-clearance";

export interface SubmitExpenseParams {
  projectId?: string;
  category: string;
  description: string;
  supplierName?: string;
  amountMinor: number;
  currency?: string;
  incurredDate: string; // YYYY-MM-DD
  evidenceFileId?: string;
}

export interface SubmitConsultantBillParams {
  projectId: string;
  consultantUserId: string;
  billReference: string;
  discipline: string;
  amountMinor: number;
  currency?: string;
  billDate: string; // YYYY-MM-DD
  evidenceFileId?: string;
}

export interface RecordPayrollParams {
  projectId?: string;
  userId: string;
  periodMonth: string; // YYYY-MM
  grossSalaryMinor: number;
  currency?: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class AccountingService {
  /**
   * Check if a given transaction date falls in a closed accounting period.
   */
  static async assertPeriodNotClosed(db: D1Database, dateStr: string) {
    const closedPeriod = (await db
      .prepare(
        `SELECT * FROM accounting_periods
         WHERE is_closed = 1 AND start_date <= ? AND end_date >= ?`,
      )
      .bind(dateStr, dateStr)
      .first()) as any;

    if (closedPeriod) {
      throw new AuthorizationError(
        `Posting denied: accounting period ${closedPeriod.period_label} is closed`,
        "CLOSED_PERIOD_WRITE_DENIED",
      );
    }
  }

  // -------------------------------------------------------------
  // Expenses
  // -------------------------------------------------------------

  static async submitExpense(
    db: D1Database,
    principal: UserPrincipal,
    params: SubmitExpenseParams,
  ) {
    if (params.projectId) {
      assertProjectAccess(principal, params.projectId);
      await assertProjectOrganisation(db, principal, params.projectId);
    }
    money(params.amountMinor);
    if (params.currency && !/^[A-Z]{3}$/.test(params.currency))
      throw new AuthorizationError("Invalid currency", "INVALID_INPUT");
    if (
      !hasCapability(principal, "ADMIN") &&
      (!params.projectId ||
        (!hasCapability(principal, "MANAGER", params.projectId) &&
          !hasCapability(principal, "TEAM_MEMBER", params.projectId)))
    )
      throw new AuthorizationError(
        "Expense submission requires a project work grant",
      );
    if (params.projectId)
      await ArchiveService.assertProjectNotArchived(db, params.projectId);
    await assertLegacyBillingAllowed(db, principal.orgId, "submit new expenses");
    await this.assertPeriodNotClosed(db, params.incurredDate);

    const expenseId = generateId("exp");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO expenses (
          id, org_id, project_id, category, description,
          supplier_name, amount_minor, currency, incurred_date,
          evidence_file_id, status, submitted_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`,
      )
      .bind(
        expenseId,
        principal.orgId,
        params.projectId || null,
        params.category,
        params.description,
        params.supplierName || null,
        params.amountMinor,
        params.currency || "INR",
        params.incurredDate,
        params.evidenceFileId || null,
        principal.id,
        now,
      )
      .run();

    return { expenseId, status: "SUBMITTED" };
  }

  static async approveExpense(
    db: D1Database,
    principal: UserPrincipal,
    expenseId: string,
  ) {
    const expense = (await db
      .prepare(`SELECT * FROM expenses WHERE id = ?`)
      .bind(expenseId)
      .first()) as any;

    if (!expense || expense.org_id !== principal.orgId)
      throw new AuthorizationError("Expense not found", "NOT_FOUND");

    if (
      !hasCapability(principal, "ADMIN") &&
      (!expense.project_id ||
        !canPublishProjectUpdates(principal, expense.project_id))
    ) {
      throw new AuthorizationError(
        "Only managers or administrators can approve expenses",
        "FORBIDDEN",
      );
    }

    if (expense.status !== "SUBMITTED")
      throw new AuthorizationError(
        "Expense is not awaiting approval",
        "CONFLICT",
      );
    const now = Date.now();
    await db
      .prepare(
        `UPDATE expenses
         SET status = 'APPROVED', approved_by_user_id = ?, approved_at = ?
         WHERE id = ? AND status = 'SUBMITTED'`,
      )
      .bind(principal.id, now, expenseId)
      .run();

    return { expenseId, status: "APPROVED" };
  }

  /**
   * Post expense to ledger.
   * ADMIN ONLY. Rejects staff and consultants.
   */
  static async postExpense(
    db: D1Database,
    principal: UserPrincipal,
    expenseId: string,
  ) {
    if (!hasCapability(principal, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can post accounting records",
      );
    const value = await db
      .prepare("SELECT * FROM expenses WHERE id=? AND org_id=?")
      .bind(expenseId, principal.orgId)
      .first<any>();
    if (!value) throw new AuthorizationError("Record not found", "NOT_FOUND");
    if (value.status === "POSTED") return { expenseId, status: "POSTED" };
    money(value.amount_minor);
    await this.assertPeriodNotClosed(db, value.incurred_date);
    const entry = FinanceService.journalStatements(db, {
      orgId: principal.orgId,
      projectId: value.project_id ?? undefined,
      sourceType: "EXPENSE_POSTED",
      sourceId: expenseId,
      entryDate: value.incurred_date,
      description: "EXPENSE_POSTED",
      lines: [
        {
          accountCode: "5000_DIRECT_PROJECT_EXPENSES",
          debitMinor: value.amount_minor,
          creditMinor: 0,
        },
        {
          accountCode: "2000_ACCOUNTS_PAYABLE",
          debitMinor: 0,
          creditMinor: value.amount_minor,
        },
      ],
    });
    await FinanceService.commit(db, [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM expenses WHERE id=? AND org_id=? AND status='APPROVED') AND NOT EXISTS(SELECT 1 FROM accounting_periods WHERE org_id=? AND is_closed=1 AND start_date<=? AND end_date>=?)",
        [
          expenseId,
          principal.orgId,
          principal.orgId,
          value.incurred_date,
          value.incurred_date,
        ],
      ),
      db
        .prepare(
          "UPDATE expenses SET status='POSTED',posted_by_user_id=?,posted_at=? WHERE id=?",
        )
        .bind(principal.id, Date.now(), expenseId),
      ...entry.statements,
      FinanceService.audit(
        db,
        principal,
        "ACCOUNTING",
        expenseId,
        "EXPENSE_POSTED",
        { amountMinor: value.amount_minor },
      ),
    ]);
    return { expenseId, status: "POSTED" };
  }

  // -------------------------------------------------------------
  // Consultant Bills
  // -------------------------------------------------------------

  static async submitConsultantBill(
    db: D1Database,
    principal: UserPrincipal,
    params: SubmitConsultantBillParams,
  ) {
    assertProjectAccess(principal, params.projectId);
    await assertProjectOrganisation(db, principal, params.projectId);
    money(params.amountMinor);
    if (params.currency && !/^[A-Z]{3}$/.test(params.currency))
      throw new AuthorizationError("Invalid currency", "INVALID_INPUT");
    if (
      !hasCapability(principal, "ADMIN") &&
      !hasCapability(principal, "MANAGER", params.projectId) &&
      !projectGrant(principal, params.projectId)?.financeAuthor
    )
      throw new AuthorizationError(
        "Consultant bills require an explicit finance author grant",
      );
    await ArchiveService.assertProjectNotArchived(db, params.projectId);
    await assertLegacyBillingAllowed(db, principal.orgId, "submit consultant bills");
    await this.assertPeriodNotClosed(db, params.billDate);

    const billId = generateId("cbl");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO consultant_bills (
          id, org_id, project_id, consultant_user_id, bill_reference,
          discipline, amount_minor, currency, bill_date,
          evidence_file_id, status, submitted_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`,
      )
      .bind(
        billId,
        principal.orgId,
        params.projectId,
        params.consultantUserId,
        params.billReference,
        params.discipline,
        params.amountMinor,
        params.currency || "INR",
        params.billDate,
        params.evidenceFileId || null,
        principal.id,
        now,
      )
      .run();

    return { billId, status: "SUBMITTED" };
  }

  static async approveConsultantBill(
    db: D1Database,
    principal: UserPrincipal,
    billId: string,
  ) {
    const bill = (await db
      .prepare(`SELECT * FROM consultant_bills WHERE id = ?`)
      .bind(billId)
      .first()) as any;

    if (!bill || bill.org_id !== principal.orgId)
      throw new AuthorizationError("Consultant bill not found", "NOT_FOUND");

    if (
      !hasCapability(principal, "ADMIN") &&
      !canPublishProjectUpdates(principal, bill.project_id)
    ) {
      throw new AuthorizationError(
        "Only managers or administrators can approve consultant bills",
        "FORBIDDEN",
      );
    }

    if (bill.status !== "SUBMITTED")
      throw new AuthorizationError("Bill is not awaiting approval", "CONFLICT");
    const now = Date.now();
    await db
      .prepare(
        `UPDATE consultant_bills
         SET status = 'APPROVED', approved_by_user_id = ?, approved_at = ?
         WHERE id = ? AND status = 'SUBMITTED'`,
      )
      .bind(principal.id, now, billId)
      .run();

    return { billId, status: "APPROVED" };
  }

  static async postConsultantBill(
    db: D1Database,
    principal: UserPrincipal,
    billId: string,
  ) {
    if (!hasCapability(principal, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can post accounting records",
      );
    const value = await db
      .prepare("SELECT * FROM consultant_bills WHERE id=? AND org_id=?")
      .bind(billId, principal.orgId)
      .first<any>();
    if (!value) throw new AuthorizationError("Record not found", "NOT_FOUND");
    if (value.status === "POSTED") return { billId, status: "POSTED" };
    money(value.amount_minor);
    await this.assertPeriodNotClosed(db, value.bill_date);
    const entry = FinanceService.journalStatements(db, {
      orgId: principal.orgId,
      projectId: value.project_id ?? undefined,
      sourceType: "CONSULTANT_BILL_POSTED",
      sourceId: billId,
      entryDate: value.bill_date,
      description: "CONSULTANT_BILL_POSTED",
      lines: [
        {
          accountCode: "5100_CONSULTANT_FEES",
          debitMinor: value.amount_minor,
          creditMinor: 0,
        },
        {
          accountCode: "2000_ACCOUNTS_PAYABLE",
          debitMinor: 0,
          creditMinor: value.amount_minor,
        },
      ],
    });
    await FinanceService.commit(db, [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM consultant_bills WHERE id=? AND org_id=? AND status='APPROVED') AND NOT EXISTS(SELECT 1 FROM accounting_periods WHERE org_id=? AND is_closed=1 AND start_date<=? AND end_date>=?)",
        [
          billId,
          principal.orgId,
          principal.orgId,
          value.bill_date,
          value.bill_date,
        ],
      ),
      db
        .prepare(
          "UPDATE consultant_bills SET status='POSTED',posted_by_user_id=?,posted_at=? WHERE id=?",
        )
        .bind(principal.id, Date.now(), billId),
      ...entry.statements,
      FinanceService.audit(
        db,
        principal,
        "ACCOUNTING",
        billId,
        "CONSULTANT_BILL_POSTED",
        { amountMinor: value.amount_minor },
      ),
    ]);
    return { billId, status: "POSTED" };
  }

  // -------------------------------------------------------------
  // Payroll & Salary Allocations
  // -------------------------------------------------------------

  /**
   * Record a payroll/salary allocation.
   * STRICTLY ADMIN-ONLY. An OWNER without ADMIN is denied.
   */
  static async recordPayroll(
    db: D1Database,
    principal: UserPrincipal,
    params: RecordPayrollParams,
  ) {
    if (!canViewPayrollAndProfit(principal))
      throw new AuthorizationError(
        "Salaries and payroll records are strictly restricted to administrators",
      );
    await assertLegacyBillingAllowed(db, principal.orgId, "record payroll entries");
    money(params.grossSalaryMinor);
    if (!/^\d{4}-\d{2}$/.test(params.periodMonth))
      throw new AuthorizationError("Invalid payroll period", "INVALID_INPUT");
    const target = await db
      .prepare(
        "SELECT 1 FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=? AND m.org_id=? AND m.is_active=1 AND u.status='ACTIVE'",
      )
      .bind(params.userId, principal.orgId)
      .first();
    if (!target)
      throw new AuthorizationError(
        "Payroll person is not an active organisation member",
        "INVALID_INPUT",
      );
    if (params.projectId) {
      assertProjectAccess(principal, params.projectId);
      await assertProjectOrganisation(db, principal, params.projectId);
      await ArchiveService.assertProjectNotArchived(db, params.projectId);
    }
    const previous = await db
      .prepare(
        `SELECT id,gross_salary_minor,currency FROM payroll_records WHERE org_id=? AND user_id=? AND period_month=? AND COALESCE(project_id,'')=COALESCE(?,'')`,
      )
      .bind(
        principal.orgId,
        params.userId,
        params.periodMonth,
        params.projectId ?? null,
      )
      .first<any>();
    if (previous) {
      if (
        previous.gross_salary_minor !== params.grossSalaryMinor ||
        previous.currency !== (params.currency ?? "INR")
      )
        throw new AuthorizationError(
          "Payroll already posted; use an approved correction.",
          "CONFLICT",
        );
      return { payrollId: previous.id, status: "POSTED" };
    }
    const payrollId = generateId("pay"),
      now = Date.now(),
      day = params.periodMonth + "-01";
    const entry = FinanceService.journalStatements(db, {
      orgId: principal.orgId,
      projectId: params.projectId ?? undefined,
      sourceType: "PAYROLL_POSTED",
      sourceId: payrollId,
      entryDate: day,
      description: "Payroll posting",
      lines: [
        {
          accountCode: "5200_SALARIES_AND_PAYROLL",
          debitMinor: params.grossSalaryMinor,
          creditMinor: 0,
        },
        {
          accountCode: "2000_ACCOUNTS_PAYABLE",
          debitMinor: 0,
          creditMinor: params.grossSalaryMinor,
        },
      ],
    });
    await FinanceService.commit(db, [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "NOT EXISTS(SELECT 1 FROM accounting_periods WHERE org_id=? AND is_closed=1 AND start_date<=? AND end_date>=?)",
        [principal.orgId, day, day],
      ),
      db
        .prepare(
          "INSERT INTO payroll_records(id,org_id,project_id,user_id,period_month,gross_salary_minor,currency,status,recorded_by_user_id,created_at) VALUES (?,?,?,?,?,?,?,'POSTED',?,?)",
        )
        .bind(
          payrollId,
          principal.orgId,
          params.projectId ?? null,
          params.userId,
          params.periodMonth,
          params.grossSalaryMinor,
          params.currency ?? "INR",
          principal.id,
          now,
        ),
      ...entry.statements,
      FinanceService.audit(
        db,
        principal,
        "PAYROLL",
        payrollId,
        "PAYROLL_POSTED",
        { periodMonth: params.periodMonth },
      ),
    ]);
    return { payrollId, status: "POSTED" };
  }

  // -------------------------------------------------------------
  // Accounting Periods
  // -------------------------------------------------------------

  static async createAccountingPeriod(
    db: D1Database,
    principal: UserPrincipal,
    params: { periodLabel: string; startDate: string; endDate: string },
  ) {
    if (!hasCapability(principal, "ADMIN")) {
      throw new AuthorizationError(
        "Only administrators can configure accounting periods",
        "FORBIDDEN",
      );
    }

    const periodId = generateId("prd");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO accounting_periods (
          id, org_id, period_label, start_date, end_date,
          is_closed, created_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        periodId,
        principal.orgId,
        params.periodLabel,
        params.startDate,
        params.endDate,
        now,
      )
      .run();

    return { periodId, periodLabel: params.periodLabel, isClosed: false };
  }

  static async closeAccountingPeriod(
    db: D1Database,
    principal: UserPrincipal,
    periodId: string,
  ) {
    if (!hasCapability(principal, "ADMIN")) {
      throw new AuthorizationError(
        "Only administrators can close accounting periods",
        "FORBIDDEN",
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE accounting_periods
         SET is_closed = 1, closed_by_user_id = ?, closed_at = ?
         WHERE id = ? AND org_id = ?`,
      )
      .bind(principal.id, now, periodId, principal.orgId)
      .run();

    return { periodId, isClosed: true };
  }

  // -------------------------------------------------------------
  // Financial Reporting & Statement Generation
  // -------------------------------------------------------------

  /**
   * Generates a reproducible financial statement for an explicitly named period and basis.
   * If caller is NOT ADMIN, salaries and profit are completely omitted from the query projection.
   * Cross-currency summing is strictly rejected.
   */
  static async getFinancialReport(
    db: D1Database,
    principal: UserPrincipal,
    params: {
      projectId?: string;
      currency?: string;
      periodStartDate: string; // YYYY-MM-DD
      periodEndDate: string; // YYYY-MM-DD
    },
  ) {
    if (params.projectId) {
      assertProjectAccess(principal, params.projectId);
      await assertProjectOrganisation(db, principal, params.projectId);
      if (
        !hasCapability(principal, "ADMIN") &&
        !hasCapability(principal, "OWNER") &&
        !hasCapability(principal, "MANAGER", params.projectId)
      )
        throw new AuthorizationError("Cost reports are restricted");
    } else if (
      !hasCapability(principal, "ADMIN") &&
      !hasCapability(principal, "OWNER")
    )
      throw new AuthorizationError(
        "Firm reports require administrator or owner capability",
      );
    for (const value of [params.periodStartDate, params.periodEndDate])
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value
      )
        throw new AuthorizationError(
          "A valid reporting period is required.",
          "INVALID_INPUT",
        );
    if (params.periodStartDate > params.periodEndDate)
      throw new AuthorizationError(
        "The reporting period ends before it starts.",
        "INVALID_INPUT",
      );
    const currency = params.currency || "INR";

    // Reject cross-currency summing if foreign currency requested
    if (currency !== "INR") {
      throw new Error(
        `Foreign currency ${currency} cannot be mixed with base INR accounts`,
      );
    }

    const isAuthorizedForSalaryProfit = canViewPayrollAndProfit(principal);

    // 1. Invoiced Amount (Issued invoices)
    let invSql = `SELECT COALESCE(SUM(total_minor), 0) as total FROM invoices WHERE org_id=? AND status = 'ISSUED' AND due_date >= ? AND due_date <= ? AND currency = ?`;
    const invParams: any[] = [
      principal.orgId,
      params.periodStartDate,
      params.periodEndDate,
      currency,
    ];
    if (params.projectId) {
      invSql += ` AND project_id = ?`;
      invParams.push(params.projectId);
    }
    const invRow = (await db
      .prepare(invSql)
      .bind(...invParams)
      .first()) as any;
    const invoicedAmountMinor = invRow?.total || 0;
    money(invoicedAmountMinor, true);

    // 2. Money Received (Confirmed receipts) - distinctly separated from invoiced sales
    let rcpSql = `SELECT COALESCE(SUM(amount_minor), 0) as total FROM receipts WHERE org_id=? AND status = 'CONFIRMED' AND received_date >= ? AND received_date <= ? AND currency = ?`;
    const rcpParams: any[] = [
      principal.orgId,
      params.periodStartDate,
      params.periodEndDate,
      currency,
    ];
    if (params.projectId) {
      rcpSql += ` AND project_id = ?`;
      rcpParams.push(params.projectId);
    }
    const rcpRow = (await db
      .prepare(rcpSql)
      .bind(...rcpParams)
      .first()) as any;
    const moneyReceivedMinor = rcpRow?.total || 0;
    money(moneyReceivedMinor, true);

    // 3. Direct Incurred Expenses (Posted)
    let expSql = `SELECT COALESCE(SUM(amount_minor), 0) as total FROM expenses WHERE org_id=? AND status = 'POSTED' AND incurred_date >= ? AND incurred_date <= ? AND currency = ?`;
    const expParams: any[] = [
      principal.orgId,
      params.periodStartDate,
      params.periodEndDate,
      currency,
    ];
    if (params.projectId) {
      expSql += ` AND project_id = ?`;
      expParams.push(params.projectId);
    }
    const expRow = (await db
      .prepare(expSql)
      .bind(...expParams)
      .first()) as any;
    const directExpensesMinor = expRow?.total || 0;
    money(directExpensesMinor, true);

    // 4. Consultant Fees (Posted)
    let cblSql = `SELECT COALESCE(SUM(amount_minor), 0) as total FROM consultant_bills WHERE org_id=? AND status = 'POSTED' AND bill_date >= ? AND bill_date <= ? AND currency = ?`;
    const cblParams: any[] = [
      principal.orgId,
      params.periodStartDate,
      params.periodEndDate,
      currency,
    ];
    if (params.projectId) {
      cblSql += ` AND project_id = ?`;
      cblParams.push(params.projectId);
    }
    const cblRow = (await db
      .prepare(cblSql)
      .bind(...cblParams)
      .first()) as any;
    const consultantFeesMinor = cblRow?.total || 0;
    money(consultantFeesMinor, true);

    // Non-sensitive operational costs subtotal
    const nonSensitiveCostsMinor = directExpensesMinor + consultantFeesMinor;

    const baseReport = {
      reportingBasis: "Issued Invoices & Incurred Costs (Accrual Basis)",
      currency,
      period: {
        startDate: params.periodStartDate,
        endDate: params.periodEndDate,
      },
      generatedAt: Date.now(),
      invoicedAmountMinor,
      moneyReceivedMinor,
      directExpensesMinor,
      consultantFeesMinor,
      nonSensitiveCostsMinor,
    };

    // If caller is NOT ADMIN, return without salaries or operating profit
    if (!isAuthorizedForSalaryProfit) {
      return baseReport;
    }

    // 5. Salaries and Payroll (ADMIN ONLY)
    const monthPrefix = params.periodStartDate.slice(0, 7);
    let paySql = `SELECT COALESCE(SUM(gross_salary_minor), 0) as total FROM payroll_records WHERE org_id=? AND period_month >= ? AND period_month <= ? AND currency = ?`;
    const payParams: any[] = [
      principal.orgId,
      monthPrefix,
      params.periodEndDate.slice(0, 7),
      currency,
    ];
    if (params.projectId) {
      paySql += ` AND project_id = ?`;
      payParams.push(params.projectId);
    }
    const payRow = (await db
      .prepare(paySql)
      .bind(...payParams)
      .first()) as any;
    const salariesMinor = payRow?.total || 0;
    money(salariesMinor, true);

    const totalCostsMinor = nonSensitiveCostsMinor + salariesMinor;
    const operatingProfitMinor = invoicedAmountMinor - totalCostsMinor;

    return {
      ...baseReport,
      salariesMinor,
      totalCostsMinor,
      operatingProfitMinor,
    };
  }
}
