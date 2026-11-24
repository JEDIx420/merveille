import { assertProjectOrganisation } from "@/server/auth/policy";
/**
 * Drawing Register, Consultant Approval, and Manager Release Domain Service.
 * Enforces version-bound consultant reviews, strict manager-only publication,
 * non-existence of client drawing approval, atomic superseding, and draft protection.
 */

import { validateAttachment } from "@/server/files/visibility";
import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import {
  assertProjectAccess,
  AuthorizationError,
  canReadInternalNotes,
} from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "../identity/service";
import { ArchiveService } from "../archive/service";

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
  db: D1Database,
) {
  assertProjectAccess(actor, input.projectId);
  await assertProjectOrganisation(db, actor, input.projectId);
  await ArchiveService.assertProjectNotArchived(db, input.projectId);

  if (
    !hasCapability(actor, "TEAM_MEMBER", input.projectId) &&
    !hasCapability(actor, "MANAGER", input.projectId)
  ) {
    throw new AuthorizationError(
      "Only architectural practice members can create drawing records.",
      "FORBIDDEN",
    );
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
    ],
  );

  return {
    id: drawingId,
    drawingNumber: input.drawingNumber.trim().toUpperCase(),
  };
}

/**
 * Create an immutable drawing version with assigned required consultants (REQ-DRW-001, AC-016, AC-019).
 */
export async function createDrawingVersion(
  actor: UserPrincipal,
  input: CreateVersionInput,
  db: D1Database,
) {
  const drawing = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
  }>(db, "SELECT id, org_id, project_id FROM drawings WHERE id = ?", [
    input.drawingId,
  ]);
  if (!drawing)
    throw new AuthorizationError("Drawing record not found.", "NOT_FOUND");

  assertProjectAccess(actor, drawing.project_id);

  await assertProjectOrganisation(db, actor, drawing.project_id);
  await ArchiveService.assertProjectNotArchived(db, drawing.project_id);

  if (
    !hasCapability(actor, "TEAM_MEMBER", drawing.project_id) &&
    !hasCapability(actor, "MANAGER", drawing.project_id)
  ) {
    throw new AuthorizationError(
      "Only design staff can submit drawing versions.",
      "FORBIDDEN",
    );
  }

  await validateAttachment(
    db,
    actor,
    input.fileId,
    drawing.project_id,
    "DRAWING",
  );
  if (input.cadFileId)
    await validateAttachment(
      db,
      actor,
      input.cadFileId,
      drawing.project_id,
      "DRAWING",
    );
  if (
    !input.requiredConsultantIds?.length ||
    new Set(input.requiredConsultantIds).size !==
      input.requiredConsultantIds.length
  )
    throw new AuthorizationError(
      "Choose required consultant reviewers.",
      "INVALID_INPUT",
    );
  for (const reviewer of input.requiredConsultantIds) {
    const assigned = await queryFirst(
      db,
      `SELECT m.id FROM project_memberships m JOIN users u ON u.id=m.user_id JOIN organization_memberships o ON o.user_id=u.id AND o.org_id=m.org_id WHERE m.project_id=? AND m.org_id=? AND m.user_id=? AND m.project_role='CONSULTANT' AND m.is_active=1 AND u.status='ACTIVE' AND o.is_active=1`,
      [drawing.project_id, actor.orgId, reviewer],
    );
    if (!assigned)
      throw new AuthorizationError(
        "Reviewer must be an active consultant on this project.",
        "INVALID_REVIEWER",
      );
  }
  await execute(
    db,
    "UPDATE files SET is_referenced=1,reference_type='DRAWING' WHERE id=? OR id=?",
    [input.fileId, input.cadFileId ?? input.fileId],
  );

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
    ],
  );

  // Setup designated required consultant reviews (AC-016, AC-019)
  for (const consultantId of input.requiredConsultantIds) {
    const reviewId = `rev_${versionId}_${consultantId}`;
    await execute(
      db,
      `INSERT INTO drawing_reviews (id, version_id, consultant_user_id, is_required, status, created_at)
       VALUES (?, ?, ?, 1, 'PENDING', ?)`,
      [reviewId, versionId, consultantId, now],
    );
  }

  return {
    id: versionId,
    versionLabel: input.versionLabel.trim().toUpperCase(),
    status: "DRAFT",
  };
}

