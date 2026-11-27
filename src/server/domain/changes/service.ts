import { assertProjectOrganisation } from "../../auth/policy";
/**
 * Change Requests, Versioned Estimates, Payment Allocation, and Execution Authorization Domain Service.
 * Enforces main-client acceptance authority, three-condition pre-work commercial gate,
 * invalidation of stale consent on revision, and task-linking controls.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import {
  assertProjectAccess,
  AuthorizationError,
  canReadInternalNotes,
  canAcceptContractualDecisions,
} from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { FinanceService, money } from "../finance/service";
import {
  getCommercialMode,
  getLatestExternalClearance,
} from "../finance/external-clearance";
import { atomicGuard } from "../../db/atomic";
import { ArchiveService } from "../archive/service";

export type ChangeRequestStatus =
  | "REQUESTED"
  | "ESTIMATING"
  | "AWAITING_CLIENT"
  | "ACCEPTED_AWAITING_PAYMENT"
  | "PAYMENT_CONFIRMED"
  | "AUTHORIZED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

export interface CreateChangeRequestParams {
  projectId: string;
  title: string;
  description: string;
  sourceType:
    | "MATERIAL_SELECTION"
    | "CLIENT_REQUEST"
    | "SITE_CONDITION"
    | "DESIGN_REVISION"
    | "DISCUSSION";
  sourceReferenceId?: string;
  affectedOriginalScope?: string;
}

export interface IssueEstimateParams {
  changeRequestId: string;
  scopeSummary: string;
  exclusions?: string;
  priceMinor: number;
  taxMinor?: number;
  requiredPreworkPaymentMinor?: number;
  scheduleImpactDays?: number;
  currency?: string;
}

export interface AcceptEstimateParams {
  changeRequestId: string;
  versionNumber: number;
  notes?: string;
}

export interface ConfirmChangePaymentParams {
  changeRequestId: string;
  receiptId: string;
  amountMinor?: number;
  idempotencyKey?: string;
}

export interface ReviseEstimateParams {
  changeRequestId: string;
  scopeSummary: string;
  exclusions?: string;
  priceMinor: number;
  taxMinor?: number;
  requiredPreworkPaymentMinor?: number;
  scheduleImpactDays?: number;
  reason: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class ChangesService {
  /**
   * Helper to determine if an actor is the authorized MAIN_CLIENT for a project.
   */
  static isMainClient(principal: UserPrincipal, projectId: string): boolean {
    return canAcceptContractualDecisions(principal, projectId);
  }

  // ---------------------------------------------------------------------------
  // 1. Change Requests
  // ---------------------------------------------------------------------------

  static async createChangeRequest(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateChangeRequestParams,
  ) {
    assertProjectAccess(principal, params.projectId);
    await assertProjectOrganisation(db, principal, params.projectId);
    await ArchiveService.assertProjectNotArchived(db, params.projectId);

    if (!params.title || params.title.trim().length === 0) {
      throw new AuthorizationError(
        "Change request title is required",
        "INVALID_INPUT",
      );
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new AuthorizationError(
        "Change request description is required",
        "INVALID_INPUT",
      );
    }

    const countRow = await queryFirst<any>(
      db,
      "SELECT COUNT(*) as c FROM change_requests WHERE project_id = ?",
      [params.projectId],
    );
    const seq = (countRow?.c || 0) + 1;
    const requestNumber = `CR-${String(seq).padStart(3, "0")}`;

    const crId = generateId("cr");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO change_requests (
        id, org_id, project_id, request_number, title, description,
        source_type, source_reference_id, affected_original_scope,
        current_version_number, status, requested_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'REQUESTED', ?, ?, ?)`,
      [
        crId,
        principal.orgId,
        params.projectId,
        requestNumber,
        params.title.trim(),
        params.description.trim(),
        params.sourceType,
        params.sourceReferenceId || null,
        params.affectedOriginalScope || null,
        principal.id,
        now,
        now,
      ],
    );

    return {
      id: crId,
      requestNumber,
      status: "REQUESTED" as ChangeRequestStatus,
      currentVersionNumber: 1,
    };
  }

  static async startEstimating(
    db: D1Database,
    principal: UserPrincipal,
    changeRequestId: string,
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", cr.project_id)) {
      throw new AuthorizationError(
        "Only project managers can start estimation",
        "FORBIDDEN",
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_requests SET status = 'ESTIMATING', updated_at = ? WHERE id = ?",
      [now, changeRequestId],
    );

    return { id: changeRequestId, status: "ESTIMATING" };
  }

  /**
   * Issue an estimate for a change request.
   */
  static async issueEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: IssueEstimateParams,
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [params.changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", cr.project_id)) {
      throw new AuthorizationError(
        "Only project managers can issue change estimates",
        "FORBIDDEN",
      );
    }

    if (!params.scopeSummary || params.scopeSummary.trim().length === 0) {
      throw new AuthorizationError(
        "Scope summary is required",
        "INVALID_INPUT",
      );
    }
    if (!Number.isSafeInteger(params.priceMinor) || params.priceMinor < 0) {
      throw new AuthorizationError("Valid price is required", "INVALID_INPUT");
    }

    const taxMinor = params.taxMinor || 0;
    const totalMinor = money(params.priceMinor + money(taxMinor, true));
    const requiredPrework =
      params.requiredPreworkPaymentMinor !== undefined
        ? params.requiredPreworkPaymentMinor
        : totalMinor;

    money(requiredPrework, true);
    if (requiredPrework > totalMinor)
      throw new AuthorizationError(
        "Required payment exceeds estimate",
        "INVALID_INPUT",
      );
    const versionId = generateId("crv");
    const now = Date.now();

    const plan = [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM change_requests WHERE id=? AND org_id=? AND current_version_number=? AND status IN ('REQUESTED','ESTIMATING'))",
        [cr.id, principal.orgId, cr.current_version_number],
      ),
    ];
    plan.push(
      db
        .prepare(
          `INSERT INTO change_request_versions (
        id, change_request_id, version_number, currency, scope_summary,
        exclusions, price_minor, tax_minor, total_minor,
        required_prework_payment_minor, schedule_impact_days, status,
        allocated_payment_minor, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', 0, ?)`,
        )
        .bind(
          ...[
            versionId,
            params.changeRequestId,
            cr.current_version_number,
            params.currency || "INR",
            params.scopeSummary.trim(),
            params.exclusions || null,
            params.priceMinor,
            taxMinor,
            totalMinor,
            requiredPrework,
            params.scheduleImpactDays || 0,
            now,
          ],
        ),
    );

    plan.push(
      db
        .prepare(
          "UPDATE change_requests SET status = 'AWAITING_CLIENT', updated_at = ? WHERE id = ?",
        )
        .bind(...[now, params.changeRequestId]),
    );

    plan.push(
      FinanceService.audit(db, principal, "CHANGE", cr.id, "ISSUEESTIMATE", {
        versionNumber: cr.current_version_number,
      }),
    );
    await FinanceService.commit(db, plan);
    return {
      versionId,
      versionNumber: cr.current_version_number,
      status: "ISSUED",
      totalMinor,
      requiredPreworkPaymentMinor: requiredPrework,
    };
  }

  /**
   * Main client estimate acceptance.
   * ONLY the main client can accept. Representatives and consultants are denied.
   */
  static async acceptEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: AcceptEstimateParams,
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [params.changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    // Enforce MAIN_CLIENT authority
    if (!this.isMainClient(principal, cr.project_id)) {
      throw new AuthorizationError(
        "Only the main client has authority to accept additional cost and estimate versions",
        "MAIN_CLIENT_ACCEPTANCE_REQUIRED",
      );
    }

    const version = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, params.versionNumber],
    );

    if (!version)
      throw new AuthorizationError("Estimate version not found", "NOT_FOUND");
    if (version.status !== "ISSUED") {
      throw new AuthorizationError(
        "Can only accept issued estimate versions",
        "INVALID_STATE",
      );
    }

    if (cr.current_version_number !== params.versionNumber)
      throw new AuthorizationError("Estimate version changed", "CONFLICT");
    const now = Date.now();
    const nextStatus: ChangeRequestStatus =
      version.required_prework_payment_minor > 0
        ? "ACCEPTED_AWAITING_PAYMENT"
        : "PAYMENT_CONFIRMED";
    await FinanceService.commit(db, [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM change_requests c JOIN change_request_versions v ON v.change_request_id=c.id AND v.version_number=c.current_version_number JOIN projects p ON p.id=c.project_id WHERE c.id=? AND c.current_version_number=? AND c.org_id=? AND p.main_client_user_id=? AND p.is_archived=0 AND v.status='ISSUED')",
        [cr.id, params.versionNumber, principal.orgId, principal.id],
      ),
      db
        .prepare(
          "UPDATE change_request_versions SET status='ACCEPTED',accepted_by_user_id=?,accepted_at=?,acceptance_notes=? WHERE id=?",
        )
        .bind(principal.id, now, params.notes ?? null, version.id),
      db
        .prepare("UPDATE change_requests SET status=?,updated_at=? WHERE id=?")
        .bind(nextStatus, now, cr.id),
      FinanceService.audit(db, principal, "CHANGE", cr.id, "CHANGE_ACCEPTED", {
        versionNumber: params.versionNumber,
      }),
    ]);

    return {
      changeRequestId: params.changeRequestId,
      versionNumber: params.versionNumber,
      status: nextStatus,
      acceptedAt: now,
      acceptedByUserId: principal.id,
    };
  }

  /**
   * Decline estimate.
   */
  static async declineEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: { changeRequestId: string; reason?: string },
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [params.changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!this.isMainClient(principal, cr.project_id)) {
      throw new AuthorizationError(
        "Only the main client can decline estimate proposals",
        "MAIN_CLIENT_ACCEPTANCE_REQUIRED",
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_request_versions SET status = 'DECLINED' WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number],
    );

    await execute(
      db,
      "UPDATE change_requests SET status = 'DECLINED', updated_at = ? WHERE id = ?",
      [now, params.changeRequestId],
    );

    return { id: params.changeRequestId, status: "DECLINED" };
  }

  /**
   * Add comment to change request. Allowed for all project members (representatives, consultants, staff).
   */
  static async addComment(
    db: D1Database,
    principal: UserPrincipal,
    params: { changeRequestId: string; commentText: string },
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [params.changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!params.commentText || params.commentText.trim().length === 0) {
      throw new AuthorizationError("Comment text is required", "INVALID_INPUT");
    }

    const commentId = generateId("crc");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO change_request_comments (id, change_request_id, user_id, comment_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        commentId,
        params.changeRequestId,
        principal.id,
        params.commentText.trim(),
        now,
      ],
    );

    return {
      id: commentId,
      changeRequestId: params.changeRequestId,
      createdAt: now,
    };
  }

  /**
   * Confirm and allocate payment for a change request.
   * ADMIN ONLY. Rejects non-admin attempts.
   * Allocates confirmed receipt funds toward the required pre-work payment.
   */
  static async confirmChangePayment(
    db: D1Database,
    principal: UserPrincipal,
    params: ConfirmChangePaymentParams,
  ) {
    if (!hasCapability(principal, "ADMIN"))
      throw new AuthorizationError(
        "Only administrators can confirm and allocate payment for change requests",
      );
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id=? AND org_id=?",
      [params.changeRequestId, principal.orgId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    const v = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id=? AND version_number=?",
      [cr.id, cr.current_version_number],
    );
    const r = await queryFirst<any>(
      db,
      "SELECT * FROM receipts WHERE id=? AND org_id=?",
      [params.receiptId, principal.orgId],
    );
    if (
      !v ||
      v.status !== "ACCEPTED" ||
      !r ||
      r.status !== "CONFIRMED" ||
      !!r.settlement_invoice_id ||
      r.project_id !== cr.project_id ||
      r.currency !== v.currency
    )
      throw new AuthorizationError(
        "Accepted estimate and matching confirmed receipt required",
        "INVALID_STATE",
      );
    const amount = money(
      params.amountMinor ??
        v.required_prework_payment_minor - v.allocated_payment_minor,
    );
    if (
      amount > r.unallocated_minor ||
      amount > v.required_prework_payment_minor - v.allocated_payment_minor
    )
      throw new AuthorizationError(
        "Allocation exceeds available funds or required estimate payment",
        "INVALID_INPUT",
      );
    const key =
        "change-payment:" +
        (params.idempotencyKey ?? `${r.id}:${v.id}:${amount}`),
      input = JSON.stringify({ receipt: r.id, version: v.id, amount });
    const old = await queryFirst<any>(
      db,
      "SELECT * FROM finance_operations WHERE org_id=? AND operation_key=?",
      [principal.orgId, key],
    );
    if (old) {
      if (old.fingerprint !== input)
        throw new AuthorizationError("Operation key conflict", "CONFLICT");
      return JSON.parse(old.result_json);
    }
    const id = generateId("alloc"),
      total = v.allocated_payment_minor + amount,
      full = total >= v.required_prework_payment_minor,
      newStatus = full ? "PAYMENT_CONFIRMED" : "ACCEPTED_AWAITING_PAYMENT";
    const result = {
      success: true,
      changeRequestId: cr.id,
      allocatedMinor: amount,
      totalAllocatedMinor: total,
      requiredMinor: v.required_prework_payment_minor,
      isFullySatisfied: full,
      newStatus,
    };
    const ledger = FinanceService.journalStatements(db, {
      orgId: principal.orgId,
      projectId: cr.project_id,
      sourceType: "CHANGE_PAYMENT_ALLOCATED",
      sourceId: id,
      entryDate: new Date().toISOString().slice(0, 10),
      description: "Payment reserved for accepted additional work",
      lines: [
        {
          accountCode: "2100_CUSTOMER_ADVANCES",
          debitMinor: amount,
          creditMinor: 0,
        },
        {
          accountCode: "2110_CHANGE_WORK_ADVANCES",
          debitMinor: 0,
          creditMinor: amount,
        },
      ],
    });
    await FinanceService.commit(db, [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM receipts r JOIN change_requests c ON c.project_id=r.project_id AND c.org_id=r.org_id JOIN change_request_versions v ON v.change_request_id=c.id AND v.version_number=c.current_version_number WHERE r.id=? AND v.id=? AND v.status='ACCEPTED' AND r.status='CONFIRMED' AND r.settlement_invoice_id IS NULL AND r.currency=v.currency AND r.unallocated_minor=? AND r.unallocated_minor>=? AND v.allocated_payment_minor=?)",
        [r.id, v.id, r.unallocated_minor, amount, v.allocated_payment_minor],
      ),
      db
        .prepare(
          "INSERT INTO receipt_allocations(id,receipt_id,change_request_id,change_request_version_id,amount_minor,allocated_by_user_id,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(id, r.id, cr.id, v.id, amount, principal.id, Date.now()),
      db
        .prepare(
          "UPDATE receipts SET allocated_minor=allocated_minor+?,unallocated_minor=unallocated_minor-? WHERE id=?",
        )
        .bind(amount, amount, r.id),
      db
        .prepare(
          "UPDATE change_request_versions SET allocated_payment_minor=allocated_payment_minor+?,allocated_receipt_id=? WHERE id=?",
        )
        .bind(amount, r.id, v.id),
      db
        .prepare("UPDATE change_requests SET status=?,updated_at=? WHERE id=?")
        .bind(newStatus, Date.now(), cr.id),
      ...ledger.statements,
      FinanceService.audit(
        db,
        principal,
        "CHANGE",
        cr.id,
        "CHANGE_PAYMENT_ALLOCATED",
        { version: v.version_number, amount },
      ),
      db
        .prepare(
          "INSERT INTO finance_operations(org_id,operation_key,fingerprint,result_json,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(principal.orgId, key, input, JSON.stringify(result), Date.now()),
    ]);
    return result;
  }

  /**
   * Authorize change request for work execution.
   * Guarded by THREE independent conditions:
   * 1. Main-client estimate acceptance.
   * 2. Administrator-confirmed required payment.
   * 3. Manager authorization.
   */
  static async authorizeChangeWork(
    db: D1Database,
    principal: UserPrincipal,
    params: { changeRequestId: string; notes?: string },
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [params.changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", cr.project_id)) {
      throw new AuthorizationError(
        "Only project managers can authorize additional change work",
        "FORBIDDEN",
      );
    }

    const version = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number],
    );
    if (!version)
      throw new AuthorizationError(
        "Current estimate version not found",
        "NOT_FOUND",
      );

    // Condition 1: Main-client acceptance check
    if (version.status !== "ACCEPTED" || !version.accepted_by_user_id) {
      throw new AuthorizationError(
        "Change request requires main client estimate acceptance before authorization",
        "ESTIMATE_NOT_ACCEPTED",
      );
    }

    const mode = await getCommercialMode(db, principal.orgId);
    if (mode === "EXTERNAL") {
      const clearance = await getLatestExternalClearance(
        db,
        cr.project_id,
        "CHANGE_REQUEST",
        cr.id,
        cr.current_version_number,
      );
      if (
        !clearance ||
        (clearance.status !== "CONFIRMED" && clearance.status !== "CORRECTED")
      ) {
        throw new AuthorizationError(
          "Change request requires ADMIN-confirmed external commercial clearance for the current accepted estimate version.",
          "MISSING_EXTERNAL_CLEARANCE",
        );
      }

      const now = Date.now();
      await FinanceService.commit(db, [
        FinanceService.activeGuard(db, principal),
        atomicGuard(
          db,
          "EXISTS(SELECT 1 FROM change_requests c JOIN change_request_versions v ON v.change_request_id=c.id AND v.version_number=c.current_version_number JOIN projects p ON p.id=c.project_id WHERE c.id=? AND c.org_id=? AND c.current_version_number=? AND c.status IN ('PAYMENT_CONFIRMED','ACCEPTED_AWAITING_PAYMENT') AND p.is_archived=0 AND v.id=? AND v.status='ACCEPTED' AND v.accepted_by_user_id IS NOT NULL AND (SELECT status FROM external_commercial_clearances ec WHERE ec.project_id=c.project_id AND ec.entity_type='CHANGE_REQUEST' AND ec.entity_id=c.id AND ec.version_number=c.current_version_number ORDER BY ec.recorded_at DESC, ec.rowid DESC LIMIT 1) IN ('CONFIRMED','CORRECTED'))",
          [cr.id, principal.orgId, cr.current_version_number, version.id],
        ),
        db
          .prepare(
            "UPDATE change_request_versions SET authorized_by_user_id=?,authorized_at=? WHERE id=?",
          )
          .bind(principal.id, now, version.id),
        db
          .prepare(
            "UPDATE change_requests SET status='AUTHORIZED',updated_at=? WHERE id=?",
          )
          .bind(now, cr.id),
        FinanceService.audit(
          db,
          principal,
          "CHANGE",
          cr.id,
          "CHANGE_AUTHORIZED",
          {
            version: cr.current_version_number,
            externalClearanceId: clearance.id,
          },
        ),
      ]);

      return {
        changeRequestId: params.changeRequestId,
        versionNumber: cr.current_version_number,
        status: "AUTHORIZED" as ChangeRequestStatus,
        authorizedAt: now,
        authorizedByUserId: principal.id,
      };
    }

    // Condition 2: Admin-confirmed payment check
    if (
      version.allocated_payment_minor < version.required_prework_payment_minor
    ) {
      throw new AuthorizationError(
        `Change request requires administrator-confirmed payment allocation before authorization (required: ${version.required_prework_payment_minor}, allocated: ${version.allocated_payment_minor})`,
        "PAYMENT_NOT_CONFIRMED",
      );
    }

    // The same accepted version and payment gate are checked inside the write transaction.
    const now = Date.now();
    await FinanceService.commit(db, [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM change_requests c JOIN change_request_versions v ON v.change_request_id=c.id AND v.version_number=c.current_version_number JOIN projects p ON p.id=c.project_id WHERE c.id=? AND c.org_id=? AND c.current_version_number=? AND c.status IN ('PAYMENT_CONFIRMED','ACCEPTED_AWAITING_PAYMENT') AND p.is_archived=0 AND v.id=? AND v.status='ACCEPTED' AND v.accepted_by_user_id IS NOT NULL AND v.allocated_payment_minor>=v.required_prework_payment_minor)",
        [cr.id, principal.orgId, cr.current_version_number, version.id],
      ),
      db
        .prepare(
          "UPDATE change_request_versions SET authorized_by_user_id=?,authorized_at=? WHERE id=?",
        )
        .bind(principal.id, now, version.id),
      db
        .prepare(
          "UPDATE change_requests SET status='AUTHORIZED',updated_at=? WHERE id=?",
        )
        .bind(now, cr.id),
      FinanceService.audit(
        db,
        principal,
        "CHANGE",
        cr.id,
        "CHANGE_AUTHORIZED",
        { version: cr.current_version_number },
      ),
    ]);

    return {
      changeRequestId: params.changeRequestId,
      versionNumber: cr.current_version_number,
      status: "AUTHORIZED" as ChangeRequestStatus,
      authorizedAt: now,
      authorizedByUserId: principal.id,
    };
  }

  /**
   * Revise estimate scope, price, or terms.
   * Supersedes prior estimate version and INVALIDATES previous acceptance and authorization.
   * Requires fresh main-client acceptance, re-evaluated payment, and manager authorization.
   */
  static async reviseEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: ReviseEstimateParams,
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [params.changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", cr.project_id)) {
      throw new AuthorizationError(
        "Only project managers can revise change estimates",
        "FORBIDDEN",
      );
    }

    const currentVersion = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number],
    );

    const now = Date.now();

    // 1. Mark existing version as SUPERSEDED (invalidates prior acceptance & authorization)
    const plan = [
      FinanceService.activeGuard(db, principal),
      atomicGuard(
        db,
        "EXISTS(SELECT 1 FROM change_requests WHERE id=? AND org_id=? AND current_version_number=? AND status IN ('AWAITING_CLIENT','ACCEPTED_AWAITING_PAYMENT','PAYMENT_CONFIRMED','AUTHORIZED'))",
        [cr.id, principal.orgId, cr.current_version_number],
      ),
    ];
    if (currentVersion) {
      plan.push(
        db
          .prepare(
            "UPDATE change_request_versions SET status = 'SUPERSEDED' WHERE id = ?",
          )
          .bind(...[currentVersion.id]),
      );
    }

    // 2. Increment version and insert new version in ISSUED status
    const nextVersionNumber = cr.current_version_number + 1;
    const newVersionId = generateId("crv");
    const taxMinor = params.taxMinor || 0;
    const totalMinor = money(params.priceMinor + money(taxMinor, true));
    const requiredPrework =
      params.requiredPreworkPaymentMinor !== undefined
        ? params.requiredPreworkPaymentMinor
        : totalMinor;
    money(requiredPrework, true);
    if (requiredPrework > totalMinor)
      throw new AuthorizationError("Payment exceeds estimate", "INVALID_INPUT");
    plan.push(
      db
        .prepare(
          `INSERT INTO change_request_versions (
        id, change_request_id, version_number, currency, scope_summary,
        exclusions, price_minor, tax_minor, total_minor,
        required_prework_payment_minor, schedule_impact_days, status,
        allocated_payment_minor, created_at
      ) VALUES (?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, 'ISSUED', 0, ?)`,
        )
        .bind(
          ...[
            newVersionId,
            params.changeRequestId,
            nextVersionNumber,
            params.scopeSummary.trim(),
            params.exclusions || null,
            params.priceMinor,
            taxMinor,
            totalMinor,
            requiredPrework,
            params.scheduleImpactDays || 0,
            now,
          ],
        ),
    );

    // 3. Reset change request status to AWAITING_CLIENT
    plan.push(
      db
        .prepare(
          `UPDATE change_requests
       SET current_version_number = ?, status = 'AWAITING_CLIENT', updated_at = ?
       WHERE id = ?`,
        )
        .bind(...[nextVersionNumber, now, params.changeRequestId]),
    );

    plan.push(
      FinanceService.audit(db, principal, "CHANGE", cr.id, "REVISEESTIMATE", {
        versionNumber: cr.current_version_number,
      }),
    );
    await FinanceService.commit(db, plan);
    return {
      changeRequestId: params.changeRequestId,
      versionNumber: nextVersionNumber,
      status: "AWAITING_CLIENT" as ChangeRequestStatus,
      priceMinor: params.priceMinor,
      requiredPreworkPaymentMinor: requiredPrework,
    };
  }

  /**
   * Start operational work on an authorized change request.
   */
  static async startChangeWork(
    db: D1Database,
    principal: UserPrincipal,
    changeRequestId: string,
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (
      !hasCapability(principal, "MANAGER", cr.project_id) &&
      !hasCapability(principal, "TEAM_MEMBER", cr.project_id)
    )
      throw new AuthorizationError("Work grant required");
    if (cr.status !== "AUTHORIZED") {
      throw new AuthorizationError(
        "Cannot start work before change request is fully authorized",
        "CHANGE_REQUEST_NOT_AUTHORIZED",
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_requests SET status = 'IN_PROGRESS', updated_at = ? WHERE id = ?",
      [now, changeRequestId],
    );

    return { id: changeRequestId, status: "IN_PROGRESS" };
  }

  /**
   * Complete change request.
   */
  static async completeChangeWork(
    db: D1Database,
    principal: UserPrincipal,
    changeRequestId: string,
  ) {
    const cr = await queryFirst<any>(
      db,
      "SELECT * FROM change_requests WHERE id = ?",
      [changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    await ArchiveService.assertProjectNotArchived(db, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", cr.project_id)) {
      throw new AuthorizationError(
        "Only project managers can complete change requests",
        "FORBIDDEN",
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_requests SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
      [now, changeRequestId],
    );

    return { id: changeRequestId, status: "COMPLETED" };
  }

  /**
   * Fetch a single change request with all versions, readiness indicators, and comments.
   */
  static async getChangeRequest(
    db: D1Database,
    principal: UserPrincipal,
    changeRequestId: string,
  ) {
    const cr = await queryFirst<any>(
      db,
      `SELECT cr.*, u.display_name as requester_name
       FROM change_requests cr
       JOIN users u ON cr.requested_by_user_id = u.id
       WHERE cr.id = ?`,
      [changeRequestId],
    );
    if (!cr)
      throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);
    await assertProjectOrganisation(db, principal, cr.project_id);
    if (cr.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    const versions = await query<any>(
      db,
      `SELECT crv.*, a.display_name as accepted_by_name, m.display_name as authorized_by_name
       FROM change_request_versions crv
       LEFT JOIN users a ON crv.accepted_by_user_id = a.id
       LEFT JOIN users m ON crv.authorized_by_user_id = m.id
       WHERE crv.change_request_id = ?
       ORDER BY crv.version_number DESC`,
      [changeRequestId],
    );

    const comments = await query<any>(
      db,
      `SELECT c.*, u.display_name as author_name
       FROM change_request_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.change_request_id = ?
       ORDER BY c.created_at ASC`,
      [changeRequestId],
    );

    const currentVersion = versions.find(
      (v) => v.version_number === cr.current_version_number,
    );

    // Readiness evaluation (SCR-14: three independent conditions)
    const isAccepted =
      currentVersion?.status === "ACCEPTED" ||
      currentVersion?.status === "SUPERSEDED"; // checked exact version
    const isPaymentSatisfied =
      currentVersion !== undefined &&
      currentVersion.allocated_payment_minor >=
        currentVersion.required_prework_payment_minor;
    const isAuthorized =
      currentVersion?.authorized_by_user_id !== null &&
      currentVersion?.authorized_by_user_id !== undefined;

    return {
      ...cr,
      versions,
      comments,
      currentVersion,
      readiness: {
        condition1_estimateAccepted: Boolean(
          currentVersion?.accepted_by_user_id,
        ),
        condition2_paymentConfirmed: isPaymentSatisfied,
        condition3_managerAuthorized: isAuthorized,
        readyToStart:
          Boolean(currentVersion?.accepted_by_user_id) &&
          isPaymentSatisfied &&
          isAuthorized,
      },
    };
  }

  /**
   * List change requests for a project.
   */
  static async listChangeRequests(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string,
  ) {
    assertProjectAccess(principal, projectId);
    await assertProjectOrganisation(db, principal, projectId);

    const requests = await query<any>(
      db,
      `SELECT cr.*, u.display_name as requester_name
       FROM change_requests cr
       JOIN users u ON cr.requested_by_user_id = u.id
       WHERE cr.project_id = ?
       ORDER BY cr.created_at DESC`,
      [projectId],
    );

    return requests;
  }
}
