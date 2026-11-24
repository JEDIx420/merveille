import { assertProjectOrganisation } from "@/server/auth/policy";
import { ArchiveService } from "../archive/service";
import { validateAttachment } from "@/server/files/visibility";
/**
 * Domain service for manual K-SMART practice records and permit milestones.
 * Enforces manual practice tracking with explicit dates and selective client sharing (AC-025, AC-026).
 * No automated government polling, scraping, or legal validity assertions.
 */

import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../auth/principal";
import {
  assertProjectAccess,
  canReadInternalNotes,
  canPublishProjectUpdates,
  AuthorizationError,
} from "../../auth/policy";

export type MilestoneType = "SANCTION" | "COMPLETION";
export type TrackingLabel =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AWAITING_RESPONSE"
  | "FOLLOW_UP_NEEDED"
  | "RECORDED_COMPLETE";

export interface RecordObservationParams {
  milestoneId: string;
  observedStatusText: string;
  decisionDate?: string; // YYYY-MM-DD
  lastCheckedDate: string; // YYYY-MM-DD
  sourceDescription: string;
  referenceUrl?: string;
  staffNotes?: string;
  files?: Array<{ fileId: string; isClientShared: boolean }>;
}

export interface ReviewSharingParams {
  observationId: string;
  decision: "APPROVE" | "RETURN";
  feedback?: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class PermitsService {
  /**
   * Ensure standard sanction and completion milestones exist for a project.
   */
  static async ensureMilestones(
    db: D1Database,
    orgId: string,
    projectId: string,
  ) {
    const types: MilestoneType[] = ["SANCTION", "COMPLETION"];
    for (const t of types) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO ksmart_milestones (
            id, org_id, project_id, milestone_type, tracking_label,
            current_published_observation_id, created_at
          ) VALUES (?, ?, ?, ?, 'NOT_STARTED', NULL, ?)`,
        )
        .bind(generateId("ksm"), orgId, projectId, t, Date.now())
        .run();
    }
  }

  /**
   * Update milestone metadata (application number / tracking label).
   */
  static async updateMilestone(
    db: D1Database,
    principal: UserPrincipal,
    params: {
      milestoneId: string;
      applicationReference?: string;
      trackingLabel?: TrackingLabel;
    },
  ) {
    const milestone = (await db
      .prepare(`SELECT * FROM ksmart_milestones WHERE id = ?`)
      .bind(params.milestoneId)
      .first()) as any;

    if (!milestone) throw new Error("Milestone not found");
    assertProjectAccess(principal, milestone.project_id);
    await assertProjectOrganisation(db, principal, milestone.project_id);

    if (!canReadInternalNotes(principal, milestone.project_id)) {
      throw new AuthorizationError(
        "Clients and consultants cannot edit permit milestones",
        "FORBIDDEN",
      );
    }

    if (params.applicationReference !== undefined) {
      await db
        .prepare(
          `UPDATE ksmart_milestones SET application_reference = ? WHERE id = ?`,
        )
        .bind(params.applicationReference, params.milestoneId)
        .run();
    }

    if (params.trackingLabel !== undefined) {
      await db
        .prepare(`UPDATE ksmart_milestones SET tracking_label = ? WHERE id = ?`)
        .bind(params.trackingLabel, params.milestoneId)
        .run();
    }

    return { milestoneId: params.milestoneId };
  }

  /**
   * Record a manual permit observation (AC-025).
   * Internal staff records what was observed and last checked date.
   */
  static async recordObservation(
    db: D1Database,
    principal: UserPrincipal,
    params: RecordObservationParams,
  ) {
    const milestone = (await db
      .prepare(`SELECT * FROM ksmart_milestones WHERE id = ?`)
      .bind(params.milestoneId)
      .first()) as any;

    if (!milestone) throw new Error("Milestone not found");
    assertProjectAccess(principal, milestone.project_id);
    await assertProjectOrganisation(db, principal, milestone.project_id);

    if (!canReadInternalNotes(principal, milestone.project_id)) {
      throw new AuthorizationError(
        "Clients and consultants cannot record permit observations",
        "FORBIDDEN",
      );
    }

    const now = Date.now();
    for (const f of params.files ?? [])
      await validateAttachment(
        db,
        principal,
        f.fileId,
        milestone.project_id,
        "PERMIT",
      );
    const observationId = generateId("kso");

    await db
      .prepare(
        `INSERT INTO ksmart_observations (
          id, milestone_id, observed_status_text, decision_date,
          last_checked_date, source_description, reference_url,
          staff_notes, recorded_by_user_id, sharing_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INTERNAL', ?)`,
      )
      .bind(
        observationId,
        params.milestoneId,
        params.observedStatusText,
        params.decisionDate || null,
        params.lastCheckedDate,
        params.sourceDescription,
        params.referenceUrl || null,
        params.staffNotes || null,
        principal.id,
        now,
      )
      .run();

    if (params.files && params.files.length > 0) {
      for (const f of params.files) {
        await db
          .prepare(
            `INSERT INTO ksmart_observation_files (
              id, observation_id, file_id, is_client_shared, created_at
            ) VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(
            generateId("ksof"),
            observationId,
            f.fileId,
            f.isClientShared ? 1 : 0,
            now,
          )
          .run();

        await db
          .prepare(`UPDATE files SET is_referenced = 1 WHERE id = ?`)
          .bind(f.fileId)
          .run();
      }
    }

    return {
      observationId,
      milestoneId: params.milestoneId,
      status: "INTERNAL",
    };
  }

  /**
   * Submit observation for manager sharing review.
   */
  static async submitObservationForSharing(
    db: D1Database,
    principal: UserPrincipal,
    observationId: string,
  ) {
    const obs = (await db
      .prepare(
        `SELECT ko.*, km.project_id
         FROM ksmart_observations ko
         JOIN ksmart_milestones km ON ko.milestone_id = km.id
         WHERE ko.id = ?`,
      )
      .bind(observationId)
      .first()) as any;

    if (!obs) throw new Error("Observation not found");
    assertProjectAccess(principal, obs.project_id);
    await assertProjectOrganisation(db, principal, obs.project_id);

    if (!canReadInternalNotes(principal, obs.project_id)) {
      throw new AuthorizationError(
        "Clients and consultants cannot submit observations for sharing",
        "FORBIDDEN",
      );
    }

    await db
      .prepare(
        `UPDATE ksmart_observations
         SET sharing_status = 'SUBMITTED_FOR_SHARING'
         WHERE id = ?`,
      )
      .bind(observationId)
      .run();

    return { observationId, sharingStatus: "SUBMITTED_FOR_SHARING" };
  }

  /**
   * Review observation sharing (manager gate) (AC-026).
   */
  static async reviewObservationSharing(
    db: D1Database,
    principal: UserPrincipal,
    params: ReviewSharingParams,
  ) {
    const obs = (await db
      .prepare(
        `SELECT ko.*, km.project_id, km.id as milestone_id
         FROM ksmart_observations ko
         JOIN ksmart_milestones km ON ko.milestone_id = km.id
         WHERE ko.id = ?`,
      )
      .bind(params.observationId)
      .first()) as any;

    if (!obs) throw new Error("Observation not found");

    if (!canPublishProjectUpdates(principal, obs.project_id)) {
      throw new AuthorizationError(
        "Only managers can review and share permit observations",
        "FORBIDDEN",
      );
    }

    await ArchiveService.assertProjectNotArchived(db, obs.project_id);
    if (obs.sharing_status !== "SUBMITTED_FOR_SHARING")
      throw new AuthorizationError(
        "Submit this record for sharing review first.",
        "INVALID_STATE",
      );
    const now = Date.now();

    if (params.decision === "APPROVE") {
      await db
        .prepare(
          `UPDATE ksmart_observations
           SET sharing_status = 'SHARED', shared_at = ?, shared_by_user_id = ?
           WHERE id = ?`,
        )
        .bind(now, principal.id, params.observationId)
        .run();

      await db
        .prepare(
          `UPDATE ksmart_milestones
           SET current_published_observation_id = ?
           WHERE id = ?`,
        )
        .bind(params.observationId, obs.milestone_id)
        .run();

      return { observationId: params.observationId, sharingStatus: "SHARED" };
    } else {
      await db
        .prepare(
          `UPDATE ksmart_observations
           SET sharing_status = 'RETURNED', manager_feedback = ?
           WHERE id = ?`,
        )
        .bind(params.feedback || null, params.observationId)
        .run();

      return { observationId: params.observationId, sharingStatus: "RETURNED" };
    }
  }

  /**
   * Get permit milestones and observations for a project (AC-025, AC-026).
   * External users see ONLY manager-approved shared observations and ONLY shared files.
   * Internal users see full history, internal notes, and sensitive evidence.
   */
  static async getProjectPermits(
    db: D1Database,
    principal: UserPrincipal,
    projectId: string,
  ) {
    assertProjectAccess(principal, projectId);
    await assertProjectOrganisation(db, principal, projectId);

    const isInternal = canReadInternalNotes(principal, projectId);

    const milestoneRows = (await db
      .prepare(
        `SELECT * FROM ksmart_milestones WHERE project_id = ? ORDER BY milestone_type ASC`,
      )
      .bind(projectId)
      .all()) as any;

    const milestones = milestoneRows.results || [];

    if (!isInternal) {
      // Client/Consultant view: only published observation & client-shared files
      const result = [];
      for (const m of milestones) {
        if (!m.current_published_observation_id) {
          result.push({
            milestoneId: m.id,
            milestoneType: m.milestone_type,
            applicationReference: m.application_reference,
            hasPublishedRecord: false,
            trackingNotice:
              "No published permit status yet for this milestone.",
          });
          continue;
        }

        const pubObs = (await db
          .prepare(
            `SELECT ko.id, ko.observed_status_text, ko.decision_date,
                    ko.last_checked_date, ko.source_description, ko.reference_url,
                    ko.shared_at, u.display_name as recorded_by_name
             FROM ksmart_observations ko
             JOIN users u ON ko.recorded_by_user_id = u.id
             WHERE ko.id = ?`,
          )
          .bind(m.current_published_observation_id)
          .first()) as any;

        if (!pubObs) {
          result.push({
            milestoneId: m.id,
            milestoneType: m.milestone_type,
            applicationReference: m.application_reference,
            hasPublishedRecord: false,
            trackingNotice:
              "No published permit status yet for this milestone.",
          });
          continue;
        }

        // STRICT SECURITY (AC-026): Only files where is_client_shared = 1
        const files = (await db
          .prepare(
            `SELECT f.id, f.file_name, f.size_bytes, f.mime_type
             FROM ksmart_observation_files kof
             JOIN files f ON kof.file_id = f.id
             WHERE kof.observation_id = ? AND kof.is_client_shared = 1`,
          )
          .bind(pubObs.id)
          .all()) as any;

        result.push({
          milestoneId: m.id,
          milestoneType: m.milestone_type,
          applicationReference: m.application_reference,
          hasPublishedRecord: true,
          statusText: pubObs.observed_status_text,
          decisionDate: pubObs.decision_date,
          lastCheckedDate: pubObs.last_checked_date,
          recordedByName: pubObs.recorded_by_name,
          sourceDescription: pubObs.source_description,
          referenceUrl: pubObs.reference_url,
          sharedAt: pubObs.shared_at,
          recordStatement: `Recorded by ${pubObs.recorded_by_name} · Last checked ${pubObs.last_checked_date}`,
          disclaimer:
            "Manual practice record entered by team · Not an automated government verification",
          files: files.results || [],
        });
      }
      return result;
    }

    // Internal view: full timeline and all attachments
    const result = [];
    for (const m of milestones) {
      const obsRows = (await db
        .prepare(
          `SELECT ko.*, u.display_name as recorded_by_name, sm.display_name as shared_by_name
           FROM ksmart_observations ko
           JOIN users u ON ko.recorded_by_user_id = u.id
           LEFT JOIN users sm ON ko.shared_by_user_id = sm.id
           WHERE ko.milestone_id = ?
           ORDER BY ko.created_at DESC`,
        )
        .bind(m.id)
        .all()) as any;

      const observations = obsRows.results || [];
      for (const obs of observations) {
        const fileRows = (await db
          .prepare(
            `SELECT f.id, f.file_name, f.size_bytes, f.mime_type, kof.is_client_shared
             FROM ksmart_observation_files kof
             JOIN files f ON kof.file_id = f.id
             WHERE kof.observation_id = ?`,
          )
          .bind(obs.id)
          .all()) as any;
        obs.files = fileRows.results || [];
      }

      result.push({
        milestoneId: m.id,
        milestoneType: m.milestone_type,
        applicationReference: m.application_reference,
        trackingLabel: m.tracking_label,
        currentPublishedObservationId: m.current_published_observation_id,
        observations,
      });
    }

    return result;
  }
}
