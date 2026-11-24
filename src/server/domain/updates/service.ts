/**
 * Domain service for project updates, internal notes, and company announcements.
 * Enforces manager publication boundary, internal note confidentiality, and targeted announcements.
 */

import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../auth/principal";
import {
  assertProjectAccess,
  canReadInternalNotes,
  canPublishProjectUpdates,
  canManageCompanyAnnouncements,
  AuthorizationError,
} from "../../auth/policy";

export interface CreateProjectUpdateParams {
  projectId: string;
  stageId?: string;
  title: string;
  bodyText: string;
  observedDate?: string; // YYYY-MM-DD
  fileIds?: string[];
}

export interface CreateUpdateVersionParams {
  updateId: string;
  title: string;
  bodyText: string;
  observedDate?: string;
  fileIds?: string[];
}

export interface CreateInternalNoteParams {
  projectId: string;
  title: string;
  bodyText: string;
  attachmentFileId?: string;
  isConfidential?: boolean;
}

export interface CreateAnnouncementParams {
  title: string;
  bodyText: string;
  audienceType: "SELECTED_PROJECTS" | "SELECTED_CLIENTS" | "ALL_CLIENTS";
  targetProjectIds?: string[];
  targetClientUserIds?: string[];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class UpdatesService {
  /**
   * Create a new project update draft (AC-022).
   * Restricted to internal team members (STAFF, MANAGER, ADMIN, OWNER).
   */
  static async createProjectUpdate(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateProjectUpdateParams
  ) {
    assertProjectAccess(principal, params.projectId);

    if (!canReadInternalNotes(principal, params.projectId)) {
      throw new AuthorizationError(
        "Clients and consultants cannot create project updates",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    const updateId = generateId("upd");
    const versionId = generateId("upv");

    // 1. Create parent update record
    await db
      .prepare(
        `INSERT INTO project_updates (
          id, org_id, project_id, stage_id, author_id,
          current_published_version_id, is_retracted, revision, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, 0, 1, ?)`
      )
      .bind(
        updateId,
        principal.orgId,
        params.projectId,
        params.stageId || null,
        principal.id,
        now
      )
      .run();

    // 2. Create version 1 in DRAFT status
    await db
      .prepare(
        `INSERT INTO update_versions (
          id, update_id, version_number, title, body_text,
          observed_date, status, revision, created_at
        ) VALUES (?, ?, 1, ?, ?, ?, 'DRAFT', 1, ?)`
      )
      .bind(
        versionId,
        updateId,
        params.title,
        params.bodyText,
        params.observedDate || null,
        now
      )
      .run();

    // 3. Attach files and mark them referenced (AC-060)
    if (params.fileIds && params.fileIds.length > 0) {
      for (const fileId of params.fileIds) {
        await db
          .prepare(
            `INSERT INTO update_attachments (id, version_id, file_id, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(generateId("upa"), versionId, fileId, now)
          .run();

        await db
          .prepare(`UPDATE files SET is_referenced = 1 WHERE id = ?`)
          .bind(fileId)
          .run();
      }
    }

    return { updateId, versionId };
  }

  /**
   * Create a subsequent version proposal for an existing update (AC-023).
   * V1 remains published until the new version is reviewed and published.
   */
  static async createUpdateVersion(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateUpdateVersionParams
  ) {
    const update = (await db
      .prepare(`SELECT * FROM project_updates WHERE id = ?`)
      .bind(params.updateId)
      .first()) as any;

    if (!update) {
      throw new Error("Update not found");
    }

    assertProjectAccess(principal, update.project_id);
    if (!canReadInternalNotes(principal, update.project_id)) {
      throw new AuthorizationError(
        "Clients and consultants cannot edit updates",
        "FORBIDDEN"
      );
    }

    const maxVerRow = (await db
      .prepare(
        `SELECT MAX(version_number) as max_v FROM update_versions WHERE update_id = ?`
      )
      .bind(params.updateId)
      .first()) as any;
    const nextVersionNumber = (maxVerRow?.max_v || 1) + 1;

    const now = Date.now();
    const versionId = generateId("upv");

    await db
      .prepare(
        `INSERT INTO update_versions (
          id, update_id, version_number, title, body_text,
          observed_date, status, revision, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', 1, ?)`
      )
      .bind(
        versionId,
        params.updateId,
        nextVersionNumber,
        params.title,
        params.bodyText,
        params.observedDate || null,
        now
      )
      .run();

    if (params.fileIds && params.fileIds.length > 0) {
      for (const fileId of params.fileIds) {
        await db
          .prepare(
            `INSERT INTO update_attachments (id, version_id, file_id, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(generateId("upa"), versionId, fileId, now)
          .run();

        await db
          .prepare(`UPDATE files SET is_referenced = 1 WHERE id = ?`)
          .bind(fileId)
          .run();
      }
    }

    return { updateId: params.updateId, versionId, versionNumber: nextVersionNumber };
  }

  /**
   * Submit draft update version for manager review.
   */
  static async submitUpdateForReview(
    db: D1Database,
    principal: UserPrincipal,
    versionId: string
  ) {
    const version = (await db
      .prepare(
        `SELECT uv.*, pu.project_id
         FROM update_versions uv
         JOIN project_updates pu ON uv.update_id = pu.id
         WHERE uv.id = ?`
      )
      .bind(versionId)
      .first()) as any;

    if (!version) throw new Error("Update version not found");
    assertProjectAccess(principal, version.project_id);

    if (version.status !== "DRAFT" && version.status !== "CHANGES_REQUESTED") {
      throw new Error(`Cannot submit update version in status ${version.status}`);
    }

    await db
      .prepare(`UPDATE update_versions SET status = 'IN_REVIEW' WHERE id = ?`)
      .bind(versionId)
      .run();

    return { versionId, status: "IN_REVIEW" };
  }

  /**
   * Manager returns update with feedback (AC-023).
   * Previous published version (if any) remains published and visible.
   */
  static async returnUpdate(
    db: D1Database,
    principal: UserPrincipal,
    params: { versionId: string; feedback: string }
  ) {
    const version = (await db
      .prepare(
        `SELECT uv.*, pu.project_id
         FROM update_versions uv
         JOIN project_updates pu ON uv.update_id = pu.id
         WHERE uv.id = ?`
      )
      .bind(params.versionId)
      .first()) as any;

    if (!version) throw new Error("Update version not found");

    if (!canPublishProjectUpdates(principal, version.project_id)) {
      throw new AuthorizationError(
        "Only managers can return submitted updates",
        "FORBIDDEN"
      );
    }

    await db
      .prepare(
        `UPDATE update_versions
         SET status = 'CHANGES_REQUESTED', review_feedback = ?
         WHERE id = ?`
      )
      .bind(params.feedback, params.versionId)
      .run();

    return { versionId: params.versionId, status: "CHANGES_REQUESTED" };
  }

  /**
   * Manager publishes update version (AC-022, AC-023).
   * Transitions version to PUBLISHED and updates parent current_published_version_id.
   */
  static async publishUpdate(
    db: D1Database,
    principal: UserPrincipal,
    versionId: string
  ) {
    const version = (await db
      .prepare(
        `SELECT uv.*, pu.project_id, pu.id as parent_update_id
         FROM update_versions uv
         JOIN project_updates pu ON uv.update_id = pu.id
         WHERE uv.id = ?`
      )
      .bind(versionId)
      .first()) as any;

    if (!version) throw new Error("Update version not found");

    if (!canPublishProjectUpdates(principal, version.project_id)) {
      throw new AuthorizationError(
        "Only managers can publish client-visible updates",
        "FORBIDDEN"
      );
    }

    const now = Date.now();

    // 1. Mark this version as PUBLISHED
    await db
      .prepare(
        `UPDATE update_versions
         SET status = 'PUBLISHED', published_at = ?, published_by_user_id = ?
         WHERE id = ?`
      )
      .bind(now, principal.id, versionId)
      .run();

    // 2. Point parent update to this published version
    await db
      .prepare(
        `UPDATE project_updates
         SET current_published_version_id = ?, revision = revision + 1
         WHERE id = ?`
      )
      .bind(versionId, version.parent_update_id)
      .run();

    return { updateId: version.parent_update_id, versionId, status: "PUBLISHED" };
  }

  /**
   * Retract a published update.
   */
  static async retractUpdate(
    db: D1Database,
    principal: UserPrincipal,
    params: { updateId: string; reason: string }
  ) {
    const update = (await db
      .prepare(`SELECT * FROM project_updates WHERE id = ?`)
      .bind(params.updateId)
      .first()) as any;

    if (!update) throw new Error("Update not found");

    if (!canPublishProjectUpdates(principal, update.project_id)) {
      throw new AuthorizationError(
        "Only managers can retract published updates",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE project_updates
         SET is_retracted = 1, retraction_reason = ?, retracted_at = ?
         WHERE id = ?`
      )
      .bind(params.reason, now, params.updateId)
      .run();

    return { updateId: params.updateId, isRetracted: true };
  }

  /**
   * List updates for a project (AC-022, AC-023).
   * External users (clients/consultants) see ONLY active published snapshots.
   * Internal staff see full revision and draft history.
   */
  static async listProjectUpdates(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string
  ) {
    assertProjectAccess(principal, projectId);

    const isInternal = canReadInternalNotes(principal, projectId);

    if (!isInternal) {
      // Client/Consultant query: only published, non-retracted updates
      const rows = (await db
        .prepare(
          `SELECT
            pu.id as update_id,
            pu.project_id,
            pu.stage_id,
            uv.id as published_version_id,
            uv.version_number,
            uv.title,
            uv.body_text,
            uv.observed_date,
            uv.published_at,
            u.display_name as author_name
           FROM project_updates pu
           JOIN update_versions uv ON pu.current_published_version_id = uv.id
           JOIN users u ON uv.published_by_user_id = u.id
           WHERE pu.project_id = ?
             AND pu.is_retracted = 0
             AND uv.status = 'PUBLISHED'
           ORDER BY uv.published_at DESC`
        )
        .bind(projectId)
        .all()) as any;

      const items = rows.results || [];
      // Enrich with published attachments
      for (const item of items) {
        const attRows = (await db
          .prepare(
            `SELECT f.id, f.file_name, f.size_bytes, f.mime_type
             FROM update_attachments ua
             JOIN files f ON ua.file_id = f.id
             WHERE ua.version_id = ?`
          )
          .bind(item.published_version_id)
          .all()) as any;
        item.attachments = attRows.results || [];
      }
      return items;
    }

    // Internal query: see all updates, drafts, and version history
    const updates = (await db
      .prepare(
        `SELECT
          pu.*,
          u.display_name as author_name
         FROM project_updates pu
         JOIN users u ON pu.author_id = u.id
         WHERE pu.project_id = ?
         ORDER BY pu.created_at DESC`
      )
      .bind(projectId)
      .all()) as any;

    const list = updates.results || [];
    for (const up of list) {
      const verRows = (await db
        .prepare(
          `SELECT uv.*, u.display_name as published_by_name
           FROM update_versions uv
           LEFT JOIN users u ON uv.published_by_user_id = u.id
           WHERE uv.update_id = ?
           ORDER BY uv.version_number DESC`
        )
        .bind(up.id)
        .all()) as any;

      const versions = verRows.results || [];
      for (const ver of versions) {
        const attRows = (await db
          .prepare(
            `SELECT f.id, f.file_name, f.size_bytes, f.mime_type
             FROM update_attachments ua
             JOIN files f ON ua.file_id = f.id
             WHERE ua.version_id = ?`
          )
          .bind(ver.id)
          .all()) as any;
        ver.attachments = attRows.results || [];
      }
      up.versions = versions;
    }

    return list;
  }

  /**
   * Create an internal note (AC-022).
   * Strictly prohibited for clients and consultants.
   */
  static async createInternalNote(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateInternalNoteParams
  ) {
    assertProjectAccess(principal, params.projectId);

    if (!canReadInternalNotes(principal, params.projectId)) {
      throw new AuthorizationError(
        "Clients and consultants cannot access or create internal notes",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    const noteId = generateId("nt");

    await db
      .prepare(
        `INSERT INTO project_internal_notes (
          id, org_id, project_id, author_id, title, body_text,
          attachment_file_id, is_confidential, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        noteId,
        principal.orgId,
        params.projectId,
        principal.id,
        params.title,
        params.bodyText,
        params.attachmentFileId || null,
        params.isConfidential ? 1 : 0,
        now,
        now
      )
      .run();

    if (params.attachmentFileId) {
      await db
        .prepare(`UPDATE files SET is_referenced = 1 WHERE id = ?`)
        .bind(params.attachmentFileId)
        .run();
    }

    return { noteId, projectId: params.projectId };
  }

  /**
   * List internal notes for a project (AC-022).
   * Rejects clients and consultants with FORBIDDEN.
   */
  static async listInternalNotes(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string
  ) {
    assertProjectAccess(principal, projectId);

    if (!canReadInternalNotes(principal, projectId)) {
      throw new AuthorizationError(
        "Clients and consultants cannot access internal notes",
        "FORBIDDEN"
      );
    }

    const rows = (await db
      .prepare(
        `SELECT
          pin.*,
          u.display_name as author_name,
          f.file_name as attachment_file_name
         FROM project_internal_notes pin
         JOIN users u ON pin.author_id = u.id
         LEFT JOIN files f ON pin.attachment_file_id = f.id
         WHERE pin.project_id = ?
         ORDER BY pin.created_at DESC`
      )
      .bind(projectId)
      .all()) as any;

    return rows.results || [];
  }

  /**
   * Create a company announcement (AC-024).
   * Restrict to managers/admins.
   */
  static async createCompanyAnnouncement(
    db: D1Database,
    principal: UserPrincipal,
    params: CreateAnnouncementParams
  ) {
    if (!canManageCompanyAnnouncements(principal)) {
      throw new AuthorizationError(
        "Only managers can create company announcements",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    const announcementId = generateId("ann");

    await db
      .prepare(
        `INSERT INTO company_announcements (
          id, org_id, title, body_text, author_id, audience_type,
          status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)`
      )
      .bind(
        announcementId,
        principal.orgId,
        params.title,
        params.bodyText,
        principal.id,
        params.audienceType,
        now
      )
      .run();

    if (params.audienceType === "SELECTED_PROJECTS" && params.targetProjectIds) {
      for (const pId of params.targetProjectIds) {
        await db
          .prepare(
            `INSERT INTO announcement_audiences (id, announcement_id, project_id, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(generateId("ana"), announcementId, pId, now)
          .run();
      }
    } else if (params.audienceType === "SELECTED_CLIENTS" && params.targetClientUserIds) {
      for (const cId of params.targetClientUserIds) {
        await db
          .prepare(
            `INSERT INTO announcement_audiences (id, announcement_id, client_user_id, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .bind(generateId("ana"), announcementId, cId, now)
          .run();
      }
    }

    return { announcementId, status: "DRAFT" };
  }

  /**
   * Publish a company announcement (AC-024).
   */
  static async publishCompanyAnnouncement(
    db: D1Database,
    principal: UserPrincipal,
    announcementId: string
  ) {
    if (!canManageCompanyAnnouncements(principal)) {
      throw new AuthorizationError(
        "Only managers can publish company announcements",
        "FORBIDDEN"
      );
    }

    const now = Date.now();
    await db
      .prepare(
        `UPDATE company_announcements
         SET status = 'PUBLISHED', published_at = ?, published_by_user_id = ?
         WHERE id = ?`
      )
      .bind(now, principal.id, announcementId)
      .run();

    return { announcementId, status: "PUBLISHED" };
  }

  /**
   * List announcements visible to the current principal (AC-024).
   * Respects explicit audience targeting:
   * - Managers/Admins see all announcements.
   * - Clients see ONLY published announcements targeting ALL_CLIENTS, their client ID, or their assigned projects.
   */
  static async listCompanyAnnouncements(
    db: D1Database,
    principal: UserPrincipal
  ) {
    if (canManageCompanyAnnouncements(principal)) {
      const rows = (await db
        .prepare(
          `SELECT ca.*, u.display_name as author_name
           FROM company_announcements ca
           JOIN users u ON ca.author_id = u.id
           ORDER BY ca.created_at DESC`
        )
        .all()) as any;
      return rows.results || [];
    }

    // Client/Consultant audience filter
    const userProjectIds = principal.projectMemberships.map((pm) => pm.projectId);

    const rows = (await db
      .prepare(
        `SELECT DISTINCT ca.*, u.display_name as author_name
         FROM company_announcements ca
         JOIN users u ON ca.author_id = u.id
         LEFT JOIN announcement_audiences aa ON ca.id = aa.announcement_id
         WHERE ca.status = 'PUBLISHED'
           AND ca.retracted_at IS NULL
           AND (
             ca.audience_type = 'ALL_CLIENTS'
             OR aa.client_user_id = ?
             OR (aa.project_id IS NOT NULL AND aa.project_id IN (${
               userProjectIds.length > 0 ? userProjectIds.map(() => "?").join(",") : "''"
             }))
           )
         ORDER BY ca.published_at DESC`
      )
      .bind(principal.id, ...userProjectIds)
      .all()) as any;

    return rows.results || [];
  }
}
