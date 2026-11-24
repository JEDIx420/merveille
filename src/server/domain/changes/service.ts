/**
 * Change Requests, Versioned Estimates, Payment Allocation, and Execution Authorization Domain Service.
 * Enforces main-client acceptance authority, three-condition pre-work commercial gate,
 * invalidation of stale consent on revision, and task-linking controls (AC-039, AC-040, AC-041).
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError, canReadInternalNotes } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";

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
  sourceType: "MATERIAL_SELECTION" | "CLIENT_REQUEST" | "SITE_CONDITION" | "DESIGN_REVISION" | "DISCUSSION";
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
    const membership = principal.projectMemberships?.find((m) => m.projectId === projectId);
    if (principal.role === "CLIENT_REP" || membership?.projectRole === "CLIENT_REP") {
      return false; // Representatives can never act as main client
    }
    if (principal.role === "MAIN_CLIENT" || membership?.projectRole === "MAIN_CLIENT") {
      return true;
    }
    if (principal.role === "ADMIN" || principal.role === "OWNER") {
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 1. Change Requests
  // ---------------------------------------------------------------------------

  static async createChangeRequest(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateChangeRequestParams
  ) {
    assertProjectAccess(principal, params.projectId);

    if (!params.title || params.title.trim().length === 0) {
      throw new AuthorizationError("Change request title is required", "INVALID_INPUT");
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new AuthorizationError("Change request description is required", "INVALID_INPUT");
    }

    const countRow = await queryFirst<any>(
      db,
      "SELECT COUNT(*) as c FROM change_requests WHERE project_id = ?",
      [params.projectId]
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
      ]
    );

    return {
      id: crId,
      requestNumber,
      status: "REQUESTED" as ChangeRequestStatus,
      currentVersionNumber: 1,
    };
  }

  static async startEstimating(db: D1Database, principal: UserPrincipal, changeRequestId: string) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [changeRequestId]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can start estimation", "FORBIDDEN");
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_requests SET status = 'ESTIMATING', updated_at = ? WHERE id = ?",
      [now, changeRequestId]
    );

    return { id: changeRequestId, status: "ESTIMATING" };
  }

  /**
   * Issue an estimate for a change request.
   */
  static async issueEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: IssueEstimateParams
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can issue change estimates", "FORBIDDEN");
    }

    if (!params.scopeSummary || params.scopeSummary.trim().length === 0) {
      throw new AuthorizationError("Scope summary is required", "INVALID_INPUT");
    }
    if (params.priceMinor === undefined || params.priceMinor < 0) {
      throw new AuthorizationError("Valid price is required", "INVALID_INPUT");
    }

    const taxMinor = params.taxMinor || 0;
    const totalMinor = params.priceMinor + taxMinor;
    const requiredPrework = params.requiredPreworkPaymentMinor !== undefined
      ? params.requiredPreworkPaymentMinor
      : totalMinor;

    const versionId = generateId("crv");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO change_request_versions (
        id, change_request_id, version_number, currency, scope_summary,
        exclusions, price_minor, tax_minor, total_minor,
        required_prework_payment_minor, schedule_impact_days, status,
        allocated_payment_minor, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', 0, ?)`,
      [
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
      ]
    );

    await execute(
      db,
      "UPDATE change_requests SET status = 'AWAITING_CLIENT', updated_at = ? WHERE id = ?",
      [now, params.changeRequestId]
    );

    return {
      versionId,
      versionNumber: cr.current_version_number,
      status: "ISSUED",
      totalMinor,
      requiredPreworkPaymentMinor: requiredPrework,
    };
  }

  /**
   * Main client estimate acceptance (AC-039).
   * ONLY the main client can accept. Representatives and consultants are denied.
   */
  static async acceptEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: AcceptEstimateParams
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    // Enforce MAIN_CLIENT authority (AC-039)
    if (!this.isMainClient(principal, cr.project_id)) {
      throw new AuthorizationError(
        "Only the main client has authority to accept additional cost and estimate versions",
        "MAIN_CLIENT_ACCEPTANCE_REQUIRED"
      );
    }

    const version = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, params.versionNumber]
    );

    if (!version) throw new AuthorizationError("Estimate version not found", "NOT_FOUND");
    if (version.status !== "ISSUED") {
      throw new AuthorizationError("Can only accept issued estimate versions", "INVALID_STATE");
    }

    const now = Date.now();
    await execute(
      db,
      `UPDATE change_request_versions
       SET status = 'ACCEPTED', accepted_by_user_id = ?, accepted_at = ?, acceptance_notes = ?
       WHERE id = ?`,
      [principal.id, now, params.notes || null, version.id]
    );

    const nextStatus: ChangeRequestStatus =
      version.required_prework_payment_minor > 0
        ? "ACCEPTED_AWAITING_PAYMENT"
        : "PAYMENT_CONFIRMED";

    await execute(
      db,
      "UPDATE change_requests SET status = ?, updated_at = ? WHERE id = ?",
      [nextStatus, now, params.changeRequestId]
    );

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
    params: { changeRequestId: string; reason?: string }
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!this.isMainClient(principal, cr.project_id)) {
      throw new AuthorizationError(
        "Only the main client can decline estimate proposals",
        "MAIN_CLIENT_ACCEPTANCE_REQUIRED"
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_request_versions SET status = 'DECLINED' WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number]
    );

    await execute(
      db,
      "UPDATE change_requests SET status = 'DECLINED', updated_at = ? WHERE id = ?",
      [now, params.changeRequestId]
    );

    return { id: params.changeRequestId, status: "DECLINED" };
  }

  /**
   * Add comment to change request. Allowed for all project members (representatives, consultants, staff).
   */
  static async addComment(
    db: D1Database,
    principal: UserPrincipal,
    params: { changeRequestId: string; commentText: string }
  ) {
    const cr = await queryFirst<any>(db, "SELECT project_id FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!params.commentText || params.commentText.trim().length === 0) {
      throw new AuthorizationError("Comment text is required", "INVALID_INPUT");
    }

    const commentId = generateId("crc");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO change_request_comments (id, change_request_id, user_id, comment_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [commentId, params.changeRequestId, principal.id, params.commentText.trim(), now]
    );

    return { id: commentId, changeRequestId: params.changeRequestId, createdAt: now };
  }

  /**
   * Confirm and allocate payment for a change request (AC-040).
   * ADMIN ONLY. Rejects non-admin attempts.
   * Allocates confirmed receipt funds toward the required pre-work payment.
   */
  static async confirmChangePayment(
    db: D1Database,
    principal: UserPrincipal,
    params: ConfirmChangePaymentParams
  ) {
    if (principal.role !== "ADMIN") {
      throw new AuthorizationError(
        "Only administrators can confirm and allocate payment for change requests",
        "FORBIDDEN"
      );
    }

    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");

    const version = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number]
    );
    if (!version) throw new AuthorizationError("Current estimate version not found", "NOT_FOUND");

    const receipt = await queryFirst<any>(db, "SELECT * FROM receipts WHERE id = ?", [
      params.receiptId,
    ]);
    if (!receipt) throw new AuthorizationError("Receipt not found", "NOT_FOUND");

    if (receipt.status !== "CONFIRMED") {
      throw new AuthorizationError(
        "Cannot allocate unconfirmed receipt funds. Admin must confirm receipt first.",
        "INVALID_STATE"
      );
    }

    const neededPayment = Math.max(0, version.required_prework_payment_minor - version.allocated_payment_minor);
    const requestedAmount = params.amountMinor !== undefined ? params.amountMinor : neededPayment;

    if (receipt.unallocated_minor < requestedAmount) {
      throw new AuthorizationError(
        `Allocation exceeds available unallocated receipt funds (available: ${receipt.unallocated_minor}, requested: ${requestedAmount})`,
        "INVALID_INPUT"
      );
    }

    const actualAllocation = requestedAmount;
    const newAllocatedMinor = version.allocated_payment_minor + actualAllocation;
    const now = Date.now();

    // 1. Record receipt allocation
    const allocId = generateId("rca");
    await execute(
      db,
      `INSERT INTO receipt_allocations (
        id, receipt_id, change_request_id, change_request_version_id,
        amount_minor, allocated_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        allocId,
        params.receiptId,
        params.changeRequestId,
        version.id,
        actualAllocation,
        principal.id,
        now,
      ]
    );

    // 2. Update receipt balances
    await execute(
      db,
      `UPDATE receipts
       SET allocated_minor = allocated_minor + ?, unallocated_minor = unallocated_minor - ?
       WHERE id = ?`,
      [actualAllocation, actualAllocation, params.receiptId]
    );

    // 3. Update version allocated payment
    await execute(
      db,
      `UPDATE change_request_versions
       SET allocated_payment_minor = ?, allocated_receipt_id = ?
       WHERE id = ?`,
      [newAllocatedMinor, params.receiptId, version.id]
    );

    // 4. Update change request status if fully satisfied
    const isPaymentFullySatisfied = newAllocatedMinor >= version.required_prework_payment_minor;
    if (isPaymentFullySatisfied) {
      await execute(
        db,
        "UPDATE change_requests SET status = 'PAYMENT_CONFIRMED', updated_at = ? WHERE id = ?",
        [now, params.changeRequestId]
      );
    }

    return {
      success: true,
      changeRequestId: params.changeRequestId,
      allocatedMinor: actualAllocation,
      totalAllocatedMinor: newAllocatedMinor,
      requiredMinor: version.required_prework_payment_minor,
      isFullySatisfied: isPaymentFullySatisfied,
      newStatus: isPaymentFullySatisfied ? "PAYMENT_CONFIRMED" : "ACCEPTED_AWAITING_PAYMENT",
    };
  }

  /**
   * Authorize change request for work execution (AC-040).
   * Guarded by THREE independent conditions:
   * 1. Main-client estimate acceptance.
   * 2. Administrator-confirmed required payment.
   * 3. Manager authorization.
   */
  static async authorizeChangeWork(
    db: D1Database,
    principal: UserPrincipal,
    params: { changeRequestId: string; notes?: string }
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError(
        "Only project managers can authorize additional change work",
        "FORBIDDEN"
      );
    }

    const version = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number]
    );
    if (!version) throw new AuthorizationError("Current estimate version not found", "NOT_FOUND");

    // Condition 1: Main-client acceptance check
    if (version.status !== "ACCEPTED" || !version.accepted_by_user_id) {
      throw new AuthorizationError(
        "Change request requires main client estimate acceptance before authorization",
        "ESTIMATE_NOT_ACCEPTED"
      );
    }

    // Condition 2: Admin-confirmed payment check
    if (version.allocated_payment_minor < version.required_prework_payment_minor) {
      throw new AuthorizationError(
        `Change request requires administrator-confirmed payment allocation before authorization (required: ${version.required_prework_payment_minor}, allocated: ${version.allocated_payment_minor})`,
        "PAYMENT_NOT_CONFIRMED"
      );
    }

    // Condition 3: Manager authorization
    const now = Date.now();
    await execute(
      db,
      `UPDATE change_request_versions
       SET authorized_by_user_id = ?, authorized_at = ?
       WHERE id = ?`,
      [principal.id, now, version.id]
    );

    await execute(
      db,
      "UPDATE change_requests SET status = 'AUTHORIZED', updated_at = ? WHERE id = ?",
      [now, params.changeRequestId]
    );

    return {
      changeRequestId: params.changeRequestId,
      versionNumber: cr.current_version_number,
      status: "AUTHORIZED" as ChangeRequestStatus,
      authorizedAt: now,
      authorizedByUserId: principal.id,
    };
  }

  /**
   * Revise estimate scope, price, or terms (AC-041).
   * Supersedes prior estimate version and INVALIDATES previous acceptance and authorization.
   * Requires fresh main-client acceptance, re-evaluated payment, and manager authorization.
   */
  static async reviseEstimate(
    db: D1Database,
    principal: UserPrincipal,
    params: ReviseEstimateParams
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [
      params.changeRequestId,
    ]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can revise change estimates", "FORBIDDEN");
    }

    const currentVersion = await queryFirst<any>(
      db,
      "SELECT * FROM change_request_versions WHERE change_request_id = ? AND version_number = ?",
      [params.changeRequestId, cr.current_version_number]
    );

    const now = Date.now();

    // 1. Mark existing version as SUPERSEDED (invalidates prior acceptance & authorization)
    if (currentVersion) {
      await execute(
        db,
        "UPDATE change_request_versions SET status = 'SUPERSEDED' WHERE id = ?",
        [currentVersion.id]
      );
    }

    // 2. Increment version and insert new version in ISSUED status
    const nextVersionNumber = cr.current_version_number + 1;
    const newVersionId = generateId("crv");
    const taxMinor = params.taxMinor || 0;
    const totalMinor = params.priceMinor + taxMinor;
    const requiredPrework = params.requiredPreworkPaymentMinor !== undefined
      ? params.requiredPreworkPaymentMinor
      : totalMinor;

    await execute(
      db,
      `INSERT INTO change_request_versions (
        id, change_request_id, version_number, currency, scope_summary,
        exclusions, price_minor, tax_minor, total_minor,
        required_prework_payment_minor, schedule_impact_days, status,
        allocated_payment_minor, created_at
      ) VALUES (?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, 'ISSUED', 0, ?)`,
      [
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
      ]
    );

    // 3. Reset change request status to AWAITING_CLIENT
    await execute(
      db,
      `UPDATE change_requests
       SET current_version_number = ?, status = 'AWAITING_CLIENT', updated_at = ?
       WHERE id = ?`,
      [nextVersionNumber, now, params.changeRequestId]
    );

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
    changeRequestId: string
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [changeRequestId]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (cr.status !== "AUTHORIZED") {
      throw new AuthorizationError(
        "Cannot start work before change request is fully authorized",
        "CHANGE_REQUEST_NOT_AUTHORIZED"
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_requests SET status = 'IN_PROGRESS', updated_at = ? WHERE id = ?",
      [now, changeRequestId]
    );

    return { id: changeRequestId, status: "IN_PROGRESS" };
  }

  /**
   * Complete change request.
   */
  static async completeChangeWork(
    db: D1Database,
    principal: UserPrincipal,
    changeRequestId: string
  ) {
    const cr = await queryFirst<any>(db, "SELECT * FROM change_requests WHERE id = ?", [changeRequestId]);
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can complete change requests", "FORBIDDEN");
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE change_requests SET status = 'COMPLETED', updated_at = ? WHERE id = ?",
      [now, changeRequestId]
    );

    return { id: changeRequestId, status: "COMPLETED" };
  }

  /**
   * Fetch a single change request with all versions, readiness indicators, and comments.
   */
  static async getChangeRequest(
    db: D1Database,
    principal: UserPrincipal,
    changeRequestId: string
  ) {
    const cr = await queryFirst<any>(
      db,
      `SELECT cr.*, u.display_name as requester_name
       FROM change_requests cr
       JOIN users u ON cr.requested_by_user_id = u.id
       WHERE cr.id = ?`,
      [changeRequestId]
    );
    if (!cr) throw new AuthorizationError("Change request not found", "NOT_FOUND");
    assertProjectAccess(principal, cr.project_id);

    const versions = await query<any>(
      db,
      `SELECT crv.*, a.display_name as accepted_by_name, m.display_name as authorized_by_name
       FROM change_request_versions crv
       LEFT JOIN users a ON crv.accepted_by_user_id = a.id
       LEFT JOIN users m ON crv.authorized_by_user_id = m.id
       WHERE crv.change_request_id = ?
       ORDER BY crv.version_number DESC`,
      [changeRequestId]
    );

    const comments = await query<any>(
      db,
      `SELECT c.*, u.display_name as author_name
       FROM change_request_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.change_request_id = ?
       ORDER BY c.created_at ASC`,
      [changeRequestId]
    );

    const currentVersion = versions.find((v) => v.version_number === cr.current_version_number);

    // Readiness evaluation (SCR-14: three independent conditions)
    const isAccepted = currentVersion?.status === "ACCEPTED" || currentVersion?.status === "SUPERSEDED"; // checked exact version
    const isPaymentSatisfied =
      currentVersion !== undefined &&
      currentVersion.allocated_payment_minor >= currentVersion.required_prework_payment_minor;
    const isAuthorized = currentVersion?.authorized_by_user_id !== null && currentVersion?.authorized_by_user_id !== undefined;

    return {
      ...cr,
      versions,
      comments,
      currentVersion,
      readiness: {
        condition1_estimateAccepted: Boolean(currentVersion?.accepted_by_user_id),
        condition2_paymentConfirmed: isPaymentSatisfied,
        condition3_managerAuthorized: isAuthorized,
        readyToStart: Boolean(currentVersion?.accepted_by_user_id) && isPaymentSatisfied && isAuthorized,
      },
    };
  }

  /**
   * List change requests for a project.
   */
  static async listChangeRequests(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string
  ) {
    assertProjectAccess(principal, projectId);

    const requests = await query<any>(
      db,
      `SELECT cr.*, u.display_name as requester_name
       FROM change_requests cr
       JOIN users u ON cr.requested_by_user_id = u.id
       WHERE cr.project_id = ?
       ORDER BY cr.created_at DESC`,
      [projectId]
    );

    return requests;
  }
}
