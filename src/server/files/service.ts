/**
 * Private Documents and Media Storage Domain Service for Merveille Designs.
 * Enforces server-assigned immutable storage keys, bounded multipart uploads,
 * current-authorization download gates, private non-cacheable responses, and retention integrity.
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { recordAuditEvent } from "@/server/domain/identity/service";

export type FileClass = "IMAGE" | "PDF" | "CAD" | "VIDEO" | "DOCUMENT";

export const FILE_CEILINGS: Record<FileClass, number> = {
  IMAGE: 25 * 1024 * 1024,      // 25 MiB
  PDF: 100 * 1024 * 1024,       // 100 MiB
  CAD: 250 * 1024 * 1024,       // 250 MiB
  VIDEO: 1024 * 1024 * 1024,    // 1 GiB
  DOCUMENT: 50 * 1024 * 1024,   // 50 MiB
};

const PROHIBITED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "bin", "html", "htm", "js", "mjs", "ts",
  "php", "py", "vbs", "ps1", "app", "jar", "msi", "com", "scr"
]);

export interface InitUploadInput {
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileClass: FileClass;
  isInternalOnly?: boolean;
  referenceType?: "SITE_IMAGE" | "FEASIBILITY" | "DRAWING" | "INVOICE" | "GENERAL";
  referenceId?: string;
  isSettlementEvidence?: boolean; // For admin upload to archived project
}

export interface UploadPartInput {
  sessionId: string;
  partNumber: number;
  chunk: ArrayBuffer | Uint8Array;
}

export interface CompleteUploadInput {
  sessionId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}

/**
 * Validate file name, extension, active content restrictions, and size ceilings.
 */
export function validateUploadParameters(fileName: string, mimeType: string, sizeBytes: number, fileClass: FileClass) {
  if (sizeBytes <= 0) {
    throw new AuthorizationError("Upload file cannot be empty (0 bytes).", "INVALID_FILE_SIZE");
  }

  const ceiling = FILE_CEILINGS[fileClass];
  if (!ceiling) {
    throw new AuthorizationError(`Unsupported file class: ${fileClass}`, "UNSUPPORTED_CLASS");
  }

  if (sizeBytes > ceiling) {
    throw new AuthorizationError(
      `File size (${Math.round(sizeBytes / (1024 * 1024))} MiB) exceeds the allowed ceiling for ${fileClass} (${Math.round(ceiling / (1024 * 1024))} MiB).`,
      "FILE_TOO_LARGE"
    );
  }

  // Check prohibited file extensions
  const parts = fileName.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop()! : "";
  if (PROHIBITED_EXTENSIONS.has(ext)) {
    throw new AuthorizationError(
      `File extension .${ext} is prohibited due to executable/active content restrictions.`,
      "PROHIBITED_FILE_TYPE"
    );
  }

  // Reject active content HTML MIME
  if (mimeType.toLowerCase().includes("text/html") || mimeType.toLowerCase().includes("javascript")) {
    throw new AuthorizationError(
      "HTML or script MIME types are prohibited.",
      "PROHIBITED_MIME_TYPE"
    );
  }
}

/**
 * Initialize a bounded multipart upload session (REQ-FIL-001, REQ-FIL-002, AC-056, AC-057).
 * Storage key is assigned strictly by the server.
 */
