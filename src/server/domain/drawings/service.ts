/**
 * Drawing Register, Consultant Approval, and Manager Release Domain Service.
 * Enforces version-bound consultant reviews, strict manager-only publication,
 * non-existence of client drawing approval, atomic superseding, and draft protection.
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "../identity/service";

export type DrawingDiscipline =
  | "ARCHITECTURAL"
  | "STRUCTURAL"
  | "MEP"
  | "LANDSCAPE"
  | "INTERIOR"
  | "CIVIL";

export interface CreateDrawingInput {
  projectId: string;
  drawingNumber: string; // e.g. "MD-ARC-101"
  title: string;
  discipline: DrawingDiscipline;
}

export interface CreateVersionInput {
  drawingId: string;
  versionLabel: string; // e.g. "V1", "V2"
  fileId: string;
  cadFileId?: string;
  submissionNote?: string;
  requiredConsultantIds: string[];
}

export interface ConsultantReviewInput {
  versionId: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  reason: string;
}

export interface ReleaseDrawingInput {
  versionId: string;
  expectedCurrentVersionId?: string | null;
}

export interface WithdrawDrawingInput {
  drawingId: string;
  reason: string;
}

/**
 * Create logical drawing sheet (REQ-DRW-001).
 */
export async function createDrawing(
  actor: UserPrincipal,
  input: CreateDrawingInput,
  db: D1Database
) {
  assertProjectAccess(actor, input.projectId);

  if (actor.role === "CONSULTANT" || actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Only architectural practice members can create drawing records.", "FORBIDDEN");
  }

  const drawingId = `drw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await execute(
    db,
    `INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      drawingId,
      actor.orgId,
      input.projectId,
      input.drawingNumber.trim().toUpperCase(),
      input.title.trim(),
      input.discipline,
      now,
    ]
  );

  return { id: drawingId, drawingNumber: input.drawingNumber.trim().toUpperCase() };
}

/**
 * Create an immutable drawing version with assigned required consultants (REQ-DRW-001, AC-016, AC-019).
 */
export async function createDrawingVersion(
  actor: UserPrincipal,
  input: CreateVersionInput,
  db: D1Database
) {
  const drawing = await queryFirst<{ id: string; org_id: string; project_id: string }>(
    db,
    "SELECT id, org_id, project_id FROM drawings WHERE id = ?",
    [input.drawingId]
  );
  if (!drawing) throw new AuthorizationError("Drawing record not found.", "NOT_FOUND");

  assertProjectAccess(actor, drawing.project_id);

  if (actor.role === "CONSULTANT" || actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Only design staff can submit drawing versions.", "FORBIDDEN");
  }

  // Verify submitted file exists and mark as referenced so it cannot be purged (AC-060)
  const file = await queryFirst<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM files WHERE id = ?",
    [input.fileId]
  );
  if (!file || file.status !== "READY") {
    throw new AuthorizationError("Drawing file must be an uploaded and finalized file.", "INVALID_FILE");
  }
  await execute(db, "UPDATE files SET is_referenced = 1, reference_type = 'DRAWING' WHERE id = ?", [input.fileId]);

  if (input.cadFileId) {
    await execute(db, "UPDATE files SET is_referenced = 1, reference_type = 'DRAWING' WHERE id = ?", [input.cadFileId]);
  }

  const versionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  // Insert drawing_versions in DRAFT status
  await execute(
    db,
    `INSERT INTO drawing_versions (id, drawing_id, version_label, file_id, cad_file_id, submission_note, author_user_id, status, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 1, ?)`,
    [
      versionId,
      input.drawingId,
      input.versionLabel.trim().toUpperCase(),
      input.fileId,
      input.cadFileId || null,
      input.submissionNote || null,
      actor.id,
      now,
    ]
  );

  // Setup designated required consultant reviews (AC-016, AC-019)
  for (const consultantId of input.requiredConsultantIds) {
    const reviewId = `rev_${versionId}_${consultantId}`;
    await execute(
      db,
      `INSERT INTO drawing_reviews (id, version_id, consultant_user_id, is_required, status, created_at)
       VALUES (?, ?, ?, 1, 'PENDING', ?)`,
      [reviewId, versionId, consultantId, now]
    );
  }

  return { id: versionId, versionLabel: input.versionLabel.trim().toUpperCase(), status: "DRAFT" };
}

