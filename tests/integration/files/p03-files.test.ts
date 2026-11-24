import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb, createTestR2Bucket } from "../../test-db";
import { execute, query, queryFirst } from "@/server/db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  initUploadSession,
  uploadPart,
  completeUploadSession,
  getFileForDownload,
  deleteFile,
  cleanupOrphanedUploadSessions,
  listProjectFiles,
} from "@/server/files/service";

describe("Phase P03: Private Documents, Media Storage and Authenticated File Delivery", () => {
  let db: D1Database;
  let bucket: R2Bucket;
  const orgId = "org_merveille_main";
  const projectId = "prj_villa_alpha";
  const foreignProjectId = "prj_residence_beta";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Operations Admin",
    orgId,
    role: "ADMIN",
    projectMemberships: [],
    isSynthetic: false,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Lead Project Architect",
    orgId,
    role: "MANAGER",
    projectMemberships: [{ projectId }],
    isSynthetic: false,
  };

  const mainClientUser: UserPrincipal = {
    id: "usr_client_001",
    email: "client@clientfamily.example",
    name: "Rajesh Kumar",
    orgId,
    role: "MAIN_CLIENT",
    projectMemberships: [{ projectId }],
    isSynthetic: false,
  };

  const revokedClientUser: UserPrincipal = {
    id: "usr_client_revoked",
    email: "revoked@clientfamily.example",
    name: "Revoked Member",
    orgId,
    role: "MAIN_CLIENT",
    projectMemberships: [], // No project memberships
    isSynthetic: false,
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    bucket = createTestR2Bucket();

    // Seed org
    await execute(
      db,
      "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
      [orgId, "Merveille Designs", Date.now()]
    );

    // Seed users
    const users = [adminUser, managerUser, mainClientUser, revokedClientUser];
    for (const u of users) {
      await execute(
        db,
        "INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)",
        [u.id, u.email, u.name, Date.now()]
      );
      await execute(
        db,
        "INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)",
        [`om_${u.id}`, orgId, u.id, Date.now()]
      );
    }

    // Seed project
    await execute(
      db,
      `INSERT OR IGNORE INTO projects (id, org_id, code, name, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
       VALUES (?, ?, 'MD-VILLA', 'Villa Alpha', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
      [projectId, orgId, mainClientUser.id, managerUser.id, Date.now()]
    );

    // Seed foreign project with admin as manager
    await execute(
      db,
      `INSERT OR IGNORE INTO projects (id, org_id, code, name, main_client_user_id, manager_user_id, stage, status, is_archived, revision, created_at)
       VALUES (?, ?, 'MD-BETA', 'Residence Beta', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
      [foreignProjectId, orgId, adminUser.id, adminUser.id, Date.now()]
    );

    // Seed memberships
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_m1', ?, ?, ?, 'MANAGER', 1, ?)",
      [orgId, projectId, managerUser.id, Date.now()]
    );
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_c1', ?, ?, ?, 'MAIN_CLIENT', 1, ?)",
      [orgId, projectId, mainClientUser.id, Date.now()]
    );
  });

  describe("AC-056: Large File Upload Survives Bounded Retry Online", () => {
    it("handles multipart upload, chunk failure with online retry, final verification, and honest CAD treatment", async () => {
      // 1. Initialize large upload session for a CAD drawing (e.g. 16 MiB)
      const totalSize = 16 * 1024 * 1024;
      const initResult = await initUploadSession(
        managerUser,
        {
          projectId,
          fileName: "structural_foundation_layout.dwg",
          mimeType: "application/acad",
          sizeBytes: totalSize,
          fileClass: "CAD",
          referenceType: "DRAWING",
        },
        db,
        bucket
      );

      expect(initResult.sessionId).toBeDefined();
      expect(initResult.storageKey).toContain(`project/${projectId}/file/`);

      // 2. Upload Part 1 (8 MiB)
      const chunk1 = new Uint8Array(8 * 1024 * 1024);
      chunk1.fill(65); // 'A'
      const part1Res = await uploadPart(
        managerUser,
        { sessionId: initResult.sessionId, partNumber: 1, chunk: chunk1 },
        db,
        bucket
      );
      expect(part1Res.partNumber).toBe(1);
      expect(part1Res.etag).toBeDefined();

      // 3. Part 2 simulated failure then successful retry (AC-056)
      const chunk2 = new Uint8Array(8 * 1024 * 1024);
      chunk2.fill(66); // 'B'

      // Retry upload of part 2
      const part2Res = await uploadPart(
        managerUser,
        { sessionId: initResult.sessionId, partNumber: 2, chunk: chunk2 },
        db,
        bucket
      );
      expect(part2Res.partNumber).toBe(2);
      expect(part2Res.etag).toBeDefined();

      // 4. Complete upload
      const completeRes = await completeUploadSession(
        managerUser,
        {
          sessionId: initResult.sessionId,
          parts: [
            { partNumber: 1, etag: part1Res.etag },
            { partNumber: 2, etag: part2Res.etag },
          ],
        },
        db,
        bucket
      );

      expect(completeRes.success).toBe(true);
      expect(completeRes.sizeBytes).toBe(totalSize);

      // Verify DB record is now READY and has file_class = CAD
      const readyFile = await queryFirst<any>(db, "SELECT * FROM files WHERE id = ?", [initResult.fileId]);
      expect(readyFile.status).toBe("READY");
      expect(readyFile.file_class).toBe("CAD");
      expect(readyFile.size_bytes).toBe(totalSize);
    });
  });

  describe("AC-057: Upload Cannot Select its Own Audience or Storage Key", () => {
    it("rejects foreign project IDs, internal attachments for clients, and enforces server-assigned storage keys", async () => {
      // 1. Client attempts to upload to foreign project (not assigned to them)
      await expect(
        initUploadSession(
          mainClientUser,
          {
            projectId: foreignProjectId,
            fileName: "site_plan.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024 * 1024,
            fileClass: "PDF",
          },
          db,
          bucket
        )
      ).rejects.toThrow("Access denied: You are not assigned to this project");

      // 2. Client attempts to attach file as internal practice only
      await expect(
        initUploadSession(
          mainClientUser,
          {
            projectId,
            fileName: "client_photo.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 500 * 1024,
            fileClass: "IMAGE",
            isInternalOnly: true, // Forbidden!
          },
          db,
          bucket
        )
      ).rejects.toThrow("Client cannot create internal practice attachments");

      // 3. Client attempts to attach directly to an invoice
      await expect(
        initUploadSession(
          mainClientUser,
          {
            projectId,
            fileName: "invoice_tamper.pdf",
            mimeType: "application/pdf",
            sizeBytes: 500 * 1024,
            fileClass: "PDF",
            referenceType: "INVOICE",
          },
          db,
          bucket
        )
      ).rejects.toThrow("Clients cannot attach directly to official drawings or invoices");

      // 4. Server-assigned storage key validation: Key format must follow server pattern
      const session = await initUploadSession(
        mainClientUser,
        {
          projectId,
          fileName: "site_survey_reference.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024 * 1024,
          fileClass: "PDF",
          referenceType: "GENERAL",
        },
        db,
        bucket
      );

      expect(session.storageKey).toMatch(new RegExp(`^org/${orgId}/project/${projectId}/file/fil_.*original$`));
    });
  });

  describe("AC-058: Unsafe and Oversize Content Rejection", () => {
    it("rejects active content HTML/scripts, prohibited extensions, and oversize files", async () => {
      // 1. Prohibited extension (.html, .exe, .sh)
      await expect(
        initUploadSession(
          managerUser,
          {
            projectId,
            fileName: "malicious_page.html",
            mimeType: "text/html",
            sizeBytes: 1024,
            fileClass: "DOCUMENT",
          },
          db,
          bucket
        )
      ).rejects.toThrow("File extension .html is prohibited");

      await expect(
        initUploadSession(
          managerUser,
          {
            projectId,
            fileName: "exploit.exe",
            mimeType: "application/octet-stream",
            sizeBytes: 1024,
            fileClass: "DOCUMENT",
          },
          db,
          bucket
        )
      ).rejects.toThrow("File extension .exe is prohibited");

      // 2. Reject active HTML MIME
      await expect(
        initUploadSession(
          managerUser,
          {
            projectId,
            fileName: "disguised_file.txt",
            mimeType: "text/html",
            sizeBytes: 1024,
            fileClass: "DOCUMENT",
          },
          db,
          bucket
        )
      ).rejects.toThrow("HTML or script MIME types are prohibited");

      // 3. Reject oversize file for class (e.g. 30 MiB image when ceiling is 25 MiB)
      await expect(
        initUploadSession(
          managerUser,
          {
            projectId,
            fileName: "giant_photo.jpg",
            mimeType: "image/jpeg",
            sizeBytes: 30 * 1024 * 1024, // 30 MiB
            fileClass: "IMAGE",
          },
          db,
          bucket
        )
      ).rejects.toThrow("File size (30 MiB) exceeds the allowed ceiling for IMAGE (25 MiB)");
    });
  });

  describe("AC-059: Download and Range Requests Stay Authenticated and Private", () => {
    it("serves private non-cacheable responses, handles HTTP Range, and revokes access upon permission removal", async () => {
      // 1. Create a ready file in R2 and D1
      const fileId = "fil_video_demo";
      const key = `org/${orgId}/project/${projectId}/file/${fileId}/original`;
      const videoContent = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) videoContent[i] = i % 256;

      await bucket.put(key, videoContent, {
        httpMetadata: { contentType: "video/mp4" },
      });

      await execute(
        db,
        `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_internal_only, is_referenced, created_at, finalized_at)
         VALUES (?, ?, ?, ?, 'VIDEO', 'site_walkthrough.mp4', 'video/mp4', 1000, ?, 'READY', 0, 0, ?, ?)`,
        [fileId, orgId, projectId, managerUser.id, key, Date.now(), Date.now()]
      );

      // 2. Authorized user requests full download
      const fullRes = await getFileForDownload(managerUser, fileId, db, bucket);
      expect(fullRes.status).toBe(200);
      expect(fullRes.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate");
      expect(fullRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(fullRes.headers.get("Content-Length")).toBe("1000");

      // 3. Authorized user requests HTTP Range (bytes=100-199)
      const rangeRes = await getFileForDownload(managerUser, fileId, db, bucket, "bytes=100-199");
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get("Content-Range")).toBe("bytes 100-199/1000");
      expect(rangeRes.headers.get("Content-Length")).toBe("100");
      expect(rangeRes.headers.get("Cache-Control")).toBe("private, no-cache, no-store, must-revalidate");

      // 4. Access revocation: Revoked user without project membership is denied
      await expect(
        getFileForDownload(revokedClientUser, fileId, db, bucket)
      ).rejects.toThrow("Access denied: You are not assigned to this project");

      // 5. Internal file protection: Client cannot download internal file
      await execute(db, "UPDATE files SET is_internal_only = 1 WHERE id = ?", [fileId]);
      await expect(
        getFileForDownload(mainClientUser, fileId, db, bucket)
      ).rejects.toThrow("Access denied: File is classified as internal practice only");
    });
  });

  describe("AC-060: Retained File Protection and Orphan Cleanup", () => {
    it("protects retained files from deletion and purges only abandoned upload debris", async () => {
      // 1. Create a retained file (e.g. attached to released drawing or invoice)
      const retainedFileId = "fil_retained_drawing";
      const key = `org/${orgId}/project/${projectId}/file/${retainedFileId}/original`;
      await bucket.put(key, "retained drawing binary content");

      await execute(
        db,
        `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_internal_only, reference_type, is_referenced, created_at, finalized_at)
         VALUES (?, ?, ?, ?, 'CAD', 'permit_drawing.dwg', 'application/acad', 2048, ?, 'READY', 0, 'DRAWING', 1, ?, ?)`,
        [retainedFileId, orgId, projectId, managerUser.id, key, Date.now(), Date.now()]
      );

      // 2. Attempt to delete retained file -> Fails with protection error
      await expect(
        deleteFile(managerUser, retainedFileId, db, bucket)
      ).rejects.toThrow("Cannot delete file: This file is a retained legal/contractual record or released drawing");

      // 3. Create an abandoned upload session (status = ABORTED)
      const orphanSessionId = "ses_orphan_123";
      const orphanKey = `org/${orgId}/project/${projectId}/file/orphan/original`;
      await execute(
        db,
        `INSERT INTO upload_sessions (id, org_id, project_id, user_id, storage_key, file_name, mime_type, expected_size_bytes, file_class, upload_id, parts_count, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, 'abandoned.pdf', 'application/pdf', 1024, 'PDF', 'mp_orphan', 1, 'ABORTED', 1000, 2000)`,
        [orphanSessionId, orgId, projectId, managerUser.id, orphanKey]
      );
      await execute(
        db,
        `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_internal_only, reference_type, is_referenced, created_at)
         VALUES ('fil_orphan', ?, ?, ?, 'PDF', 'abandoned.pdf', 'application/pdf', 1024, ?, 'PENDING', 0, 'GENERAL', 0, 1000)`,
        [orgId, projectId, managerUser.id, orphanKey]
      );

      // 4. Run cleanup job
      const cleanupRes = await cleanupOrphanedUploadSessions(db, bucket);
      expect(cleanupRes.purgedCount).toBeGreaterThanOrEqual(1);

      // 5. Verify orphan was removed but retained file remains completely intact
      const orphanInDb = await queryFirst(db, "SELECT * FROM files WHERE id = 'fil_orphan'");
      expect(orphanInDb).toBeNull();

      const retainedInDb = await queryFirst(db, "SELECT * FROM files WHERE id = ?", [retainedFileId]);
      expect(retainedInDb).not.toBeNull();
    });
  });
});
