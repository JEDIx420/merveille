/**
 * Domain service for firm accounting, expense approvals, consultant bills,
 * admin-only payroll/profit reporting, period closure, and reproducible financial statements.
 */

import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../auth/principal";
import {
  assertProjectAccess,
  canPublishProjectUpdates,
  canViewPayrollAndProfit,
  AuthorizationError,
} from "../../auth/policy";
import { FinanceService } from "../finance/service";

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
   * Check if a given transaction date falls in a closed accounting period (AC-037).
   */
  static async assertPeriodNotClosed(db: D1Database, dateStr: string) {
    const closedPeriod = (await db
      .prepare(
        `SELECT * FROM accounting_periods
         WHERE is_closed = 1 AND start_date <= ? AND end_date >= ?`
      )
      .bind(dateStr, dateStr)
      .first()) as any;

    if (closedPeriod) {
      throw new AuthorizationError(
        `Posting denied: accounting period ${closedPeriod.period_label} is closed (AC-037)`,
        "CLOSED_PERIOD_WRITE_DENIED"
      );
    }
  }

  // -------------------------------------------------------------
  // Expenses (AC-034)
  // -------------------------------------------------------------

  static async submitExpense(
    db: D1Database,
    principal: UserPrincipal,
    params: SubmitExpenseParams
  ) {
    if (params.projectId) {
      assertProjectAccess(principal, params.projectId);
    }
    await this.assertPeriodNotClosed(db, params.incurredDate);

    const expenseId = generateId("exp");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO expenses (
          id, org_id, project_id, category, description,
          supplier_name, amount_minor, currency, incurred_date,
          evidence_file_id, status, submitted_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`
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
        now
      )
      .run();

    return { expenseId, status: "SUBMITTED" };
  }

  static async approveExpense(
    db: D1Database,
    principal: UserPrincipal,
    expenseId: string
  ) {
    const expense = (await db
      .prepare(`SELECT * FROM expenses WHERE id = ?`)
      .bind(expenseId)
      .first()) as any;

    if (!expense) throw new Error("Expense not found");

    if (expense.project_id && !canPublishProjectUpdates(principal, expense.project_id)) {
      throw new AuthorizationError(
        "Only managers or administrators can approve expenses",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE expenses
         SET status = 'APPROVED', approved_by_user_id = ?, approved_at = ?
         WHERE id = ?`
      )
      .bind(principal.id, now, expenseId)
      .run();

    return { expenseId, status: "APPROVED" };
  }

  /**
   * Post expense to ledger (AC-034).
   * ADMIN ONLY. Rejects staff and consultants.
   */
  static async postExpense(
    db: D1Database,
    principal: UserPrincipal,
    expenseId: string
  ) {
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can post expenses to the accounting ledger",
        "FORBIDDEN"
      );
    }

    const expense = (await db
      .prepare(`SELECT * FROM expenses WHERE id = ?`)
      .bind(expenseId)
      .first()) as any;

    if (!expense) throw new Error("Expense not found");

    if (expense.status !== "APPROVED") {
      throw new Error("Cannot post unapproved expense (AC-034)");
    }

    await this.assertPeriodNotClosed(db, expense.incurred_date);

    const now = Date.now();
    await db
      .prepare(
        `UPDATE expenses
         SET status = 'POSTED', posted_by_user_id = ?, posted_at = ?
         WHERE id = ?`
      )
      .bind(principal.id, now, expenseId)
      .run();

    // Balanced journal entry: Debit Expense, Credit AP
    const expenseAccount = expense.project_id
      ? "5000_DIRECT_PROJECT_EXPENSES"
      : "5300_OFFICE_OVERHEAD";

    await FinanceService.postBalancedJournal(db, {
      orgId: expense.org_id,
      projectId: expense.project_id || undefined,
      sourceType: "EXPENSE_POSTED",
      sourceId: expenseId,
      entryDate: expense.incurred_date,
      description: `Expense: ${expense.description} (${expense.category})`,
      lines: [
        {
          accountCode: expenseAccount,
          debitMinor: expense.amount_minor,
          creditMinor: 0,
        },
        {
          accountCode: "2000_ACCOUNTS_PAYABLE",
          debitMinor: 0,
          creditMinor: expense.amount_minor,
        },
      ],
    });

    return { expenseId, status: "POSTED" };
  }

  // -------------------------------------------------------------
  // Consultant Bills (AC-034)
  // -------------------------------------------------------------

  static async submitConsultantBill(
    db: D1Database,
    principal: UserPrincipal,
    params: SubmitConsultantBillParams
  ) {
    assertProjectAccess(principal, params.projectId);
    await this.assertPeriodNotClosed(db, params.billDate);

    const billId = generateId("cbl");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO consultant_bills (
          id, org_id, project_id, consultant_user_id, bill_reference,
          discipline, amount_minor, currency, bill_date,
          evidence_file_id, status, submitted_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`
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
        now
      )
      .run();

    return { billId, status: "SUBMITTED" };
  }

  static async approveConsultantBill(
    db: D1Database,
    principal: UserPrincipal,
    billId: string
  ) {
    const bill = (await db
      .prepare(`SELECT * FROM consultant_bills WHERE id = ?`)
      .bind(billId)
      .first()) as any;

    if (!bill) throw new Error("Consultant bill not found");

    if (!canPublishProjectUpdates(principal, bill.project_id)) {
      throw new AuthorizationError(
        "Only managers or administrators can approve consultant bills",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE consultant_bills
         SET status = 'APPROVED', approved_by_user_id = ?, approved_at = ?
         WHERE id = ?`
      )
      .bind(principal.id, now, billId)
      .run();

    return { billId, status: "APPROVED" };
  }

  static async postConsultantBill(
    db: D1Database,
    principal: UserPrincipal,
    billId: string
  ) {
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can post consultant bills",
        "FORBIDDEN"
      );
    }

    const bill = (await db
      .prepare(`SELECT * FROM consultant_bills WHERE id = ?`)
      .bind(billId)
      .first()) as any;

    if (!bill) throw new Error("Consultant bill not found");

    if (bill.status !== "APPROVED") {
      throw new Error("Cannot post unapproved consultant bill");
    }

    await this.assertPeriodNotClosed(db, bill.bill_date);

    const now = Date.now();
    await db
      .prepare(
        `UPDATE consultant_bills
         SET status = 'POSTED', posted_by_user_id = ?, posted_at = ?
         WHERE id = ?`
      )
      .bind(principal.id, now, billId)
      .run();

    // Balanced journal entry: Debit Consultant Fees, Credit AP
    await FinanceService.postBalancedJournal(db, {
      orgId: bill.org_id,
      projectId: bill.project_id,
      sourceType: "CONSULTANT_BILL_POSTED",
      sourceId: billId,
      entryDate: bill.bill_date,
      description: `Consultant Bill: ${bill.bill_reference} (${bill.discipline})`,
      lines: [
        {
          accountCode: "5100_CONSULTANT_FEES",
          debitMinor: bill.amount_minor,
          creditMinor: 0,
        },
        {
          accountCode: "2000_ACCOUNTS_PAYABLE",
          debitMinor: 0,
          creditMinor: bill.amount_minor,
        },
      ],
    });

    return { billId, status: "POSTED" };
  }

  // -------------------------------------------------------------
  // Payroll & Salary Allocations (AC-035)
  // -------------------------------------------------------------

  /**
   * Record a payroll/salary allocation.
   * STRICTLY ADMIN-ONLY. An OWNER without ADMIN is denied (AC-005, AC-035).
   */
  static async recordPayroll(
    db: D1Database,
    principal: UserPrincipal,
    params: RecordPayrollParams
  ) {
    if (!canViewPayrollAndProfit(principal)) {
      throw new AuthorizationError(
        "Salaries and payroll records are strictly restricted to administrators",
        "FORBIDDEN"
      );
    }

    const payrollId = generateId("pay");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO payroll_records (
          id, org_id, project_id, user_id, period_month,
          gross_salary_minor, currency, status, recorded_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, ?)`
      )
      .bind(
        payrollId,
        principal.orgId,
        params.projectId || null,
        params.userId,
        params.periodMonth,
        params.grossSalaryMinor,
        params.currency || "INR",
        principal.id,
        now
      )
      .run();

    // Balanced journal entry: Debit Salaries Expense, Credit AP/Bank
    await FinanceService.postBalancedJournal(db, {
      orgId: principal.orgId,
      projectId: params.projectId || undefined,
      sourceType: "PAYROLL_POSTED",
      sourceId: payrollId,
      entryDate: `${params.periodMonth}-01`,
      description: `Salary Allocation for ${params.periodMonth}`,
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

    return { payrollId, status: "POSTED" };
  }

  // -------------------------------------------------------------
  // Accounting Periods (AC-037)
  // -------------------------------------------------------------

  static async createAccountingPeriod(
    db: D1Database,
    principal: UserPrincipal,
    params: { periodLabel: string; startDate: string; endDate: string }
  ) {
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can configure accounting periods",
        "FORBIDDEN"
      );
    }

    const periodId = generateId("prd");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO accounting_periods (
          id, org_id, period_label, start_date, end_date,
          is_closed, created_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?)`
      )
      .bind(
        periodId,
        principal.orgId,
        params.periodLabel,
        params.startDate,
        params.endDate,
        now
      )
      .run();

    return { periodId, periodLabel: params.periodLabel, isClosed: false };
  }

  static async closeAccountingPeriod(
    db: D1Database,
    principal: UserPrincipal,
    periodId: string
  ) {
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can close accounting periods",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE accounting_periods
         SET is_closed = 1, closed_by_user_id = ?, closed_at = ?
         WHERE id = ?`
      )
      .bind(principal.id, now, periodId)
      .run();

    return { periodId, isClosed: true };
  }

  // -------------------------------------------------------------
  // Financial Reporting & Statement Generation (AC-035, AC-036, AC-038)
  // -------------------------------------------------------------

  /**
   * Generates a reproducible financial statement for an explicitly named period and basis.
   * If caller is NOT ADMIN, salaries and profit are completely omitted from the query projection (AC-035).
   * Cross-currency summing is strictly rejected (AC-036).
   */
  static async getFinancialReport(
    db: D1Database,
    principal: UserPrincipal,
    params: {
      projectId?: string;
      currency?: string;
      periodStartDate: string; // YYYY-MM-DD
      periodEndDate: string; // YYYY-MM-DD
    }
  ) {
    const currency = params.currency || "INR";

    // Reject cross-currency summing if foreign currency requested (AC-036)
    if (currency !== "INR") {
      throw new Error(`Foreign currency ${currency} cannot be mixed with base INR accounts (AC-036)`);
    }

    const isAuthorizedForSalaryProfit = canViewPayrollAndProfit(principal);

    // 1. Invoiced Amount (Issued invoices)
    let invSql = `SELECT COALESCE(SUM(total_minor), 0) as total FROM invoices WHERE status = 'ISSUED' AND due_date >= ? AND due_date <= ? AND currency = ?`;
    const invParams: any[] = [params.periodStartDate, params.periodEndDate, currency];
    if (params.projectId) {
      invSql += ` AND project_id = ?`;
      invParams.push(params.projectId);
    }
    const invRow = (await db.prepare(invSql).bind(...invParams).first()) as any;
    const invoicedAmountMinor = invRow?.total || 0;

    // 2. Money Received (Confirmed receipts) - distinctly separated from invoiced sales (AC-036)
    let rcpSql = `SELECT COALESCE(SUM(amount_minor), 0) as total FROM receipts WHERE status = 'CONFIRMED' AND received_date >= ? AND received_date <= ? AND currency = ?`;
    const rcpParams: any[] = [params.periodStartDate, params.periodEndDate, currency];
    if (params.projectId) {
      rcpSql += ` AND project_id = ?`;
      rcpParams.push(params.projectId);
    }
    const rcpRow = (await db.prepare(rcpSql).bind(...rcpParams).first()) as any;
    const moneyReceivedMinor = rcpRow?.total || 0;

    // 3. Direct Incurred Expenses (Posted)
    let expSql = `SELECT COALESCE(SUM(amount_minor), 0) as total FROM expenses WHERE status = 'POSTED' AND incurred_date >= ? AND incurred_date <= ? AND currency = ?`;
    const expParams: any[] = [params.periodStartDate, params.periodEndDate, currency];
    if (params.projectId) {
      expSql += ` AND project_id = ?`;
      expParams.push(params.projectId);
    }
    const expRow = (await db.prepare(expSql).bind(...expParams).first()) as any;
    const directExpensesMinor = expRow?.total || 0;

    // 4. Consultant Fees (Posted)
    let cblSql = `SELECT COALESCE(SUM(amount_minor), 0) as total FROM consultant_bills WHERE status = 'POSTED' AND bill_date >= ? AND bill_date <= ? AND currency = ?`;
    const cblParams: any[] = [params.periodStartDate, params.periodEndDate, currency];
    if (params.projectId) {
      cblSql += ` AND project_id = ?`;
      cblParams.push(params.projectId);
    }
    const cblRow = (await db.prepare(cblSql).bind(...cblParams).first()) as any;
    const consultantFeesMinor = cblRow?.total || 0;

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

    // If caller is NOT ADMIN, return without salaries or operating profit (AC-035)
    if (!isAuthorizedForSalaryProfit) {
      return baseReport;
    }

    // 5. Salaries and Payroll (ADMIN ONLY)
    const monthPrefix = params.periodStartDate.slice(0, 7);
    let paySql = `SELECT COALESCE(SUM(gross_salary_minor), 0) as total FROM payroll_records WHERE period_month = ? AND currency = ?`;
    const payParams: any[] = [monthPrefix, currency];
    if (params.projectId) {
      paySql += ` AND project_id = ?`;
      payParams.push(params.projectId);
    }
    const payRow = (await db.prepare(paySql).bind(...payParams).first()) as any;
    const salariesMinor = payRow?.total || 0;

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