export async function initUploadSession(
  actor: UserPrincipal,
  input: InitUploadInput,
  db: D1Database,
  bucket: R2Bucket
) {
  // 1. Authorization & audience checks (AC-057)
  assertProjectAccess(actor, input.projectId);

  // Check project status
  const project = await queryFirst<{ id: string; org_id: string; is_archived: number }>(
    db,
    "SELECT id, org_id, is_archived FROM projects WHERE id = ?",
    [input.projectId]
  );

  if (!project) {
    throw new AuthorizationError("Project not found.", "NOT_FOUND");
  }

  // Archived projects reject new content uploads except ADMIN settlement-evidence (REQ-FIL-001)
  if (project.is_archived === 1) {
    if (actor.role !== "ADMIN" || !input.isSettlementEvidence) {
      throw new AuthorizationError(
        "Archived projects reject new file uploads except admin settlement evidence.",
        "PROJECT_ARCHIVED"
      );
    }
  }

  // Unauthorized parent attachment check: Clients cannot attach files to internal notes or financial payroll (AC-057)
  if (actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP") {
    if (input.isInternalOnly) {
      throw new AuthorizationError("Client cannot create internal practice attachments.", "FORBIDDEN");
    }
    if (input.referenceType === "INVOICE" || input.referenceType === "DRAWING") {
      throw new AuthorizationError("Clients cannot attach directly to official drawings or invoices.", "FORBIDDEN");
    }
  }

  // 2. Validate file parameters
  validateUploadParameters(input.fileName, input.mimeType, input.sizeBytes, input.fileClass);

  // 3. Assign server-side immutable storage key
  const fileId = `fil_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const storageKey = `org/${actor.orgId}/project/${input.projectId}/file/${fileId}/original`;

  // 4. Create R2 multipart upload
  const mp = await bucket.createMultipartUpload(storageKey);
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hour session window

  // 5. Insert records in D1
  await execute(
    db,
    `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_internal_only, reference_type, reference_id, is_referenced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 0, ?)`,
    [
      fileId,
      actor.orgId,
      input.projectId,
      actor.id,
      input.fileClass,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      storageKey,
      input.isInternalOnly ? 1 : 0,
      input.referenceType || "GENERAL",
      input.referenceId || null,
      now,
    ]
  );

  await execute(
    db,
    `INSERT INTO upload_sessions (id, org_id, project_id, user_id, storage_key, file_name, mime_type, expected_size_bytes, file_class, upload_id, parts_count, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE', ?, ?)`,
    [
      sessionId,
      actor.orgId,
      input.projectId,
      actor.id,
      storageKey,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.fileClass,
      mp.uploadId,
      now,
      expiresAt,
    ]
  );

  return {
    sessionId,
    fileId,
    uploadId: mp.uploadId,
    storageKey,
    chunkSize: 8 * 1024 * 1024, // 8 MiB chunk recommendation
  };
}

/**
 * Upload a single chunk to the active multipart upload (AC-056).
 * Safe retry: Idempotent upsert allows failed parts to be retried online.
 */
export async function uploadPart(
  actor: UserPrincipal,
  input: UploadPartInput,
  db: D1Database,
  bucket: R2Bucket
) {
  const session = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
    user_id: string;
    storage_key: string;
    upload_id: string;
    status: string;
    expires_at: number;
  }>(db, "SELECT * FROM upload_sessions WHERE id = ?", [input.sessionId]);

  if (!session) {
    throw new AuthorizationError("Upload session not found.", "NOT_FOUND");
  }

  if (session.status !== "ACTIVE" || Date.now() > session.expires_at) {
    throw new AuthorizationError("Upload session is no longer active or has expired.", "SESSION_EXPIRED");
  }

  // Re-verify actor identity & project authorization
  if (session.user_id !== actor.id && actor.role !== "ADMIN") {
    throw new AuthorizationError("You do not own this upload session.", "FORBIDDEN");
  }
  assertProjectAccess(actor, session.project_id);

  // Resume multipart upload in R2
  const mp = await bucket.resumeMultipartUpload(session.storage_key, session.upload_id);
  const partResult = await mp.uploadPart(input.partNumber, input.chunk);

  const now = Date.now();
  const chunkSize = input.chunk instanceof Uint8Array ? input.chunk.length : input.chunk.byteLength;

  // Record/upsert part in upload_parts table
  const partId = `part_${session.id}_${input.partNumber}`;
  await execute(
    db,
    `INSERT INTO upload_parts (id, session_id, part_number, etag, size_bytes, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id, part_number) DO UPDATE SET
       etag = excluded.etag,
       size_bytes = excluded.size_bytes,
       uploaded_at = excluded.uploaded_at`,
    [partId, session.id, input.partNumber, partResult.etag, chunkSize, now]
  );

  return {
    partNumber: input.partNumber,
    etag: partResult.etag,
  };
}

/**
 * Complete multipart upload session and finalize file record (AC-056, AC-058).
 */
