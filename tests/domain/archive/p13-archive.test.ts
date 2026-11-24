import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb, createTestR2Bucket } from "../../test-db";
import { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { UserPrincipal } from "@/server/auth/principal";
import { ArchiveService } from "@/server/domain/archive/service";
import { createTask } from "@/server/domain/tasks/service";
import { createDrawing, createDrawingVersion } from "@/server/domain/drawings/service";
import { FinanceService } from "@/server/domain/finance/service";
import { SnagsService } from "@/server/domain/snags/service";

describe("Phase 13: Project Archive, Access Retention, Settlement and Recovery", () => {
  let db: D1Database;
  let r2: R2Bucket;
  const orgId = "org_merveille_main";
  const projectId = "prj_archive_azure";

  const ownerUser: UserPrincipal = {
    id: "usr_owner_p13",
    email: "owner.p13@merveilledesigns.com",
    name: "Vikram Owner",
    role: "OWNER",
    orgId,
    projectMemberships: [{ projectId, projectRole: "DIRECTOR" }],
  };

  const adminUser: UserPrincipal = {
    id: "usr_admin_p13",
    email: "admin.p13@merveilledesigns.com",
    name: "Anita Admin",
    role: "ADMIN",
    orgId,
    projectMemberships: [{ projectId, projectRole: "FINANCE" }],
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_p13",
    email: "manager.p13@merveilledesigns.com",
    name: "Mohan Manager",
    role: "MANAGER",
    orgId,
    projectMemberships: [{ projectId, projectRole: "PROJECT_MANAGER" }],
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_p13",
    email: "staff.p13@merveilledesigns.com",
    name: "Suresh Staff",
    role: "STAFF",
    orgId,
    projectMemberships: [{ projectId, projectRole: "ARCHITECT" }],
  };

  const consultantUser: UserPrincipal = {
    id: "usr_cons_p13",
    email: "structural.p13@cons.com",
    name: "Cyrus Structural",
    role: "CONSULTANT",
    orgId,
    projectMemberships: [{ projectId, projectRole: "CONSULTANT" }],
  };

  const clientUser: UserPrincipal = {
    id: "usr_client_p13",
    email: "client.p13@gmail.com",
    name: "Dr. K. R. Nambiar",
    role: "MAIN_CLIENT",
    orgId,
    projectMemberships: [{ projectId, projectRole: "MAIN_CLIENT" }],
  };

  const revokedClientUser: UserPrincipal = {
    id: "usr_revoked_p13",
    email: "revoked.p13@gmail.com",
    name: "Revoked Member",
    role: "MAIN_CLIENT",
    orgId,
    projectMemberships: [{ projectId, projectRole: "MAIN_CLIENT" }], // Will be set is_active = 0 in DB
  };

  const outsiderUser: UserPrincipal = {
    id: "usr_outsider_p13",
    email: "outsider.p13@foreign.com",
    name: "Outsider User",
    role: "MAIN_CLIENT",
    orgId,
    projectMemberships: [], // No membership
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    r2 = createTestR2Bucket();

    // 1. Seed users
    const now = Date.now();
    const users = [
      ownerUser,
      adminUser,
      managerUser,
      staffUser,
      consultantUser,
      clientUser,
      revokedClientUser,
      outsiderUser,
    ];

    for (const u of users) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, display_name, status, created_at)
           VALUES (?, ?, ?, 'ACTIVE', ?)`
        )
        .bind(u.id, u.email, u.name, now)
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at)
           VALUES (?, ?, ?, 1, ?)`
        )
        .bind(`om_${u.id}`, orgId, u.id, now)
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at)
           VALUES (?, ?, ?, ?, 'GLOBAL', ?)`
        )
        .bind(`ra_${u.id}`, orgId, u.id, u.role, now)
        .run();
    }

    // 2. Seed active project
    await db
      .prepare(
        `INSERT INTO projects (id, org_id, code, name, stage, status, is_archived, revision, created_at)
         VALUES (?, ?, 'AZU-01', 'Villa Azure', 'CONSTRUCTION', 'ACTIVE', 0, 1, ?)`
      )
      .bind(projectId, orgId, now)
      .run();

    // 3. Seed memberships
    await db
      .prepare(
        `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES
         ('pm_mgr_13', ?, ?, ?, 'PROJECT_MANAGER', 1, ?),
         ('pm_stf_13', ?, ?, ?, 'ARCHITECT', 1, ?),
         ('pm_cns_13', ?, ?, ?, 'CONSULTANT', 1, ?),
         ('pm_clt_13', ?, ?, ?, 'MAIN_CLIENT', 1, ?),
         ('pm_rev_13', ?, ?, ?, 'MAIN_CLIENT', 0, ?)` // Revoked member (is_active = 0)
      )
      .bind(
        orgId, projectId, managerUser.id, now,
        orgId, projectId, staffUser.id, now,
        orgId, projectId, consultantUser.id, now,
        orgId, projectId, clientUser.id, now,
        orgId, projectId, revokedClientUser.id, now
      )
      .run();

    // 4. Seed drawings & versions:
    // Drawing 1: Has V1 (SUPERSEDED) and V2 (RELEASED / CURRENT)
    // Drawing 2: Has V1 (DRAFT, unreleased)
    await db
      .prepare(
        `INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, current_released_version_id, is_withdrawn, created_at)
         VALUES
         ('drw_01', ?, ?, 'ARC-101', 'Ground Floor Layout', 'ARCHITECTURAL', 'dv_02', 0, ?),
         ('drw_02', ?, ?, 'ARC-102', 'Roof Detail Draft', 'ARCHITECTURAL', NULL, 0, ?)`
      )
      .bind(orgId, projectId, now, orgId, projectId, now)
      .run();

    await db
      .prepare(
        `INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_referenced, created_at)
         VALUES
         ('fil_01', ?, ?, ?, 'DRAWING', 'ground_v1.pdf', 'application/pdf', 10240, 'files/ground_v1.pdf', 'READY', 1, ?),
         ('fil_02', ?, ?, ?, 'DRAWING', 'ground_v2.pdf', 'application/pdf', 12400, 'files/ground_v2.pdf', 'READY', 1, ?),
         ('fil_03', ?, ?, ?, 'DRAWING', 'roof_draft.pdf', 'application/pdf', 8500, 'files/roof_draft.pdf', 'READY', 1, ?)`
      )
      .bind(
        orgId, projectId, staffUser.id, now,
        orgId, projectId, staffUser.id, now,
        orgId, projectId, staffUser.id, now
      )
      .run();

    await db
      .prepare(
        `INSERT INTO drawing_versions (id, drawing_id, version_label, file_id, author_user_id, status, released_at, released_by_user_id, created_at)
         VALUES
         ('dv_01', 'drw_01', 'V1', 'fil_01', ?, 'SUPERSEDED', ?, ?, ?),
         ('dv_02', 'drw_01', 'V2', 'fil_02', ?, 'RELEASED', ?, ?, ?),
         ('dv_03', 'drw_02', 'V1', 'fil_03', ?, 'DRAFT', NULL, NULL, ?)`
      )
      .bind(
        staffUser.id, now - 86400000, managerUser.id, now - 86400000,
        staffUser.id, now, managerUser.id, now,
        staffUser.id, now
      )
      .run();

    // 5. Seed Project Updates:
    // Update 1: Published
    // Update 2: Draft
    await db
      .prepare(
        `INSERT INTO project_updates (id, org_id, project_id, author_id, current_published_version_id, is_retracted, revision, created_at)
         VALUES
         ('upd_01', ?, ?, ?, 'upv_01', 0, 1, ?),
         ('upd_02', ?, ?, ?, NULL, 0, 1, ?)`
      )
      .bind(orgId, projectId, staffUser.id, now, orgId, projectId, staffUser.id, now)
      .run();

    await db
      .prepare(
        `INSERT INTO update_versions (id, update_id, version_number, title, body_text, observed_date, status, published_at, published_by_user_id, revision, created_at)
         VALUES
         ('upv_01', 'upd_01', 1, 'Foundation Completed', 'Plinth beam and columns cured successfully.', '2026-11-20', 'PUBLISHED', ?, ?, 1, ?),
         ('upv_02', 'upd_02', 1, 'Internal Brickwork Draft', 'Draft notes on brick supplier changes.', '2026-11-24', 'DRAFT', NULL, NULL, 1, ?)`
      )
      .bind(now, managerUser.id, now, now)
      .run();

    // 6. Seed Invoices:
    // Invoice 1: Issued, balance ₹2,50,000 (25000000 paise)
    await db
      .prepare(
        `INSERT INTO invoices (id, org_id, project_id, invoice_number, currency, status, current_version_number, total_minor, allocated_minor, outstanding_minor, due_date, created_by_user_id, created_at)
         VALUES ('inv_01', ?, ?, 'INV-AZU-001', 'INR', 'ISSUED', 1, 25000000, 0, 25000000, '2026-12-01', ?, ?)`
      )
      .bind(orgId, projectId, adminUser.id, now)
      .run();
  });

  it("AC-054: Completed project archive keeps authorised client and consultant access to released drawings and published updates while denying revoked members and outsiders", async () => {
    // 1. Manager archives the project with formal reason
    const archiveResult = await ArchiveService.archiveProject(db, managerUser, {
      projectId,
      reason: "Practical completion certified; client occupancy handover complete.",
    });

    expect(archiveResult.status).toBe("ARCHIVED");
    expect(archiveResult.archiveReason).toBe("Practical completion certified; client occupancy handover complete.");
    expect(archiveResult.unpaidInvoicesCount).toBe(1);
    expect(archiveResult.totalUnpaidMinor).toBe(25000000);

    // 2. Active client accesses archived project records
    const clientRecords = await ArchiveService.getArchivedProjectRecords(db, clientUser, projectId);
    expect(clientRecords.project.isArchived).toBe(true);

    // Verify released drawings: must contain BOTH current release (V2) and superseded release (V1)
    expect(clientRecords.releasedDrawings.length).toBe(2);
    const versionLabels = clientRecords.releasedDrawings.map((d: any) => d.version_label);
    expect(versionLabels).toContain("V1");
    expect(versionLabels).toContain("V2");

    // Strictly excludes unreleased draft drawing drw_02 / dv_03
    const drawingIds = clientRecords.releasedDrawings.map((d: any) => d.drawing_id);
    expect(drawingIds).not.toContain("drw_02");

    // Verify published updates: contains published update upv_01, strictly excludes draft update upv_02
    expect(clientRecords.publishedUpdates.length).toBe(1);
    expect(clientRecords.publishedUpdates[0].title).toBe("Foundation Completed");

    // Verify unpaid invoices are displayed with balances intact (not forgiven)
    expect(clientRecords.unpaidInvoices.length).toBe(1);
    expect(clientRecords.unpaidInvoices[0].invoice_number).toBe("INV-AZU-001");
    expect(clientRecords.unpaidInvoices[0].outstanding_minor).toBe(25000000);

    // 3. Active consultant accesses archived project records
    const consultantRecords = await ArchiveService.getArchivedProjectRecords(db, consultantUser, projectId);
    expect(consultantRecords.releasedDrawings.length).toBe(2);
    expect(consultantRecords.publishedUpdates.length).toBe(1);
    // Consultants do not see commercial client invoice records
    expect(consultantRecords.unpaidInvoices.length).toBe(0);

    // 4. Revoked member (is_active = 0) is strictly denied
    await expect(
      ArchiveService.getArchivedProjectRecords(db, revokedClientUser, projectId)
    ).rejects.toThrow("Access denied: You do not have active membership in this archived project.");

    // 5. Outsider is strictly denied
    await expect(
      ArchiveService.getArchivedProjectRecords(db, outsiderUser, projectId)
    ).rejects.toThrow("Access denied: You do not have active membership in this archived project.");
  });

  it("AC-055: Archived project rejects operational mutations, maintains unpaid balances, permits ADMIN-only settlements, and requires authorized audited reopening", async () => {
    // 1. Archive the project
    await ArchiveService.archiveProject(db, managerUser, {
      projectId,
      reason: "Handed over to client.",
    });

    // 2. Verify operational mutation rejections with PROJECT_ARCHIVED_READ_ONLY
    // Task creation
    await expect(
      createTask(
        staffUser,
        { projectId, title: "Paint retouch on porch" },
        db
      )
    ).rejects.toThrow("Project is archived and read-only. Operational changes are not permitted.");

    // Drawing creation
    await expect(
      createDrawing(
        staffUser,
        { projectId, drawingNumber: "ARC-201", title: "Gate Detail", discipline: "ARCHITECTURAL" },
        db
      )
    ).rejects.toThrow("Project is archived and read-only. Operational changes are not permitted.");

    // Drawing version creation
    await expect(
      createDrawingVersion(
        staffUser,
        { drawingId: "drw_01", versionLabel: "V3", fileId: "fil_02", requiredConsultantIds: [] },
        db
      )
    ).rejects.toThrow("Project is archived and read-only. Operational changes are not permitted.");

    // Quotation creation
    await expect(
      FinanceService.createQuotation(db, managerUser, {
        projectId,
        title: "Pergola Addition",
        requiredAdvanceMinor: 100000,
        items: [{ description: "Timber pergola", unitRateMinor: 500000 }],
      })
    ).rejects.toThrow("Project is archived and read-only. Operational changes are not permitted.");

    // Invoice drafting
    await expect(
      FinanceService.draftInvoice(db, adminUser, {
        projectId,
        dueDate: "2026-12-15",
        lineItems: [{ description: "Extra work", unitRateMinor: 500000 }],
      })
    ).rejects.toThrow("Project is archived and read-only. Operational changes are not permitted.");

    // Snag reporting
    await expect(
      SnagsService.reportSnag(db, clientUser, {
        projectId,
        title: "Tile crack",
        description: "Small crack on entrance tile",
        locationArea: "Porch",
      })
    ).rejects.toThrow("Project is archived and read-only. Operational changes are not permitted.");

    // 3. ADMIN-only settlement exception (AC-055)
    // Non-admin attempting settlement must fail
    await expect(
      ArchiveService.settleArchivedInvoice(db, managerUser, {
        projectId,
        invoiceId: "inv_01",
        amountMinor: 10000000, // ₹1,00,000
      })
    ).rejects.toThrow("Only administrators can record financial settlements on archived projects.");

    // ADMIN settles ₹1,00,000 against existing invoice inv_01 without reopening project
    const settleResult = await ArchiveService.settleArchivedInvoice(db, adminUser, {
      projectId,
      invoiceId: "inv_01",
      amountMinor: 10000000,
      notes: "Client RTGS transfer received for final settlement",
    });

    expect(settleResult.settledAmountMinor).toBe(10000000);
    expect(settleResult.previousOutstandingMinor).toBe(25000000);
    expect(settleResult.remainingOutstandingMinor).toBe(15000000); // Balance reduced by exact minor unit
    expect(settleResult.settlementStatus).toBe("PARTIALLY_PAID");

    // Verify project is still ARCHIVED
    const projCheck = await db
      .prepare(`SELECT is_archived, status FROM projects WHERE id = ?`)
      .bind(projectId)
      .first<any>();
    expect(projCheck.is_archived).toBe(1);
    expect(projCheck.status).toBe("ARCHIVED");

    // 4. Reopen project validation and authorization
    // Staff/client attempting reopen must fail
    await expect(
      ArchiveService.reopenProject(db, staffUser, {
        projectId,
        reason: "Need to fix drawing",
      })
    ).rejects.toThrow("Only managers, administrators, or practice owners can reopen an archived project.");

    // Empty reason must fail
    await expect(
      ArchiveService.reopenProject(db, managerUser, {
        projectId,
        reason: "   ",
      })
    ).rejects.toThrow("A formal reopen reason is required.");

    // Manager reopens project
    const reopenResult = await ArchiveService.reopenProject(db, managerUser, {
      projectId,
      reason: "Client commissioned Phase 2 gazebo addition under same contract.",
    });

    expect(reopenResult.status).toBe("ACTIVE");
    expect(reopenResult.reopenReason).toBe("Client commissioned Phase 2 gazebo addition under same contract.");

    // After reopening, operational tasks can be created again!
    const newTask = await createTask(
      staffUser,
      { projectId, title: "Survey gazebo boundary markers" },
      db
    );
    expect(newTask.id).toBeDefined();
    expect(newTask.status).toBeDefined();
  });

  it("AC-066: Disaster recovery backup packages project tables and verified files into private storage, and isolated environment restoration reconciles 100% of counts and balances", async () => {
    // 1. Put actual mock file bytes into test R2 bucket for file fil_01 and fil_02
    await r2.put("files/ground_v1.pdf", new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    await r2.put("files/ground_v2.pdf", new Uint8Array([10, 20, 30, 40, 50, 60]));
    await r2.put("files/roof_draft.pdf", new Uint8Array([100, 101, 102]));

    // 2. Export project backup
    const exportResult = await ArchiveService.exportProjectBackup(
      db,
      r2,
      adminUser,
      projectId
    );

    expect(exportResult.backupKey).toMatch(/^backups\/projects\/prj_archive_azure_/);
    expect(exportResult.manifestSha256).toHaveLength(64); // Valid SHA-256 hex string
    expect(exportResult.recordCounts.drawings).toBe(2);
    expect(exportResult.recordCounts.invoices).toBe(1);
    expect(exportResult.recordCounts.memberships).toBe(5);
    expect(exportResult.filesVerifiedCount).toBe(3);

    // Verify backup manifest exists in R2
    const manifestObj = await r2.get(exportResult.backupKey);
    expect(manifestObj).not.toBeNull();
    const manifestText = await manifestObj!.text();
    const manifestJson = JSON.parse(manifestText);

    expect(manifestJson.projectId).toBe(projectId);
    expect(manifestJson.fileChecksums["fil_01"]).toHaveLength(64);
    expect(manifestJson.fileChecksums["fil_02"]).toHaveLength(64);

    // 3. Isolated environment recovery test (restore into an independent second database)
    const isolatedDb = await setupMigratedTestDb();

    // Verify isolated database has 0 project records initially
    const initCheck = await isolatedDb
      .prepare(`SELECT COUNT(*) as cnt FROM projects WHERE id = ?`)
      .bind(projectId)
      .first<{ cnt: number }>();
    expect(initCheck?.cnt).toBe(0);

    // Restore backup payload into isolated environment
    const restoreResult = await ArchiveService.restoreBackupToIsolatedEnv(
      isolatedDb,
      manifestJson
    );

    expect(restoreResult.reconciled).toBe(true);
    expect(restoreResult.restoredCounts.drawings).toBe(2);
    expect(restoreResult.restoredCounts.invoices).toBe(1);
    expect(restoreResult.restoredCounts.memberships).toBe(5);
    expect(restoreResult.restoredCounts.files).toBe(3);
    expect(restoreResult.restoredCounts.totalOutstandingMinor).toBe(25000000);
    expect(restoreResult.fileChecksumsVerified).toBe(3);

    // Verify production DB remains intact and unmodified
    const prodProject = await db
      .prepare(`SELECT status FROM projects WHERE id = ?`)
      .bind(projectId)
      .first<any>();
    expect(prodProject.status).toBe("ACTIVE");
  });
});