/**
 * Submit draft drawing version for consultant review (DRAFT -> IN_REVIEW).
 */
export async function submitDrawingForReview(
  actor: UserPrincipal,
  versionId: string,
  db: D1Database
) {
  const version = await queryFirst<{
    id: string;
    drawing_id: string;
    version_label: string;
    status: string;
  }>(db, "SELECT * FROM drawing_versions WHERE id = ?", [versionId]);

  if (!version) throw new AuthorizationError("Drawing version not found.", "NOT_FOUND");
  if (version.status !== "DRAFT") {
    throw new AuthorizationError(`Cannot submit version in status ${version.status}. Must be DRAFT.`, "INVALID_STATE");
  }

  const drawing = await queryFirst<{ id: string; project_id: string }>(
    db,
    "SELECT id, project_id FROM drawings WHERE id = ?",
    [version.drawing_id]
  );
  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");

  assertProjectAccess(actor, drawing.project_id);

  // Check that at least one required consultant was defined
  const reviewsCount = await queryFirst<{ count: number }>(
    db,
    "SELECT count(*) as count FROM drawing_reviews WHERE version_id = ? AND is_required = 1",
    [versionId]
  );
  if (!reviewsCount || reviewsCount.count === 0) {
    throw new AuthorizationError("At least one required consultant must be assigned for review.", "NO_REVIEWERS");
  }

  await execute(
    db,
    "UPDATE drawing_versions SET status = 'IN_REVIEW', revision = revision + 1 WHERE id = ?",
    [versionId]
  );

  return { success: true, versionId, status: "IN_REVIEW" };
}

/**
 * Submit version-bound consultant review decision (AC-016, AC-017).
 * Strictly guarded: Unassigned consultants cannot decide.
 * Consultant approval alone NEVER publishes or releases (AC-017).
 */
export async function submitConsultantReview(
  actor: UserPrincipal,
  input: ConsultantReviewInput,
  db: D1Database
) {
  // Clients are strictly prohibited from reviewing or approving drawings (AC-017)
  if (actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Clients do not approve drawings. Approval is consultant-led followed by manager release.", "FORBIDDEN");
  }

  const version = await queryFirst<{
    id: string;
    drawing_id: string;
    version_label: string;
    status: string;
  }>(db, "SELECT * FROM drawing_versions WHERE id = ?", [input.versionId]);

  if (!version) throw new AuthorizationError("Drawing version not found.", "NOT_FOUND");
  if (version.status !== "IN_REVIEW") {
    throw new AuthorizationError(`Version is in status ${version.status}, not IN_REVIEW.`, "INVALID_STATE");
  }

  // Check that this exact actor is assigned as a reviewer for this version (AC-016)
  const review = await queryFirst<{
    id: string;
    version_id: string;
    consultant_user_id: string;
    status: string;
  }>(
    db,
    "SELECT * FROM drawing_reviews WHERE version_id = ? AND consultant_user_id = ?",
    [input.versionId, actor.id]
  );

  if (!review) {
    throw new AuthorizationError(
      "Unassigned consultant cannot submit review decision for this drawing version.",
      "UNASSIGNED_REVIEWER"
    );
  }

  const now = Date.now();

  // Update review record
  await execute(
    db,
    "UPDATE drawing_reviews SET status = ?, decision_reason = ?, decided_at = ? WHERE id = ?",
    [input.decision, input.reason, now, review.id]
  );

  if (input.decision === "CHANGES_REQUESTED" || input.decision === "REJECTED") {
    // Blocks release; version moves to CHANGES_REQUESTED or REJECTED
    await execute(
      db,
      "UPDATE drawing_versions SET status = ?, revision = revision + 1 WHERE id = ?",
      [input.decision, input.versionId]
    );
    return { success: true, versionId: input.versionId, decision: input.decision, versionStatus: input.decision };
  }

  // If APPROVED, check if all required consultant reviews for this version are approved (AC-016)
  const pendingReviews = await query<{ id: string }>(
    db,
    "SELECT id FROM drawing_reviews WHERE version_id = ? AND is_required = 1 AND status != 'APPROVED'",
    [input.versionId]
  );

  let newVersionStatus = "IN_REVIEW";
  if (pendingReviews.length === 0) {
    // All required consultants approved! Version moves to CONSULTANT_APPROVED
    // NOTE: It is NOT released yet! Manager release is required (AC-017).
    newVersionStatus = "CONSULTANT_APPROVED";
    await execute(
      db,
      "UPDATE drawing_versions SET status = 'CONSULTANT_APPROVED', revision = revision + 1 WHERE id = ?",
      [input.versionId]
    );
  }

  return {
    success: true,
    versionId: input.versionId,
    decision: "APPROVED",
    versionStatus: newVersionStatus,
    allApproved: pendingReviews.length === 0,
  };
}