export async function completeUploadSession(
  actor: UserPrincipal,
  input: CompleteUploadInput,
  db: D1Database,
  bucket: R2Bucket
) {
  const session = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
    user_id: string;
    storage_key: string;
    upload_id: string;
    status: string;
    expected_size_bytes: number;
  }>(db, "SELECT * FROM upload_sessions WHERE id = ?", [input.sessionId]);

  if (!session) {
    throw new AuthorizationError("Upload session not found.", "NOT_FOUND");
  }

  if (session.status !== "ACTIVE") {
    throw new AuthorizationError("Upload session is not active.", "INVALID_SESSION_STATE");
  }

  // Re-verify authorization
  if (session.user_id !== actor.id && actor.role !== "ADMIN") {
    throw new AuthorizationError("You do not own this upload session.", "FORBIDDEN");
  }
  assertProjectAccess(actor, session.project_id);

  // Resume and complete multipart upload
  const mp = await bucket.resumeMultipartUpload(session.storage_key, session.upload_id);
  const completeResult = await mp.complete(input.parts);

  // Verify finalized object size
  const r2Head = await bucket.head(session.storage_key);
  if (!r2Head || r2Head.size !== session.expected_size_bytes) {
    throw new AuthorizationError(
      `Finalized object size mismatch. Expected ${session.expected_size_bytes} bytes, received ${r2Head?.size || 0} bytes.`,
      "SIZE_MISMATCH"
    );
  }

  const now = Date.now();

  // Transition upload_sessions to COMPLETED
  await execute(
    db,
    "UPDATE upload_sessions SET status = 'COMPLETED', parts_count = ? WHERE id = ?",
    [input.parts.length, session.id]
  );

  // Transition files to READY
  await execute(
    db,
    "UPDATE files SET status = 'READY', finalized_at = ? WHERE storage_key = ?",
    [now, session.storage_key]
  );

  const file = await queryFirst<{ id: string; file_name: string; storage_key: string }>(
    db,
    "SELECT id, file_name, storage_key FROM files WHERE storage_key = ?",
    [session.storage_key]
  );

  await recordAuditEvent(db, {
    orgId: session.org_id,
    actorId: actor.id,
    entityType: "FILE",
    entityId: file?.id || session.id,
    action: "FILE_UPLOAD_COMPLETED",
    newState: { fileName: file?.file_name, sizeBytes: r2Head.size },
  });

  return {
    success: true,
    fileId: file?.id,
    storageKey: session.storage_key,
    sizeBytes: r2Head.size,
  };
}

/**
 * Abort an active upload session.
 */
export async function abortUploadSession(
  actor: UserPrincipal,
  sessionId: string,
  db: D1Database,
  bucket: R2Bucket
) {
  const session = await queryFirst<{
    id: string;
    project_id: string;
    user_id: string;
    storage_key: string;
    upload_id: string;
    status: string;
  }>(db, "SELECT * FROM upload_sessions WHERE id = ?", [sessionId]);

  if (!session) return { success: true };

  if (session.user_id !== actor.id && actor.role !== "ADMIN") {
    throw new AuthorizationError("You do not own this upload session.", "FORBIDDEN");
  }

  try {
    const mp = await bucket.resumeMultipartUpload(session.storage_key, session.upload_id);
    await mp.abort();
  } catch {
    // Ignore already aborted or missing
  }

  await execute(
    db,
    "UPDATE upload_sessions SET status = 'ABORTED' WHERE id = ?",
    [sessionId]
  );

  await execute(
    db,
    "UPDATE files SET status = 'DELETED' WHERE storage_key = ? AND status = 'PENDING'",
    [session.storage_key]
  );

  return { success: true };
}

/**
 * Download/stream gate enforcing current authorization and non-cacheable private headers (AC-059).
 */
export async function getFileForDownload(
  actor: UserPrincipal,
  fileId: string,
  db: D1Database,
  bucket: R2Bucket,
  rangeHeader?: string | null
) {
  const file = await queryFirst<{
    id: string;
    org_id: string;
    project_id: string;
    uploaded_by_user_id: string;
    file_class: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    storage_key: string;
    status: string;
    is_internal_only: number;
  }>(db, "SELECT * FROM files WHERE id = ?", [fileId]);

  if (!file || file.status !== "READY") {
    throw new AuthorizationError("File not found or not ready for download.", "NOT_FOUND");
  }

  // Current authorization check on every request (AC-059)
  assertProjectAccess(actor, file.project_id);

  // Internal practice protection: Clients/consultants cannot access internal attachments
  if ((actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP" || actor.role === "CONSULTANT") && file.is_internal_only === 1) {
    throw new AuthorizationError("Access denied: File is classified as internal practice only.", "FORBIDDEN");
  }

  // Handle Range request if present
  let r2Range: R2Range | undefined = undefined;
  let isRange = false;
  let rangeStart = 0;
  let rangeEnd = file.size_bytes - 1;

  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const parts = rangeHeader.replace("bytes=", "").split("-");
    rangeStart = parseInt(parts[0], 10) || 0;
    rangeEnd = parts[1] ? parseInt(parts[1], 10) : file.size_bytes - 1;
    if (rangeEnd >= file.size_bytes) rangeEnd = file.size_bytes - 1;

    if (rangeStart <= rangeEnd) {
      isRange = true;
      r2Range = { offset: rangeStart, length: rangeEnd - rangeStart + 1 };
    }
  }

  const obj = r2Range
    ? await bucket.get(file.storage_key, { range: r2Range })
    : await bucket.get(file.storage_key);
  if (!obj) {
    throw new AuthorizationError("Object content not found in storage.", "STORAGE_OBJECT_MISSING");
  }

  // Build safe headers (AC-059)
  const headers = new Headers();
  headers.set("Content-Type", file.mime_type || "application/octet-stream");
  headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");

  // Sanitize filename for Content-Disposition
  const safeFilename = file.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const isInline = file.file_class === "IMAGE" || file.file_class === "PDF" || file.file_class === "VIDEO";
  headers.set("Content-Disposition", `${isInline ? "inline" : "attachment"}; filename="${safeFilename}"`);

  if (isRange) {
    headers.set("Content-Range", `bytes ${rangeStart}-${rangeEnd}/${file.size_bytes}`);
    headers.set("Content-Length", `${rangeEnd - rangeStart + 1}`);
    return {
      status: 206,
      headers,
      body: obj.body,
    };
  } else {
    headers.set("Content-Length", `${file.size_bytes}`);
    return {
      status: 200,
      headers,
      body: obj.body,
    };
  }
}

