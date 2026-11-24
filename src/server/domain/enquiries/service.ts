/**
 * Enquiry and Feasibility Study domain service for Merveille Designs.
 * Handles initial intake, feasibility evaluations, and stage progression.
 */

import { UserPrincipal } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "../identity/service";

export interface CreateEnquiryInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  siteLocation: string;
  requirementsText?: string;
  leadManagerId?: string;
}

export interface FeasibilityStudyInput {
  observations: string;
  siteConstraints?: string;
  recommendations: string;
}

export interface CloseEnquiryInput {
  status: "LOST" | "DECLINED";
  reason: string;
}

export interface ConvertEnquiryInput {
  projectCode: string;
  projectName: string;
  mainClientUserId: string;
  managerUserId: string;
}

export async function createEnquiry(
  actor: UserPrincipal,
  input: CreateEnquiryInput,
  db: D1Database
) {
  // Only internal staff, manager, owner, or admin can record enquiries
  if (actor.role === "CONSULTANT" || actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Only architectural practice members can record new enquiries.", "FORBIDDEN");
  }

  const id = `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await execute(
    db,
    `INSERT INTO enquiries (id, org_id, contact_name, contact_email, contact_phone, site_location, requirements_text, lead_manager_id, status, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 1, ?)`,
    [
      id,
      actor.orgId,
      input.contactName,
      input.contactEmail.toLowerCase().trim(),
      input.contactPhone || null,
      input.siteLocation,
      input.requirementsText || null,
      input.leadManagerId || actor.id,
      now,
    ]
  );

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "ENQUIRY",
    entityId: id,
    action: "ENQUIRY_CREATED",
    newState: {
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      siteLocation: input.siteLocation,
    },
    reason: "New client enquiry received",
  });

  return { id, status: "OPEN" };
}

export async function recordFeasibilityStudy(
  actor: UserPrincipal,
  enquiryId: string,
  input: FeasibilityStudyInput,
  db: D1Database
) {
  if (actor.role === "CONSULTANT" || actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Only design staff can record feasibility studies.", "FORBIDDEN");
  }

  const enquiry = await queryFirst<{ id: string; org_id: string; status: string }>(
    db,
    "SELECT id, org_id, status FROM enquiries WHERE id = ?",
    [enquiryId]
  );

  if (!enquiry) {
    throw new AuthorizationError("Enquiry not found.", "NOT_FOUND");
  }

  const studyId = `feas_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await execute(
    db,
    `INSERT INTO feasibility_studies (id, enquiry_id, observations, site_constraints, recommendations, reviewer_id, status, revision, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', 1, ?, ?)`,
    [
      studyId,
      enquiryId,
      input.observations,
      input.siteConstraints || null,
      input.recommendations,
      actor.id,
      now,
      now,
    ]
  );

  await execute(
    db,
    "UPDATE enquiries SET status = 'FEASIBILITY_REVIEW', revision = revision + 1 WHERE id = ?",
    [enquiryId]
  );

  await recordAuditEvent(db, {
    orgId: enquiry.org_id,
    actorId: actor.id,
    entityType: "ENQUIRY",
    entityId: enquiryId,
    action: "FEASIBILITY_STUDY_RECORDED",
    newState: { studyId, recommendations: input.recommendations },
  });

  return { studyId, enquiryId, status: "FEASIBILITY_REVIEW" };
}

/**
 * Close an enquiry without creating an active project (AC-009).
 */
export async function closeEnquiry(
  actor: UserPrincipal,
  enquiryId: string,
  input: CloseEnquiryInput,
  db: D1Database
) {
  if (actor.role !== "ADMIN" && actor.role !== "OWNER" && actor.role !== "MANAGER") {
    throw new AuthorizationError("Only practice managers or administrators can close enquiries.", "FORBIDDEN");
  }

  const enquiry = await queryFirst<{ id: string; org_id: string; status: string; linked_project_id: string | null }>(
    db,
    "SELECT id, org_id, status, linked_project_id FROM enquiries WHERE id = ?",
    [enquiryId]
  );

  if (!enquiry) {
    throw new AuthorizationError("Enquiry not found.", "NOT_FOUND");
  }

  // Update status to LOST or DECLINED with reason
  await execute(
    db,
    "UPDATE enquiries SET status = ?, decline_reason = ?, revision = revision + 1 WHERE id = ?",
    [input.status, input.reason, enquiryId]
  );

  await recordAuditEvent(db, {
    orgId: enquiry.org_id,
    actorId: actor.id,
    entityType: "ENQUIRY",
    entityId: enquiryId,
    action: input.status === "LOST" ? "ENQUIRY_LOST" : "ENQUIRY_DECLINED",
    oldState: { status: enquiry.status },
    newState: { status: input.status, declineReason: input.reason },
    reason: input.reason,
  });

  return { enquiryId, status: input.status, reason: input.reason, hasActiveProject: false };
}

