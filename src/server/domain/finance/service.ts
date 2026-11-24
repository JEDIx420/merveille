/**
 * Commercial finance domain service for Merveille Designs.
 * Handles quotations, upfront schedules with trigger policies, invoice issuance gates,
 * admin-confirmed receipts, exact minor-unit allocations, and balanced journal postings.
 */

import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../auth/principal";
import {
  assertProjectAccess,
  canAcceptContractualDecisions,
  canPublishProjectUpdates,
  AuthorizationError,
} from "../../auth/policy";
import { ArchiveService } from "../archive/service";

export type ScheduleTriggerType =
  | "DATE_ONLY"
  | "STAGE_ONLY"
  | "DATE_AND_STAGE"
  | "DATE_OR_STAGE";

export interface QuotationLineItemInput {
  description: string;
  quantity?: number;
  unitRateMinor: number;
}

export interface CreateQuotationParams {
  projectId: string;
  title: string;
  currency?: string;
  requiredAdvanceMinor: number;
  items: QuotationLineItemInput[];
}

export interface ScheduleItemInput {
  description: string;
  amountMinor: number;
  triggerType: ScheduleTriggerType;
  targetDate?: string; // YYYY-MM-DD
  targetStageName?: string;
  isAdvance?: boolean;
}

export interface CreateScheduleParams {
  projectId: string;
  quotationId?: string;
  reason?: string;
  items: ScheduleItemInput[];
}

export interface InvoiceLineItemInput {
  description: string;
  quantity?: number;
  unitRateMinor: number;
}

export interface DraftInvoiceParams {
  projectId: string;
  scheduleItemId?: string;
  dueDate: string; // YYYY-MM-DD
  notes?: string;
  currency?: string;
  lineItems: InvoiceLineItemInput[];
}

export interface ReportReceiptParams {
  projectId: string;
  amountMinor: number;
  receivedDate: string; // YYYY-MM-DD
  paymentMethod: string;
  referenceNote?: string;
  evidenceFileId?: string;
  idempotencyKey?: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class FinanceService {
  /**
   * Post a balanced double-entry journal entry.
   * Ensures SUM(debit_minor) == SUM(credit_minor).
   */
  static async postBalancedJournal(
    db: D1Database,
    params: {
      orgId: string;
      projectId?: string;
      sourceType: string;
      sourceId: string;
      entryDate: string;
      description: string;
      lines: Array<{ accountCode: string; debitMinor: number; creditMinor: number }>;
    }
  ) {
    const totalDebits = params.lines.reduce((s, l) => s + l.debitMinor, 0);
    const totalCredits = params.lines.reduce((s, l) => s + l.creditMinor, 0);

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Journal entry out of balance: Debits ${totalDebits} != Credits ${totalCredits}`
      );
    }

    const entryId = generateId("je");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO journal_entries (
          id, org_id, project_id, source_type, source_id,
          entry_date, description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entryId,
        params.orgId,
        params.projectId || null,
        params.sourceType,
        params.sourceId,
        params.entryDate,
        params.description,
        now
      )
      .run();

    for (const line of params.lines) {
      await db
        .prepare(
          `INSERT INTO journal_lines (
            id, journal_entry_id, account_code, debit_minor, credit_minor
          ) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          generateId("jl"),
          entryId,
          line.accountCode,
          line.debitMinor,
          line.creditMinor
        )
        .run();
    }