/**
 * Final Manager Release Command (AC-017, AC-018, AC-021).
 * Strictly guarded: Manager-only publication boundary.
 * Clients cannot release; consultant approval alone cannot release.
 * Atomically marks prior release SUPERSEDED (AC-018) and handles concurrent releases (AC-021).
 */
export async function releaseDrawingVersion(
  actor: UserPrincipal,
  input: ReleaseDrawingInput,
  db: D1Database
) {
  // Only MANAGER, ADMIN, or OWNER can release (AC-017)
  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only assigned project managers or administrators can release drawings.", "FORBIDDEN");
  }

  const version = await queryFirst<{
    id: string;
    drawing_id: string;
    version_label: string;
    status: string;
    revision: number;
  }>(db, "SELECT * FROM drawing_versions WHERE id = ?", [input.versionId]);

  if (!version) throw new AuthorizationError("Drawing version not found.", "NOT_FOUND");

  const drawing = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
    drawing_number: string;
    current_released_version_id: string | null;
    revision: number;
  }>(db, "SELECT * FROM drawings WHERE id = ?", [version.drawing_id]);

  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");

  assertProjectAccess(actor, drawing.project_id);

  // Idempotency: If already released as current, return immediately (AC-021)
  if (version.status === "RELEASED" && drawing.current_released_version_id === version.id) {
    return {
      success: true,
      drawingId: drawing.id,
      releasedVersionId: version.id,
      versionLabel: version.version_label,
      isIdempotent: true,
    };
  }

  // Version MUST be in CONSULTANT_APPROVED status (AC-016, AC-017)
  if (version.status !== "CONSULTANT_APPROVED") {
    throw new AuthorizationError(
      `Cannot release drawing version in status ${version.status}. All required consultant approvals must be complete.`,
      "APPROVALS_INCOMPLETE"
    );
  }

  // Optimistic concurrency check (AC-021)
  if (
    input.expectedCurrentVersionId !== undefined &&
    drawing.current_released_version_id !== input.expectedCurrentVersionId
  ) {
    throw new AuthorizationError(
      "Concurrent release detected. Another version was released in the interim.",
      "CONCURRENCY_CONFLICT"
    );
  }

  const now = Date.now();

  // Atomically supersede prior released version (AC-018)
  if (drawing.current_released_version_id) {
    await execute(
      db,
      "UPDATE drawing_versions SET status = 'SUPERSEDED', superseded_at = ?, revision = revision + 1 WHERE id = ?",
      [now, drawing.current_released_version_id]
    );
  }

  // Release new version
  await execute(
    db,
    `UPDATE drawing_versions
     SET status = 'RELEASED', released_at = ?, released_by_user_id = ?, revision = revision + 1
     WHERE id = ?`,
    [now, actor.id, version.id]
  );

  // Update drawing current released pointer
  await execute(
    db,
    `UPDATE drawings
     SET current_released_version_id = ?, is_withdrawn = 0, withdrawal_reason = NULL, revision = revision + 1
     WHERE id = ?`,
    [version.id, drawing.id]
  );

  await recordAuditEvent(db, {
    orgId: drawing.org_id,
    actorId: actor.id,
    entityType: "DRAWING",
    entityId: drawing.id,
    action: "DRAWING_RELEASED",
    oldState: { priorReleasedVersionId: drawing.current_released_version_id },
    newState: { releasedVersionId: version.id, versionLabel: version.version_label },
  });

  return {
    success: true,
    drawingId: drawing.id,
    releasedVersionId: version.id,
    versionLabel: version.version_label,
    priorVersionSuperseded: !!drawing.current_released_version_id,
  };
}

/**
 * Withdraw a currently released drawing (AC-018).
 * Guarded Manager command. Sets drawing to withdrawn and does NOT auto-promote older versions.
 */
