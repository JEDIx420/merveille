import { beforeEach, describe, it, expect } from "vitest";
import { setupMigratedTestDb, createTestR2Bucket } from "../test-db";
import { NotificationService } from "@/server/notifications/service";
import {
  createWhatsAppAdapter,
  verifyMetaWebhookSignature,
} from "@/server/notifications/whatsapp";
import { SyntheticWhatsAppAdapter } from "../fixtures/whatsapp";
import { ArchiveService } from "@/server/domain/archive/service";
import type { UserPrincipal } from "@/server/auth/principal";
const org = "org_merveille_main",
  project = "ops_project";
const principal = (id: string, role: any): UserPrincipal => ({
  id,
  email: `${id}@example.invalid`,
  name: id,
  orgId: org,
  role,
  roles: [role],
  projectMemberships: [
    { projectId: project, projectRole: role, roles: [role] },
  ],
});
const admin = principal("ops_admin", "ADMIN"),
  manager = principal("ops_manager", "MANAGER"),
  staff = principal("ops_staff", "TEAM_MEMBER");
async function fixture() {
  const db = await setupMigratedTestDb();
  for (const p of [admin, manager, staff]) {
    await db
      .prepare(
        "INSERT INTO users(id,email,display_name,status,created_at) VALUES(?,?,?,'ACTIVE',?)",
      )
      .bind(p.id, p.email, p.name, Date.now())
      .run();
    await db
      .prepare(
        "INSERT INTO organization_memberships(id,org_id,user_id,is_active,created_at) VALUES(?,?,?,1,?)",
      )
      .bind(`om_${p.id}`, org, p.id, Date.now())
      .run();
    await db
      .prepare(
        "INSERT INTO role_assignments(id,org_id,user_id,role,scope,granted_at) VALUES(?,?,?,?,'GLOBAL',?)",
      )
      .bind(`role_${p.id}`, org, p.id, p.role, Date.now())
      .run();
  }
  await db
    .prepare(
      "INSERT INTO projects(id,org_id,code,name,status,created_at) VALUES(?,?,'OPS','Fictional operations project','ACTIVE',?)",
    )
    .bind(project, org, Date.now())
    .run();
  for (const p of [manager, staff])
    await db
      .prepare(
        "INSERT INTO project_memberships(id,org_id,project_id,user_id,project_role,is_active,assigned_at) VALUES(?,?,?,?,?,1,?)",
      )
      .bind(`pm_${p.id}`, org, project, p.id, p.role, Date.now())
      .run();
  await db
    .prepare(
      "INSERT INTO tasks(id,org_id,project_id,title,status,creator_user_id,assignee_user_id,effective_due_date,created_at) VALUES('ops_task',?,?,'Inspect fictional site','TODO',?,?,'2026-11-01',?)",
    )
    .bind(org, project, manager.id, staff.id, Date.now())
    .run();
  return db;
}
describe("Durable reminder repairs", () => {
  let db: D1Database;
  beforeEach(async () => {
    db = await fixture();
  });
  it("deduplicates scheduled scans and creates actionable ADMIN escalation and outbox pairs", async () => {
    const first = await NotificationService.scanDueAndOverdueItems(
      db,
      org,
      new Date("2026-11-24T06:00:00Z"),
    );
    const second = await NotificationService.scanDueAndOverdueItems(
      db,
      org,
      new Date("2026-11-24T07:00:00Z"),
    );
    expect(first.createdCount).toBeGreaterThan(0);
    expect(second.createdCount).toBe(0);
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) n FROM notifications WHERE user_id=? AND dedupe_key LIKE '%ESCALATION'",
        )
        .bind(admin.id)
        .first<any>(),
    ).toMatchObject({ n: 1 });
    expect(
      (await db.prepare("SELECT COUNT(*) n FROM outbox_events").first<any>())
        ?.n,
    ).toBe(first.createdCount);
  });
  it("does not fake delivery without provider/contact setup and suppresses membership revocation", async () => {
    await NotificationService.scanDueAndOverdueItems(
      db,
      org,
      new Date("2026-11-24T06:00:00Z"),
    );
    const adapter = createWhatsAppAdapter({ WHATSAPP_MODE: "fake" });
    const res = await NotificationService.dispatchQueuedNotifications(
      db,
      adapter,
    );
    expect(res.unavailable).toBe(1);
    expect(res.sent).toBe(0);
    await db
      .prepare("UPDATE notifications SET status='QUEUED' WHERE user_id=?")
      .bind(staff.id)
      .run();
    await db
      .prepare("UPDATE project_memberships SET is_active=0 WHERE user_id=?")
      .bind(staff.id)
      .run();
    const retry = await NotificationService.dispatchQueuedNotifications(
      db,
      new SyntheticWhatsAppAdapter(),
    );
    expect(retry.suppressed).toBe(2);
  });
  it("claims one notification once and preserves uncertain delivery without automatic resends", async () => {
    await db
      .prepare(
        "INSERT INTO notification_preferences(org_id,user_id,whatsapp_phone,whatsapp_verified_at,whatsapp_consent_at,whatsapp_enabled,updated_at) VALUES(?,?,?,1,1,1,1)",
      )
      .bind(org, staff.id, "+15555550123")
      .run();
    await NotificationService.scanDueAndOverdueItems(
      db,
      org,
      new Date("2026-11-24T06:00:00Z"),
    );
    const n = await db
      .prepare(
        "SELECT id FROM notifications WHERE user_id=? AND channel='WHATSAPP'",
      )
      .bind(staff.id)
      .first<any>();
    const fake = new SyntheticWhatsAppAdapter();
    fake.simulateTimeout = true;
    await NotificationService.dispatchQueuedNotifications(db, fake, n.id);
    await NotificationService.dispatchQueuedNotifications(db, fake, n.id);
    expect(fake.sentMessages).toHaveLength(1);
    expect(
      await db
        .prepare("SELECT status FROM notifications WHERE id=?")
        .bind(n.id)
        .first<any>(),
    ).toMatchObject({ status: "UNKNOWN" });
  });
  it("deduplicates signed webhook effects and never regresses READ with an older SENT/FAILED status", async () => {
    await db
      .prepare(
        "INSERT INTO notifications(id,org_id,user_id,project_id,source_entity_type,source_entity_id,dedupe_key,channel,title,body_text,status,provider_message_id,created_at) VALUES('hook',?,?,?,'TASK','ops_task','hook','WHATSAPP','Action','Action','SENT','provider_123',1)",
      )
      .bind(org, staff.id, project)
      .run();
    await NotificationService.reconcileWebhookStatus(
      db,
      "e-read",
      "provider_123",
      "READ",
    );
    expect(
      (
        await NotificationService.reconcileWebhookStatus(
          db,
          "e-read",
          "provider_123",
          "READ",
        )
      ).duplicate,
    ).toBe(true);
    await NotificationService.reconcileWebhookStatus(
      db,
      "e-sent",
      "provider_123",
      "SENT",
    );
    await NotificationService.reconcileWebhookStatus(
      db,
      "e-failed",
      "provider_123",
      "FAILED",
    );
    expect(
      await db
        .prepare("SELECT status FROM notifications WHERE id='hook'")
        .first<any>(),
    ).toMatchObject({ status: "READ" });
    const bytes = new TextEncoder().encode('{"event":"read"}');
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("test-only-secret"),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = Array.from(
      new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes)),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    expect(
      await verifyMetaWebhookSignature(
        bytes,
        `sha256=${sig}`,
        "test-only-secret",
      ),
    ).toBe(true);
    expect(
      await verifyMetaWebhookSignature(
        new TextEncoder().encode("altered"),
        `sha256=${sig}`,
        "test-only-secret",
      ),
    ).toBe(false);
  });
});
describe("Independent recovery and archive repairs", () => {
  it("rejects ADMIN-only archive authority and records actual prior lifecycle for reopening", async () => {
    const db = await fixture();
    await expect(
      ArchiveService.archiveProject(db, admin, {
        projectId: project,
        reason: "Complete",
      }),
    ).rejects.toThrow("assigned manager");
    await ArchiveService.archiveProject(db, manager, {
      projectId: project,
      reason: "Fictional close-out review",
    });
    expect(
      (
        await db
          .prepare("SELECT pre_archive_status FROM projects WHERE id=?")
          .bind(project)
          .first<any>()
      )?.pre_archive_status,
    ).toBe("ACTIVE");
    await ArchiveService.reopenProject(db, manager, {
      projectId: project,
      reason: "Fictional follow-up",
    });
    expect(
      (
        await db
          .prepare("SELECT status FROM projects WHERE id=?")
          .bind(project)
          .first<any>()
      )?.status,
    ).toBe("ACTIVE");
    await expect(
      ArchiveService.settleArchivedInvoice(db, admin, {
        projectId: project,
        invoiceId: "unknown",
        amountMinor: 100,
      }),
    ).rejects.toThrow();
  });
  it("recovers actual bytes and complete task history after source deletion, quarantining restored access", async () => {
    const db = await fixture(),
      source = createTestR2Bucket(),
      backup = createTestR2Bucket(),
      target = createTestR2Bucket();
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    await source.put("objects/site-photo", bytes);
    await db
      .prepare(
        "INSERT INTO files(id,org_id,project_id,uploaded_by_user_id,file_class,file_name,mime_type,size_bytes,storage_key,status,created_at) VALUES('ops_file',?,?,?,'IMAGE','fictional-site.jpg','image/jpeg',5,'objects/site-photo','READY',1)",
      )
      .bind(org, project, staff.id)
      .run();
    await db
      .prepare(
        "INSERT INTO task_events(id,task_id,actor_id,event_type,created_at) VALUES('ops_event','ops_task',?,'TASK_CREATED',1)",
      )
      .bind(manager.id)
      .run();
    await expect(
      ArchiveService.exportProjectBackup(db, source, admin, project),
    ).rejects.toThrow("Separate protected");
    const exported = await ArchiveService.exportProjectBackup(
      db,
      source,
      admin,
      project,
      backup,
    );
    await source.delete("objects/site-photo");
    const targetDb = await setupMigratedTestDb();
    const restored = await ArchiveService.restoreBackupToIsolatedEnv(
      targetDb,
      backup,
      target,
      exported.backupKey,
      exported.manifestSha256,
    );
    expect(restored.reconciled).toBe(true);
    expect(restored.fileChecksumsVerified).toBe(1);
    expect(
      new Uint8Array(
        await (await target.get("objects/site-photo"))!.arrayBuffer(),
      ),
    ).toEqual(bytes);
    expect(
      (
        await targetDb
          .prepare("SELECT COUNT(*) n FROM task_events WHERE id='ops_event'")
          .first<any>()
      )?.n,
    ).toBe(1);
    expect(
      (
        await targetDb
          .prepare(
            "SELECT COUNT(*) n FROM organization_memberships WHERE org_id=? AND is_active=1",
          )
          .bind(org)
          .first<any>()
      )?.n,
    ).toBe(0);
    expect(
      (
        await targetDb
          .prepare("SELECT COUNT(*) n FROM users WHERE status='ACTIVE'")
          .first<any>()
      )?.n,
    ).toBe(0);
  });
  it("marks a missing source object INCOMPLETE and rejects corrupt independent backup segments", async () => {
    const db = await fixture(),
      source = createTestR2Bucket(),
      backup = createTestR2Bucket();
    await db
      .prepare(
        "INSERT INTO files(id,org_id,project_id,uploaded_by_user_id,file_class,file_name,mime_type,size_bytes,storage_key,status,created_at) VALUES('ops_file',?,?,?,'IMAGE','fictional-site.jpg','image/jpeg',3,'objects/site-photo','READY',1)",
      )
      .bind(org, project, staff.id)
      .run();
    await expect(
      ArchiveService.exportProjectBackup(db, source, admin, project, backup),
    ).rejects.toThrow("SOURCE_OBJECT_MISSING");
    expect(
      (await db.prepare("SELECT status FROM backup_runs LIMIT 1").first<any>())
        ?.status,
    ).toBe("INCOMPLETE");
    await source.put("objects/site-photo", new Uint8Array([1, 2, 3]));
    const result = await ArchiveService.exportProjectBackup(
      db,
      source,
      admin,
      project,
      backup,
    );
    const manifest = JSON.parse(
      await (await backup.get(result.backupKey))!.text(),
    );
    await backup.put(
      manifest.objects[0].chunks[0].key,
      new Uint8Array([8, 8, 8]),
    );
    await expect(
      ArchiveService.restoreBackupToIsolatedEnv(
        await setupMigratedTestDb(),
        backup,
        createTestR2Bucket(),
        result.backupKey,
        result.manifestSha256,
      ),
    ).rejects.toThrow("HASH_MISMATCH");
  });
});