/**
 * Submit draft drawing version for consultant review (DRAFT -> IN_REVIEW).
 */
export async function submitDrawingForReview(
  actor: UserPrincipal,
  versionId: string,
  db: D1Database,
) {
  const version = await queryFirst<{
    id: string;
    drawing_id: string;
    version_label: string;
    status: string;
  }>(db, "SELECT * FROM drawing_versions WHERE id = ?", [versionId]);

  if (!version)
    throw new AuthorizationError("Drawing version not found.", "NOT_FOUND");
  if (version.status !== "DRAFT") {
    throw new AuthorizationError(
      `Cannot submit version in status ${version.status}. Must be DRAFT.`,
      "INVALID_STATE",
    );
  }

  const drawing = await queryFirst<{ id: string; project_id: string }>(
    db,
    "SELECT id, project_id FROM drawings WHERE id = ?",
    [version.drawing_id],
  );
  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");

  assertProjectAccess(actor, drawing.project_id);

  await assertProjectOrganisation(db, actor, drawing.project_id);
  await ArchiveService.assertProjectNotArchived(db, drawing.project_id);

  if (
    !hasCapability(actor, "MANAGER", drawing.project_id) &&
    !hasCapability(actor, "TEAM_MEMBER", drawing.project_id)
  )
    throw new AuthorizationError("Only project staff may submit a drawing.");
  // Check that at least one required consultant was defined
  const reviewsCount = await queryFirst<{ count: number }>(
    db,
    "SELECT count(*) as count FROM drawing_reviews WHERE version_id = ? AND is_required = 1",
    [versionId],
  );
  if (!reviewsCount || reviewsCount.count === 0) {
    throw new AuthorizationError(
      "At least one required consultant must be assigned for review.",
      "NO_REVIEWERS",
    );
  }

  await execute(
    db,
    "UPDATE drawing_versions SET status = 'IN_REVIEW', revision = revision + 1 WHERE id = ?",
    [versionId],
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
  db: D1Database,
) {
  // Clients are strictly prohibited from reviewing or approving drawings (AC-017)
  if (actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError(
      "Clients do not approve drawings. Approval is consultant-led followed by manager release.",
      "FORBIDDEN",
    );
  }

  const version = await queryFirst<{
    id: string;
    drawing_id: string;
    version_label: string;
    status: string;
  }>(db, "SELECT * FROM drawing_versions WHERE id = ?", [input.versionId]);

  if (!version)
    throw new AuthorizationError("Drawing version not found.", "NOT_FOUND");
  if (version.status !== "IN_REVIEW") {
    throw new AuthorizationError(
      `Version is in status ${version.status}, not IN_REVIEW.`,
      "INVALID_STATE",
    );
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
    [input.versionId, actor.id],
  );

  if (!review) {
    throw new AuthorizationError(
      "Unassigned consultant cannot submit review decision for this drawing version.",
      "UNASSIGNED_REVIEWER",
    );
  }

  const parent = await queryFirst<any>(
    db,
    "SELECT project_id,org_id FROM drawings WHERE id=?",
    [version.drawing_id],
  );
  assertProjectAccess(actor, parent.project_id);
  if (
    parent.org_id !== actor.orgId ||
    !hasCapability(actor, "CONSULTANT", parent.project_id)
  )
    throw new AuthorizationError("Assigned consultant access required.");
  await ArchiveService.assertProjectNotArchived(db, parent.project_id);
  if (
    !["APPROVED", "CHANGES_REQUESTED", "REJECTED"].includes(input.decision) ||
    !input.reason?.trim()
  )
    throw new AuthorizationError(
      "Enter a review decision and reason.",
      "INVALID_INPUT",
    );
  const now = Date.now();
  const guard = crypto.randomUUID();
  const resultStatus =
    input.decision === "APPROVED" ? "IN_REVIEW" : input.decision;
  await db.batch([
    db
      .prepare(
        `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM drawing_versions WHERE id=? AND status='IN_REVIEW') AND EXISTS(SELECT 1 FROM drawing_reviews WHERE id=? AND status='PENDING') THEN 1 ELSE 0 END`,
      )
      .bind(guard, version.id, review.id),
    db
      .prepare(
        "UPDATE drawing_reviews SET status=?,decision_reason=?,decided_at=? WHERE id=?",
      )
      .bind(input.decision, input.reason, now, review.id),
    db
      .prepare(
        `UPDATE drawing_versions SET status=CASE WHEN ?!='APPROVED' THEN ? WHEN NOT EXISTS(SELECT 1 FROM drawing_reviews WHERE version_id=? AND is_required=1 AND status!='APPROVED') THEN 'CONSULTANT_APPROVED' ELSE 'IN_REVIEW' END,revision=revision+1 WHERE id=?`,
      )
      .bind(input.decision, resultStatus, version.id, version.id),
    db
      .prepare(
        `INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,new_state,created_at) VALUES(?,?,?,'DRAWING_VERSION',?,'CONSULTANT_REVIEWED',?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.orgId,
        actor.id,
        version.id,
        JSON.stringify({ decision: input.decision }),
        now,
      ),
    db.prepare("DELETE FROM command_assertions WHERE id=?").bind(guard),
  ]);
  const final = await queryFirst<any>(
    db,
    "SELECT status FROM drawing_versions WHERE id=?",
    [version.id],
  );
  return {
    success: true,
    versionId: version.id,
    decision: input.decision,
    versionStatus: final.status,
    allApproved: final.status === "CONSULTANT_APPROVED",
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
  db: D1Database,
) {
  const version = await queryFirst<{
    id: string;
    drawing_id: string;
    version_label: string;
    status: string;
    revision: number;
  }>(db, "SELECT * FROM drawing_versions WHERE id = ?", [input.versionId]);

  if (!version)
    throw new AuthorizationError("Drawing version not found.", "NOT_FOUND");

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

  await assertProjectOrganisation(db, actor, drawing.project_id);
  await ArchiveService.assertProjectNotArchived(db, drawing.project_id);

  if (!hasCapability(actor, "MANAGER", drawing.project_id))
    throw new AuthorizationError(
      "Only the assigned manager can release drawings.",
    );
  if (drawing.org_id !== actor.orgId)
    throw new AuthorizationError("Project not found.", "NOT_FOUND");

  // Idempotency: If already released as current, return immediately (AC-021)
  if (
    version.status === "RELEASED" &&
    drawing.current_released_version_id === version.id
  ) {
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
      "APPROVALS_INCOMPLETE",
    );
  }

  // Optimistic concurrency check (AC-021)
  if (
    input.expectedCurrentVersionId !== undefined &&
    drawing.current_released_version_id !== input.expectedCurrentVersionId
  ) {
    throw new AuthorizationError(
      "Concurrent release detected. Another version was released in the interim.",
      "CONCURRENCY_CONFLICT",
    );
  }

  const now = Date.now();

  const guardId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO command_assertions(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM drawings d JOIN drawing_versions v ON v.drawing_id=d.id JOIN projects p ON p.id=d.project_id WHERE d.id=? AND d.org_id=? AND d.revision=? AND d.current_released_version_id IS ? AND v.id=? AND v.status='CONSULTANT_APPROVED' AND p.is_archived=0) AND EXISTS(SELECT 1 FROM drawing_reviews WHERE version_id=? AND is_required=1) AND NOT EXISTS(SELECT 1 FROM drawing_reviews WHERE version_id=? AND is_required=1 AND status!='APPROVED') THEN 1 ELSE 0 END`,
      )
      .bind(
        guardId,
        drawing.id,
        actor.orgId,
        drawing.revision,
        drawing.current_released_version_id,
        version.id,
        version.id,
        version.id,
      ),
    db
      .prepare(
        "UPDATE drawing_versions SET status='SUPERSEDED',superseded_at=?,revision=revision+1 WHERE id=? AND status='RELEASED'",
      )
      .bind(now, drawing.current_released_version_id),
    db
      .prepare(
        "UPDATE drawing_versions SET status='RELEASED',released_at=?,released_by_user_id=?,revision=revision+1 WHERE id=?",
      )
      .bind(now, actor.id, version.id),
    db
      .prepare(
        "UPDATE drawings SET current_released_version_id=?,is_withdrawn=0,withdrawal_reason=NULL,revision=revision+1 WHERE id=?",
      )
      .bind(version.id, drawing.id),
    db
      .prepare(
        `INSERT INTO audit_events(id,org_id,actor_id,entity_type,entity_id,action,new_state,created_at) VALUES(?,?,?,'DRAWING',?,'DRAWING_RELEASED',?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.orgId,
        actor.id,
        drawing.id,
        JSON.stringify({ versionId: version.id }),
        now,
      ),
    db
      .prepare(
        `INSERT INTO outbox_events(id,org_id,event_type,entity_type,entity_id,payload_json,status,created_at) VALUES(?,?,'DRAWING_RELEASED','DRAWING',?,?,'PENDING',?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.orgId,
        drawing.id,
        JSON.stringify({ versionId: version.id }),
        now,
      ),
    db.prepare("DELETE FROM command_assertions WHERE id=?").bind(guardId),
  ]);

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
  db: D1Database,
) {
  const drawing = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
    current_released_version_id: string | null;
  }>(db, "SELECT * FROM drawings WHERE id = ?", [input.drawingId]);

  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");
  assertProjectAccess(actor, drawing.project_id);
  await assertProjectOrganisation(db, actor, drawing.project_id);
  if (!hasCapability(actor, "MANAGER", drawing.project_id)) {
    throw new AuthorizationError(
      "Only project managers can withdraw released drawings.",
      "FORBIDDEN",
    );
  }

  await ArchiveService.assertProjectNotArchived(db, drawing.project_id);

  const now = Date.now();

  if (drawing.current_released_version_id) {
    await execute(
      db,
      "UPDATE drawing_versions SET status = 'WITHDRAWN', revision = revision + 1 WHERE id = ?",
      [drawing.current_released_version_id],
    );
  }

  await execute(
    db,
    `UPDATE drawings
     SET current_released_version_id = NULL, is_withdrawn = 1, withdrawal_reason = ?, revision = revision + 1
     WHERE id = ?`,
    [input.reason, input.drawingId],
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
  db: D1Database,
) {
  const drawing = await queryFirst<any>(
    db,
    "SELECT * FROM drawings WHERE id = ?",
    [drawingId],
  );

  if (!drawing) throw new AuthorizationError("Drawing not found.", "NOT_FOUND");
  assertProjectAccess(actor, drawing.project_id);
  await assertProjectOrganisation(db, actor, drawing.project_id);

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
  if (
    !canReadInternalNotes(actor, drawing.project_id) &&
    !hasCapability(actor, "CONSULTANT", drawing.project_id)
  ) {
    sql += " AND (v.status = 'RELEASED' OR v.status = 'SUPERSEDED')";
  }

  sql += " ORDER BY v.created_at DESC";

  let versions = await query<any>(db, sql, params);
  if (
    !canReadInternalNotes(actor, drawing.project_id) &&
    hasCapability(actor, "CONSULTANT", drawing.project_id)
  ) {
    const assigned = await query<any>(
      db,
      "SELECT version_id FROM drawing_reviews WHERE consultant_user_id=?",
      [actor.id],
    );
    versions = versions.filter(
      (v) =>
        ["RELEASED", "SUPERSEDED"].includes(v.status) ||
        assigned.some((r) => r.version_id === v.id),
    );
  }

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
      versionIds,
    );
  }

  const versionsWithReviews = versions.map((v) => ({
    ...v,
    reviews:
      canReadInternalNotes(actor, drawing.project_id) ||
      hasCapability(actor, "CONSULTANT", drawing.project_id)
        ? reviews.filter((r) => r.version_id === v.id)
        : [],
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
  disciplineFilter?: string,
) {
  assertProjectAccess(actor, projectId);
  await assertProjectOrganisation(db, actor, projectId);

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

  if (!canReadInternalNotes(actor, projectId)) {
    sql += " AND (d.current_released_version_id IS NOT NULL";
    if (hasCapability(actor, "CONSULTANT", projectId)) {
      sql +=
        " OR EXISTS(SELECT 1 FROM drawing_versions rv JOIN drawing_reviews rr ON rr.version_id=rv.id WHERE rv.drawing_id=d.id AND rr.consultant_user_id=?)";
      params.push(actor.id);
    }
    sql += ")";
  }
  // Scope the register to released records or explicitly assigned reviews.
  sql += " ORDER BY d.drawing_number ASC";

  return await query(db, sql, params);
}
