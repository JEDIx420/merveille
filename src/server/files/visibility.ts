import { UserPrincipal, hasCapability } from "@/server/auth/principal";
import {
  assertProjectAccess,
  AuthorizationError,
  canReadInternalNotes,
} from "@/server/auth/policy";
import { query, queryFirst } from "@/server/db";
export async function validateAttachment(
  db: D1Database,
  actor: UserPrincipal,
  fileId: string,
  projectId: string,
  purpose: string,
) {
  assertProjectAccess(actor, projectId);
  const file = await queryFirst<any>(
    db,
    "SELECT * FROM files WHERE id=? AND org_id=? AND project_id=? AND status='READY'",
    [fileId, actor.orgId, projectId],
  );
  if (!file)
    throw new AuthorizationError(
      "Choose a completed file from this project.",
      "INVALID_FILE",
    );
  const bankParent=await queryFirst(db,'SELECT id FROM receipts WHERE evidence_file_id=?',[fileId]);
  if(bankParent && purpose!=='RECEIPT')throw new AuthorizationError('Payment verification evidence cannot be republished as project content.','FILE_PURPOSE_CONFLICT');
  if (
    file.is_referenced &&
    file.reference_type &&
    file.reference_type !== purpose
  )
    throw new AuthorizationError(
      "This file already belongs to another workflow. Upload a separate version.",
      "FILE_PURPOSE_CONFLICT",
    );
  if (
    file.uploaded_by_user_id !== actor.id &&
    !hasCapability(actor, "MANAGER", projectId)
  )
    throw new AuthorizationError(
      "Only the uploader or project manager may attach this file.",
    );
  return file;
}
export async function canReadFile(
  db: D1Database,
  actor: UserPrincipal,
  file: any,
): Promise<boolean> {
  if (file.org_id !== actor.orgId || file.status !== "READY") return false;
  try {
    assertProjectAccess(actor, file.project_id);
  } catch {
    return false;
  }
  const receipt=await queryFirst<any>(db,'SELECT reported_by_user_id FROM receipts WHERE evidence_file_id=? AND org_id=?',[file.id,actor.orgId]);
  if(receipt)return hasCapability(actor,'ADMIN')||receipt.reported_by_user_id===actor.id;
  const cost=await queryFirst<any>(db,'SELECT submitted_by_user_id FROM expenses WHERE evidence_file_id=? AND org_id=? UNION SELECT submitted_by_user_id FROM consultant_bills WHERE evidence_file_id=? AND org_id=?',[file.id,actor.orgId,file.id,actor.orgId]);
  if(cost)return hasCapability(actor,'ADMIN')||hasCapability(actor,'MANAGER',file.project_id)||cost.submitted_by_user_id===actor.id;
  if (canReadInternalNotes(actor, file.project_id)) {
    // Payroll and raw bank evidence do not inherit internal operational visibility.
    if (
      ["PAYROLL", "SALARY", "BANK_EVIDENCE", "RECEIPT"].includes(
        file.reference_type,
      )
    )
      return (
        hasCapability(actor, "ADMIN") || file.uploaded_by_user_id === actor.id
      );
    return true;
  }
  if (file.is_internal_only) return false;
  const drawings = await query<any>(
    db,
    `SELECT v.*,d.is_withdrawn FROM drawing_versions v JOIN drawings d ON d.id=v.drawing_id WHERE d.project_id=? AND (v.file_id=? OR v.cad_file_id=?)`,
    [file.project_id, file.id, file.id],
  );
  if (drawings.length) {
    for (const v of drawings) {
      if (!v.is_withdrawn && ["RELEASED", "SUPERSEDED"].includes(v.status))
        return true;
      if (
        hasCapability(actor, "CONSULTANT", file.project_id) &&
        ["IN_REVIEW", "CONSULTANT_APPROVED", "CHANGES_REQUESTED"].includes(
          v.status,
        )
      ) {
        const review = await queryFirst(
          db,
          "SELECT id FROM drawing_reviews WHERE version_id=? AND consultant_user_id=?",
          [v.id, actor.id],
        );
        if (review) return true;
      }
    }
    return false;
  }
  // Files reserved for a drawing cannot be exposed between upload and linking.
  if (file.reference_type === "DRAWING") return false;
  const update = await queryFirst(
    db,
    `SELECT a.id FROM update_attachments a JOIN update_versions v ON v.id=a.version_id JOIN project_updates u ON u.id=v.update_id WHERE a.file_id=? AND u.project_id=? AND u.current_published_version_id=v.id AND v.status='PUBLISHED' AND u.is_retracted=0`,
    [file.id, file.project_id],
  );
  if (update) return true;
  const linkedUpdate = await queryFirst(
    db,
    "SELECT id FROM update_attachments WHERE file_id=?",
    [file.id],
  );
  if (linkedUpdate) return false;
  const permit = await queryFirst(
    db,
    `SELECT f.id FROM ksmart_observation_files f JOIN ksmart_observations o ON o.id=f.observation_id JOIN ksmart_milestones m ON m.id=o.milestone_id WHERE f.file_id=? AND m.project_id=? AND f.is_client_shared=1 AND o.sharing_status='SHARED'`,
    [file.id, file.project_id],
  );
  if (permit) return true;
  const snag = await queryFirst(
    db,
    `SELECT a.id FROM snag_attachments a JOIN snags s ON s.id=a.snag_id WHERE a.file_id=? AND s.project_id=? AND a.is_internal_only=0 AND s.is_client_shared=1`,
    [file.id, file.project_id],
  );
  if (snag) return true;
  // Unpublished unlinked files stay private to their uploader, never all project members.
  return file.uploaded_by_user_id === actor.id && !file.is_referenced;
}
