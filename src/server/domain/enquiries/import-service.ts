/**
 * Reviewed Spreadsheet Import Service for Leads and Asana CSV Exports (Stage N02, NAC-007).
 * Enforces bounded 50-row server batches, row provenance, duplicate review,
 * idempotent retry/resume, Free-tier R2 storage reservation, and conditional undo.
 */

import { UserPrincipal } from "@/server/auth/principal";
import { AuthorizationError, canReadInternalNotes } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { QuotaService } from "@/server/quota/service";
import { recordAuditEvent } from "@/server/domain/identity/service";
import { assertLeadAccess, LeadStage } from "./leads-service";
import { createPersonalTask } from "@/server/domain/tasks/personal-service";
import { createTask } from "@/server/domain/tasks/service";

export const MAX_IMPORT_BATCH_ROWS = 50;
export const MAX_IMPORT_TOTAL_ROWS = 2000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export interface LeadImportRowInput {
  rowNumber: number;
  sheetName?: string;
  sourceExternalId?: string;
  name: string;
  phone?: string;
  email?: string;
  requirement?: string;
  stage?: string;
  ownerId?: string;
  nextAction?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  hasMissingFormulaValue?: boolean;
  ambiguousDateRaw?: string;
  extraColumns?: Record<string, string>;
}

export interface LeadImportPreviewItem {
  rowNumber: number;
  decision: "CREATE" | "SKIP_EXACT_SOURCE" | "PROPOSED_UPDATE" | "POSSIBLE_DUPLICATE" | "REJECT";
  reason?: string;
  existingLeadId?: string;
  normalizedStage: LeadStage;
  rowSha256: string;
}

