/** Authoritative commercial commands. D1 batches commit guards, snapshots, ledger and audit together. */
import { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import {
  UserPrincipal,
  hasCapability,
  projectGrant,
} from "../../auth/principal";
import {
  assertProjectAccess,
  assertFinanceAuthor,
  canAcceptContractualDecisions,
  canPublishProjectUpdates,
  canViewFinancials,
  AuthorizationError,
} from "../../auth/policy";
import { atomicGuard } from "../../db/atomic";
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
  settlementInvoiceId?: string;
}

function generateId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
export function money(value: number, zero = false): number {
  if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1))
    throw new AuthorizationError(
      "Amount must be a positive safe integer in minor units.",
      "INVALID_INPUT",
    );
  return value;
}
function currency(value = "INR") {
  if (!/^[A-Z]{3}$/.test(value))
    throw new AuthorizationError("Invalid currency.", "INVALID_INPUT");
  return value;
}
function date(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new AuthorizationError("A valid date is required.", "INVALID_INPUT");
  return value;
}
function lines(items: InvoiceLineItemInput[]) {
  if (!Array.isArray(items) || !items.length)
    throw new AuthorizationError(
      "At least one line item is required.",
      "INVALID_INPUT",
    );
  const result = items.map((item) => {
    const qty = item.quantity ?? 1;
    if (!Number.isFinite(qty) || qty <= 0 || !item.description?.trim())
      throw new AuthorizationError("Invalid line item.", "INVALID_INPUT");
    money(item.unitRateMinor);
    const amountMinor = money(Math.round(qty * item.unitRateMinor));
    return { ...item, quantity: qty, amountMinor };
  });
  money(result.reduce((s, i) => s + i.amountMinor, 0));
  return result;
}
async function row(db: D1Database, table: string, id: string, org: string) {
  const item = await db
    .prepare(`SELECT * FROM ${table} WHERE id=? AND org_id=?`)
    .bind(id, org)
    .first<any>();
  if (!item) throw new AuthorizationError("Record not found.", "NOT_FOUND");
  return item;
}
async function project(
  db: D1Database,
  p: UserPrincipal,
  id: string,
  mutable = true,
) {
  assertProjectAccess(p, id);
  const item = await row(db, "projects", id, p.orgId);
  if (mutable) await ArchiveService.assertProjectNotArchived(db, id);
  return item;
}
function audit(
  db: D1Database,
  p: UserPrincipal,
  type: string,
  id: string,
  action: string,
  value: unknown,
) {
  return db
    .prepare(
      `INSERT INTO audit_events (id,org_id,actor_id,entity_type,entity_id,action,new_state,created_at) VALUES (?,?,?,?,?,?,?,?)`,
    )
    .bind(
      generateId("aud"),
      p.orgId,
      p.id,
      type,
      id,
      action,
      JSON.stringify(value),
      Date.now(),
    );
}
function activeGuard(db: D1Database, p: UserPrincipal) {
  return atomicGuard(
    db,
    `EXISTS(SELECT 1 FROM users u JOIN organization_memberships om ON om.user_id=u.id WHERE u.id=? AND u.status='ACTIVE' AND om.org_id=? AND om.is_active=1)`,
    [p.id, p.orgId],
  );
}
async function commit(db: D1Database, statements: D1PreparedStatement[]) {
  try {
    await db.batch([...statements, db.prepare("DELETE FROM financial_guard")]);
  } catch (e) {
    throw new AuthorizationError(
      "The record changed or could not be saved. Reload and retry.",
      "CONFLICT",
    );
  }
}
function journal(
  db: D1Database,
  params: {
    orgId: string;
    projectId?: string;
    sourceType: string;
    sourceId: string;
    entryDate: string;
    description: string;
    lines: Array<{
      accountCode: string;
      debitMinor: number;
      creditMinor: number;
    }>;
  },
) {
  const debit = params.lines.reduce((s, l) => s + money(l.debitMinor, true), 0),
    credit = params.lines.reduce((s, l) => s + money(l.creditMinor, true), 0);
  if (!Number.isSafeInteger(debit) || debit !== credit || debit <= 0)
    throw new AuthorizationError(
      "Journal entry out of balance.",
      "INVALID_INPUT",
    );
  const id = generateId("je");
  return {
    id,
    statements: [
      db
        .prepare(
          `INSERT INTO journal_entries (id,org_id,project_id,source_type,source_id,entry_date,description,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          params.orgId,
          params.projectId ?? null,
          params.sourceType,
          params.sourceId,
          date(params.entryDate),
          params.description,
          Date.now(),
        ),
      ...params.lines.map((l) =>
        db
          .prepare(
            `INSERT INTO journal_lines(id,journal_entry_id,account_code,debit_minor,credit_minor) VALUES (?,?,?,?,?)`,
          )
          .bind(
            generateId("jl"),
            id,
            l.accountCode,
            l.debitMinor,
            l.creditMinor,
          ),
      ),
    ],
  };
}
function doubleJournal(
  db: D1Database,
  p: UserPrincipal,
  projectId: string,
  sourceType: string,
  sourceId: string,
  amount: number,
  debit: string,
  credit: string,
  entryDate: string,
) {
  return journal(db, {
    orgId: p.orgId,
    projectId,
    sourceType,
    sourceId,
    entryDate,
    description: sourceType,
    lines: [
      { accountCode: debit, debitMinor: amount, creditMinor: 0 },
      { accountCode: credit, debitMinor: 0, creditMinor: amount },
    ],
  }).statements;
}
async function replay(
  db: D1Database,
  p: UserPrincipal,
  key: string,
  input: unknown,
) {
  const fingerprint = JSON.stringify(input);
  const existing = await db
    .prepare(
      "SELECT * FROM finance_operations WHERE org_id=? AND operation_key=?",
    )
    .bind(p.orgId, key)
    .first<any>();
  if (existing && existing.fingerprint !== fingerprint)
    throw new AuthorizationError(
      "This operation key was already used for different input.",
      "IDEMPOTENCY_CONFLICT",
    );
  return existing ? JSON.parse(existing.result_json) : null;
}
function operation(
  db: D1Database,
  p: UserPrincipal,
  key: string,
  input: unknown,
  result: unknown,
) {
  return db
    .prepare(
      "INSERT INTO finance_operations(org_id,operation_key,fingerprint,result_json,created_at) VALUES (?,?,?,?,?)",
    )
    .bind(
      p.orgId,
      key,
      JSON.stringify(input),
      JSON.stringify(result),
      Date.now(),
    );
}
function sequence(
  db: D1Database,
  p: UserPrincipal,
  kind: "INV" | "RCP",
  year: number,
) {
  const table = kind === "INV" ? "invoices" : "receipts",
    field = kind === "INV" ? "invoice_number" : "receipt_number",
    prefix = `MD-${kind}-${year}-`;
  return db
    .prepare(
      `INSERT INTO finance_sequences(org_id,kind,year,value) VALUES (?,?,?,COALESCE((SELECT MAX(CAST(substr(${field},?) AS INTEGER)) FROM ${table} WHERE org_id=? AND ${field} LIKE ?),0)+1) ON CONFLICT(org_id,kind,year) DO UPDATE SET value=value+1`,
    )
    .bind(p.orgId, kind, year, prefix.length + 1, p.orgId, prefix + "%");
}
export class FinanceService {
  static journalStatements = journal;
  static commit = commit;
  static audit = audit;
  static activeGuard = activeGuard;
  static async postBalancedJournal(
    db: D1Database,
    params: Parameters<typeof journal>[1],
  ) {
    const entry = journal(db, params);
    await commit(db, entry.statements);
    return { entryId: entry.id };
  }
  static async createQuotation(
    db: D1Database,
    p: UserPrincipal,
    params: CreateQuotationParams,
  ) {
    await project(db, p, params.projectId);
    assertFinanceAuthor(p, params.projectId);
    if (typeof params.title !== "string" || !params.title.trim())
      throw new AuthorizationError(
        "A quotation title is required.",
        "INVALID_INPUT",
      );
    money(params.requiredAdvanceMinor);
    const items = lines(params.items);
    const total = items.reduce((s, i) => s + i.amountMinor, 0);
    if (params.requiredAdvanceMinor > total)
      throw new AuthorizationError(
        "Advance exceeds quotation.",
        "INVALID_INPUT",
      );
    const previous = await db
      .prepare(
        "SELECT COALESCE(MAX(version_number),0) AS n FROM quotations WHERE project_id=?",
      )
      .bind(params.projectId)
      .first<any>();
    const versionNumber = previous.n + 1,
      id = generateId("quo"),
      now = Date.now();
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "(SELECT COALESCE(MAX(version_number),0) FROM quotations WHERE project_id=?)=?",
        [params.projectId, previous.n],
      ),
      db
        .prepare(
          `INSERT INTO quotations(id,org_id,project_id,version_number,title,currency,total_amount_minor,required_advance_minor,status,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,?,?,'SENT',?,?)`,
        )
        .bind(
          id,
          p.orgId,
          params.projectId,
          versionNumber,
          params.title,
          currency(params.currency),
          total,
          params.requiredAdvanceMinor,
          p.id,
          now,
        ),
      ...items.map((i, n) =>
        db
          .prepare(
            "INSERT INTO quotation_items(id,quotation_id,item_order,description,quantity,unit_rate_minor,amount_minor) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            generateId("qi"),
            id,
            n + 1,
            i.description,
            i.quantity,
            i.unitRateMinor,
            i.amountMinor,
          ),
      ),
      audit(db, p, "QUOTATION", id, "QUOTATION_CREATED", { versionNumber }),
    ]);
    return { quotationId: id, versionNumber, totalAmountMinor: total };
  }
  static async acceptQuotation(db: D1Database, p: UserPrincipal, id: string) {
    const q = await row(db, "quotations", id, p.orgId);
    const prj = await project(db, p, q.project_id);
    if (
      !canAcceptContractualDecisions(p, q.project_id) ||
      prj.main_client_user_id !== p.id
    )
      throw new AuthorizationError(
        "Only the assigned primary client can accept contractual quotations",
      );
    if (q.status === "ACCEPTED") return { quotationId: id, status: "ACCEPTED" };
    const now = Date.now();
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        `EXISTS(SELECT 1 FROM quotations q JOIN projects p ON p.id=q.project_id WHERE q.id=? AND q.status='SENT' AND q.revision=? AND p.main_client_user_id=? AND p.is_archived=0)`,
        [id, q.revision, p.id],
      ),
      db
        .prepare(
          "UPDATE quotations SET status='SUPERSEDED' WHERE project_id=? AND status='ACCEPTED'",
        )
        .bind(q.project_id),
      db
        .prepare(
          "UPDATE quotations SET status='ACCEPTED',accepted_by_user_id=?,accepted_at=?,revision=revision+1 WHERE id=?",
        )
        .bind(p.id, now, id),
      db
        .prepare("UPDATE projects SET quote_accepted_at=? WHERE id=?")
        .bind(now, q.project_id),
      audit(db, p, "QUOTATION", id, "QUOTATION_ACCEPTED", {
        version: q.version_number,
      }),
    ]);
    return { quotationId: id, status: "ACCEPTED" };
  }
  static async createOrReviseSchedule(
    db: D1Database,
    p: UserPrincipal,
    params: CreateScheduleParams,
  ) {
    await project(db, p, params.projectId);
    if (!canPublishProjectUpdates(p, params.projectId))
      throw new AuthorizationError(
        "Only project managers can create or revise payment schedules",
      );
    if (!Array.isArray(params.items) || !params.items.length)
      throw new AuthorizationError(
        "Schedule items are required.",
        "INVALID_INPUT",
      );
    for (const i of params.items) {
      money(i.amountMinor);
      if (
        ![
          "DATE_ONLY",
          "STAGE_ONLY",
          "DATE_AND_STAGE",
          "DATE_OR_STAGE",
        ].includes(i.triggerType)
      )
        throw new AuthorizationError("Invalid trigger.", "INVALID_INPUT");
      if (i.triggerType !== "STAGE_ONLY") date(i.targetDate!);
      if (i.triggerType !== "DATE_ONLY" && !i.targetStageName?.trim())
        throw new AuthorizationError("Stage required.", "INVALID_INPUT");
    }
    if (params.quotationId) {
      const q = await row(db, "quotations", params.quotationId, p.orgId);
      if (q.project_id !== params.projectId)
        throw new AuthorizationError("Quotation belongs to another project");
    }
    const current = await db
      .prepare(
        "SELECT COALESCE(MAX(version_number),0) n FROM payment_schedules WHERE project_id=?",
      )
      .bind(params.projectId)
      .first<any>();
    if (current.n && !params.reason?.trim())
      throw new AuthorizationError(
        "A revision reason is required.",
        "INVALID_INPUT",
      );
    const id = generateId("sch"),
      versionNumber = current.n + 1;
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "(SELECT COALESCE(MAX(version_number),0) FROM payment_schedules WHERE project_id=?)=?",
        [params.projectId, current.n],
      ),
      db
        .prepare(
          "UPDATE payment_schedules SET status='SUPERSEDED' WHERE project_id=? AND status='AGREED'",
        )
        .bind(params.projectId),
      db
        .prepare(
          "INSERT INTO payment_schedules(id,org_id,project_id,quotation_id,version_number,status,revision_reason,created_by_user_id,created_at) VALUES (?,?,?,?,?,'AGREED',?,?,?)",
        )
        .bind(
          id,
          p.orgId,
          params.projectId,
          params.quotationId ?? null,
          versionNumber,
          params.reason ?? null,
          p.id,
          Date.now(),
        ),
      ...params.items.map((i, n) =>
        db
          .prepare(
            "INSERT INTO payment_schedule_items(id,schedule_id,item_order,description,amount_minor,trigger_type,target_date,target_stage_name,is_advance) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            generateId("si"),
            id,
            n + 1,
            i.description,
            i.amountMinor,
            i.triggerType,
            i.targetDate ?? null,
            i.targetStageName ?? null,
            i.isAdvance ? 1 : 0,
          ),
      ),
      audit(db, p, "SCHEDULE", id, "SCHEDULE_REVISED", {
        versionNumber,
        reason: params.reason,
      }),
    ]);
    return { scheduleId: id, versionNumber };
  }
  static isScheduleItemDue(
    item: {
      trigger_type: ScheduleTriggerType;
      target_date?: string | null;
      target_stage_name?: string | null;
    },
    currentDate: string,
    completedStageNames: string[],
  ): boolean {
    const isDatePassed = Boolean(
      item.target_date && currentDate >= item.target_date,
    );
    const isStageCompleted = Boolean(
      item.target_stage_name &&
        completedStageNames.includes(item.target_stage_name),
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

  static async draftInvoice(
    db: D1Database,
    p: UserPrincipal,
    params: DraftInvoiceParams,
  ) {
    await project(db, p, params.projectId);
    assertFinanceAuthor(p, params.projectId);
    date(params.dueDate);
    currency(params.currency);
    const items = lines(params.lineItems),
      total = items.reduce((s, i) => s + i.amountMinor, 0),
      id = generateId("inv"),
      vid = generateId("iv"),
      now = Date.now();
    if (params.scheduleItemId) {
      const si = await db
        .prepare(
          "SELECT ps.project_id FROM payment_schedule_items si JOIN payment_schedules ps ON ps.id=si.schedule_id WHERE si.id=? AND ps.org_id=?",
        )
        .bind(params.scheduleItemId, p.orgId)
        .first<any>();
      if (si?.project_id !== params.projectId)
        throw new AuthorizationError(
          "Schedule item belongs to another project",
        );
    }
    await commit(db, [
      activeGuard(db, p),
      db
        .prepare(
          "INSERT INTO invoices(id,org_id,project_id,schedule_item_id,currency,status,current_version_number,total_minor,outstanding_minor,due_date,created_by_user_id,created_at) VALUES (?,?,?,?,?,'DRAFT',1,?,?,?,?,?)",
        )
        .bind(
          id,
          p.orgId,
          params.projectId,
          params.scheduleItemId ?? null,
          params.currency ?? "INR",
          total,
          total,
          params.dueDate,
          p.id,
          now,
        ),
      db
        .prepare(
          "INSERT INTO invoice_versions(id,invoice_id,version_number,subtotal_minor,tax_minor,total_minor,due_date,notes,status,created_at) VALUES (?,?,1,?,0,?,?,?,'DRAFT',?)",
        )
        .bind(vid, id, total, total, params.dueDate, params.notes ?? null, now),
      ...items.map((i) =>
        db
          .prepare(
            "INSERT INTO invoice_line_items(id,invoice_version_id,description,quantity,unit_rate_minor,amount_minor) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            generateId("il"),
            vid,
            i.description,
            i.quantity,
            i.unitRateMinor,
            i.amountMinor,
          ),
      ),
      audit(db, p, "INVOICE", id, "INVOICE_DRAFTED", { versionNumber: 1 }),
    ]);
    return {
      invoiceId: id,
      versionId: vid,
      versionNumber: 1,
      totalMinor: total,
    };
  }
  static async editDraftInvoice(
    db: D1Database,
    p: UserPrincipal,
    params: {
      invoiceId: string;
      lineItems: InvoiceLineItemInput[];
      dueDate?: string;
      notes?: string;
      expectedVersion?: number;
    },
  ) {
    const inv = await row(db, "invoices", params.invoiceId, p.orgId);
    await project(db, p, inv.project_id);
    assertFinanceAuthor(p, inv.project_id);
    if (!["DRAFT", "IN_REVIEW", "APPROVED"].includes(inv.status))
      throw new AuthorizationError(
        "Issued invoices cannot be edited directly.",
        "CONFLICT",
      );
    if (
      params.expectedVersion !== undefined &&
      params.expectedVersion !== inv.current_version_number
    )
      throw new AuthorizationError("Invoice version changed.", "CONFLICT");
    const items = lines(params.lineItems),
      total = items.reduce((s, i) => s + i.amountMinor, 0),
      versionNumber = inv.current_version_number + 1,
      vid = generateId("iv"),
      due = date(params.dueDate ?? inv.due_date);
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM invoices WHERE id=? AND org_id=? AND current_version_number=? AND status IN ('DRAFT','IN_REVIEW','APPROVED'))",
        [inv.id, p.orgId, inv.current_version_number],
      ),
      db
        .prepare(
          "INSERT INTO invoice_versions(id,invoice_id,version_number,subtotal_minor,tax_minor,total_minor,due_date,notes,status,created_at) VALUES (?,?,?,?,0,?,?,?,'DRAFT',?)",
        )
        .bind(
          vid,
          inv.id,
          versionNumber,
          total,
          total,
          due,
          params.notes ?? null,
          Date.now(),
        ),
      ...items.map((i) =>
        db
          .prepare(
            "INSERT INTO invoice_line_items(id,invoice_version_id,description,quantity,unit_rate_minor,amount_minor) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            generateId("il"),
            vid,
            i.description,
            i.quantity,
            i.unitRateMinor,
            i.amountMinor,
          ),
      ),
      db
        .prepare(
          "UPDATE invoices SET status='DRAFT',current_version_number=?,total_minor=?,outstanding_minor=?,due_date=? WHERE id=?",
        )
        .bind(versionNumber, total, total, due, inv.id),
      audit(db, p, "INVOICE", inv.id, "INVOICE_REVISED", { versionNumber }),
    ]);
    return { invoiceId: inv.id, versionNumber, status: "DRAFT" };
  }
  static async approveInvoice(
    db: D1Database,
    p: UserPrincipal,
    params: { invoiceId: string; versionNumber: number },
  ) {
    const inv = await row(db, "invoices", params.invoiceId, p.orgId);
    await project(db, p, inv.project_id);
    if (!canPublishProjectUpdates(p, inv.project_id))
      throw new AuthorizationError("Only managers can approve invoices");
    if (
      inv.status === "APPROVED" &&
      inv.current_version_number === params.versionNumber
    )
      return {
        invoiceId: inv.id,
        versionNumber: params.versionNumber,
        status: "APPROVED",
      };
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM invoices WHERE id=? AND current_version_number=? AND status IN ('DRAFT','IN_REVIEW'))",
        [inv.id, params.versionNumber],
      ),
      db
        .prepare(
          "UPDATE invoice_versions SET status='APPROVED',approved_by_user_id=?,approved_at=? WHERE invoice_id=? AND version_number=?",
        )
        .bind(p.id, Date.now(), inv.id, params.versionNumber),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM invoice_versions WHERE invoice_id=? AND version_number=? AND status='APPROVED')",
        [inv.id, params.versionNumber],
      ),
      db
        .prepare("UPDATE invoices SET status='APPROVED' WHERE id=?")
        .bind(inv.id),
      audit(db, p, "INVOICE", inv.id, "INVOICE_APPROVED", {
        versionNumber: params.versionNumber,
      }),
    ]);
    return {
      invoiceId: inv.id,
      versionNumber: params.versionNumber,
      status: "APPROVED",
    };
  }
  static async issueInvoice(
    db: D1Database,
    p: UserPrincipal,
    params: {
      invoiceId: string;
      versionNumber: number;
      idempotencyKey?: string;
    },
  ) {
    const inv = await row(db, "invoices", params.invoiceId, p.orgId);
    await project(db, p, inv.project_id);
    assertFinanceAuthor(p, inv.project_id, true);
    const key = `issue:${params.idempotencyKey ?? `${inv.id}:${params.versionNumber}`}`,
      input = { invoiceId: inv.id, versionNumber: params.versionNumber };
    const previous = await replay(db, p, key, input);
    if (previous) {
      const saved = await row(db, "invoices", inv.id, p.orgId);
      return { ...previous, invoiceNumber: saved.invoice_number };
    }
    const version = await db
      .prepare(
        "SELECT * FROM invoice_versions WHERE invoice_id=? AND version_number=?",
      )
      .bind(inv.id, params.versionNumber)
      .first<any>();
    if (
      inv.status === "ISSUED" &&
      inv.issued_version_number === params.versionNumber
    ) {
      const entry = await db
        .prepare(
          "SELECT id FROM journal_entries WHERE org_id=? AND source_type='INVOICE_ISSUED' AND source_id=?",
        )
        .bind(p.orgId, inv.id)
        .first();
      if (entry)
        return {
          invoiceId: inv.id,
          status: "ISSUED",
          invoiceNumber: inv.invoice_number,
          totalMinor: inv.total_minor,
          outstandingMinor: inv.outstanding_minor,
        };
    }
    if (
      inv.status !== "APPROVED" ||
      inv.current_version_number !== params.versionNumber ||
      version?.status !== "APPROVED"
    )
      throw new AuthorizationError(
        "Only the current approved invoice version can be issued.",
        "CONFLICT",
      );
    money(version.total_minor);
    const year = new Date().getUTCFullYear(),
      now = Date.now();
    const result = {
      invoiceId: inv.id,
      status: "ISSUED",
      totalMinor: version.total_minor,
      outstandingMinor: version.total_minor,
    };
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM invoices i JOIN invoice_versions v ON v.invoice_id=i.id AND v.version_number=i.current_version_number WHERE i.id=? AND i.current_version_number=? AND i.status='APPROVED' AND v.status='APPROVED')",
        [inv.id, params.versionNumber],
      ),
      sequence(db, p, "INV", year),
      db
        .prepare(
          "UPDATE invoices SET status='ISSUED',invoice_number=? || printf('%04d',(SELECT value FROM finance_sequences WHERE org_id=? AND kind='INV' AND year=?)),issued_version_number=?,issued_at=?,issued_by_user_id=?,settlement_status='UNPAID',total_minor=?,outstanding_minor=? WHERE id=?",
        )
        .bind(
          `MD-INV-${year}-`,
          p.orgId,
          year,
          params.versionNumber,
          now,
          p.id,
          version.total_minor,
          version.total_minor,
          inv.id,
        ),
      ...doubleJournal(
        db,
        p,
        inv.project_id,
        "INVOICE_ISSUED",
        inv.id,
        version.total_minor,
        "1100_ACCOUNTS_RECEIVABLE",
        "4000_DESIGN_FEE_REVENUE",
        new Date(now).toISOString().slice(0, 10),
      ),
      audit(db, p, "INVOICE", inv.id, "INVOICE_ISSUED", {
        versionNumber: params.versionNumber,
      }),
      operation(db, p, key, input, result),
    ]);
    const saved = await row(db, "invoices", inv.id, p.orgId);
    return { ...result, invoiceNumber: saved.invoice_number };
  }
  static async reportReceipt(
    db: D1Database,
    p: UserPrincipal,
    params: ReportReceiptParams,
  ) {
    const prj = await project(db, p, params.projectId, false);
    money(params.amountMinor);
    date(params.receivedDate);
    const archived = prj.is_archived === 1 || prj.status === "ARCHIVED";
    let settlement: any = null;
    if (
      archived &&
      (!hasCapability(p, "ADMIN") ||
        !params.settlementInvoiceId ||
        !params.idempotencyKey?.trim())
    )
      throw new AuthorizationError(
        "Archived projects allow only administrator settlement payments against an existing invoice.",
        "PROJECT_ARCHIVED_READ_ONLY",
      );
    const grant = projectGrant(p, params.projectId);
    if (
      !hasCapability(p, "ADMIN") &&
      !hasCapability(p, "MANAGER", params.projectId) &&
      !hasCapability(p, "MAIN_CLIENT", params.projectId) &&
      !grant?.financeAuthor &&
      !grant?.financeAccess
    )
      throw new AuthorizationError(
        "You cannot report payments for this project",
      );
    if (params.settlementInvoiceId && !hasCapability(p, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can record settlement payments.",
      );
    const key = params.idempotencyKey
      ? `report:${params.idempotencyKey}`
      : null;
    if (key) {
      const previous = await replay(db, p, key, params);
      if (previous) return previous;
    }
    if (params.settlementInvoiceId) {
      if (!hasCapability(p, "ADMIN"))
        throw new AuthorizationError(
          "Only administrators can record settlement payments.",
        );
      settlement = await row(
        db,
        "invoices",
        params.settlementInvoiceId,
        p.orgId,
      );
      if (
        settlement.project_id !== params.projectId ||
        settlement.status !== "ISSUED" ||
        settlement.currency !== "INR" ||
        settlement.outstanding_minor <= 0 ||
        params.amountMinor > settlement.outstanding_minor
      )
        throw new AuthorizationError(
          "Choose an outstanding issued invoice in this project and an amount no greater than its outstanding balance.",
          "INVALID_INPUT",
        );
    }
    if (
      !["NEFT", "RTGS", "UPI", "CHEQUE", "BANK_TRANSFER"].includes(
        params.paymentMethod,
      )
    )
      throw new AuthorizationError(
        "Select a supported external payment method.",
        "INVALID_INPUT",
      );
    if (params.evidenceFileId) {
      const f = await db
        .prepare(
          "SELECT * FROM files WHERE id=? AND org_id=? AND project_id=? AND status='READY'",
        )
        .bind(params.evidenceFileId, p.orgId, params.projectId)
        .first<any>();
      if (!f)
        throw new AuthorizationError(
          "Payment evidence is unavailable.",
          "INVALID_INPUT",
        );
    }
    const id = generateId("rcp"),
      result = {
        receiptId: id,
        status: "REPORTED",
        amountMinor: params.amountMinor,
      };
    await commit(db, [
      activeGuard(db, p),
      ...(archived
        ? [
            atomicGuard(
              db,
              "EXISTS(SELECT 1 FROM role_assignments WHERE user_id=? AND org_id=? AND role='ADMIN' AND scope='GLOBAL' AND revoked_at IS NULL)",
              [p.id, p.orgId],
            ),
          ]
        : []),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM projects WHERE id=? AND org_id=? AND is_archived=?)",
        [params.projectId, p.orgId, prj.is_archived],
      ),
      ...(settlement
        ? [
            atomicGuard(
              db,
              "EXISTS(SELECT 1 FROM invoices WHERE id=? AND org_id=? AND project_id=? AND status='ISSUED' AND currency='INR' AND outstanding_minor=? AND outstanding_minor>=?)",
              [
                settlement.id,
                p.orgId,
                params.projectId,
                settlement.outstanding_minor,
                params.amountMinor,
              ],
            ),
          ]
        : []),
      db
        .prepare(
          "INSERT INTO receipts(id,org_id,project_id,currency,amount_minor,allocated_minor,unallocated_minor,received_date,payment_method,reference_note,evidence_file_id,status,idempotency_key,reported_by_user_id,created_at,settlement_invoice_id) VALUES (?,?,?,'INR',?,0,?,?,?,?,?,'REPORTED',?,?,?,?)",
        )
        .bind(
          id,
          p.orgId,
          params.projectId,
          params.amountMinor,
          params.amountMinor,
          params.receivedDate,
          params.paymentMethod,
          params.referenceNote ?? null,
          params.evidenceFileId ?? null,
          params.idempotencyKey ? `${p.orgId}:${params.idempotencyKey}` : null,
          p.id,
          Date.now(),
          params.settlementInvoiceId ?? null,
        ),
      audit(db, p, "RECEIPT", id, "RECEIPT_REPORTED", {
        amountMinor: params.amountMinor,
        settlementInvoiceId: params.settlementInvoiceId ?? null,
      }),
      ...(key ? [operation(db, p, key, params, result)] : []),
    ]);
    return result;
  }
  static async confirmReceipt(
    db: D1Database,
    p: UserPrincipal,
    params: { receiptId: string; idempotencyKey?: string },
  ) {
    if (!hasCapability(p, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can confirm receipt of real funds",
      );
    const r = await row(db, "receipts", params.receiptId, p.orgId);
    money(r.amount_minor);
    const key = `confirm:${params.idempotencyKey ?? r.id}`,
      input = { receiptId: r.id },
      previous = await replay(db, p, key, input);
    if (previous) {
      const saved = await row(db, "receipts", r.id, p.orgId);
      return { ...previous, receiptNumber: saved.receipt_number };
    }
    if (r.status === "CONFIRMED") {
      const entry = await db
        .prepare(
          "SELECT id FROM journal_entries WHERE org_id=? AND source_type='RECEIPT_CONFIRMED' AND source_id=?",
        )
        .bind(p.orgId, r.id)
        .first();
      if (entry)
        return {
          receiptId: r.id,
          status: "CONFIRMED",
          receiptNumber: r.receipt_number,
        };
    }
    if (r.status !== "REPORTED")
      throw new AuthorizationError(
        "Receipt is not awaiting confirmation.",
        "CONFLICT",
      );
    const year = new Date().getUTCFullYear(),
      now = Date.now(),
      result = { receiptId: r.id, status: "CONFIRMED" };
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM receipts WHERE id=? AND org_id=? AND status='REPORTED')",
        [r.id, p.orgId],
      ),
      sequence(db, p, "RCP", year),
      db
        .prepare(
          "UPDATE receipts SET status='CONFIRMED',receipt_number=? || printf('%04d',(SELECT value FROM finance_sequences WHERE org_id=? AND kind='RCP' AND year=?)),confirmed_by_user_id=?,confirmed_at=? WHERE id=?",
        )
        .bind(`MD-RCP-${year}-`, p.orgId, year, p.id, now, r.id),
      db
        .prepare(
          "UPDATE projects SET advance_confirmed_at=? WHERE id=? AND org_id=?",
        )
        .bind(now, r.project_id, p.orgId),
      ...doubleJournal(
        db,
        p,
        r.project_id,
        "RECEIPT_CONFIRMED",
        r.id,
        r.amount_minor,
        "1000_BANK",
        "2100_CUSTOMER_ADVANCES",
        r.received_date,
      ),
      audit(db, p, "RECEIPT", r.id, "RECEIPT_CONFIRMED", {
        amountMinor: r.amount_minor,
      }),
      operation(db, p, key, input, result),
    ]);
    const saved = await row(db, "receipts", r.id, p.orgId);
    return { ...result, receiptNumber: saved.receipt_number };
  }
  static async allocateReceipt(
    db: D1Database,
    p: UserPrincipal,
    params: {
      receiptId: string;
      invoiceId: string;
      amountMinor: number;
      idempotencyKey?: string;
    },
  ) {
    if (!hasCapability(p, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can allocate receipts to invoices",
      );
    money(params.amountMinor);
    if (!params.idempotencyKey?.trim())
      throw new AuthorizationError(
        "An allocation operation key is required.",
        "INVALID_INPUT",
      );
    const key = `allocate:${params.idempotencyKey}`,
      input = {
        receiptId: params.receiptId,
        invoiceId: params.invoiceId,
        amountMinor: params.amountMinor,
      },
      previous = await replay(db, p, key, input);
    if (previous) return previous;
    const r = await row(db, "receipts", params.receiptId, p.orgId),
      i = await row(db, "invoices", params.invoiceId, p.orgId);
    if (
      r.status !== "CONFIRMED" ||
      (r.settlement_invoice_id && r.settlement_invoice_id !== i.id) ||
      i.status !== "ISSUED" ||
      r.project_id !== i.project_id ||
      r.currency !== i.currency ||
      params.amountMinor > r.unallocated_minor ||
      params.amountMinor > i.outstanding_minor
    )
      throw new AuthorizationError(
        "Allocation requires matching confirmed funds and sufficient issued outstanding balance.",
        "INVALID_INPUT",
      );
    const amount = params.amountMinor,
      id = generateId("alloc"),
      outstanding = i.outstanding_minor - amount,
      status = outstanding === 0 ? "PAID" : "PARTIALLY_PAID",
      result = {
        allocatedMinor: amount,
        invoiceOutstandingMinor: outstanding,
        invoiceSettlementStatus: status,
        receiptUnallocatedMinor: r.unallocated_minor - amount,
      };
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM receipts r JOIN invoices i ON i.project_id=r.project_id AND i.org_id=r.org_id AND i.currency=r.currency WHERE r.id=? AND i.id=? AND r.org_id=? AND r.status='CONFIRMED' AND i.status='ISSUED' AND r.unallocated_minor=? AND i.outstanding_minor=? AND r.unallocated_minor>=? AND i.outstanding_minor>=? AND (r.settlement_invoice_id IS NULL OR r.settlement_invoice_id=i.id))",
        [
          r.id,
          i.id,
          p.orgId,
          r.unallocated_minor,
          i.outstanding_minor,
          amount,
          amount,
        ],
      ),
      db
        .prepare(
          "INSERT INTO receipt_allocations(id,receipt_id,invoice_id,amount_minor,allocated_by_user_id,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(id, r.id, i.id, amount, p.id, Date.now()),
      db
        .prepare(
          "UPDATE invoices SET allocated_minor=allocated_minor+?,outstanding_minor=outstanding_minor-?,settlement_status=? WHERE id=?",
        )
        .bind(amount, amount, status, i.id),
      db
        .prepare(
          "UPDATE receipts SET allocated_minor=allocated_minor+?,unallocated_minor=unallocated_minor-? WHERE id=?",
        )
        .bind(amount, amount, r.id),
      ...doubleJournal(
        db,
        p,
        i.project_id,
        "RECEIPT_ALLOCATED",
        id,
        amount,
        "2100_CUSTOMER_ADVANCES",
        "1100_ACCOUNTS_RECEIVABLE",
        new Date().toISOString().slice(0, 10),
      ),
      audit(db, p, "ALLOCATION", id, "RECEIPT_ALLOCATED", input),
      operation(db, p, key, input, result),
    ]);
    return result;
  }
  static async activateProject(
    db: D1Database,
    p: UserPrincipal,
    projectId: string,
  ) {
    const prj = await project(db, p, projectId);
    if (!canPublishProjectUpdates(p, projectId))
      throw new AuthorizationError("Only managers can activate projects");
    if (prj.status === "ACTIVE")
      return { projectId, status: "ACTIVE", isCommercialActivated: true };
    const q = await db
      .prepare(
        "SELECT * FROM quotations WHERE project_id=? AND org_id=? AND status='ACCEPTED' ORDER BY version_number DESC",
      )
      .bind(projectId, p.orgId)
      .first<any>();
    if (!q)
      throw new AuthorizationError(
        "Project cannot be activated: missing accepted quotation",
        "MISSING_ACCEPTED_QUOTATION",
      );
    money(q.required_advance_minor);
    const paid = await db
      .prepare(
        "SELECT COALESCE(SUM(r.amount_minor),0) total FROM receipts r WHERE r.project_id=? AND r.org_id=? AND r.status='CONFIRMED' AND r.confirmed_by_user_id IS NOT NULL AND r.confirmed_at IS NOT NULL AND EXISTS(SELECT 1 FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id WHERE je.org_id=r.org_id AND je.source_type='RECEIPT_CONFIRMED' AND je.source_id=r.id GROUP BY je.id HAVING SUM(jl.debit_minor)=r.amount_minor AND SUM(jl.credit_minor)=r.amount_minor)",
      )
      .bind(projectId, p.orgId)
      .first<any>();
    if (paid.total < q.required_advance_minor)
      throw new AuthorizationError(
        "The required advance payment is not confirmed by admin.",
        "MISSING_CONFIRMED_ADVANCE",
      );
    await commit(db, [
      activeGuard(db, p),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM projects p JOIN quotations q ON q.project_id=p.id WHERE p.id=? AND p.org_id=? AND p.status='DRAFT' AND p.is_archived=0 AND p.revision=? AND q.id=? AND q.status='ACCEPTED' AND q.required_advance_minor>0 AND q.required_advance_minor<=(SELECT COALESCE(SUM(r.amount_minor),0) FROM receipts r WHERE r.project_id=p.id AND r.org_id=p.org_id AND r.status='CONFIRMED' AND r.confirmed_by_user_id IS NOT NULL AND r.confirmed_at IS NOT NULL AND EXISTS(SELECT 1 FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id=je.id WHERE je.org_id=r.org_id AND je.source_type='RECEIPT_CONFIRMED' AND je.source_id=r.id GROUP BY je.id HAVING SUM(jl.debit_minor)=r.amount_minor AND SUM(jl.credit_minor)=r.amount_minor)))",
        [projectId, p.orgId, prj.revision, q.id],
      ),
      db
        .prepare(
          "UPDATE projects SET status='ACTIVE',activated_at=?,activated_by_user_id=?,revision=revision+1 WHERE id=?",
        )
        .bind(Date.now(), p.id, projectId),
      audit(db, p, "PROJECT", projectId, "PROJECT_ACTIVATED", {
        quotationId: q.id,
        requiredAdvanceMinor: q.required_advance_minor,
      }),
    ]);
    return { projectId, status: "ACTIVE", isCommercialActivated: true };
  }
}
