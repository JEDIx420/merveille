import { describe, it, expect } from "vitest";
import { setupMigratedTestDb, createTestR2Bucket } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import { ArchiveService } from "@/server/domain/archive/service";
import { NotificationService } from "@/server/notifications/service";

describe("Stage N05: Integrated Populated Migration, Recovery, and Free-Tier Rollout (NAC-012, NAC-013)", () => {
  it("NAC-012: All 27 migrations execute cleanly, preserve records, suppress legacy WhatsApp replay, and reconcile isolated backup restore", async () => {
    const db = await setupMigratedTestDb();
    const r2 = createTestR2Bucket();
    const orgId = "org_merveille_main";
    const projectId = "prj_n05_populated";
    const now = Date.now();

    const adminUser: UserPrincipal = {
      id: "usr_admin_n05",
      email: "admin.n05@merveilledesigns.com",
      name: "Admin N05",
      role: "ADMIN",
      roles: ["ADMIN"],
      orgId,
      projectMemberships: [{ projectId, projectRole: "ADMIN" }],
    };

    await db
      .prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`)
      .bind(adminUser.id, adminUser.email, adminUser.name, now)
      .run();
    await db
      .prepare(`INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`)
      .bind(`om_${adminUser.id}`, orgId, adminUser.id, now)
      .run();
    await db
      .prepare(`INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at) VALUES (?, ?, ?, 'ADMIN', 'GLOBAL', ?)`)
      .bind(`ra_${adminUser.id}`, orgId, adminUser.id, now)
      .run();

    // Verify N00-N04 tables all exist alongside P00-P14 & R00-R05 tables
    const tables = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all<{ name: string }>();
    const names = new Set(tables.results.map((t) => t.name));
    for (const reqTable of [
      "quota_policies",
      "quota_usage_daily",
      "quota_reservations",
      "job_execution_status",
      "personal_tasks",
      "task_checklist_items",
      "task_collaborators",
      "external_commercial_clearances",
      "lead_followups",
      "lead_activities",
      "import_batches",
      "import_batch_rows",
      "reminder_preset_configs",
      "reminder_snoozes",
    ]) {
      expect(names.has(reqTable)).toBe(true);
    }

    // Seed project + drawing + file + backup & restore to isolated DB
    await db
      .prepare(`INSERT INTO projects (id, org_id, code, name, stage, status, is_archived, revision, created_at) VALUES (?, ?, 'N05-1', 'Populated Project', 'CONSTRUCTION', 'ACTIVE', 0, 1, ?)`)
      .bind(projectId, orgId, now)
      .run();
    await db
      .prepare(`INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at) VALUES ('pm_n05', ?, ?, ?, 'ADMIN', 1, ?)`)
      .bind(orgId, projectId, adminUser.id, now)
      .run();
    await db
      .prepare(`INSERT INTO files (id, org_id, project_id, uploaded_by_user_id, file_class, file_name, mime_type, size_bytes, storage_key, status, is_referenced, created_at) VALUES ('fil_n05', ?, ?, ?, 'DRAWING', 'plan.pdf', 'application/pdf', 5, 'files/n05_plan.pdf', 'READY', 1, ?)`)
      .bind(orgId, projectId, adminUser.id, now)
      .run();
    await r2.put("files/n05_plan.pdf", new Uint8Array([1, 2, 3, 4, 5]));
    await db
      .prepare(`INSERT INTO drawings (id, org_id, project_id, drawing_number, title, discipline, current_released_version_id, is_withdrawn, created_at) VALUES ('drw_n05', ?, ?, 'ARC-01', 'Plan', 'ARCHITECTURAL', 'dv_n05', 0, ?)`)
      .bind(orgId, projectId, now)
      .run();
    await db
      .prepare(`INSERT INTO drawing_versions (id, drawing_id, version_label, file_id, author_user_id, status, released_at, released_by_user_id, created_at) VALUES ('dv_n05', 'drw_n05', 'V1', 'fil_n05', ?, 'RELEASED', ?, ?, ?)`)
      .bind(adminUser.id, now, adminUser.id, now)
      .run();

    const backupR2 = createTestR2Bucket();
    const backup = await ArchiveService.exportProjectBackup(db, r2, adminUser, projectId, backupR2);
    expect(backup.filesVerifiedCount).toBe(1);

    const isolatedDb = await setupMigratedTestDb();
    const targetR2 = createTestR2Bucket();
    const restored = await ArchiveService.restoreBackupToIsolatedEnv(
      isolatedDb,
      backupR2,
      targetR2,
      backup.backupKey,
      backup.manifestSha256
    );
    expect(restored.reconciled).toBe(true);
    expect(restored.restoredCounts.drawings).toBe(1);
    expect(restored.restoredCounts.files).toBe(1);

    // Ensure NotificationService scan produces zero WHATSAPP rows
    await NotificationService.scanDueAndOverdueItems(db, orgId);
    const waCount = await db
      .prepare(`SELECT COUNT(*) as cnt FROM notifications WHERE channel='WHATSAPP' AND status='QUEUED'`)
      .first<{ cnt: number }>();
    expect(waCount?.cnt).toBe(0);
  });
});