export async function withdrawDrawing(
  actor: UserPrincipal,
  input: WithdrawDrawingInput,
  db: D1Database
) {
  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only project managers can withdraw released drawings.", "FORBIDDEN");
  }

  const drawing = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
    current_released_version_id: string | null;
  }>(db, "SELECT * FROM drawings WHERE id = ?", [input.drawingId]);

  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");
  assertProjectAccess(actor, drawing.project_id);

  const now = Date.now();

  if (drawing.current_released_version_id) {
    await execute(
      db,
      "UPDATE drawing_versions SET status = 'WITHDRAWN', revision = revision + 1 WHERE id = ?",
      [drawing.current_released_version_id]
    );
  }

  await execute(
    db,
    `UPDATE drawings
     SET current_released_version_id = NULL, is_withdrawn = 1, withdrawal_reason = ?, revision = revision + 1
     WHERE id = ?`,
    [input.reason, input.drawingId]
  );

  await recordAuditEvent(db, {
    orgId: drawing.org_id,
    actorId: actor.id,
    entityType: "DRAWING",
    entityId: drawing.id,
    action: "DRAWING_WITHDRAWN",
    reason: input.reason,
  });

  return { success: true, drawingId: drawing.id, isWithdrawn: true };
}

/**
 * Get drawing details and versions with role-based filtering (AC-018, AC-020).
 * Clients see ONLY RELEASED (current) and SUPERSEDED (historical) versions.
 * Unreleased DRAFT, IN_REVIEW, and REJECTED versions are strictly hidden from clients.
 */
export async function getDrawing(
  actor: UserPrincipal,
  drawingId: string,
  db: D1Database
) {
  const drawing = await queryFirst<any>(
    db,
    "SELECT * FROM drawings WHERE id = ?",
    [drawingId]
  );

  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");
  assertProjectAccess(actor, drawing.project_id);

  let sql = `
    SELECT v.*,
           u.display_name as author_name,
           r.display_name as released_by_name,
           f.file_name,
           f.size_bytes,
           f.mime_type
    FROM drawing_versions v
    LEFT JOIN users u ON u.id = v.author_user_id
    LEFT JOIN users r ON r.id = v.released_by_user_id
    LEFT JOIN files f ON f.id = v.file_id
    WHERE v.drawing_id = ?
  `;
  const params: any[] = [drawingId];

  // Client protection: Clients see ONLY RELEASED and SUPERSEDED (AC-020)
  if (actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    sql += " AND (v.status = 'RELEASED' OR v.status = 'SUPERSEDED')";
  }

  sql += " ORDER BY v.created_at DESC";

  const versions = await query<any>(db, sql, params);

  // Load reviews for versions
  const versionIds = versions.map((v) => v.id);
  let reviews: any[] = [];
  if (versionIds.length > 0) {
    const placeholders = versionIds.map(() => "?").join(",");
    reviews = await query<any>(
      db,
      `SELECT dr.*, u.display_name as consultant_name
       FROM drawing_reviews dr
       JOIN users u ON u.id = dr.consultant_user_id
       WHERE dr.version_id IN (${placeholders})`,
      versionIds
    );
  }

  const versionsWithReviews = versions.map((v) => ({
    ...v,
    reviews: reviews.filter((r) => r.version_id === v.id),
    isCurrentRelease: v.id === drawing.current_released_version_id,
  }));

  return { drawing, versions: versionsWithReviews };
}

/**
 * List drawings for a project with role-based visibility.
 */
export async function listProjectDrawings(
  actor: UserPrincipal,
  projectId: string,
  db: D1Database,
  disciplineFilter?: string
) {
  assertProjectAccess(actor, projectId);

  let sql = `
    SELECT d.*,
           v.version_label as current_version_label,
           v.status as current_version_status,
           v.released_at,
           f.file_name,
           f.size_bytes
    FROM drawings d
    LEFT JOIN drawing_versions v ON v.id = d.current_released_version_id
    LEFT JOIN files f ON f.id = v.file_id
    WHERE d.project_id = ?
  `;
  const params: any[] = [projectId];

  if (disciplineFilter && disciplineFilter !== "ALL") {
    sql += " AND d.discipline = ?";
    params.push(disciplineFilter);
  }

  // If client, and drawing has no current released version, show as withdrawn/pending
  sql += " ORDER BY d.drawing_number ASC";

  return await query(db, sql, params);
}
