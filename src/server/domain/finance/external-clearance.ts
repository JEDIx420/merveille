/**
 * Version-Bound External Commercial Clearance & Cutover Service (Stage N01, NAC-005).
 * Billing remains outside the portal while preserving client acceptance, ADMIN-confirmed
 * external clearance tied to exact quotation/change versions, and manager authorization.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError, assertProjectAccess } from "@/server/auth/policy";
import { query, queryFirst } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/identity/service";

export type CommercialMode = "LEGACY_PORTAL" | "EXTERNAL";
export type ClearanceEntityType = "QUOTATION" | "CHANGE_REQUEST";
export type ClearanceType =
  | "ADVANCE_RECEIVED"
  | "PAYMENT_CLEARED"
  | "WAIVED_BY_ADMIN"
  | "EXTERNAL_TERMS_MET";

export async function getCommercialMode(
  db: D1Database,
  orgId: string
): Promise<CommercialMode> {
  const row = await queryFirst<{ commercial_mode?: string }>(
    db,
    `SELECT commercial_mode FROM organizations WHERE id = ?`,
    [orgId]
  );
  return row?.commercial_mode === "EXTERNAL" ? "EXTERNAL" : "LEGACY_PORTAL";
}

export async function setCommercialMode(
  db: D1Database,
  actor: UserPrincipal,
  orgId: string,
  mode: CommercialMode,
  reason: string
) {
  if (!hasCapability(actor, "ADMIN")) {
    throw new AuthorizationError("Only administrators can change commercial mode.", "FORBIDDEN");
  }
  if (!reason?.trim()) {
    throw new AuthorizationError("A reason is required for commercial cutover.", "INVALID_INPUT");
  }
  const previous = await getCommercialMode(db, orgId);
  await db
    .prepare(`UPDATE organizations SET commercial_mode = ? WHERE id = ?`)
    .bind(mode, orgId)
    .run();

  await recordAuditEvent(db, {
    orgId,
    actorId: actor.id,
    entityType: "ORGANIZATION",
    entityId: orgId,
    action: "COMMERCIAL_MODE_CHANGED",
    oldState: { commercialMode: previous },
    newState: { commercialMode: mode },
    reason: reason.trim(),
  });

  return { orgId, commercialMode: mode };
}

export async function assertLegacyBillingAllowed(
  db: D1Database,
  orgId: string,
  actionLabel: string
) {
  const mode = await getCommercialMode(db, orgId);
  if (mode === "EXTERNAL") {
    throw new AuthorizationError(
      `Cannot ${actionLabel}: billing is handled externally. Only legacy obligation corrections and external commercial clearance are permitted.`,
      "EXTERNAL_BILLING_CUTOVER"
    );
  }
}

export async function recordExternalClearance(
  db: D1Database,
  actor: UserPrincipal,
  input: {
    projectId: string;
    entityType: ClearanceEntityType;
    entityId: string;
    versionNumber: number;
    clearanceType: ClearanceType;
    externalReference: string;
    reason?: string;
  }
) {
  if (!hasCapability(actor, "ADMIN")) {
    throw new AuthorizationError(
      "Only administrators can record external commercial clearance.",
      "FORBIDDEN"
    );
  }
  assertProjectAccess(actor, input.projectId);

  if (!input.externalReference?.trim()) {
    throw new AuthorizationError("External reference is required.", "INVALID_INPUT");
  }

  // Verify exact version exists and is ACCEPTED by main client
  if (input.entityType === "QUOTATION") {
    const q = await queryFirst<any>(
      db,
      `SELECT id, version_number, status FROM quotations WHERE id = ? AND project_id = ? AND org_id = ?`,
      [input.entityId, input.projectId, actor.orgId]
    );
    if (!q || q.version_number !== input.versionNumber) {
      throw new AuthorizationError("Exact quotation version not found.", "NOT_FOUND");
    }
    if (q.status !== "ACCEPTED") {
      throw new AuthorizationError(
        "Quotation version must be accepted by the main client before recording external clearance.",
        "INVALID_STATE"
      );
    }
  } else {
    const crv = await queryFirst<any>(
      db,
      `SELECT v.id, v.version_number, v.status
       FROM change_request_versions v
       JOIN change_requests c ON c.id = v.change_request_id
       WHERE c.id = ? AND c.project_id = ? AND c.org_id = ? AND v.version_number = ?`,
      [input.entityId, input.projectId, actor.orgId, input.versionNumber]
    );
    if (!crv) {
      throw new AuthorizationError("Exact change-request version not found.", "NOT_FOUND");
    }
    if (crv.status !== "ACCEPTED") {
      throw new AuthorizationError(
        "Change estimate version must be accepted by the main client before recording external clearance.",
        "INVALID_STATE"
      );
    }
  }

  const clearanceId = `ecl_${crypto.randomUUID()}`;
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO external_commercial_clearances (
        id, org_id, project_id, entity_type, entity_id, version_number,
        clearance_type, external_reference, status, recorded_by_user_id, reason, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?)`
    )
    .bind(
      clearanceId,
      actor.orgId,
      input.projectId,
      input.entityType,
      input.entityId,
      input.versionNumber,
      input.clearanceType,
      input.externalReference.trim(),
      actor.id,
      input.reason?.trim() || null,
      now
    )
    .run();

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "EXTERNAL_CLEARANCE",
    entityId: clearanceId,
    action: "EXTERNAL_CLEARANCE_RECORDED",
    scope: "PROJECT",
    newState: {
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      versionNumber: input.versionNumber,
      clearanceType: input.clearanceType,
      externalReference: input.externalReference.trim(),
    },
    reason: input.reason?.trim() || undefined,
  });

  return {
    id: clearanceId,
    status: "CONFIRMED",
    entityType: input.entityType,
    entityId: input.entityId,
    versionNumber: input.versionNumber,
    recordedAt: now,
  };
}

export async function updateExternalClearanceStatus(
  db: D1Database,
  actor: UserPrincipal,
  input: {
    clearanceId: string;
    action: "CORRECTED" | "REVOKED";
    reason: string;
    externalReference?: string;
    clearanceType?: ClearanceType;
  }
) {
  if (!hasCapability(actor, "ADMIN")) {
    throw new AuthorizationError(
      "Only administrators can correct or revoke external commercial clearance.",
      "FORBIDDEN"
    );
  }
  if (!input.reason?.trim()) {
    throw new AuthorizationError("A reason is required to correct or revoke clearance.", "INVALID_INPUT");
  }

  const prior = await queryFirst<any>(
    db,
    `SELECT * FROM external_commercial_clearances WHERE id = ? AND org_id = ?`,
    [input.clearanceId, actor.orgId]
  );
  if (!prior) {
    throw new AuthorizationError("Clearance record not found.", "NOT_FOUND");
  }

  const newId = `ecl_${crypto.randomUUID()}`;
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO external_commercial_clearances (
        id, org_id, project_id, entity_type, entity_id, version_number,
        clearance_type, external_reference, status, recorded_by_user_id, reason, supersedes_clearance_id, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newId,
      actor.orgId,
      prior.project_id,
      prior.entity_type,
      prior.entity_id,
      prior.version_number,
      input.clearanceType ?? prior.clearance_type,
      input.externalReference?.trim() || prior.external_reference,
      input.action,
      actor.id,
      input.reason.trim(),
      prior.id,
      now
    )
    .run();

  // Check if project or change work is already active so manager can be alerted
  let activeWorkAffected = false;
  if (prior.entity_type === "QUOTATION") {
    const p = await queryFirst<{ status: string }>(
      db,
      `SELECT status FROM projects WHERE id = ?`,
      [prior.project_id]
    );
    activeWorkAffected = p?.status === "ACTIVE";
  } else {
    const cr = await queryFirst<{ status: string }>(
      db,
      `SELECT status FROM change_requests WHERE id = ?`,
      [prior.entity_id]
    );
    activeWorkAffected = cr?.status === "AUTHORIZED" || cr?.status === "IN_PROGRESS";
  }

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "EXTERNAL_CLEARANCE",
    entityId: newId,
    action: `EXTERNAL_CLEARANCE_${input.action}`,
    scope: "PROJECT",
    oldState: { priorClearanceId: prior.id, status: prior.status },
    newState: { status: input.action, activeWorkAffected },
    reason: input.reason.trim(),
  });

  return {
    id: newId,
    supersedesClearanceId: prior.id,
    status: input.action,
    activeWorkAffected,
    managerNotice: activeWorkAffected
      ? "Work is already active; surface this exception to the project manager for a deliberate decision."
      : null,
  };
}

export async function getLatestExternalClearance(
  db: D1Database,
  projectId: string,
  entityType: ClearanceEntityType,
  entityId: string,
  versionNumber: number
) {
  return queryFirst<any>(
    db,
    `SELECT * FROM external_commercial_clearances
     WHERE project_id = ? AND entity_type = ? AND entity_id = ? AND version_number = ?
     ORDER BY recorded_at DESC, rowid DESC LIMIT 1`,
    [projectId, entityType, entityId, versionNumber]
  );
}

export async function listProjectClearances(
  db: D1Database,
  actor: UserPrincipal,
  projectId: string
) {
  assertProjectAccess(actor, projectId);
  return query<any>(
    db,
    `SELECT c.*, u.display_name as recorded_by_name
     FROM external_commercial_clearances c
     LEFT JOIN users u ON u.id = c.recorded_by_user_id
     WHERE c.project_id = ? AND c.org_id = ?
     ORDER BY c.recorded_at DESC`,
    [projectId, actor.orgId]
  );
}
