/**
 * Simple Leads Tracker, Follow-ups, and Activity History (Stage N02, NAC-006).
 * Extends the existing enquiries domain without creating a disconnected CRM.
 * Only explicitly authorized internal users (ADMIN, OWNER, intakeAccess) may access leads.
 */

import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/identity/service";
import { neutralizeCsvCell } from "@/shared/spreadsheet";

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "DISCUSSION"
  | "PROPOSAL"
  | "WON"
  | "LOST"
  | "ON_HOLD";

const VALID_STAGES = new Set<LeadStage>([
  "NEW",
  "CONTACTED",
  "DISCUSSION",
  "PROPOSAL",
  "WON",
  "LOST",
  "ON_HOLD",
]);

export function assertLeadAccess(actor: UserPrincipal) {
  if (
    !hasCapability(actor, "ADMIN") &&
    !hasCapability(actor, "OWNER") &&
    !actor.intakeAccess
  ) {
    throw new AuthorizationError(
      "Lead records are restricted to authorized internal practice members.",
      "FORBIDDEN"
    );
  }
}

export interface CreateLeadInput {
  name: string;
  requirement: string;
  phone?: string;
  email?: string;
  stage?: LeadStage;
  ownerId?: string;
  nextAction?: string;
  nextActionDate?: string; // YYYY-MM-DD
  nextActionTime?: string; // HH:MM
  siteLocation?: string;
  sourceLabel?: string;
  budgetText?: string;
}

