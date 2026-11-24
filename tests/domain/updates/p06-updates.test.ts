/**
 * P06 Acceptance Tests: Published updates, internal notes, announcements, and manual K-SMART records.
 * Tests AC-022, AC-023, AC-024, AC-025, AC-026.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../../src/server/auth/principal";
import { UpdatesService } from "../../../src/server/domain/updates/service";
import { PermitsService } from "../../../src/server/domain/permits/service";

describe("Phase 06: Updates, Internal Notes, Announcements, and Permits", () => {
  let db: D1Database;

  const testOrgId = "org_merveille_main";
  const testProjectId = "prj_updates_villa";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Merveille Admin",
    orgId: testOrgId,
    role: "ADMIN",
    projectMemberships: [{ projectId: testProjectId, projectRole: "ADMIN" }],
    isSynthetic: true,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Vipin Manager",
    orgId: testOrgId,
    role: "MANAGER",
    projectMemberships: [{ projectId: testProjectId, projectRole: "MANAGER" }],
    isSynthetic: true,
  };

  const staffUser: UserPrincipal = {
    id: "usr_stf_001",
    email: "staff@merveilledesigns.com",
    name: "Nithya Architect",
    orgId: testOrgId,
    role: "STAFF",
    projectMemberships: [{ projectId: testProjectId, projectRole: "STAFF" }],
    isSynthetic: true,
  };

  const clientUser: UserPrincipal = {
    id: "usr_cli_001",
    email: "client@example.com",
    name: "Thomas Client",
    orgId: testOrgId,
    role: "MAIN_CLIENT",
    projectMemberships: [{ projectId: testProjectId, projectRole: "MAIN_CLIENT" }],
    isSynthetic: true,
  };

  const otherClientUser: UserPrincipal = {
    id: "usr_cli_002",
    email: "otherclient@example.com",
    name: "Anand Other Client",
    orgId: testOrgId,
    role: "MAIN_CLIENT",
    projectMemberships: [{ projectId: "prj_other_residence", projectRole: "MAIN_CLIENT" }],
    isSynthetic: true,
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // 1. Seed org
    await db
      .prepare(
        "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)"
      )
      .bind(testOrgId, "Merveille Designs", Date.now())
      .run();

    // 2. Seed users and memberships
    const allUsers = [adminUser, managerUser, staffUser, clientUser, otherClientUser];
    for (const u of allUsers) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, display_name, status, created_at)
           VALUES (?, ?, ?, 'ACTIVE', ?)`
        )
        .bind(u.id, u.email, u.name, Date.now())
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at)
           VALUES (?, ?, ?, 1, ?)`
        )
        .bind(`om_${u.id}`, testOrgId, u.id, Date.now())
        .run();
    }

    // 3. Seed project
    await db
      .prepare(
        `INSERT OR IGNORE INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id,
          stage, status, is_archived, revision, created_at
        ) VALUES (?, ?, 'MD-UPD', 'Updates Test Villa', ?, ?, 'Schematic Design', 'ACTIVE', 0, 1, ?)`
      )
      .bind(testProjectId, testOrgId, clientUser.id, managerUser.id, Date.now())
      .run();

    // 4. Seed project memberships
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES ('pm_m1', ?, ?, ?, 'MANAGER', 1, ?)`
      )
      .bind(testOrgId, testProjectId, managerUser.id, Date.now())
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES ('pm_s1', ?, ?, ?, 'STAFF', 1, ?)`
      )
      .bind(testOrgId, testProjectId, staffUser.id, Date.now())
      .run();
    await db
      .prepare(
        `INSERT OR IGNORE INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES ('pm_c1', ?, ?, ?, 'MAIN_CLIENT', 1, ?)`
      )
      .bind(testOrgId, testProjectId, clientUser.id, Date.now())
      .run();

    // 5. Seed files
    for (const fId of ["fil_site_photo_1", "fil_sensitive_screenshot", "fil_permit_summary"]) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO files (
            id, org_id, project_id, uploaded_by_user_id, file_class, file_name,
            mime_type, size_bytes, storage_key, status, is_internal_only, is_referenced, created_at
          ) VALUES (?, ?, ?, ?, 'IMAGE', ?, 'image/jpeg', 2048, ?, 'READY', 0, 0, ?)`
        )
        .bind(fId, testOrgId, testProjectId, staffUser.id, `${fId}.jpg`, `keys/${fId}`, Date.now())
        .run();
    }
  });

  it("AC-022: Manager publishes selected audience; internal notes never appear to clients", async () => {
    // 1. Staff creates draft update with photo
    const { updateId, versionId } = await UpdatesService.createProjectUpdate(
      db,
      staffUser,
      {
        projectId: testProjectId,
        title: "Foundation Concreting Complete",
        bodyText: "Completed casting raft foundation today.",
        observedDate: "2026-11-24",
        fileIds: ["fil_site_photo_1"],
      }
    );
    expect(updateId).toBeDefined();

    // 2. Staff creates separate internal note
    const { noteId } = await UpdatesService.createInternalNote(db, staffUser, {
      projectId: testProjectId,
      title: "Internal Contractor Delay Discussion",
      bodyText: "Contractor was 3 days late; discuss penalty in next review.",
      isConfidential: true,
    });
    expect(noteId).toBeDefined();

    // 3. Client checks feed BEFORE publication
    const clientFeedBefore = await UpdatesService.listProjectUpdates(
      db,
      clientUser,
      testProjectId
    );
    expect(clientFeedBefore).toHaveLength(0); // Draft is completely hidden!

    // 4. Client attempts to query internal notes -> strictly rejected
    await expect(
      UpdatesService.listInternalNotes(db, clientUser, testProjectId)
    ).rejects.toThrow(/Clients and consultants cannot access internal notes/);

    // 5. Staff submits update for review
    await UpdatesService.submitUpdateForReview(db, staffUser, versionId);

    // 6. Manager reviews and publishes the update
    const pubResult = await UpdatesService.publishUpdate(db, managerUser, versionId);
    expect(pubResult.status).toBe("PUBLISHED");

    // 7. Client checks feed AFTER publication
    const clientFeedAfter = await UpdatesService.listProjectUpdates(
      db,
      clientUser,
      testProjectId
    );
    expect(clientFeedAfter).toHaveLength(1);
    expect(clientFeedAfter[0].title).toBe("Foundation Concreting Complete");
    expect(clientFeedAfter[0].body_text).toBe("Completed casting raft foundation today.");
    expect(clientFeedAfter[0].attachments).toHaveLength(1);
    expect(clientFeedAfter[0].attachments[0].id).toBe("fil_site_photo_1");

    // Internal notes STILL strictly inaccessible to client
    await expect(
      UpdatesService.listInternalNotes(db, clientUser, testProjectId)
    ).rejects.toThrow(/Clients and consultants cannot access internal notes/);
  });

  it("AC-023: Published update edit needs review; rejected edit does not overwrite published V1", async () => {
    // 1. Create and publish V1
    const { updateId, versionId: v1Id } = await UpdatesService.createProjectUpdate(
      db,
      staffUser,
      {
        projectId: testProjectId,
        title: "Structural Columns Cast",
        bodyText: "Ground floor columns cast successfully.",
        observedDate: "2026-11-20",
      }
    );
    await UpdatesService.submitUpdateForReview(db, staffUser, v1Id);
    await UpdatesService.publishUpdate(db, managerUser, v1Id);

    // Verify client sees V1
    const initialClientFeed = await UpdatesService.listProjectUpdates(
      db,
      clientUser,
      testProjectId
    );
    expect(initialClientFeed).toHaveLength(1);
    expect(initialClientFeed[0].title).toBe("Structural Columns Cast");
    expect(initialClientFeed[0].body_text).toBe("Ground floor columns cast successfully.");

    // 2. Staff proposes V2 with modified text
    const { versionId: v2Id } = await UpdatesService.createUpdateVersion(
      db,
      staffUser,
      {
        updateId,
        title: "Structural Columns Cast - Correction",
        bodyText: "Ground floor columns cast with minor honeycombing noted.",
        observedDate: "2026-11-21",
      }
    );
    await UpdatesService.submitUpdateForReview(db, staffUser, v2Id);

    // 3. Manager reviews and returns V2 with feedback (CHANGES_REQUESTED)
    const returnResult = await UpdatesService.returnUpdate(db, managerUser, {
      versionId: v2Id,
      feedback: "Honeycombing requires remedial patch before publishing to client.",
    });
    expect(returnResult.status).toBe("CHANGES_REQUESTED");

    // 4. Client checks feed: V1 remains published and intact! V2 text is NOT visible to client
    const clientFeedAfterReturn = await UpdatesService.listProjectUpdates(
      db,
      clientUser,
      testProjectId
    );
    expect(clientFeedAfterReturn).toHaveLength(1);
    expect(clientFeedAfterReturn[0].title).toBe("Structural Columns Cast");
    expect(clientFeedAfterReturn[0].body_text).toBe("Ground floor columns cast successfully.");
    expect(clientFeedAfterReturn[0].body_text).not.toContain("honeycombing");
  });

  it("AC-024: Announcements have separate explicit audience targeting", async () => {
    // 1. Manager prepares company announcement targeting only testProjectId
    const { announcementId } = await UpdatesService.createCompanyAnnouncement(
      db,
      managerUser,
      {
        title: "Holiday Schedule Notice",
        bodyText: "Office closed for Onam from Sept 1 to Sept 5.",
        audienceType: "SELECTED_PROJECTS",
        targetProjectIds: [testProjectId],
      }
    );

    // 2. Publish announcement
    await UpdatesService.publishCompanyAnnouncement(db, managerUser, announcementId);

    // 3. User A (client on testProjectId) views announcements -> VISIBLE
    const userAAnnouncements = await UpdatesService.listCompanyAnnouncements(
      db,
      clientUser
    );
    expect(userAAnnouncements).toHaveLength(1);
    expect(userAAnnouncements[0].title).toBe("Holiday Schedule Notice");

    // 4. User B (client on other project prj_other_residence) views announcements -> NOT VISIBLE
    const userBAnnouncements = await UpdatesService.listCompanyAnnouncements(
      db,
      otherClientUser
    );
    expect(userBAnnouncements).toHaveLength(0);
  });

  it("AC-025: K-SMART evidence is manual and dated; separate sanction and completion records", async () => {
    // 1. Ensure milestones exist
    await PermitsService.ensureMilestones(db, testOrgId, testProjectId);

    const internalPermits = await PermitsService.getProjectPermits(
      db,
      staffUser,
      testProjectId
    );
    expect(internalPermits).toHaveLength(2); // SANCTION and COMPLETION

    const sanctionMilestone = internalPermits.find(
      (m: any) => m.milestoneType === "SANCTION"
    );
    expect(sanctionMilestone).toBeDefined();

    // 2. Staff enters manual observation with check date and source
    const { observationId } = await PermitsService.recordObservation(
      db,
      staffUser,
      {
        milestoneId: sanctionMilestone.milestoneId,
        observedStatusText: "Scrutiny Completed - Awaiting Local Body Committee",
        decisionDate: "2026-11-20",
        lastCheckedDate: "2026-11-24",
        sourceDescription: "Staff manual verification on K-SMART web portal",
        referenceUrl: "https://ksmart.kerala.gov.in/app/10294",
        staffNotes: "Engineering scrutiny cleared, town planning review pending.",
        files: [{ fileId: "fil_permit_summary", isClientShared: true }],
      }
    );
    expect(observationId).toBeDefined();

    // 3. Submit and approve sharing
    await PermitsService.submitObservationForSharing(db, staffUser, observationId);
    await PermitsService.reviewObservationSharing(db, managerUser, {
      observationId,
      decision: "APPROVE",
    });

    // 4. Client views permit records
    const clientPermits = await PermitsService.getProjectPermits(
      db,
      clientUser,
      testProjectId
    );
    expect(clientPermits).toHaveLength(2);

    const clientSanction = clientPermits.find(
      (m: any) => m.milestoneType === "SANCTION"
    );
    expect(clientSanction.hasPublishedRecord).toBe(true);
    expect(clientSanction.statusText).toBe(
      "Scrutiny Completed - Awaiting Local Body Committee"
    );
    expect(clientSanction.lastCheckedDate).toBe("2026-11-24");
    expect(clientSanction.recordStatement).toBe(
      "Recorded by Nithya Architect · Last checked 2026-11-24"
    );
    expect(clientSanction.disclaimer).toContain(
      "Manual practice record entered by team · Not an automated government verification"
    );
    // Private staff notes omitted
    expect((clientSanction as any).staffNotes).toBeUndefined();
  });

  it("AC-026: Permit evidence can remain restricted; sensitive screenshot remains private", async () => {
    await PermitsService.ensureMilestones(db, testOrgId, testProjectId);
    const internalPermits = await PermitsService.getProjectPermits(
      db,
      staffUser,
      testProjectId
    );
    const sanctionMilestone = internalPermits.find(
      (m: any) => m.milestoneType === "SANCTION"
    );

    // 1. Staff records observation with two files:
    // - fil_sensitive_screenshot: isClientShared = false (INTERNAL ONLY)
    // - fil_permit_summary: isClientShared = true (SAFE TO SHARE)
    const { observationId } = await PermitsService.recordObservation(
      db,
      staffUser,
      {
        milestoneId: sanctionMilestone.milestoneId,
        observedStatusText: "Site Inspection Completed",
        lastCheckedDate: "2026-11-24",
        sourceDescription: "Staff inspected K-SMART portal and municipal notice",
        staffNotes: "Internal note containing personal official details.",
        files: [
          { fileId: "fil_sensitive_screenshot", isClientShared: false },
          { fileId: "fil_permit_summary", isClientShared: true },
        ],
      }
    );

    // 2. Submit and manager publishes
    await PermitsService.submitObservationForSharing(db, staffUser, observationId);
    await PermitsService.reviewObservationSharing(db, managerUser, {
      observationId,
      decision: "APPROVE",
    });

    // 3. Client checks permit
    const clientPermits = await PermitsService.getProjectPermits(
      db,
      clientUser,
      testProjectId
    );
    const clientSanction = clientPermits.find(
      (m: any) => m.milestoneType === "SANCTION"
    );

    // Client receives approved status and SHARED files only
    expect(clientSanction.hasPublishedRecord).toBe(true);
    expect(clientSanction.files).toHaveLength(1);
    expect(clientSanction.files[0].id).toBe("fil_permit_summary");

    // Sensitive screenshot is strictly excluded from client response
    const sensitiveFilePresent = clientSanction.files.some(
      (f: any) => f.id === "fil_sensitive_screenshot"
    );
    expect(sensitiveFilePresent).toBe(false);

    // Internal staff still sees both files
    const staffPermits = await PermitsService.getProjectPermits(
      db,
      staffUser,
      testProjectId
    );
    const staffSanction = staffPermits.find(
      (m: any) => m.milestoneType === "SANCTION"
    );
    const obs = staffSanction.observations.find((o: any) => o.id === observationId);
    expect(obs.files).toHaveLength(2);
  });
});
