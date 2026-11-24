import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { execute, query, queryFirst } from "@/server/db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  createDrawing,
  createDrawingVersion,
  submitDrawingForReview,
  submitConsultantReview,
  releaseDrawingVersion,
  withdrawDrawing,
  getDrawing,
} from "@/server/domain/drawings/service";

describe("Phase P05: Drawing Register, Consultant Approval, and Manager Release", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";
  const projectId = "prj_drawing_villa";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Operations Admin",
    orgId,
    role: "ADMIN", roles: ["ADMIN"],
    projectMemberships: [],
    isSynthetic: false,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Project Manager",
    orgId,
    role: "MANAGER", roles: [],
    projectMemberships: [{ projectId, projectRole: "MANAGER" }],
    isSynthetic: false,
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_001",
    email: "staff@merveilledesigns.com",
    name: "Architectural Staff",
    orgId,
    role: "STAFF", roles: [],
    projectMemberships: [{ projectId, projectRole: "STAFF" }],
    isSynthetic: false,
  };

  const consultant1: UserPrincipal = {
    id: "usr_cons_structural",
    email: "structural@cons.example",
    name: "Structural Engineer",
    orgId,
    role: "CONSULTANT", roles: [],
    projectMemberships: [{ projectId, projectRole: "CONSULTANT" }],
    isSynthetic: false,
  };

  const consultant2: UserPrincipal = {
    id: "usr_cons_mep",
    email: "mep@cons.example",
    name: "MEP Consultant",
    orgId,
    role: "CONSULTANT", roles: [],
    projectMemberships: [{ projectId, projectRole: "CONSULTANT" }],
    isSynthetic: false,
  };

  const unrelatedConsultant: UserPrincipal = {
    id: "usr_cons_unrelated",
    email: "landscape@cons.example",
    name: "Landscape Consultant",
    orgId,
    role: "CONSULTANT", roles: [],
    projectMemberships: [{ projectId, projectRole: "CONSULTANT" }],
    isSynthetic: false,
  };

  const clientUser: UserPrincipal = {
    id: "usr_client_001",
    email: "client@clientfamily.example",
    name: "Client Owner",
    orgId,
    role: "MAIN_CLIENT", roles: [],
    projectMemberships: [{ projectId, projectRole: "MAIN_CLIENT", contractualAuthority: true }],
    isSynthetic: false,
  };

  // Helper to create ready file in DB
  async function createMockFile(fileId: string, fileName: string) {
    const key = `org/${orgId}/project/${projectId}/file/${fileId}/original`;
    await execute(
      db,
      `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_internal_only, is_referenced, created_at)
       VALUES (?, ?, ?, ?, 'PDF', ?, 'application/pdf', 2048, ?, 'READY', 0, 0, ?)`,
      [fileId, orgId, projectId, staffUser.id, fileName, key, Date.now()]
    );
  }

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // Seed org
    await execute(
      db,
      "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
      [orgId, "Merveille Designs", Date.now()]
    );

    // Seed users
    const users = [adminUser, managerUser, staffUser, consultant1, consultant2, unrelatedConsultant, clientUser];
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
       VALUES (?, ?, 'MD-DWG', 'Drawing Villa', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`,
      [projectId, orgId, clientUser.id, managerUser.id, Date.now()]
    );

    for(const consultant of [consultant1,consultant2,unrelatedConsultant]) await db.prepare("INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES(?,?,?,?,'CONSULTANT',1,?)").bind('pm_'+consultant.id,orgId,projectId,consultant.id,Date.now()).run();
    // Seed memberships
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_m1', ?, ?, ?, 'MANAGER', 1, ?)",
      [orgId, projectId, managerUser.id, Date.now()]
    );
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_s1', ?, ?, ?, 'STAFF', 1, ?)",
      [orgId, projectId, staffUser.id, Date.now()]
    );
    await execute(
      db,
      "INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_c1', ?, ?, ?, 'MAIN_CLIENT', 1, ?)",
      [orgId, projectId, clientUser.id, Date.now()]
    );
  });

  describe("AC-016: Version-Bound Consultant Review", () => {
    it("enforces exact version binding, requires all designated consultants to approve, and rejects unassigned consultants", async () => {
      // 1. Create drawing sheet
      const { id: drawingId } = await createDrawing(
        staffUser,
        {
          projectId,
          drawingNumber: "MD-ARC-101",
          title: "Ground Floor Architectural Layout",
          discipline: "ARCHITECTURAL",
        },
        db
      );

      // Create ready file
      await createMockFile("fil_v1_pdf", "MD-ARC-101_V1.pdf");

      // 2. Submit Version V1 requiring consultant1 and consultant2
      const { id: v1Id } = await createDrawingVersion(
        staffUser,
        {
          drawingId,
          versionLabel: "V1",
          fileId: "fil_v1_pdf",
          requiredConsultantIds: [consultant1.id, consultant2.id],
        },
        db
      );

      await submitDrawingForReview(staffUser, v1Id, db);

      // 3. Consultant 1 approves
      const res1 = await submitConsultantReview(
        consultant1,
        {
          versionId: v1Id,
          decision: "APPROVED",
          reason: "Structural grid lines checked and coordinated",
        },
        db
      );
      expect(res1.allApproved).toBe(false);
      expect(res1.versionStatus).toBe("IN_REVIEW"); // Still waiting for consultant2

      // Manager cannot release yet (AC-016: incomplete set blocks release)
      await expect(
        releaseDrawingVersion(managerUser, { versionId: v1Id }, db)
      ).rejects.toThrow("All required consultant approvals must be complete");

      // 4. Unrelated consultant attempts approval -> REJECTED (AC-016)
      await expect(
        submitConsultantReview(
          unrelatedConsultant,
          {
            versionId: v1Id,
            decision: "APPROVED",
            reason: "Trying to approve unassigned drawing",
          },
          db
        )
      ).rejects.toThrow("Unassigned consultant cannot submit review decision");

      // 5. Consultant 2 approves -> All required consultants approved!
      const res2 = await submitConsultantReview(
        consultant2,
        {
          versionId: v1Id,
          decision: "APPROVED",
          reason: "Plumbing chases and electrical risers verified",
        },
        db
      );
      expect(res2.allApproved).toBe(true);
      expect(res2.versionStatus).toBe("CONSULTANT_APPROVED");

      // Check DB
      const v1InDb = await queryFirst<any>(db, "SELECT status FROM drawing_versions WHERE id = ?", [v1Id]);
      expect(v1InDb.status).toBe("CONSULTANT_APPROVED");
    });
  });

  describe("AC-017: Manager Release is a Distinct Gate", () => {
    it("verifies consultant approval alone never publishes, client cannot approve/release, and manager release succeeds", async () => {
      const { id: drawingId } = await createDrawing(
        staffUser,
        {
          projectId,
          drawingNumber: "MD-STR-201",
          title: "Foundation Footing Details",
          discipline: "STRUCTURAL",
        },
        db
      );
      await createMockFile("fil_str_v1", "MD-STR-201_V1.pdf");

      const { id: v1Id } = await createDrawingVersion(
        staffUser,
        {
          drawingId,
          versionLabel: "V1",
          fileId: "fil_str_v1",
          requiredConsultantIds: [consultant1.id],
        },
        db
      );

      await submitDrawingForReview(staffUser, v1Id, db);
      await submitConsultantReview(consultant1, { versionId: v1Id, decision: "APPROVED", reason: "Rebar size OK" }, db);

      // Verify status is CONSULTANT_APPROVED, NOT RELEASED
      const v1PreRelease = await queryFirst<any>(db, "SELECT status FROM drawing_versions WHERE id = ?", [v1Id]);
      expect(v1PreRelease.status).toBe("CONSULTANT_APPROVED");

      // Client attempts to approve/review -> FORBIDDEN (AC-017: No client drawing approval gate)
      await expect(
        submitConsultantReview(clientUser, { versionId: v1Id, decision: "APPROVED", reason: "Client says OK" }, db)
      ).rejects.toThrow("Clients do not approve drawings");

      // Client attempts to release -> FORBIDDEN
      await expect(
        releaseDrawingVersion(clientUser, { versionId: v1Id }, db)
      ).rejects.toThrow("Only the assigned manager can release drawings");

      // Manager releases drawing -> SUCCEEDS (AC-017)
      const releaseRes = await releaseDrawingVersion(managerUser, { versionId: v1Id }, db);
      expect(releaseRes.success).toBe(true);
      expect(releaseRes.releasedVersionId).toBe(v1Id);

      // Verify DB: version is RELEASED and drawing has current_released_version_id
      const v1Released = await queryFirst<any>(db, "SELECT status, released_at, released_by_user_id FROM drawing_versions WHERE id = ?", [v1Id]);
      expect(v1Released.status).toBe("RELEASED");
      expect(v1Released.released_by_user_id).toBe(managerUser.id);
      expect(v1Released.released_at).toBeGreaterThan(0);

      const drawingInDb = await queryFirst<any>(db, "SELECT current_released_version_id FROM drawings WHERE id = ?", [drawingId]);
      expect(drawingInDb.current_released_version_id).toBe(v1Id);
    });
  });

  describe("AC-018: Replacement Never Hides Current Release Prematurely", () => {
    it("keeps V1 current while V2 is under review or rejected, and atomically supersedes V1 only when V3 releases", async () => {
      // 1. Release V1
      const { id: drawingId } = await createDrawing(
        staffUser,
        {
          projectId,
          drawingNumber: "MD-MEP-301",
          title: "HVAC Distribution Plan",
          discipline: "MEP",
        },
        db
      );
      await createMockFile("fil_mep_v1", "MD-MEP-301_V1.pdf");
      const { id: v1Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V1", fileId: "fil_mep_v1", requiredConsultantIds: [consultant2.id] },
        db
      );
      await submitDrawingForReview(staffUser, v1Id, db);
      await submitConsultantReview(consultant2, { versionId: v1Id, decision: "APPROVED", reason: "Duct sizing approved" }, db);
      await releaseDrawingVersion(managerUser, { versionId: v1Id }, db);

      // 2. Author creates V2 and submits for review
      await createMockFile("fil_mep_v2", "MD-MEP-301_V2.pdf");
      const { id: v2Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V2", fileId: "fil_mep_v2", requiredConsultantIds: [consultant2.id] },
        db
      );
      await submitDrawingForReview(staffUser, v2Id, db);

      // Consultant requests changes on V2
      await submitConsultantReview(
        consultant2,
        { versionId: v2Id, decision: "CHANGES_REQUESTED", reason: "Acoustic attenuation missing in master bed branch" },
        db
      );

      // V2 status is CHANGES_REQUESTED
      const v2InDb = await queryFirst<any>(db, "SELECT status FROM drawing_versions WHERE id = ?", [v2Id]);
      expect(v2InDb.status).toBe("CHANGES_REQUESTED");

      // Verify V1 is STILL CURRENT in drawings table and client view (AC-018)
      const clientViewWhileV2Rejected = await getDrawing(clientUser, drawingId, db);
      expect(clientViewWhileV2Rejected.drawing.current_released_version_id).toBe(v1Id);
      // Client only sees V1; V2 is NOT in client view and NOT mislabeled superseded
      expect(clientViewWhileV2Rejected.versions).toHaveLength(1);
      expect(clientViewWhileV2Rejected.versions[0].version_label).toBe("V1");
      expect(clientViewWhileV2Rejected.versions[0].status).toBe("RELEASED");

      // 3. Author uploads V3
      await createMockFile("fil_mep_v3", "MD-MEP-301_V3.pdf");
      const { id: v3Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V3", fileId: "fil_mep_v3", requiredConsultantIds: [consultant2.id] },
        db
      );
      await submitDrawingForReview(staffUser, v3Id, db);
      await submitConsultantReview(consultant2, { versionId: v3Id, decision: "APPROVED", reason: "Acoustic baffles added" }, db);

      // 4. Manager releases V3
      await releaseDrawingVersion(managerUser, { versionId: v3Id }, db);

      // Now V3 is current release, and V1 is SUPERSEDED (AC-018)
      const v1AfterV3 = await queryFirst<any>(db, "SELECT status, superseded_at FROM drawing_versions WHERE id = ?", [v1Id]);
      expect(v1AfterV3.status).toBe("SUPERSEDED");
      expect(v1AfterV3.superseded_at).toBeGreaterThan(0);

      const v3AfterRelease = await queryFirst<any>(db, "SELECT status FROM drawing_versions WHERE id = ?", [v3Id]);
      expect(v3AfterRelease.status).toBe("RELEASED");

      const drawingAfterV3 = await queryFirst<any>(db, "SELECT current_released_version_id FROM drawings WHERE id = ?", [drawingId]);
      expect(drawingAfterV3.current_released_version_id).toBe(v3Id);
    });
  });

  describe("AC-019: Revision Invalidates Only Changed Version's Approvals", () => {
    it("prevents releasing V2 based on V1 consultant approvals", async () => {
      const { id: drawingId } = await createDrawing(
        staffUser,
        {
          projectId,
          drawingNumber: "MD-ARC-102",
          title: "Section AA Elevation",
          discipline: "ARCHITECTURAL",
        },
        db
      );
      await createMockFile("fil_sec_v1", "MD-ARC-102_V1.pdf");
      const { id: v1Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V1", fileId: "fil_sec_v1", requiredConsultantIds: [consultant1.id] },
        db
      );
      await submitDrawingForReview(staffUser, v1Id, db);
      await submitConsultantReview(consultant1, { versionId: v1Id, decision: "APPROVED", reason: "Height clearance OK" }, db);

      // V1 is approved but manager did NOT release it yet.
      // Staff realizes a mistake and uploads V2 with revised content
      await createMockFile("fil_sec_v2", "MD-ARC-102_V2.pdf");
      const { id: v2Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V2", fileId: "fil_sec_v2", requiredConsultantIds: [consultant1.id] },
        db
      );

      // Attempting to release V2 without consultant approval on V2 must fail (AC-019)
      await expect(
        releaseDrawingVersion(managerUser, { versionId: v2Id }, db)
      ).rejects.toThrow("All required consultant approvals must be complete");
    });
  });

  describe("AC-021: Concurrent Drawing Releases Remain Consistent", () => {
    it("rejects concurrent releases with stale expected version and behaves idempotently on retry", async () => {
      const { id: drawingId } = await createDrawing(
        staffUser,
        {
          projectId,
          drawingNumber: "MD-CIV-401",
          title: "Site Drainage Plan",
          discipline: "CIVIL",
        },
        db
      );
      await createMockFile("fil_civ_v1", "MD-CIV-401_V1.pdf");
      const { id: v1Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V1", fileId: "fil_civ_v1", requiredConsultantIds: [consultant1.id] },
        db
      );
      await submitDrawingForReview(staffUser, v1Id, db);
      await submitConsultantReview(consultant1, { versionId: v1Id, decision: "APPROVED", reason: "Stormwater slope OK" }, db);

      // Release V1 with expectedCurrentVersionId: null -> SUCCEEDS
      const release1 = await releaseDrawingVersion(
        managerUser,
        { versionId: v1Id, expectedCurrentVersionId: null },
        db
      );
      expect(release1.success).toBe(true);

      // Idempotent retry of same command -> SUCCEEDS idempotently
      const retryRes = await releaseDrawingVersion(
        managerUser,
        { versionId: v1Id, expectedCurrentVersionId: null },
        db
      );
      expect(retryRes.isIdempotent).toBe(true);

      // Concurrency conflict test: Create V2, approve V2
      await createMockFile("fil_civ_v2", "MD-CIV-401_V2.pdf");
      const { id: v2Id } = await createDrawingVersion(
        staffUser,
        { drawingId, versionLabel: "V2", fileId: "fil_civ_v2", requiredConsultantIds: [consultant1.id] },
        db
      );
      await submitDrawingForReview(staffUser, v2Id, db);
      await submitConsultantReview(consultant1, { versionId: v2Id, decision: "APPROVED", reason: "Catch basin added" }, db);

      // Manager attempts to release V2 expecting current release to be null (stale expectation!) -> CONCURRENCY_CONFLICT
      await expect(
        releaseDrawingVersion(managerUser, { versionId: v2Id, expectedCurrentVersionId: "stale_version_id" }, db)
      ).rejects.toThrow("Concurrent release detected");
    });
  });
});