export async function createLead(
  actor: UserPrincipal,
  input: CreateLeadInput,
  db: D1Database
) {
  assertLeadAccess(actor);

  if (!input.name?.trim() || !input.requirement?.trim()) {
    throw new AuthorizationError(
      "Lead name and requirement note are required.",
      "INVALID_INPUT"
    );
  }

  const stage: LeadStage = input.stage || "NEW";
  if (!VALID_STAGES.has(stage)) {
    throw new AuthorizationError(`Invalid lead stage: ${stage}`, "INVALID_INPUT");
  }

  const ownerId = input.ownerId || actor.id;
  const ownerRow = await queryFirst<any>(
    db,
    `SELECT u.id FROM users u
     JOIN organization_memberships m ON m.user_id = u.id
     WHERE u.id = ? AND m.org_id = ? AND m.is_active = 1 AND u.status = 'ACTIVE'`,
    [ownerId, actor.orgId]
  );
  if (!ownerRow) {
    throw new AuthorizationError("Selected lead owner is not an active organization member.", "INVALID_INPUT");
  }

  const id = `enq_${crypto.randomUUID()}`;
  const now = Date.now();
  const email = input.email?.trim() ? input.email.trim().toLowerCase() : null;
  const phone = input.phone?.trim() || null;
  const siteLocation = input.siteLocation?.trim() || null;

  await execute(
    db,
    `INSERT INTO enquiries (
      id, org_id, contact_name, contact_email, contact_phone, site_location,
      requirements_text, lead_manager_id, status, lead_stage, source_label, budget_text, revision, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, 1, ?)`,
    [
      id,
      actor.orgId,
      input.name.trim(),
      email,
      phone,
      siteLocation,
      input.requirement.trim(),
      ownerId,
      stage,
      input.sourceLabel?.trim() || null,
      input.budgetText?.trim() || null,
      now,
    ]
  );

  let followupId: string | null = null;
  if (input.nextAction?.trim()) {
    followupId = `lfu_${crypto.randomUUID()}`;
    await execute(
      db,
      `INSERT INTO lead_followups (
        id, org_id, enquiry_id, owner_user_id, action_text, due_date, due_time, is_completed, revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
      [
        followupId,
        actor.orgId,
        id,
        ownerId,
        input.nextAction.trim(),
        input.nextActionDate || null,
        input.nextActionTime || null,
        now,
      ]
    );
  }

  await execute(
    db,
    `INSERT INTO lead_activities (id, org_id, enquiry_id, actor_id, activity_type, summary, created_at)
     VALUES (?, ?, ?, ?, 'NOTE', ?, ?)`,
    [`lact_${crypto.randomUUID()}`, actor.orgId, id, actor.id, `Lead created: ${input.requirement.trim().slice(0, 120)}`, now]
  );

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "ENQUIRY",
    entityId: id,
    action: "LEAD_CREATED",
    newState: { contactName: input.name.trim(), stage, ownerId },
  });

  return { id, stage, ownerId, followupId };
}

export async function listLeads(
  actor: UserPrincipal,
  db: D1Database,
  filters: {
    filter?: "ALL" | "FOLLOWUPS_DUE" | "OVERDUE" | "NEEDS_ATTENTION";
    stage?: LeadStage;
    query?: string;
  } = {}
) {
  assertLeadAccess(actor);
  const today = new Date().toISOString().slice(0, 10);

  let sql = `
    SELECT e.*,
           u.display_name as owner_name,
           (SELECT f.id FROM lead_followups f WHERE f.enquiry_id = e.id AND f.is_completed = 0 ORDER BY CASE WHEN f.due_date IS NULL THEN 1 ELSE 0 END, f.due_date ASC LIMIT 1) as next_followup_id,
           (SELECT f.action_text FROM lead_followups f WHERE f.enquiry_id = e.id AND f.is_completed = 0 ORDER BY CASE WHEN f.due_date IS NULL THEN 1 ELSE 0 END, f.due_date ASC LIMIT 1) as next_action_text,
           (SELECT f.due_date FROM lead_followups f WHERE f.enquiry_id = e.id AND f.is_completed = 0 ORDER BY CASE WHEN f.due_date IS NULL THEN 1 ELSE 0 END, f.due_date ASC LIMIT 1) as next_due_date,
           (SELECT f.due_time FROM lead_followups f WHERE f.enquiry_id = e.id AND f.is_completed = 0 ORDER BY CASE WHEN f.due_date IS NULL THEN 1 ELSE 0 END, f.due_date ASC LIMIT 1) as next_due_time
    FROM enquiries e
    LEFT JOIN users u ON u.id = e.lead_manager_id
    WHERE e.org_id = ?
  `;
  const params: any[] = [actor.orgId];

  if (filters.stage) {
    sql += ` AND e.lead_stage = ?`;
    params.push(filters.stage);
  }
  if (filters.query?.trim()) {
    const q = `%${filters.query.trim().toLowerCase()}%`;
    sql += ` AND (lower(e.contact_name) LIKE ? OR lower(COALESCE(e.contact_phone,'')) LIKE ? OR lower(COALESCE(e.requirements_text,'')) LIKE ?)`;
    params.push(q, q, q);
  }
  sql += ` ORDER BY e.created_at DESC`;

  const rows = await query<any>(db, sql, params);
  return rows.filter((r) => {
    if (filters.filter === "FOLLOWUPS_DUE") {
      return Boolean(r.next_followup_id && r.next_due_date && r.next_due_date <= today);
    }
    if (filters.filter === "OVERDUE") {
      return Boolean(r.next_followup_id && r.next_due_date && r.next_due_date < today);
    }
    if (filters.filter === "NEEDS_ATTENTION") {
      return !r.next_followup_id && r.lead_stage !== "WON" && r.lead_stage !== "LOST";
    }
    return true;
  });
}

export async function updateLeadStage(
  actor: UserPrincipal,
  leadId: string,
  stage: LeadStage,
  reason: string | undefined,
  db: D1Database
) {
  assertLeadAccess(actor);
  if (!VALID_STAGES.has(stage)) {
    throw new AuthorizationError(`Invalid lead stage: ${stage}`, "INVALID_INPUT");
  }
  if (stage === "LOST" && !reason?.trim()) {
    throw new AuthorizationError("A reason is required when marking a lead Lost.", "INVALID_INPUT");
  }

  const lead = await queryFirst<any>(
    db,
    `SELECT * FROM enquiries WHERE id = ? AND org_id = ?`,
    [leadId, actor.orgId]
  );
  if (!lead) throw new AuthorizationError("Lead not found.", "NOT_FOUND");

  const legacyStatus =
    stage === "LOST" ? "LOST" : stage === "WON" ? lead.linked_project_id ? "CONVERTED" : "QUOTE_PREPARATION" : stage === "ON_HOLD" ? "ON_HOLD" : "OPEN";

  const now = Date.now();
  await execute(
    db,
    `UPDATE enquiries SET lead_stage = ?, status = ?, decline_reason = COALESCE(?, decline_reason), revision = revision + 1 WHERE id = ?`,
    [stage, legacyStatus, stage === "LOST" ? reason?.trim() : null, leadId]
  );

  const actType = lead.lead_stage === "LOST" && stage !== "LOST" ? "REOPENED" : "STAGE_CHANGE";
  await execute(
    db,
    `INSERT INTO lead_activities (id, org_id, enquiry_id, actor_id, activity_type, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `lact_${crypto.randomUUID()}`,
      actor.orgId,
      leadId,
      actor.id,
      actType,
      `Stage changed from ${lead.lead_stage} to ${stage}${reason ? `: ${reason.trim()}` : ""}`,
      now,
    ]
  );

  return { id: leadId, leadStage: stage, linkedProjectId: lead.linked_project_id || null };
}

export async function reassignLeadOwner(
  actor: UserPrincipal,
  leadId: string,
  newOwnerId: string,
  db: D1Database
) {
  assertLeadAccess(actor);
  const lead = await queryFirst<any>(
    db,
    `SELECT * FROM enquiries WHERE id = ? AND org_id = ?`,
    [leadId, actor.orgId]
  );
  if (!lead) throw new AuthorizationError("Lead not found.", "NOT_FOUND");

  const ownerRow = await queryFirst<any>(
    db,
    `SELECT u.id, u.display_name FROM users u
     JOIN organization_memberships m ON m.user_id = u.id
     WHERE u.id = ? AND m.org_id = ? AND m.is_active = 1 AND u.status = 'ACTIVE'`,
    [newOwnerId, actor.orgId]
  );
  if (!ownerRow) {
    throw new AuthorizationError("Target owner is not an active organization member.", "INVALID_INPUT");
  }

  const now = Date.now();
  await execute(
    db,
    `UPDATE enquiries SET lead_manager_id = ?, revision = revision + 1 WHERE id = ?`,
    [newOwnerId, leadId]
  );
  await execute(
    db,
    `UPDATE lead_followups SET owner_user_id = ? WHERE enquiry_id = ? AND is_completed = 0`,
    [newOwnerId, leadId]
  );
  await execute(
    db,
    `INSERT INTO lead_activities (id, org_id, enquiry_id, actor_id, activity_type, summary, created_at)
     VALUES (?, ?, ?, ?, 'OWNER_CHANGE', ?, ?)`,
    [`lact_${crypto.randomUUID()}`, actor.orgId, leadId, actor.id, `Lead assigned to ${ownerRow.display_name}`, now]
  );

  return { id: leadId, ownerId: newOwnerId };
}

export async function addLeadFollowup(
  actor: UserPrincipal,
  leadId: string,
  input: { actionText: string; dueDate?: string; dueTime?: string },
  db: D1Database
) {
  assertLeadAccess(actor);
  if (!input.actionText?.trim()) {
    throw new AuthorizationError("Follow-up action text is required.", "INVALID_INPUT");
  }
  const lead = await queryFirst<any>(
    db,
    `SELECT * FROM enquiries WHERE id = ? AND org_id = ?`,
    [leadId, actor.orgId]
  );
  if (!lead) throw new AuthorizationError("Lead not found.", "NOT_FOUND");

  const id = `lfu_${crypto.randomUUID()}`;
  const now = Date.now();
  await execute(
    db,
    `INSERT INTO lead_followups (id, org_id, enquiry_id, owner_user_id, action_text, due_date, due_time, is_completed, revision, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
    [id, actor.orgId, leadId, lead.lead_manager_id || actor.id, input.actionText.trim(), input.dueDate || null, input.dueTime || null, now]
  );
  return { id, enquiryId: leadId, actionText: input.actionText.trim(), dueDate: input.dueDate || null, dueTime: input.dueTime || null };
}

export async function completeLeadFollowup(
  actor: UserPrincipal,
  followupId: string,
  input: { outcomeNote: string; nextActionText?: string; nextDueDate?: string; nextDueTime?: string },
  db: D1Database
) {
  assertLeadAccess(actor);
  const f = await queryFirst<any>(
    db,
    `SELECT * FROM lead_followups WHERE id = ? AND org_id = ?`,
    [followupId, actor.orgId]
  );
  if (!f) throw new AuthorizationError("Follow-up not found.", "NOT_FOUND");

  const now = Date.now();
  await execute(
    db,
    `UPDATE lead_followups SET is_completed = 1, completed_at = ?, completed_by_user_id = ?, outcome_note = ?, revision = revision + 1 WHERE id = ?`,
    [now, actor.id, input.outcomeNote?.trim() || "Completed", followupId]
  );
  await execute(
    db,
    `INSERT INTO lead_activities (id, org_id, enquiry_id, actor_id, activity_type, summary, created_at)
     VALUES (?, ?, ?, ?, 'FOLLOWUP_COMPLETED', ?, ?)`,
    [`lact_${crypto.randomUUID()}`, actor.orgId, f.enquiry_id, actor.id, input.outcomeNote?.trim() || `Completed: ${f.action_text}`, now]
  );

  let nextFollowupId: string | null = null;
  if (input.nextActionText?.trim()) {
    const next = await addLeadFollowup(
      actor,
      f.enquiry_id,
      { actionText: input.nextActionText, dueDate: input.nextDueDate, dueTime: input.nextDueTime },
      db
    );
    nextFollowupId = next.id;
  }

  return { completedFollowupId: followupId, nextFollowupId };
}

export async function exportLeadsCsv(actor: UserPrincipal, db: D1Database): Promise<string> {
  assertLeadAccess(actor);
  const rows = await listLeads(actor, db);
  const headers = [
    "ID",
    "Source ID",
    "Import Batch",
    "Name",
    "Phone",
    "Email",
    "Requirement",
    "Stage",
    "Owner",
    "Next Action",
    "Next Due Date",
  ];
  const lines = [headers.map(neutralizeCsvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.source_external_id || "",
        r.import_batch_id || "",
        r.contact_name,
        r.contact_phone || "",
        r.contact_email || "",
        r.requirements_text || "",
        r.lead_stage,
        r.owner_name || "",
        r.next_action_text || "",
        r.next_due_date || "",
      ]
        .map(neutralizeCsvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}