/**
 * Convert an enquiry into a project record with default architectural stage templates.
 */
export async function convertEnquiryToProject(
  actor: UserPrincipal,
  enquiryId: string,
  input: ConvertEnquiryInput,
  db: D1Database
) {
  if (actor.role !== "ADMIN" && actor.role !== "OWNER" && actor.role !== "MANAGER") {
    throw new AuthorizationError("Only practice managers or administrators can convert enquiries.", "FORBIDDEN");
  }

  const enquiry = await queryFirst<{
    id: string;
    org_id: string;
    contact_name: string;
    site_location: string;
    status: string;
  }>(db, "SELECT * FROM enquiries WHERE id = ?", [enquiryId]);

  if (!enquiry) {
    throw new AuthorizationError("Enquiry not found.", "NOT_FOUND");
  }

  const projectId = `prj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  // 1. Create Project in DRAFT status
  await execute(
    db,
    `INSERT INTO projects (id, org_id, code, name, site_location, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEMATIC_DESIGN', 'DRAFT', 0, 1, ?)`,
    [
      projectId,
      enquiry.org_id,
      input.projectCode,
      input.projectName,
      enquiry.site_location,
      input.mainClientUserId,
      input.managerUserId,
      now,
    ]
  );

  // 2. Insert standard architectural practice stages
  const defaultStages = [
    { order: 1, name: "Schematic Design" },
    { order: 2, name: "Design Development" },
    { order: 3, name: "Statutory & Permit Drawings" },
    { order: 4, name: "Tender Documentation & GFC" },
    { order: 5, name: "Site Execution & Supervision" },
    { order: 6, name: "Handover & Project Closeout" },
  ];

  for (const s of defaultStages) {
    const stageId = `stg_${projectId}_${s.order}`;
    await execute(
      db,
      `INSERT INTO project_stages (id, project_id, stage_order, name, status, revision)
       VALUES (?, ?, ?, ?, 'PENDING', 1)`,
      [stageId, projectId, s.order, s.name]
    );
  }

  // 3. Bind Main Client and Manager to project memberships
  await execute(
    db,
    `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
     VALUES (?, ?, ?, ?, 'MAIN_CLIENT', 1, ?)`,
    [`pm_mc_${projectId}`, enquiry.org_id, projectId, input.mainClientUserId, now]
  );

  await execute(
    db,
    `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
     VALUES (?, ?, ?, ?, 'MANAGER', 1, ?)`,
    [`pm_mgr_${projectId}`, enquiry.org_id, projectId, input.managerUserId, now]
  );

  // 4. Update enquiry to CONVERTED
  await execute(
    db,
    "UPDATE enquiries SET status = 'CONVERTED', linked_project_id = ?, revision = revision + 1 WHERE id = ?",
    [projectId, enquiryId]
  );

  await recordAuditEvent(db, {
    orgId: enquiry.org_id,
    actorId: actor.id,
    entityType: "ENQUIRY",
    entityId: enquiryId,
    action: "ENQUIRY_CONVERTED_TO_PROJECT",
    newState: { projectId, projectCode: input.projectCode },
  });

  return { projectId, projectCode: input.projectCode, status: "DRAFT" };
}

export async function listEnquiries(actor: UserPrincipal, db: D1Database) {
  if (actor.role === "CONSULTANT" || actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Enquiries are internal practice records.", "FORBIDDEN");
  }

  return await query(
    db,
    "SELECT * FROM enquiries WHERE org_id = ? ORDER BY created_at DESC",
    [actor.orgId]
  );
}

export async function getEnquiry(actor: UserPrincipal, enquiryId: string, db: D1Database) {
  if (actor.role === "CONSULTANT" || actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    throw new AuthorizationError("Enquiries are internal practice records.", "FORBIDDEN");
  }

  const enquiry = await queryFirst(
    db,
    "SELECT * FROM enquiries WHERE id = ? AND org_id = ?",
    [enquiryId, actor.orgId]
  );

  if (!enquiry) {
    throw new AuthorizationError("Enquiry not found.", "NOT_FOUND");
  }

  const studies = await query(
    db,
    "SELECT * FROM feasibility_studies WHERE enquiry_id = ? ORDER BY created_at DESC",
    [enquiryId]
  );

  return { enquiry, studies };
}