const STAGE_MAP: Record<string, LeadStage> = {
  new: "NEW",
  open: "NEW",
  contacted: "CONTACTED",
  "requirements review": "CONTACTED",
  discussion: "DISCUSSION",
  "site visit": "DISCUSSION",
  "discussion/site visit": "DISCUSSION",
  "feasibility review": "DISCUSSION",
  proposal: "PROPOSAL",
  "quote preparation": "PROPOSAL",
  won: "WON",
  converted: "WON",
  lost: "LOST",
  declined: "LOST",
  "on hold": "ON_HOLD",
  on_hold: "ON_HOLD",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function mapLeadStage(raw?: string, fallback: LeadStage = "NEW"): { stage: LeadStage; known: boolean } {
  if (!raw?.trim()) return { stage: fallback, known: true };
  const mapped = STAGE_MAP[raw.trim().toLowerCase()];
  if (mapped) return { stage: mapped, known: true };
  return { stage: fallback, known: false };
}

export async function previewLeadImport(
  actor: UserPrincipal,
  db: D1Database,
  input: {
    rows: LeadImportRowInput[];
    defaultRequirementNote?: string;
    stageMapping?: Record<string, LeadStage>;
  }
): Promise<{ items: LeadImportPreviewItem[] }> {
  assertLeadAccess(actor);
  if (input.rows.length > MAX_IMPORT_TOTAL_ROWS) {
    throw new AuthorizationError(`Import exceeds maximum of ${MAX_IMPORT_TOTAL_ROWS} rows.`, "INVALID_INPUT");
  }

  const existingLeads = await query<any>(
    db,
    `SELECT id, contact_name, contact_email, contact_phone, source_external_id, revision FROM enquiries WHERE org_id = ?`,
    [actor.orgId]
  );

  const items: LeadImportPreviewItem[] = [];
  for (const row of input.rows) {
    const reqText = (row.requirement || input.defaultRequirementNote || "").trim();
    const rowHash = await sha256Hex(
      JSON.stringify({
        name: row.name,
        phone: row.phone,
        email: row.email,
        req: reqText,
        stage: row.stage,
        sourceExternalId: row.sourceExternalId,
      })
    );

    if (row.hasMissingFormulaValue) {
      items.push({
        rowNumber: row.rowNumber,
        decision: "REJECT",
        reason: "Formula cell has no cached value; resolve in spreadsheet before importing.",
        normalizedStage: "NEW",
        rowSha256: rowHash,
      });
      continue;
    }
    if (row.ambiguousDateRaw) {
      items.push({
        rowNumber: row.rowNumber,
        decision: "REJECT",
        reason: `Ambiguous date "${row.ambiguousDateRaw}" requires explicit YYYY-MM-DD confirmation.`,
        normalizedStage: "NEW",
        rowSha256: rowHash,
      });
      continue;
    }
    if (!row.name?.trim() || !reqText) {
      items.push({
        rowNumber: row.rowNumber,
        decision: "REJECT",
        reason: "Both Name and Requirement note are required.",
        normalizedStage: "NEW",
        rowSha256: rowHash,
      });
      continue;
    }

    const customMapped = row.stage && input.stageMapping?.[row.stage.trim()];
    const stageRes = customMapped
      ? { stage: customMapped, known: true }
      : mapLeadStage(row.stage, "NEW");
    if (!stageRes.known) {
      items.push({
        rowNumber: row.rowNumber,
        decision: "REJECT",
        reason: `Unknown stage "${row.stage}" requires explicit mapping.`,
        normalizedStage: "NEW",
        rowSha256: rowHash,
      });
      continue;
    }

    // 1. Check exact source_external_id
    if (row.sourceExternalId?.trim()) {
      const priorRow = await queryFirst<any>(
        db,
        `SELECT row_sha256, target_entity_id FROM import_batch_rows
         WHERE org_id = ? AND source_external_id = ? AND action IN ('CREATED', 'UPDATED')
         ORDER BY created_at DESC LIMIT 1`,
        [actor.orgId, row.sourceExternalId.trim()]
      );
      if (priorRow) {
        if (priorRow.row_sha256 === rowHash) {
          items.push({
            rowNumber: row.rowNumber,
            decision: "SKIP_EXACT_SOURCE",
            reason: "Exact source row already imported.",
            existingLeadId: priorRow.target_entity_id,
            normalizedStage: stageRes.stage,
            rowSha256: rowHash,
          });
          continue;
        } else {
          items.push({
            rowNumber: row.rowNumber,
            decision: "PROPOSED_UPDATE",
            reason: "Source row changed since last import.",
            existingLeadId: priorRow.target_entity_id,
            normalizedStage: stageRes.stage,
            rowSha256: rowHash,
          });
          continue;
        }
      }
    }

    // 2. Check possible duplicate by normalized email or phone (never merge on name alone!)
    const normEmail = row.email?.trim().toLowerCase();
    const normPhone = row.phone?.trim();
    const dup = existingLeads.find(
      (l) =>
        (normEmail && l.contact_email && l.contact_email.toLowerCase() === normEmail) ||
        (normPhone && l.contact_phone && l.contact_phone === normPhone)
    );
    if (dup) {
      items.push({
        rowNumber: row.rowNumber,
        decision: "POSSIBLE_DUPLICATE",
        reason: `Matches existing contact (${dup.contact_name}). Review before creating or updating.`,
        existingLeadId: dup.id,
        normalizedStage: stageRes.stage,
        rowSha256: rowHash,
      });
      continue;
    }

    items.push({
      rowNumber: row.rowNumber,
      decision: "CREATE",
      normalizedStage: stageRes.stage,
      rowSha256: rowHash,
    });
  }

  return { items };
}

export async function confirmLeadImportBatch(
  actor: UserPrincipal,
  db: D1Database,
  input: {
    batchId: string;
    fileName: string;
    fileSha256: string;
    fileBytes: number;
    mapping: Record<string, any>;
    rows: Array<LeadImportRowInput & { allowUpdate?: boolean; allowDuplicateCreate?: boolean }>;
    defaultRequirementNote?: string;
    stageMapping?: Record<string, LeadStage>;
  },
  r2?: R2Bucket,
  rawFileBytes?: Uint8Array
) {
  assertLeadAccess(actor);
  if (input.rows.length > MAX_IMPORT_BATCH_ROWS) {
    throw new AuthorizationError(
      `Batch size exceeds bounded server limit of ${MAX_IMPORT_BATCH_ROWS} rows.`,
      "INVALID_INPUT"
    );
  }
  if (input.fileBytes > MAX_IMPORT_BYTES) {
    throw new AuthorizationError("Import file exceeds 5 MB limit.", "INVALID_INPUT");
  }

  const now = Date.now();
  // Create or fetch existing batch idempotently
  let batch = await queryFirst<any>(
    db,
    `SELECT * FROM import_batches WHERE id = ? AND org_id = ?`,
    [input.batchId, actor.orgId]
  );

  if (!batch) {
    let r2Key: string | null = null;
    let retentionMode = "NO_ORIGINAL_RETENTION";
    if (r2 && rawFileBytes && rawFileBytes.byteLength > 0) {
      try {
        await QuotaService.reserveStorageBytes(
          db,
          actor.orgId,
          `imp_${input.batchId}`,
          rawFileBytes.byteLength,
          "PRIMARY"
        );
        r2Key = `org/${actor.orgId}/imports/${input.batchId}/${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await r2.put(r2Key, rawFileBytes);
        await QuotaService.commitStorageReservation(
          db,
          actor.orgId,
          `imp_${input.batchId}`,
          rawFileBytes.byteLength,
          "PRIMARY"
        );
        await QuotaService.recordR2Ops(db, actor.orgId, "R2_CLASS_A", 1);
        retentionMode = "R2_ORIGINAL_RETAINED";
      } catch {
        // Explicit documented no-original retention mode if R2 quota insufficient (never public URL)
        r2Key = null;
      }
    }

    await execute(
      db,
      `INSERT INTO import_batches (
        id, org_id, import_kind, file_name, file_sha256, file_bytes, r2_key, mapping_json, status, created_by_user_id, created_at
      ) VALUES (?, ?, 'LEADS', ?, ?, ?, ?, ?, 'PROCESSING', ?, ?)`,
      [
        input.batchId,
        actor.orgId,
        input.fileName,
        input.fileSha256,
        input.fileBytes,
        r2Key,
        JSON.stringify({ ...input.mapping, retentionMode }),
        actor.id,
        now,
      ]
    );
    batch = await queryFirst<any>(db, `SELECT * FROM import_batches WHERE id = ?`, [input.batchId]);
  }

  const preview = await previewLeadImport(actor, db, {
    rows: input.rows,
    defaultRequirementNote: input.defaultRequirementNote,
    stageMapping: input.stageMapping,
  });

  let created = 0,
    updated = 0,
    skipped = 0,
    rejected = 0;

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const pItem = preview.items[i];

    // Idempotency check for resume/retry of interrupted batch
    const alreadyDone = await queryFirst<any>(
      db,
      `SELECT id, action FROM import_batch_rows WHERE batch_id = ? AND row_number = ?`,
      [input.batchId, row.rowNumber]
    );
    if (alreadyDone) {
      if (alreadyDone.action === "CREATED") created++;
      else if (alreadyDone.action === "UPDATED") updated++;
      else if (alreadyDone.action === "SKIPPED") skipped++;
      else if (alreadyDone.action === "REJECTED") rejected++;
      continue;
    }

    const reqText = (row.requirement || input.defaultRequirementNote || "").trim();
    if (pItem.decision === "REJECT" || (pItem.decision === "POSSIBLE_DUPLICATE" && !row.allowDuplicateCreate)) {
      rejected++;
      await execute(
        db,
        `INSERT INTO import_batch_rows (id, batch_id, org_id, sheet_name, row_number, source_external_id, row_sha256, action, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'REJECTED', ?, ?)`,
        [
          `ibr_${crypto.randomUUID()}`,
          input.batchId,
          actor.orgId,
          row.sheetName || null,
          row.rowNumber,
          row.sourceExternalId || null,
          pItem.rowSha256,
          pItem.reason || "Rejected",
          now,
        ]
      );
      continue;
    }

    if (pItem.decision === "SKIP_EXACT_SOURCE" || (pItem.decision === "PROPOSED_UPDATE" && !row.allowUpdate)) {
      skipped++;
      await execute(
        db,
        `INSERT INTO import_batch_rows (id, batch_id, org_id, sheet_name, row_number, source_external_id, row_sha256, action, target_entity_type, target_entity_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'SKIPPED', 'ENQUIRY', ?, ?)`,
        [
          `ibr_${crypto.randomUUID()}`,
          input.batchId,
          actor.orgId,
          row.sheetName || null,
          row.rowNumber,
          row.sourceExternalId || null,
          pItem.rowSha256,
          pItem.existingLeadId || null,
          now,
        ]
      );
      continue;
    }

    if (pItem.decision === "PROPOSED_UPDATE" && row.allowUpdate && pItem.existingLeadId) {
      const before = await queryFirst<any>(db, `SELECT * FROM enquiries WHERE id = ?`, [pItem.existingLeadId]);
      await execute(
        db,
        `UPDATE enquiries SET contact_name = ?, contact_phone = ?, contact_email = ?, requirements_text = ?, lead_stage = ?, revision = revision + 1 WHERE id = ?`,
        [
          row.name.trim(),
          row.phone?.trim() || null,
          row.email?.trim().toLowerCase() || null,
          reqText,
          pItem.normalizedStage,
          pItem.existingLeadId,
        ]
      );
      updated++;
      await execute(
        db,
        `INSERT INTO import_batch_rows (id, batch_id, org_id, sheet_name, row_number, source_external_id, row_sha256, action, target_entity_type, target_entity_id, target_revision_at_import, before_json, after_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'UPDATED', 'ENQUIRY', ?, ?, ?, ?, ?)`,
        [
          `ibr_${crypto.randomUUID()}`,
          input.batchId,
          actor.orgId,
          row.sheetName || null,
          row.rowNumber,
          row.sourceExternalId || null,
          pItem.rowSha256,
          pItem.existingLeadId,
          (before?.revision ?? 1) + 1,
          JSON.stringify(before),
          JSON.stringify(row),
          now,
        ]
      );
      continue;
    }

    // CREATE new lead (historical import generates zero reminders/invitations/WhatsApp)
    const leadId = `enq_${crypto.randomUUID()}`;
    const ownerId = row.ownerId || actor.id;
    await execute(
      db,
      `INSERT INTO enquiries (
        id, org_id, contact_name, contact_email, contact_phone, requirements_text,
        lead_manager_id, status, lead_stage, import_batch_id, source_external_id, extra_metadata_json, revision, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, 1, ?)`,
      [
        leadId,
        actor.orgId,
        row.name.trim(),
        row.email?.trim().toLowerCase() || null,
        row.phone?.trim() || null,
        reqText,
        ownerId,
        pItem.normalizedStage,
        input.batchId,
        row.sourceExternalId?.trim() || null,
        row.extraColumns ? JSON.stringify(row.extraColumns) : null,
        now,
      ]
    );
    created++;
    await execute(
      db,
      `INSERT INTO import_batch_rows (id, batch_id, org_id, sheet_name, row_number, source_external_id, row_sha256, action, target_entity_type, target_entity_id, target_revision_at_import, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'CREATED', 'ENQUIRY', ?, 1, ?)`,
      [
        `ibr_${crypto.randomUUID()}`,
        input.batchId,
        actor.orgId,
        row.sheetName || null,
        row.rowNumber,
        row.sourceExternalId?.trim() || null,
        pItem.rowSha256,
        leadId,
        now,
      ]
    );
  }

  await execute(
    db,
    `UPDATE import_batches
     SET status = 'COMPLETED',
         created_count = created_count + ?,
         updated_count = updated_count + ?,
         skipped_count = skipped_count + ?,
         rejected_count = rejected_count + ?
     WHERE id = ?`,
    [created, updated, skipped, rejected, input.batchId]
  );

  return { batchId: input.batchId, created, updated, skipped, rejected };
}

/**
 * Undo an import batch conditionally: reverts ONLY untouched records created by this batch
 * with no linked project or dependent follow-up/activity; preserves edited records (NAC-007).
 */
export async function undoLeadImportBatch(
  actor: UserPrincipal,
  db: D1Database,
  batchId: string
) {
  assertLeadAccess(actor);
  const batch = await queryFirst<any>(
    db,
    `SELECT * FROM import_batches WHERE id = ? AND org_id = ?`,
    [batchId, actor.orgId]
  );
  if (!batch) throw new AuthorizationError("Import batch not found.", "NOT_FOUND");
  if (batch.undone_at) {
    throw new AuthorizationError("Import batch was already undone.", "CONFLICT");
  }

  const rows = await query<any>(
    db,
    `SELECT * FROM import_batch_rows WHERE batch_id = ? AND action = 'CREATED'`,
    [batchId]
  );

  let reverted = 0;
  const preservedConflicts: Array<{ rowNumber: number; entityId: string; reason: string }> = [];

  for (const r of rows) {
    const lead = await queryFirst<any>(
      db,
      `SELECT id, revision, linked_project_id FROM enquiries WHERE id = ?`,
      [r.target_entity_id]
    );
    if (!lead) continue;

    const activityCnt = await queryFirst<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM lead_activities WHERE enquiry_id = ?`,
      [lead.id]
    );
    const followupCnt = await queryFirst<{ cnt: number }>(
      db,
      `SELECT COUNT(*) as cnt FROM lead_followups WHERE enquiry_id = ?`,
      [lead.id]
    );

    if (
      lead.linked_project_id ||
      lead.revision !== r.target_revision_at_import ||
      (activityCnt?.cnt ?? 0) > 0 ||
      (followupCnt?.cnt ?? 0) > 0
    ) {
      preservedConflicts.push({
        rowNumber: r.row_number,
        entityId: lead.id,
        reason: lead.linked_project_id
          ? "Lead is linked to a project"
          : "Lead has later edits or follow-up activity",
      });
      continue;
    }

    await execute(db, `DELETE FROM enquiries WHERE id = ? AND revision = ?`, [
      lead.id,
      r.target_revision_at_import,
    ]);
    await execute(db, `UPDATE import_batch_rows SET action = 'UNDONE' WHERE id = ?`, [r.id]);
    reverted++;
  }

  const now = Date.now();
  await execute(
    db,
    `UPDATE import_batches SET status = 'UNDONE', undone_at = ?, undone_by_user_id = ? WHERE id = ?`,
    [now, actor.id, batchId]
  );

  await recordAuditEvent(db, {
    orgId: actor.orgId,
    actorId: actor.id,
    entityType: "IMPORT_BATCH",
    entityId: batchId,
    action: "IMPORT_BATCH_UNDONE",
    newState: { reverted, preservedConflictsCount: preservedConflicts.length },
  });

  return { batchId, reverted, preservedConflicts };
}

/**
 * Reviewed Asana CSV task import: defaults private tasks to personal_tasks,
 * or targets an authorized project with 1-level parent resolution via source_external_id.
 */
export async function importAsanaTasksBatch(
  actor: UserPrincipal,
  db: D1Database,
  input: {
    batchId: string;
    rows: Array<{
      rowNumber: number;
      sourceTaskId: string;
      title: string;
      notes?: string;
      section?: string;
      dueDate?: string;
      parentSourceTaskId?: string;
      isPrivate?: boolean;
    }>;
    projectId?: string;
  }
) {
  if (input.rows.length > MAX_IMPORT_BATCH_ROWS) {
    throw new AuthorizationError("Batch exceeds 50 rows.", "INVALID_INPUT");
  }

  if (input.projectId && !canReadInternalNotes(actor, input.projectId)) {
    throw new AuthorizationError("Forbidden to import into target project.", "FORBIDDEN");
  }

  const sourceToCreatedId = new Map<string, string>();
  let created = 0;
  const reviewNeeded: Array<{ rowNumber: number; reason: string }> = [];

  // Pass 1: parents (rows without parentSourceTaskId)
  const sorted = [...input.rows].sort((a, b) => (a.parentSourceTaskId ? 1 : 0) - (b.parentSourceTaskId ? 1 : 0));

  for (const row of sorted) {
    if (!row.title?.trim()) {
      reviewNeeded.push({ rowNumber: row.rowNumber, reason: "Missing task title" });
      continue;
    }

    let resolvedParentId: string | undefined;
    if (row.parentSourceTaskId) {
      resolvedParentId = sourceToCreatedId.get(row.parentSourceTaskId);
      if (!resolvedParentId) {
        const existingParent = await queryFirst<{ id: string }>(
          db,
          input.projectId && !row.isPrivate
            ? `SELECT id FROM tasks WHERE org_id = ? AND project_id = ? AND source_external_id = ?`
            : `SELECT id FROM personal_tasks WHERE org_id = ? AND owner_user_id = ? AND source_external_id = ?`,
          [actor.orgId, input.projectId && !row.isPrivate ? input.projectId : actor.id, row.parentSourceTaskId]
        );
        resolvedParentId = existingParent?.id;
      }
      if (!resolvedParentId) {
        reviewNeeded.push({
          rowNumber: row.rowNumber,
          reason: `Parent task ${row.parentSourceTaskId} not found or conflicting scope`,
        });
        continue;
      }
    }

    if (!input.projectId || row.isPrivate) {
      const pt = await createPersonalTask(
        actor,
        {
          title: row.title,
          description: row.notes,
          dueDate: row.dueDate,
          sectionLabel: row.section,
          parentTaskId: resolvedParentId,
          sourceExternalId: row.sourceTaskId,
        },
        db
      );
      if (row.sourceTaskId) sourceToCreatedId.set(row.sourceTaskId, pt.id);
      created++;
    } else {
      const t = await createTask(
        actor,
        {
          projectId: input.projectId,
          title: row.title,
          description: row.notes,
          proposedDueDate: row.dueDate,
        },
        db
      );
      if (row.sourceTaskId) {
        await execute(
          db,
          `UPDATE tasks SET source_external_id = ?, section_label = ?, parent_task_id = ? WHERE id = ?`,
          [row.sourceTaskId, row.section || null, resolvedParentId || null, t.id]
        );
        sourceToCreatedId.set(row.sourceTaskId, t.id);
      }
      created++;
    }
  }

  return { batchId: input.batchId, created, reviewNeeded };
}