/**
 * List files for an authorized project.
 */
export async function listProjectFiles(
  actor: UserPrincipal,
  projectId: string,
  db: D1Database,
  categoryFilter?: string
) {
  assertProjectAccess(actor, projectId);

  let sql = `
    SELECT f.*, u.display_name as uploaded_by_name
    FROM files f
    LEFT JOIN users u ON u.id = f.uploaded_by_user_id
    WHERE f.project_id = ? AND f.status = 'READY'
  `;
  const params: any[] = [projectId];

  // Internal files hidden from clients and consultants
  if (actor.role === "MAIN_CLIENT" || actor.role === "CLIENT_REP" || actor.role === "CONSULTANT") {
    sql += " AND f.is_internal_only = 0";
  }

  if (categoryFilter && categoryFilter !== "ALL") {
    sql += " AND f.reference_type = ?";
    params.push(categoryFilter);
  }

  sql += " ORDER BY f.created_at DESC";

  return await query(db, sql, params);
}

/**
 * Retention and cleanup service (AC-060).
 * Cleans abandoned/expired upload sessions and temporary chunks.
 * Retained files (referenced by drawings, invoices, or with is_referenced = 1) CANNOT be purged.
 */
export async function cleanupOrphanedUploadSessions(db: D1Database, bucket: R2Bucket) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  // Find expired or aborted upload sessions
  const orphanedSessions = await query<{
    id: string;
    storage_key: string;
    upload_id: string;
  }>(
    db,
    "SELECT id, storage_key, upload_id FROM upload_sessions WHERE (status = 'ABORTED' OR (status = 'ACTIVE' AND expires_at < ?))",
    [cutoff]
  );

  let purgedCount = 0;
  for (const s of orphanedSessions) {
    try {
      const mp = await bucket.resumeMultipartUpload(s.storage_key, s.upload_id);
      await mp.abort();
    } catch {
      // Ignore already aborted
    }

    // Clean D1 parts and session
    await execute(db, "DELETE FROM upload_parts WHERE session_id = ?", [s.id]);
    await execute(db, "DELETE FROM upload_sessions WHERE id = ?", [s.id]);

    // Check if files row is PENDING (unfinalized) and not referenced
    await execute(
      db,
      "DELETE FROM files WHERE storage_key = ? AND status = 'PENDING' AND is_referenced = 0",
      [s.storage_key]
    );

    purgedCount++;
  }

  return { purgedCount };
}

/**
 * Delete unreferenced file (enforces AC-060 retention protection).
 */
export async function deleteFile(
  actor: UserPrincipal,
  fileId: string,
  db: D1Database,
  bucket: R2Bucket
) {
  const file = await queryFirst<{
    id: string;
    project_id: string;
    storage_key: string;
    is_referenced: number;
    reference_type: string;
  }>(db, "SELECT * FROM files WHERE id = ?", [fileId]);

  if (!file) throw new AuthorizationError("File not found.", "NOT_FOUND");

  assertProjectAccess(actor, file.project_id);

  // Retained files cannot be deleted (AC-060)
  if (file.is_referenced === 1 || file.reference_type === "DRAWING" || file.reference_type === "INVOICE") {
    throw new AuthorizationError(
      "Cannot delete file: This file is a retained legal/contractual record or released drawing.",
      "FILE_RETAINED_PROTECTED"
    );
  }

  // Only manager or admin can delete files
  if (actor.role !== "MANAGER" && actor.role !== "ADMIN" && actor.role !== "OWNER") {
    throw new AuthorizationError("Only managers or administrators can remove project files.", "FORBIDDEN");
  }

  await bucket.delete(file.storage_key);
  await execute(db, "UPDATE files SET status = 'DELETED' WHERE id = ?", [fileId]);

  return { success: true };
}
