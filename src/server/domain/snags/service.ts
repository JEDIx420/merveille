/**
 * Site Issues and Snag Tracking Domain Service.
 * Enforces issue capture, manager triage/assignment, staff resolution vs manager
 * verified closure (AC-044), client/consultant visibility boundaries with confidential
 * remediation cost isolation (AC-045), and change gate compliance for charged remediation (AC-070).
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError, canReadInternalNotes } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { ArchiveService } from "../archive/service";

export type SnagSeverity = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type SnagStatus =
  | "REPORTED"
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "READY_FOR_VERIFICATION"
  | "CLOSED"
  | "REOPENED"
  | "DUPLICATE"
  | "NOT_ACCEPTED";

export interface ReportSnagParams {
  projectId: string;
  title: string;
  description: string;
  locationArea: string;
  severity?: SnagSeverity;
  relatedDrawingId?: string;
  fileIds?: string[];
  caption?: string;
}

export interface TriageSnagParams {
  snagId: string;
  severity?: SnagSeverity;
  assignedToUserId: string;
  targetDate?: string; // YYYY-MM-DD
  isClientShared?: boolean;
  isChargedWork?: boolean;
  changeRequestId?: string;
  internalCostMinor?: number;
  internalNotes?: string;
}

export interface SubmitResolutionParams {
  snagId: string;
  resolutionEvidence: string;
  afterPhotoFileIds?: string[];
}

export interface ReopenSnagParams {
  snagId: string;
  reason: string;
  newTargetDate?: string;
  newAssigneeId?: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class SnagsService {
  /**
   * Report an observed site issue / snag (REQ-SNG-001, AC-044).
   * Authorized clients, representatives, consultants, and staff may report.
   */
  static async reportSnag(
    db: D1Database,
    principal: UserPrincipal,
    params: ReportSnagParams
  ) {
    assertProjectAccess(principal, params.projectId);
    await ArchiveService.assertProjectNotArchived(db, params.projectId);

    if (!params.title || params.title.trim().length === 0) {
      throw new AuthorizationError("Snag title is required", "INVALID_INPUT");
    }
    if (!params.description || params.description.trim().length === 0) {
      throw new AuthorizationError("Snag description is required", "INVALID_INPUT");
    }
    if (!params.locationArea || params.locationArea.trim().length === 0) {
      throw new AuthorizationError("Location/area is required", "INVALID_INPUT");
    }

    // Allocate sequential snag number
    const countRow = await queryFirst<any>(
      db,
      "SELECT COUNT(*) as c FROM snags WHERE project_id = ?",
      [params.projectId]
    );
    const seq = (countRow?.c || 0) + 1;
    const snagNumber = `SNG-${String(seq).padStart(3, "0")}`;

    const snagId = generateId("sng");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO snags (
        id, org_id, project_id, snag_number, title, description,
        location_area, severity, status, reported_by_user_id, reported_at,
        related_drawing_id, is_client_shared, is_charged_work,
        reopen_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REPORTED', ?, ?, ?, 0, 0, 0, ?, ?)`,
      [
        snagId,
        principal.orgId,
        params.projectId,
        snagNumber,
        params.title.trim(),
        params.description.trim(),
        params.locationArea.trim(),
        params.severity || "MEDIUM",
        principal.id,
        now,
        params.relatedDrawingId || null,
        now,
        now,
      ]
    );

    // Attach initial before photos if provided
    if (params.fileIds && params.fileIds.length > 0) {
      for (const fId of params.fileIds) {
        await execute(
          db,
          `INSERT INTO snag_attachments (
            id, snag_id, file_id, attachment_type, is_internal_only, caption,
            uploaded_by_user_id, created_at
          ) VALUES (?, ?, ?, 'BEFORE_PHOTO', 0, ?, ?, ?)`,
          [generateId("sat"), snagId, fId, params.caption || null, principal.id, now]
        );
      }
    }

    // Audit event
    await execute(
      db,
      `INSERT INTO snag_events (
        id, snag_id, actor_id, event_type, from_status, to_status, notes, created_at
      ) VALUES (?, ?, ?, 'SNAG_REPORTED', NULL, 'REPORTED', ?, ?)`,
      [generateId("sev"), snagId, principal.id, `Reported at ${params.locationArea}`, now]
    );

    return {
      id: snagId,
      snagNumber,
      status: "REPORTED" as SnagStatus,
      createdAt: now,
    };
  }

  /**
   * Manager triage, assignment, and deadline setting (REQ-SNG-002, AC-044).
   * Validates assignee belongs to the same authorized project.
   */
  static async triageSnag(
    db: D1Database,
    principal: UserPrincipal,
    params: TriageSnagParams
  ) {
    const snag = await queryFirst<any>(db, "SELECT * FROM snags WHERE id = ?", [params.snagId]);
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can triage and assign site issues", "FORBIDDEN");
    }

    // Verify assignee belongs to this project (SCR-17)
    const assigneeMembership = await queryFirst<any>(
      db,
      "SELECT id FROM project_memberships WHERE project_id = ? AND user_id = ? AND is_active = 1",
      [snag.project_id, params.assignedToUserId]
    );
    if (!assigneeMembership) {
      throw new AuthorizationError(
        "Assignee must be an active member of this project",
        "INVALID_ASSIGNEE"
      );
    }

    const now = Date.now();
    await execute(
      db,
      `UPDATE snags
       SET status = 'OPEN', severity = COALESCE(?, severity),
           assigned_to_user_id = ?, assigned_by_user_id = ?,
           target_date = ?, is_client_shared = ?, is_charged_work = ?,
           change_request_id = ?, internal_cost_minor = ?, internal_notes = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        params.severity || null,
        params.assignedToUserId,
        principal.id,
        params.targetDate || null,
        params.isClientShared ? 1 : 0,
        params.isChargedWork ? 1 : 0,
        params.changeRequestId || null,
        params.internalCostMinor !== undefined ? params.internalCostMinor : null,
        params.internalNotes || null,
        now,
        params.snagId,
      ]
    );

    await execute(
      db,
      `INSERT INTO snag_events (
        id, snag_id, actor_id, event_type, from_status, to_status, notes, created_at
      ) VALUES (?, ?, ?, 'SNAG_TRIAGED', ?, 'OPEN', ?, ?)`,
      [
        generateId("sev"),
        params.snagId,
        principal.id,
        snag.status,
        `Assigned to user ${params.assignedToUserId}${params.targetDate ? ` with due date ${params.targetDate}` : ""}`,
        now,
      ]
    );

    return { id: params.snagId, status: "OPEN" as SnagStatus, assignedToUserId: params.assignedToUserId };
  }

  /**
   * Start operational remediation work on a snag.
   * If charged work (AC-070), MUST verify linked change request is authorized.
   */
  static async startSnagWork(db: D1Database, principal: UserPrincipal, snagId: string) {
    const snag = await queryFirst<any>(db, "SELECT * FROM snags WHERE id = ?", [snagId]);
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    // Enforce AC-070: Charged snag remediation obeys the change gate
    if (snag.is_charged_work) {
      if (!snag.change_request_id) {
        throw new AuthorizationError(
          "Charged snag remediation requires an authorized change request before starting work",
          "CHANGE_REQUEST_REQUIRED"
        );
      }

      const cr = await queryFirst<any>(
        db,
        "SELECT status FROM change_requests WHERE id = ?",
        [snag.change_request_id]
      );

      if (!cr || (cr.status !== "AUTHORIZED" && cr.status !== "IN_PROGRESS" && cr.status !== "COMPLETED")) {
        throw new AuthorizationError(
          "Charged snag remediation work remains blocked until change request is authorized and paid",
          "CHANGE_REQUEST_NOT_AUTHORIZED"
        );
      }
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE snags SET status = 'IN_PROGRESS', updated_at = ? WHERE id = ?",
      [now, snagId]
    );

    await execute(
      db,
      `INSERT INTO snag_events (
        id, snag_id, actor_id, event_type, from_status, to_status, notes, created_at
      ) VALUES (?, ?, ?, 'SNAG_STARTED', ?, 'IN_PROGRESS', 'Remediation work started', ?)`,
      [generateId("sev"), snagId, principal.id, snag.status, now]
    );

    return { id: snagId, status: "IN_PROGRESS" as SnagStatus };
  }

  /**
   * Submit resolution evidence by staff/assignee (AC-044).
   * Status transitions to READY_FOR_VERIFICATION.
   * Note: This does NOT close the issue; manager verification is required.
   */
  static async submitResolution(
    db: D1Database,
    principal: UserPrincipal,
    params: SubmitResolutionParams
  ) {
    const snag = await queryFirst<any>(db, "SELECT * FROM snags WHERE id = ?", [params.snagId]);
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    if (!params.resolutionEvidence || params.resolutionEvidence.trim().length === 0) {
      throw new AuthorizationError("Resolution evidence note is required", "INVALID_INPUT");
    }

    const now = Date.now();

    // Attach after photos if provided
    if (params.afterPhotoFileIds && params.afterPhotoFileIds.length > 0) {
      for (const fId of params.afterPhotoFileIds) {
        await execute(
          db,
          `INSERT INTO snag_attachments (
            id, snag_id, file_id, attachment_type, is_internal_only, caption,
            uploaded_by_user_id, created_at
          ) VALUES (?, ?, ?, 'AFTER_PHOTO', 0, 'Resolution photo', ?, ?)`,
          [generateId("sat"), params.snagId, fId, principal.id, now]
        );
      }
    }

    await execute(
      db,
      "UPDATE snags SET status = 'READY_FOR_VERIFICATION', updated_at = ? WHERE id = ?",
      [now, params.snagId]
    );

    await execute(
      db,
      `INSERT INTO snag_events (
        id, snag_id, actor_id, event_type, from_status, to_status, notes, resolution_evidence, created_at
      ) VALUES (?, ?, ?, 'SNAG_RESOLUTION_SUBMITTED', ?, 'READY_FOR_VERIFICATION', 'Resolution submitted for manager review', ?, ?)`,
      [generateId("sev"), params.snagId, principal.id, snag.status, params.resolutionEvidence.trim(), now]
    );

    return { id: params.snagId, status: "READY_FOR_VERIFICATION" as SnagStatus };
  }

  /**
   * Manager verified closure (REQ-SNG-003, AC-044).
   * ONLY project managers can record verified closure.
   */
  static async verifyCloseSnag(
    db: D1Database,
    principal: UserPrincipal,
    params: { snagId: string; notes?: string }
  ) {
    const snag = await queryFirst<any>(db, "SELECT * FROM snags WHERE id = ?", [params.snagId]);
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can verify and close site snags", "FORBIDDEN");
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE snags SET status = 'CLOSED', updated_at = ? WHERE id = ?",
      [now, params.snagId]
    );

    await execute(
      db,
      `INSERT INTO snag_events (
        id, snag_id, actor_id, event_type, from_status, to_status, notes, created_at
      ) VALUES (?, ?, ?, 'SNAG_VERIFIED_CLOSED', ?, 'CLOSED', ?, ?)`,
      [
        generateId("sev"),
        params.snagId,
        principal.id,
        snag.status,
        params.notes || "Verified resolved following site inspection",
        now,
      ]
    );

    return { id: params.snagId, status: "CLOSED" as SnagStatus, verifiedByUserId: principal.id };
  }

  /**
   * Manager reopens snag with reason (AC-044).
   * Preserves previous resolution evidence and increments reopen_count.
   */
  static async reopenSnag(
    db: D1Database,
    principal: UserPrincipal,
    params: ReopenSnagParams
  ) {
    const snag = await queryFirst<any>(db, "SELECT * FROM snags WHERE id = ?", [params.snagId]);
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    if (!["MANAGER", "ADMIN", "OWNER"].includes(principal.role)) {
      throw new AuthorizationError("Only project managers can reopen site snags", "FORBIDDEN");
    }

    if (!params.reason || params.reason.trim().length === 0) {
      throw new AuthorizationError("Reopen reason is mandatory", "INVALID_INPUT");
    }

    const now = Date.now();
    const effectiveDueDate = params.newTargetDate || snag.target_date;
    const effectiveAssignee = params.newAssigneeId || snag.assigned_to_user_id;

    await execute(
      db,
      `UPDATE snags
       SET status = 'OPEN', reopen_count = reopen_count + 1,
           target_date = ?, assigned_to_user_id = ?, updated_at = ?
       WHERE id = ?`,
      [effectiveDueDate, effectiveAssignee, now, params.snagId]
    );

    await execute(
      db,
      `INSERT INTO snag_events (
        id, snag_id, actor_id, event_type, from_status, to_status, notes, created_at
      ) VALUES (?, ?, ?, 'SNAG_REOPENED', ?, 'OPEN', ?, ?)`,
      [
        generateId("sev"),
        params.snagId,
        principal.id,
        snag.status,
        `Reopened: ${params.reason.trim()}`,
        now,
      ]
    );

    return {
      id: params.snagId,
      status: "OPEN" as SnagStatus,
      reopenCount: snag.reopen_count + 1,
    };
  }

  /**
   * Add comment to snag with optional internal isolation.
   */
  static async addComment(
    db: D1Database,
    principal: UserPrincipal,
    params: { snagId: string; commentText: string; isInternalOnly?: boolean }
  ) {
    const snag = await queryFirst<any>(db, "SELECT project_id FROM snags WHERE id = ?", [params.snagId]);
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    if (!params.commentText || params.commentText.trim().length === 0) {
      throw new AuthorizationError("Comment text is required", "INVALID_INPUT");
    }

    const canInternal = canReadInternalNotes(principal, snag.project_id);
    const isInternal = Boolean(params.isInternalOnly && canInternal);

    const commentId = generateId("snc");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO snag_comments (
        id, snag_id, user_id, comment_text, is_internal_only, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [commentId, params.snagId, principal.id, params.commentText.trim(), isInternal ? 1 : 0, now]
    );

    return { id: commentId, snagId: params.snagId, isInternalOnly: isInternal, createdAt: now };
  }

  /**
   * Retrieve snag detail with protected external projection (AC-045).
   * External clients and consultants cannot see internal remediation notes,
   * internal costs, or internal-only attachments.
   */
  static async getSnag(db: D1Database, principal: UserPrincipal, snagId: string) {
    const snag = await queryFirst<any>(
      db,
      `SELECT s.*, r.display_name as reporter_name, a.display_name as assignee_name, m.display_name as manager_name
       FROM snags s
       JOIN users r ON s.reported_by_user_id = r.id
       LEFT JOIN users a ON s.assigned_to_user_id = a.id
       LEFT JOIN users m ON s.assigned_by_user_id = m.id
       WHERE s.id = ?`,
      [snagId]
    );
    if (!snag) throw new AuthorizationError("Snag not found", "NOT_FOUND");
    assertProjectAccess(principal, snag.project_id);

    const canSeeInternal = canReadInternalNotes(principal, snag.project_id);

    // External participant access check (SCR-17, AC-045)
    if (!canSeeInternal) {
      const isReporter = snag.reported_by_user_id === principal.id;
      if (!isReporter && !snag.is_client_shared) {
        throw new AuthorizationError(
          "This site issue has not been approved for client/consultant viewing",
          "FORBIDDEN"
        );
      }
    }

    // Attachments with internal isolation (AC-045)
    const attachments = await query<any>(
      db,
      `SELECT sa.*, f.file_name, f.size_bytes, f.mime_type, u.display_name as uploader_name
       FROM snag_attachments sa
       JOIN files f ON sa.file_id = f.id
       JOIN users u ON sa.uploaded_by_user_id = u.id
       WHERE sa.snag_id = ? ${canSeeInternal ? "" : "AND sa.is_internal_only = 0"}
       ORDER BY sa.created_at ASC`,
      [snagId]
    );

    // Comments with internal isolation (AC-045)
    const comments = await query<any>(
      db,
      `SELECT sc.*, u.display_name as author_name
       FROM snag_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.snag_id = ? ${canSeeInternal ? "" : "AND sc.is_internal_only = 0"}
       ORDER BY sc.created_at ASC`,
      [snagId]
    );

    // Audit history
    const events = await query<any>(
      db,
      `SELECT se.*, u.display_name as actor_name
       FROM snag_events se
       JOIN users u ON se.actor_id = u.id
       WHERE se.snag_id = ?
       ORDER BY se.created_at ASC`,
      [snagId]
    );

    return {
      ...snag,
      internal_notes: canSeeInternal ? snag.internal_notes : undefined,
      internal_cost_minor: canSeeInternal ? snag.internal_cost_minor : undefined,
      attachments,
      comments,
      events,
    };
  }

  /**
   * List snags for a project with permission-scoped visibility.
   */
  static async listSnags(db: D1Database, principal: UserPrincipal, projectId: string) {
    assertProjectAccess(principal, projectId);
    const canSeeInternal = canReadInternalNotes(principal, projectId);

    let rows: any[];
    if (canSeeInternal) {
      rows = await query<any>(
        db,
        `SELECT s.*, r.display_name as reporter_name, a.display_name as assignee_name
         FROM snags s
         JOIN users r ON s.reported_by_user_id = r.id
         LEFT JOIN users a ON s.assigned_to_user_id = a.id
         WHERE s.project_id = ?
         ORDER BY s.created_at DESC`,
        [projectId]
      );
    } else {
      // Clients/consultants see only client-shared snags OR snags they reported (AC-045)
      rows = await query<any>(
        db,
        `SELECT s.*, r.display_name as reporter_name, a.display_name as assignee_name
         FROM snags s
         JOIN users r ON s.reported_by_user_id = r.id
         LEFT JOIN users a ON s.assigned_to_user_id = a.id
         WHERE s.project_id = ? AND (s.is_client_shared = 1 OR s.reported_by_user_id = ?)
         ORDER BY s.created_at DESC`,
        [projectId, principal.id]
      );
    }

    return rows.map((r) => ({
      ...r,
      internal_notes: canSeeInternal ? r.internal_notes : undefined,
      internal_cost_minor: canSeeInternal ? r.internal_cost_minor : undefined,
    }));
  }
}