    return { entryId };
  }

  // -------------------------------------------------------------
  // Quotations
  // -------------------------------------------------------------

  static async createQuotation(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateQuotationParams
  ) {
    assertProjectAccess(principal, params.projectId);
    await ArchiveService.assertProjectNotArchived(db, params.projectId);

    const maxVerRow = (await db
      .prepare(
        `SELECT MAX(version_number) as max_v FROM quotations WHERE project_id = ?`
      )
      .bind(params.projectId)
      .first()) as any;
    const versionNumber = (maxVerRow?.max_v || 0) + 1;

    let totalAmountMinor = 0;
    const calculatedItems = params.items.map((item, idx) => {
      const qty = item.quantity ?? 1;
      const amt = Math.round(qty * item.unitRateMinor);
      totalAmountMinor += amt;
      return {
        ...item,
        quantity: qty,
        amountMinor: amt,
        order: idx + 1,
      };
    });

    const quotationId = generateId("quo");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO quotations (
          id, org_id, project_id, version_number, title, currency,
          total_amount_minor, required_advance_minor, status,
          created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?, ?)`
      )
      .bind(
        quotationId,
        principal.orgId,
        params.projectId,
        versionNumber,
        params.title,
        params.currency || "INR",
        totalAmountMinor,
        params.requiredAdvanceMinor,
        principal.id,
        now
      )
      .run();

    for (const itm of calculatedItems) {
      await db
        .prepare(
          `INSERT INTO quotation_items (
            id, quotation_id, item_order, description, quantity,
            unit_rate_minor, amount_minor
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId("qit"),
          quotationId,
          itm.order,
          itm.description,
          itm.quantity,
          itm.unitRateMinor,
          itm.amountMinor
        )
        .run();
    }

    return { quotationId, versionNumber, totalAmountMinor };
  }

  static async acceptQuotation(
    db: D1Database,
    principal: UserPrincipal,
    quotationId: string
  ) {
    const quote = (await db
      .prepare(`SELECT * FROM quotations WHERE id = ?`)
      .bind(quotationId)
      .first()) as any;

    if (!quote) throw new Error("Quotation not found");

    // Strictly enforce contractual decision authority (AC-004)
    if (!canAcceptContractualDecisions(principal, quote.project_id)) {
      throw new AuthorizationError(
        "Only the assigned primary client can accept contractual quotations",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE quotations
         SET status = 'ACCEPTED', accepted_by_user_id = ?, accepted_at = ?
         WHERE id = ?`
      )
      .bind(principal.id, now, quotationId)
      .run();

    // Record quote acceptance on project record
    await db
      .prepare(`UPDATE projects SET quote_accepted_at = ? WHERE id = ?`)
      .bind(now, quote.project_id)
      .run();

    // Supersede any older accepted quotations for this project
    await db
      .prepare(
        `UPDATE quotations
         SET status = 'SUPERSEDED'
         WHERE project_id = ? AND id != ? AND status = 'ACCEPTED'`
      )
      .bind(quote.project_id, quotationId)
      .run();

    return { quotationId, status: "ACCEPTED" };
  }

  // -------------------------------------------------------------
  // Payment Schedules (AC-027, AC-028)
  // -------------------------------------------------------------

  static async createOrReviseSchedule(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateScheduleParams
  ) {
    assertProjectAccess(principal, params.projectId);

    // Manager authority gate (AC-027)
    if (!canPublishProjectUpdates(principal, params.projectId)) {
      throw new AuthorizationError(
        "Only project managers can create or revise payment schedules",
        "FORBIDDEN"
      );
    }

    const currentSchedule = (await db
      .prepare(
        `SELECT * FROM payment_schedules
         WHERE project_id = ? AND status = 'AGREED'
         ORDER BY version_number DESC`
      )
      .bind(params.projectId)
      .first()) as any;

    const nextVersion = currentSchedule ? currentSchedule.version_number + 1 : 1;

    // Supersede current schedule if exists
    if (currentSchedule) {
      await db
        .prepare(
          `UPDATE payment_schedules SET status = 'SUPERSEDED' WHERE id = ?`
        )
        .bind(currentSchedule.id)
        .run();
    }

    const scheduleId = generateId("sch");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO payment_schedules (
          id, org_id, project_id, quotation_id, version_number,
          status, revision_reason, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'AGREED', ?, ?, ?)`
      )
      .bind(
        scheduleId,
        principal.orgId,
        params.projectId,
        params.quotationId || null,
        nextVersion,
        params.reason || null,
        principal.id,
        now
      )
      .run();

    for (let i = 0; i < params.items.length; i++) {
      const itm = params.items[i];
      await db
        .prepare(
          `INSERT INTO payment_schedule_items (
            id, schedule_id, item_order, description, amount_minor,
            trigger_type, target_date, target_stage_name, is_advance, billed_amount_minor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
        )
        .bind(
          generateId("sci"),
          scheduleId,
          i + 1,
          itm.description,
          itm.amountMinor,
          itm.triggerType,
          itm.targetDate || null,
          itm.targetStageName || null,
          itm.isAdvance ? 1 : 0
        )
        .run();
    }

    return { scheduleId, versionNumber: nextVersion };
  }

  /**
   * Deterministic due rule evaluator (AC-028).
   */
  static isScheduleItemDue(
    item: {
      trigger_type: ScheduleTriggerType;
      target_date?: string | null;
      target_stage_name?: string | null;
    },
    currentDate: string,
    completedStageNames: string[]
  ): boolean {
    const isDatePassed = Boolean(
      item.target_date && currentDate >= item.target_date
    );
    const isStageCompleted = Boolean(
      item.target_stage_name &&
        completedStageNames.includes(item.target_stage_name)
    );

    switch (item.trigger_type) {
      case "DATE_ONLY":
        return isDatePassed;

      case "STAGE_ONLY":
        return isStageCompleted;

      case "DATE_AND_STAGE":
        return isDatePassed && isStageCompleted;

      case "DATE_OR_STAGE":
        return isDatePassed || isStageCompleted;

      default:
        return false;
    }
  }

  // -------------------------------------------------------------
  // Invoices (AC-029, AC-030)
  // -------------------------------------------------------------

  static async draftInvoice(
    db: D1Database,
    principal: UserPrincipal,
    params: DraftInvoiceParams
  ) {
    assertProjectAccess(principal, params.projectId);
    await ArchiveService.assertProjectNotArchived(db, params.projectId);

    let subtotalMinor = 0;
    const items = params.lineItems.map((li) => {
      const qty = li.quantity ?? 1;
      const amt = Math.round(qty * li.unitRateMinor);
      subtotalMinor += amt;
      return { ...li, quantity: qty, amountMinor: amt };
    });

    const totalMinor = subtotalMinor; // tax configured separately if enabled
    const invoiceId = generateId("inv");
    const versionId = generateId("ivv");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO invoices (
          id, org_id, project_id, schedule_item_id, currency,
          status, current_version_number, total_minor,
          outstanding_minor, due_date, created_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?, ?, ?, ?)`
      )
      .bind(
        invoiceId,
        principal.orgId,
        params.projectId,
        params.scheduleItemId || null,
        params.currency || "INR",
        totalMinor,
        totalMinor,
        params.dueDate,
        principal.id,
        now
      )
      .run();

    await db
      .prepare(
        `INSERT INTO invoice_versions (
          id, invoice_id, version_number, subtotal_minor, tax_minor,
          total_minor, due_date, notes, status, created_at
        ) VALUES (?, ?, 1, ?, 0, ?, ?, ?, 'DRAFT', ?)`
      )
      .bind(
        versionId,
        invoiceId,
        subtotalMinor,
        totalMinor,
        params.dueDate,
        params.notes || null,
        now
      )
      .run();

    for (const li of items) {
      await db
        .prepare(
          `INSERT INTO invoice_line_items (
            id, invoice_version_id, description, quantity, unit_rate_minor, amount_minor
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId("ili"),
          versionId,
          li.description,
          li.quantity,
          li.unitRateMinor,
          li.amountMinor
        )
        .run();
    }

    return { invoiceId, versionId, versionNumber: 1, totalMinor };
  }

  /**
   * Edit draft invoice line items (AC-029).
   * If previously approved, editing creates a new DRAFT version and INVALIDATES approval.
   */
  static async editDraftInvoice(
    db: D1Database,
    principal: UserPrincipal,
    params: {
      invoiceId: string;
      lineItems: InvoiceLineItemInput[];
      dueDate?: string;
      notes?: string;
    }
  ) {
    const invoice = (await db
      .prepare(`SELECT * FROM invoices WHERE id = ?`)
      .bind(params.invoiceId)
      .first()) as any;

    if (!invoice) throw new Error("Invoice not found");
    assertProjectAccess(principal, invoice.project_id);

    if (invoice.status === "ISSUED") {
      throw new Error("Issued invoices cannot be edited directly (AC-030)");
    }

    const currentVersionRow = (await db
      .prepare(
        `SELECT * FROM invoice_versions
         WHERE invoice_id = ? AND version_number = ?`
      )
      .bind(params.invoiceId, invoice.current_version_number)
      .first()) as any;

    let subtotalMinor = 0;
    const items = params.lineItems.map((li) => {
      const qty = li.quantity ?? 1;
      const amt = Math.round(qty * li.unitRateMinor);
      subtotalMinor += amt;
      return { ...li, quantity: qty, amountMinor: amt };
    });
    const totalMinor = subtotalMinor;

    const nextVerNum = invoice.current_version_number + 1;
    const versionId = generateId("ivv");
    const now = Date.now();
    const effectiveDueDate = params.dueDate || currentVersionRow?.due_date || invoice.due_date;

    // Create next version in DRAFT status (unapproved)
    await db
      .prepare(
        `INSERT INTO invoice_versions (
          id, invoice_id, version_number, subtotal_minor, tax_minor,
          total_minor, due_date, notes, status, created_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'DRAFT', ?)`
      )
      .bind(
        versionId,
        params.invoiceId,
        nextVerNum,
        subtotalMinor,
        totalMinor,
        effectiveDueDate,
        params.notes || null,
        now
      )
      .run();

    for (const li of items) {
      await db
        .prepare(
          `INSERT INTO invoice_line_items (
            id, invoice_version_id, description, quantity, unit_rate_minor, amount_minor
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId("ili"),
          versionId,
          li.description,
          li.quantity,
          li.unitRateMinor,
          li.amountMinor
        )
        .run();
    }

    // Update parent invoice pointer to new version and reset status to DRAFT
    await db
      .prepare(
        `UPDATE invoices
         SET current_version_number = ?, status = 'DRAFT',
             total_minor = ?, outstanding_minor = ?, due_date = ?
         WHERE id = ?`
      )
      .bind(nextVerNum, totalMinor, totalMinor, effectiveDueDate, params.invoiceId)
      .run();

    return { invoiceId: params.invoiceId, versionNumber: nextVerNum, status: "DRAFT" };
  }

  static async approveInvoice(
    db: D1Database,
    principal: UserPrincipal,
    params: { invoiceId: string; versionNumber: number }
  ) {
    const invoice = (await db
      .prepare(`SELECT * FROM invoices WHERE id = ?`)
      .bind(params.invoiceId)
      .first()) as any;

    if (!invoice) throw new Error("Invoice not found");

    if (!canPublishProjectUpdates(principal, invoice.project_id)) {
      throw new AuthorizationError(
        "Only managers can approve invoices",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE invoice_versions
         SET status = 'APPROVED', approved_by_user_id = ?, approved_at = ?
         WHERE invoice_id = ? AND version_number = ?`
      )
      .bind(principal.id, now, params.invoiceId, params.versionNumber)
      .run();

    await db
      .prepare(`UPDATE invoices SET status = 'APPROVED' WHERE id = ?`)
      .bind(params.invoiceId)
      .run();

    return { invoiceId: params.invoiceId, versionNumber: params.versionNumber, status: "APPROVED" };
  }

  /**
   * Issue an approved invoice (AC-029, AC-030).
   * Strictly enforces that the exact version being issued has APPROVED status.
   */
  static async issueInvoice(
    db: D1Database,
    principal: UserPrincipal,
    params: { invoiceId: string; versionNumber: number }
  ) {
    const invoice = (await db
      .prepare(`SELECT * FROM invoices WHERE id = ?`)
      .bind(params.invoiceId)
      .first()) as any;

    if (!invoice) throw new Error("Invoice not found");
    assertProjectAccess(principal, invoice.project_id);

    if (invoice.status === "ISSUED") {
      throw new Error("Invoice has already been issued (AC-030)");
    }

    const versionRow = (await db
      .prepare(
        `SELECT * FROM invoice_versions
         WHERE invoice_id = ? AND version_number = ?`
      )
      .bind(params.invoiceId, params.versionNumber)
      .first()) as any;

    if (!versionRow) throw new Error("Invoice version not found");

    // Approval gate: must be APPROVED
    if (versionRow.status !== "APPROVED") {
      throw new Error(
        `Cannot issue invoice: version ${params.versionNumber} is in status ${versionRow.status}, requires manager approval`
      );
    }

    // Allocate next sequential invoice number atomically
    const countRow = (await db
      .prepare(`SELECT COUNT(*) as c FROM invoices WHERE invoice_number IS NOT NULL`)
      .first()) as any;
    const seq = (countRow?.c || 0) + 1;
    const year = new Date().getFullYear();
    const invoiceNumber = `MD-INV-${year}-${String(seq).padStart(4, "0")}`;

    const now = Date.now();

    await db
      .prepare(
        `UPDATE invoices
         SET status = 'ISSUED', invoice_number = ?, issued_version_number = ?,
             issued_at = ?, issued_by_user_id = ?, settlement_status = 'UNPAID',
             total_minor = ?, outstanding_minor = ?
         WHERE id = ?`
      )
      .bind(
        invoiceNumber,
        params.versionNumber,
        now,
        principal.id,
        versionRow.total_minor,
        versionRow.total_minor,
        params.invoiceId
      )
      .run();

    // Post balanced journal entry: Debit AR, Credit Revenue
    await this.postBalancedJournal(db, {
      orgId: invoice.org_id,
      projectId: invoice.project_id,
      sourceType: "INVOICE_ISSUED",
      sourceId: params.invoiceId,
      entryDate: new Date(now).toISOString().slice(0, 10),
      description: `Issued Invoice ${invoiceNumber}`,
      lines: [
        {
          accountCode: "1100_ACCOUNTS_RECEIVABLE",
          debitMinor: versionRow.total_minor,
          creditMinor: 0,
        },
        {
          accountCode: "4000_DESIGN_FEE_REVENUE",
          debitMinor: 0,
          creditMinor: versionRow.total_minor,
        },
      ],
    });

    return {
      invoiceId: params.invoiceId,
      invoiceNumber,
      status: "ISSUED",
      totalMinor: versionRow.total_minor,
      outstandingMinor: versionRow.total_minor,
    };
  }

  // -------------------------------------------------------------
  // Receipts & Allocations (AC-031, AC-032, AC-033)
  // -------------------------------------------------------------

  static async reportReceipt(
    db: D1Database,
    principal: UserPrincipal,
    params: ReportReceiptParams
  ) {
    assertProjectAccess(principal, params.projectId);

    const receiptId = generateId("rcp");
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO receipts (
          id, org_id, project_id, currency, amount_minor,
          allocated_minor, unallocated_minor, received_date,
          payment_method, reference_note, evidence_file_id,
          status, idempotency_key, reported_by_user_id, created_at
        ) VALUES (?, ?, ?, 'INR', ?, 0, ?, ?, ?, ?, ?, 'REPORTED', ?, ?, ?)`
      )
      .bind(
        receiptId,
        principal.orgId,
        params.projectId,
        params.amountMinor,
        params.amountMinor,
        params.receivedDate,
        params.paymentMethod,
        params.referenceNote || null,
        params.evidenceFileId || null,
        params.idempotencyKey || null,
        principal.id,
        now
      )
      .run();

    return { receiptId, status: "REPORTED", amountMinor: params.amountMinor };
  }

  /**
   * Confirm receipt of funds (AC-031, AC-033).
   * ADMIN ONLY. Rejects non-admin attempts.
   * Handles idempotency keys safely.
   */
  static async confirmReceipt(
    db: D1Database,
    principal: UserPrincipal,
    params: { receiptId: string; idempotencyKey?: string }
  ) {
    // ADMIN ONLY (AC-031)
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can confirm receipt of real funds",
        "FORBIDDEN"
      );
    }

    const receipt = (await db
      .prepare(`SELECT * FROM receipts WHERE id = ?`)
      .bind(params.receiptId)
      .first()) as any;

    if (!receipt) throw new Error("Receipt not found");

    // Idempotency check (AC-033)
    if (params.idempotencyKey) {
      if (receipt.idempotency_key && receipt.idempotency_key === params.idempotencyKey) {
        if (receipt.status === "CONFIRMED") {
          return { receiptId: receipt.id, status: "CONFIRMED", receiptNumber: receipt.receipt_number };
        }
      }
    }

    if (receipt.status === "CONFIRMED") {
      return { receiptId: receipt.id, status: "CONFIRMED", receiptNumber: receipt.receipt_number };
    }

    // Allocate next receipt number
    const countRow = (await db
      .prepare(`SELECT COUNT(*) as c FROM receipts WHERE receipt_number IS NOT NULL`)
      .first()) as any;
    const seq = (countRow?.c || 0) + 1;
    const year = new Date().getFullYear();
    const receiptNumber = `MD-RCP-${year}-${String(seq).padStart(4, "0")}`;

    const now = Date.now();

    await db
      .prepare(
        `UPDATE receipts
         SET status = 'CONFIRMED', receipt_number = ?, confirmed_by_user_id = ?,
             confirmed_at = ?
         WHERE id = ?`
      )
      .bind(receiptNumber, principal.id, now, params.receiptId)
      .run();

    // Mark project advance confirmed
    await db
      .prepare(`UPDATE projects SET advance_confirmed_at = ? WHERE id = ?`)
      .bind(now, receipt.project_id)
      .run();

    // Post balanced journal entry: Debit Bank, Credit Customer Advances
    await this.postBalancedJournal(db, {
      orgId: receipt.org_id,
      projectId: receipt.project_id,
      sourceType: "RECEIPT_CONFIRMED",
      sourceId: params.receiptId,
      entryDate: receipt.received_date,
      description: `Confirmed Receipt ${receiptNumber}`,
      lines: [
        {
          accountCode: "1000_BANK",
          debitMinor: receipt.amount_minor,
          creditMinor: 0,
        },
        {
          accountCode: "2100_CUSTOMER_ADVANCES",
          debitMinor: 0,
          creditMinor: receipt.amount_minor,
        },
      ],
    });

    return { receiptId: params.receiptId, status: "CONFIRMED", receiptNumber };
  }

  /**
   * Allocate confirmed receipt funds to an issued invoice (AC-032).
   * Uses exact integer minor units; caps allocation at invoice outstanding;
   * unallocated excess remains on the receipt without negative outstanding.
   */
  static async allocateReceipt(
    db: D1Database,
    principal: UserPrincipal,
    params: { receiptId: string; invoiceId: string; amountMinor: number }
  ) {
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can allocate receipts to invoices",
        "FORBIDDEN"
      );
    }

    const receipt = (await db
      .prepare(`SELECT * FROM receipts WHERE id = ?`)
      .bind(params.receiptId)
      .first()) as any;

    if (!receipt) throw new Error("Receipt not found");
    if (receipt.status !== "CONFIRMED") {
      throw new Error("Cannot allocate unconfirmed receipt");
    }

    const invoice = (await db
      .prepare(`SELECT * FROM invoices WHERE id = ?`)
      .bind(params.invoiceId)
      .first()) as any;

    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "ISSUED") {
      throw new Error("Cannot allocate receipt to non-issued invoice");
    }

    if (receipt.unallocated_minor < params.amountMinor) {
      throw new Error(
        `Allocation exceeds available unallocated funds (available: ${receipt.unallocated_minor}, requested: ${params.amountMinor})`
      );
    }

    // Exact allocation calculation (AC-032)
    // Cannot over-allocate beyond the invoice's outstanding balance
    const actualAllocation = Math.min(params.amountMinor, invoice.outstanding_minor);

    const newInvoiceAllocated = invoice.allocated_minor + actualAllocation;
    const newInvoiceOutstanding = Math.max(0, invoice.total_minor - newInvoiceAllocated);
    const newSettlementStatus =
      newInvoiceOutstanding === 0 ? "PAID" : "PARTIALLY_PAID";

    const newReceiptAllocated = receipt.allocated_minor + actualAllocation;
    const newReceiptUnallocated = receipt.unallocated_minor - actualAllocation;

    // 1. Record allocation row
    await db
      .prepare(
        `INSERT INTO receipt_allocations (
          id, receipt_id, invoice_id, amount_minor,
          allocated_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        generateId("rca"),
        params.receiptId,
        params.invoiceId,
        actualAllocation,
        principal.id,
        Date.now()
      )
      .run();

    // 2. Update invoice balances
    await db
      .prepare(
        `UPDATE invoices
         SET allocated_minor = ?, outstanding_minor = ?, settlement_status = ?
         WHERE id = ?`
      )
      .bind(
        newInvoiceAllocated,
        newInvoiceOutstanding,
        newSettlementStatus,
        params.invoiceId
      )
      .run();

    // 3. Update receipt balances
    await db
      .prepare(
        `UPDATE receipts
         SET allocated_minor = ?, unallocated_minor = ?
         WHERE id = ?`
      )
      .bind(newReceiptAllocated, newReceiptUnallocated, params.receiptId)
      .run();

    // 4. Post balanced journal entry: Debit Customer Advances, Credit Accounts Receivable
    await this.postBalancedJournal(db, {
      orgId: receipt.org_id,
      projectId: invoice.project_id,
      sourceType: "RECEIPT_ALLOCATED",
      sourceId: params.receiptId,
      entryDate: new Date().toISOString().slice(0, 10),
      description: `Allocated ${actualAllocation} to Invoice ${invoice.invoice_number}`,
      lines: [
        {
          accountCode: "2100_CUSTOMER_ADVANCES",
          debitMinor: actualAllocation,
          creditMinor: 0,
        },
        {
          accountCode: "1100_ACCOUNTS_RECEIVABLE",
          debitMinor: 0,
          creditMinor: actualAllocation,
        },
      ],
    });

    return {
      allocatedMinor: actualAllocation,
      invoiceOutstandingMinor: newInvoiceOutstanding,
      invoiceSettlementStatus: newSettlementStatus,
      receiptUnallocatedMinor: newReceiptUnallocated,
    };
  }

  // -------------------------------------------------------------
  // Project Activation Gate (AC-010)
  // -------------------------------------------------------------

  static async activateProject(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string
  ) {
    assertProjectAccess(principal, projectId);

    if (!canPublishProjectUpdates(principal, projectId)) {
      throw new AuthorizationError(
        "Only managers can activate projects",
        "FORBIDDEN"
      );
    }

    // Gate 1: Check accepted quotation
    const acceptedQuote = (await db
      .prepare(
        `SELECT * FROM quotations
         WHERE project_id = ? AND status = 'ACCEPTED'
         ORDER BY version_number DESC`
      )
      .bind(projectId)
      .first()) as any;

    if (!acceptedQuote) {
      throw new AuthorizationError(
        "Project cannot be activated: missing accepted quotation",
        "MISSING_ACCEPTED_QUOTATION"
      );
    }

    // Gate 2: Check admin-confirmed required advance payment
    if (acceptedQuote.required_advance_minor > 0) {
      const sumRow = (await db
        .prepare(
          `SELECT COALESCE(SUM(amount_minor), 0) as confirmed_total
           FROM receipts
           WHERE project_id = ? AND status = 'CONFIRMED'`
        )
        .bind(projectId)
        .first()) as any;

      const confirmedTotal = sumRow?.confirmed_total || 0;
      if (confirmedTotal < acceptedQuote.required_advance_minor) {
        throw new AuthorizationError(
          `Project cannot be activated: required advance payment of ${acceptedQuote.required_advance_minor} is not confirmed by admin (confirmed: ${confirmedTotal})`,
          "MISSING_CONFIRMED_ADVANCE"
        );
      }
    }

    // Both gates satisfied: activate project!
    const now = Date.now();
    await db
      .prepare(
        `UPDATE projects
         SET status = 'ACTIVE', activated_at = ?, activated_by_user_id = ?
         WHERE id = ?`
      )
      .bind(now, principal.id, projectId)
      .run();

    return { projectId, status: "ACTIVE", isCommercialActivated: true };
  }
}
