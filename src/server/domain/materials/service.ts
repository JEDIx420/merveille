import { assertProjectOrganisation } from "../../auth/policy";
/**
 * Client References, Material Selections, and Execution Readiness Domain Service.
 * Enforces client reference scoping, representative suggestions vs authoritative
 * main-client selections, internal pricing note confidentiality, and commercial
 * change gate compliance before execution readiness.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import {
  assertProjectAccess,
  AuthorizationError,
  canReadInternalNotes,
  canAcceptContractualDecisions,
} from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { ArchiveService } from "../archive/service";

export type SelectionStatus =
  | "DRAFT"
  | "AWAITING_MAIN_CLIENT"
  | "SELECTED"
  | "CHANGES_REQUESTED"
  | "READY_FOR_EXECUTION"
  | "CANCELLED";

export interface AddReferenceParams {
  projectId: string;
  caption: string;
  fileId?: string;
  externalUrl?: string;
  roomArea?: string;
  category?: string;
}

export interface CreateSelectionOptionInput {
  label: string;
  description?: string;
  fileId?: string;
  externalLink?: string;
  costImplicationMinor?: number;
  scheduleImplicationDays?: number;
  isRecommended?: boolean;
}

export interface CreateSelectionItemParams {
  projectId: string;
  title: string;
  location?: string;
  question: string;
  neededByDate?: string;
  internalNotes?: string;
  options: CreateSelectionOptionInput[];
}

export interface RecordSuggestionParams {
  selectionItemId: string;
  optionId?: string;
  suggestionType?: "SUGGESTION" | "COMMENT";
  commentText: string;
}

export interface SelectOptionParams {
  selectionItemId: string;
  optionId: string;
  comment?: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class MaterialsService {
  /**
   * Helper to determine if an actor is the authorized MAIN_CLIENT for a project.
   */
  static isMainClient(principal: UserPrincipal, projectId: string): boolean {
    return canAcceptContractualDecisions(principal, projectId);
  }

  // ---------------------------------------------------------------------------
  // 1. Client References
  // ---------------------------------------------------------------------------

  static async addReference(
    db: D1Database,
    principal: UserPrincipal,
    params: AddReferenceParams,
  ) {
    assertProjectAccess(principal, params.projectId);
    await assertProjectOrganisation(db, principal, params.projectId);
    await ArchiveService.assertProjectNotArchived(db, params.projectId);

    if (!params.caption || params.caption.trim().length === 0) {
      throw new AuthorizationError(
        "Reference caption is required",
        "INVALID_INPUT",
      );
    }

    if (params.fileId) {
      const file = await queryFirst<any>(
        db,
        "SELECT * FROM files WHERE id = ?",
        [params.fileId],
      );
      if (
        !file ||
        file.org_id !== principal.orgId ||
        file.project_id !== params.projectId ||
        file.status !== "READY" ||
        file.is_internal_only
      )
        throw new AuthorizationError(
          "A completed shared file from this project is required.",
          "INVALID_INPUT",
        );
    }

    const refId = generateId("ref");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO client_references (
        id, org_id, project_id, uploaded_by_user_id, file_id,
        external_url, caption, room_area, category, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        refId,
        principal.orgId,
        params.projectId,
        principal.id,
        params.fileId || null,
        params.externalUrl || null,
        params.caption.trim(),
        params.roomArea || null,
        params.category || null,
        now,
      ],
    );

    return {
      id: refId,
      projectId: params.projectId,
      caption: params.caption.trim(),
      uploadedByUserId: principal.id,
      createdAt: now,
    };
  }

  static async getReference(
    db: D1Database,
    principal: UserPrincipal,
    referenceId: string,
  ) {
    const ref = await queryFirst<any>(
      db,
      `SELECT r.*, u.display_name as uploader_name, f.file_name, f.size_bytes as file_size
       FROM client_references r
       JOIN users u ON r.uploaded_by_user_id = u.id
       LEFT JOIN files f ON r.file_id = f.id
       WHERE r.id = ?`,
      [referenceId],
    );

    if (!ref) throw new AuthorizationError("Reference not found", "NOT_FOUND");
    assertProjectAccess(principal, ref.project_id);
    await assertProjectOrganisation(db, principal, ref.project_id);
    if (ref.org_id !== principal.orgId)
      throw new AuthorizationError("Reference not found", "NOT_FOUND");

    const comments = await query<any>(
      db,
      `SELECT c.*, u.display_name as author_name
       FROM client_reference_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.reference_id = ?
       ORDER BY c.created_at ASC`,
      [referenceId],
    );

    return { ...ref, comments };
  }

  static async listReferences(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string,
  ) {
    assertProjectAccess(principal, projectId);
    await assertProjectOrganisation(db, principal, projectId);

    return await query<any>(
      db,
      `SELECT r.*, u.display_name as uploader_name, f.file_name
       FROM client_references r
       JOIN users u ON r.uploaded_by_user_id = u.id
       LEFT JOIN files f ON r.file_id = f.id
       WHERE r.project_id = ?
       ORDER BY r.created_at DESC`,
      [projectId],
    );
  }

  static async addReferenceComment(
    db: D1Database,
    principal: UserPrincipal,
    params: { referenceId: string; commentText: string },
  ) {
    const ref = await queryFirst<any>(
      db,
      "SELECT * FROM client_references WHERE id = ?",
      [params.referenceId],
    );
    if (!ref) throw new AuthorizationError("Reference not found", "NOT_FOUND");
    assertProjectAccess(principal, ref.project_id);
    await assertProjectOrganisation(db, principal, ref.project_id);
    if (ref.org_id !== principal.orgId)
      throw new AuthorizationError("Reference not found", "NOT_FOUND");
    await ArchiveService.assertProjectNotArchived(db, ref.project_id);

    if (!params.commentText || params.commentText.trim().length === 0) {
      throw new AuthorizationError("Comment text is required", "INVALID_INPUT");
    }

    const commentId = generateId("rfc");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO client_reference_comments (id, reference_id, user_id, comment_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        commentId,
        params.referenceId,
        principal.id,
        params.commentText.trim(),
        now,
      ],
    );

    return { id: commentId, referenceId: params.referenceId, createdAt: now };
  }

  // ---------------------------------------------------------------------------
  // 2. Material Selections
  // ---------------------------------------------------------------------------

  static async createSelectionItem(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateSelectionItemParams,
  ) {
    assertProjectAccess(principal, params.projectId);
    await assertProjectOrganisation(db, principal, params.projectId);
    await ArchiveService.assertProjectNotArchived(db, params.projectId);

    // Only internal practice staff can create/frame selection items (SCR-13)
    if (
      !hasCapability(principal, "TEAM_MEMBER", params.projectId) &&
      !hasCapability(principal, "MANAGER", params.projectId)
    ) {
      throw new AuthorizationError(
        "Only practice staff can frame material selection decision items",
        "FORBIDDEN",
      );
    }

    if (!params.title || params.title.trim().length === 0) {
      throw new AuthorizationError(
        "Selection title is required",
        "INVALID_INPUT",
      );
    }
    if (!params.question || params.question.trim().length === 0) {
      throw new AuthorizationError(
        "Decision question is required",
        "INVALID_INPUT",
      );
    }
    if (!params.options || params.options.length === 0) {
      throw new AuthorizationError(
        "At least one option must be provided",
        "INVALID_INPUT",
      );
    }

    for (const option of params.options ?? []) {
      if (option.fileId) {
        const file = await queryFirst<any>(
          db,
          "SELECT id FROM files WHERE id=? AND org_id=? AND project_id=? AND status='READY' AND is_internal_only=0",
          [option.fileId, principal.orgId, params.projectId],
        );
        if (!file)
          throw new AuthorizationError(
            "A completed shared file from this project is required.",
            "INVALID_INPUT",
          );
      }
      if (!Number.isSafeInteger(option.costImplicationMinor ?? 0))
        throw new AuthorizationError(
          "Material cost must use integer minor units.",
          "INVALID_INPUT",
        );
    }
    const itemId = generateId("msi");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO material_selection_items (
        id, org_id, project_id, title, location, question, needed_by_date,
        status, internal_notes, responsible_manager_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'AWAITING_MAIN_CLIENT', ?, ?, ?, ?)`,
      [
        itemId,
        principal.orgId,
        params.projectId,
        params.title.trim(),
        params.location || null,
        params.question.trim(),
        params.neededByDate || null,
        params.internalNotes || null,
        principal.id,
        now,
        now,
      ],
    );

    for (const opt of params.options) {
      const optId = generateId("mso");
      await execute(
        db,
        `INSERT INTO material_selection_options (
          id, selection_item_id, option_label, description, file_id,
          external_link, cost_implication_minor, schedule_implication_days,
          is_recommended, version_number, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          optId,
          itemId,
          opt.label.trim(),
          opt.description || null,
          opt.fileId || null,
          opt.externalLink || null,
          opt.costImplicationMinor || 0,
          opt.scheduleImplicationDays || 0,
          opt.isRecommended ? 1 : 0,
          now,
        ],
      );
    }

    return { id: itemId, status: "AWAITING_MAIN_CLIENT" };
  }

  /**
   * Record representative or consultant suggestion / comment.
   * Note: This does NOT select the option or authorize work.
   */
  static async recordSuggestion(
    db: D1Database,
    principal: UserPrincipal,
    params: RecordSuggestionParams,
  ) {
    const item = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_items WHERE id = ?",
      [params.selectionItemId],
    );
    if (!item)
      throw new AuthorizationError("Selection item not found", "NOT_FOUND");
    assertProjectAccess(principal, item.project_id);
    await assertProjectOrganisation(db, principal, item.project_id);
    await ArchiveService.assertProjectNotArchived(db, item.project_id);
    if (item.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!params.commentText || params.commentText.trim().length === 0) {
      throw new AuthorizationError(
        "Comment / suggestion text is required",
        "INVALID_INPUT",
      );
    }

    const suggestionId = generateId("mss");
    const now = Date.now();

    await execute(
      db,
      `INSERT INTO material_selection_suggestions (
        id, selection_item_id, option_id, user_id, suggestion_type, comment_text, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        suggestionId,
        params.selectionItemId,
        params.optionId || null,
        principal.id,
        params.suggestionType || "SUGGESTION",
        params.commentText.trim(),
        now,
      ],
    );

    return {
      id: suggestionId,
      selectionItemId: params.selectionItemId,
      suggestionType: params.suggestionType || "SUGGESTION",
      commentText: params.commentText.trim(),
      createdAt: now,
    };
  }

  /**
   * Binding material selection.
   * ONLY MAIN_CLIENT can make binding selections.
   * Representatives cannot select or overwrite previous selections.
   */
  static async selectOption(
    db: D1Database,
    principal: UserPrincipal,
    params: SelectOptionParams,
  ) {
    const item = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_items WHERE id = ?",
      [params.selectionItemId],
    );
    if (!item)
      throw new AuthorizationError("Selection item not found", "NOT_FOUND");
    assertProjectAccess(principal, item.project_id);
    await assertProjectOrganisation(db, principal, item.project_id);
    await ArchiveService.assertProjectNotArchived(db, item.project_id);
    if (item.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    // Enforce MAIN_CLIENT authority
    if (!this.isMainClient(principal, item.project_id)) {
      throw new AuthorizationError(
        "Only the main client has authority to make binding material decisions",
        "MAIN_CLIENT_SELECTION_REQUIRED",
      );
    }

    const authority = await queryFirst<any>(
      db,
      "SELECT main_client_user_id FROM projects WHERE id=? AND org_id=?",
      [item.project_id, principal.orgId],
    );
    if (authority?.main_client_user_id !== principal.id)
      throw new AuthorizationError(
        "Main-client authority changed",
        "FORBIDDEN",
      );
    const option = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_options WHERE id = ? AND selection_item_id = ?",
      [params.optionId, params.selectionItemId],
    );
    if (!option)
      throw new AuthorizationError(
        "Option not found for this selection item",
        "NOT_FOUND",
      );

    const now = Date.now();

    await execute(
      db,
      `UPDATE material_selection_items
       SET status = 'SELECTED', selected_option_id = ?, selected_by_user_id = ?,
           selected_at = ?, updated_at = ?
       WHERE id = ?`,
      [params.optionId, principal.id, now, now, params.selectionItemId],
    );

    return {
      id: params.selectionItemId,
      status: "SELECTED",
      selectedOptionId: params.optionId,
      costImplicationMinor: option.cost_implication_minor,
      requiresChangeRequest: option.cost_implication_minor > 0,
    };
  }

  /**
   * Mark selection item ready for execution.
   * Only MANAGER, ADMIN, OWNER.
   * If selected option has cost implication > 0, an AUTHORIZED change request is MANDATORY.
   */
  static async markReadyForExecution(
    db: D1Database,
    principal: UserPrincipal,
    selectionItemId: string,
  ) {
    const item = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_items WHERE id = ?",
      [selectionItemId],
    );
    if (!item)
      throw new AuthorizationError("Selection item not found", "NOT_FOUND");
    assertProjectAccess(principal, item.project_id);
    await assertProjectOrganisation(db, principal, item.project_id);
    await ArchiveService.assertProjectNotArchived(db, item.project_id);
    if (item.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", item.project_id)) {
      throw new AuthorizationError(
        "Only project managers can record execution readiness",
        "FORBIDDEN",
      );
    }

    if (item.status !== "SELECTED") {
      throw new AuthorizationError(
        "Item must have a binding selection before being marked ready for execution",
        "INVALID_STATE",
      );
    }

    const option = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_options WHERE id = ?",
      [item.selected_option_id],
    );
    if (!option)
      throw new AuthorizationError("Selected option not found", "NOT_FOUND");

    // Commercial gate: Added cost enters change process; selection alone doesn't authorise work
    if (option.cost_implication_minor > 0) {
      if (!item.change_request_id) {
        throw new AuthorizationError(
          "Cost-impacting selection requires an authorized change request before execution readiness",
          "CHANGE_REQUEST_REQUIRED",
        );
      }

      const cr = await queryFirst<any>(
        db,
        "SELECT status FROM change_requests WHERE id = ?",
        [item.change_request_id],
      );

      if (
        !cr ||
        (cr.status !== "AUTHORIZED" &&
          cr.status !== "IN_PROGRESS" &&
          cr.status !== "COMPLETED")
      ) {
        throw new AuthorizationError(
          "Cannot mark selection ready for execution: linked change request is not authorized",
          "CHANGE_REQUEST_NOT_AUTHORIZED",
        );
      }
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE material_selection_items SET status = 'READY_FOR_EXECUTION', updated_at = ? WHERE id = ?",
      [now, selectionItemId],
    );

    return { id: selectionItemId, status: "READY_FOR_EXECUTION" };
  }

  /**
   * Link a change request to a material selection item.
   */
  static async linkChangeRequest(
    db: D1Database,
    principal: UserPrincipal,
    params: { selectionItemId: string; changeRequestId: string },
  ) {
    const item = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_items WHERE id = ?",
      [params.selectionItemId],
    );
    if (!item)
      throw new AuthorizationError("Selection item not found", "NOT_FOUND");
    assertProjectAccess(principal, item.project_id);
    await assertProjectOrganisation(db, principal, item.project_id);
    await ArchiveService.assertProjectNotArchived(db, item.project_id);
    if (item.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!hasCapability(principal, "MANAGER", item.project_id))
      throw new AuthorizationError(
        "Only the assigned manager can link additional work",
      );
    const change = await queryFirst<any>(
      db,
      "SELECT id FROM change_requests WHERE id=? AND project_id=? AND org_id=?",
      [params.changeRequestId, item.project_id, principal.orgId],
    );
    if (!change)
      throw new AuthorizationError(
        "Change request belongs to another project",
        "INVALID_INPUT",
      );
    await execute(
      db,
      "UPDATE material_selection_items SET change_request_id = ?, updated_at = ? WHERE id = ?",
      [params.changeRequestId, Date.now(), params.selectionItemId],
    );

    return {
      success: true,
      selectionItemId: params.selectionItemId,
      changeRequestId: params.changeRequestId,
    };
  }

  /**
   * Request changes / alternatives by Main Client.
   */
  static async requestChanges(
    db: D1Database,
    principal: UserPrincipal,
    params: { selectionItemId: string; reason: string },
  ) {
    const item = await queryFirst<any>(
      db,
      "SELECT * FROM material_selection_items WHERE id = ?",
      [params.selectionItemId],
    );
    if (!item)
      throw new AuthorizationError("Selection item not found", "NOT_FOUND");
    assertProjectAccess(principal, item.project_id);
    await assertProjectOrganisation(db, principal, item.project_id);
    await ArchiveService.assertProjectNotArchived(db, item.project_id);
    if (item.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    if (!this.isMainClient(principal, item.project_id)) {
      throw new AuthorizationError(
        "Only the main client can request alternative material choices",
        "MAIN_CLIENT_SELECTION_REQUIRED",
      );
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE material_selection_items SET status = 'CHANGES_REQUESTED', updated_at = ? WHERE id = ?",
      [now, params.selectionItemId],
    );

    if (params.reason) {
      await this.recordSuggestion(db, principal, {
        selectionItemId: params.selectionItemId,
        suggestionType: "COMMENT",
        commentText: `Alternatives requested: ${params.reason}`,
      });
    }

    return { id: params.selectionItemId, status: "CHANGES_REQUESTED" };
  }

  /**
   * Get single selection item with protected projection (AC-042, SCR-13).
   * Strips internal sourcing/pricing notes for clients and consultants.
   */
  static async getSelectionItem(
    db: D1Database,
    principal: UserPrincipal,
    selectionItemId: string,
  ) {
    const item = await queryFirst<any>(
      db,
      `SELECT m.*, u.display_name as manager_name, s.display_name as selector_name
       FROM material_selection_items m
       LEFT JOIN users u ON m.responsible_manager_id = u.id
       LEFT JOIN users s ON m.selected_by_user_id = s.id
       WHERE m.id = ?`,
      [selectionItemId],
    );
    if (!item)
      throw new AuthorizationError("Selection item not found", "NOT_FOUND");
    assertProjectAccess(principal, item.project_id);
    await assertProjectOrganisation(db, principal, item.project_id);
    if (item.org_id !== principal.orgId)
      throw new AuthorizationError("Record not found", "NOT_FOUND");

    const options = await query<any>(
      db,
      `SELECT o.*, f.file_name
       FROM material_selection_options o
       LEFT JOIN files f ON o.file_id = f.id
       WHERE o.selection_item_id = ?
       ORDER BY o.is_recommended DESC, o.created_at ASC`,
      [selectionItemId],
    );

    const suggestions = await query<any>(
      db,
      `SELECT s.*, u.display_name as user_name
       FROM material_selection_suggestions s
       JOIN users u ON s.user_id = u.id
       WHERE s.selection_item_id = ?
       ORDER BY s.created_at ASC`,
      [selectionItemId],
    );

    // Enforce confidentiality: internal_notes are hidden from clients and consultants (AC-042, SCR-13)
    const canSeeInternal = canReadInternalNotes(principal, item.project_id);

    return {
      ...item,
      internal_notes: canSeeInternal ? item.internal_notes : undefined,
      options,
      suggestions,
    };
  }

  /**
   * List selection items for a project with confidentiality projection.
   */
  static async listSelectionItems(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string,
  ) {
    assertProjectAccess(principal, projectId);
    await assertProjectOrganisation(db, principal, projectId);
    const canSeeInternal = canReadInternalNotes(principal, projectId);

    const items = await query<any>(
      db,
      `SELECT m.*, u.display_name as manager_name, s.display_name as selector_name
       FROM material_selection_items m
       LEFT JOIN users u ON m.responsible_manager_id = u.id
       LEFT JOIN users s ON m.selected_by_user_id = s.id
       WHERE m.project_id = ?
       ORDER BY m.created_at DESC`,
      [projectId],
    );

    return items.map((it) => ({
      ...it,
      internal_notes: canSeeInternal ? it.internal_notes : undefined,
    }));
  }
}
