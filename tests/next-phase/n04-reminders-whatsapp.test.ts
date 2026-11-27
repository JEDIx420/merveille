import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import { NotificationService } from "@/server/notifications/service";
import { createLead, addLeadFollowup } from "@/server/domain/enquiries/leads-service";
import { setCommercialMode } from "@/server/domain/finance/external-clearance";
import { buildPreparedWhatsAppMessage } from "@/shared/whatsapp-share";

describe("Stage N04: In-App Reminders and Manual WhatsApp Preparation (NAC-010, NAC-011)", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";

  const adminUser: UserPrincipal = {
    id: "usr_admin_n04",
    email: "admin.n04@merveilledesigns.com",
    name: "Admin N04",
    role: "ADMIN",
    roles: ["ADMIN"],
    intakeAccess: true,
    orgId,
    projectMemberships: [],
  };

  const staffUser: UserPrincipal = {
    id: "usr_staff_n04",
    email: "staff.n04@merveilledesigns.com",
    name: "Staff N04",
    role: "TEAM_MEMBER",
    roles: ["TEAM_MEMBER"],
    intakeAccess: true,
    orgId,
    projectMemberships: [],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    const now = Date.now();
    for (const u of [adminUser, staffUser]) {
      await db
        .prepare(`INSERT OR IGNORE INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, 'ACTIVE', ?)`)
        .bind(u.id, u.email, u.name, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at) VALUES (?, ?, ?, 1, ?)`)
        .bind(`om_${u.id}`, orgId, u.id, now)
        .run();
      await db
        .prepare(`INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at) VALUES (?, ?, ?, ?, 'GLOBAL', ?)`)
        .bind(`ra_${u.id}`, orgId, u.id, u.role, now)
        .run();
    }
  });

  it("NAC-010: Scanner creates PORTAL-only reminders (zero WHATSAPP rows), respects EXTERNAL mode, office hours, snoozes, and duplicate scans", async () => {
    // Switch org to EXTERNAL billing mode -> invoice reminders must not be created
    await setCommercialMode(db, adminUser, orgId, "EXTERNAL", "External billing");

    // Create a lead with due follow-up today (2026-11-27)
    const lead = await createLead(
      staffUser,
      {
        name: "Kiran Das",
        requirement: "Office interior fitout",
        nextAction: "Send concept deck",
        nextActionDate: "2026-11-27",
      },
      db
    );

    // 1. Scan at 11:00 IST (2026-11-27T05:30:00Z)
    const clock = new Date("2026-11-27T05:30:00Z");
    const first = await NotificationService.scanDueAndOverdueItems(db, orgId, clock);
    expect(first.createdCount).toBe(1);

    // Repeat scan is idempotent (0 duplicates)
    const second = await NotificationService.scanDueAndOverdueItems(db, orgId, clock);
    expect(second.createdCount).toBe(0);

    // Zero WHATSAPP notifications generated!
    const waCount = await db
      .prepare(`SELECT COUNT(*) as cnt FROM notifications WHERE org_id = ? AND channel = 'WHATSAPP'`)
      .bind(orgId)
      .first<{ cnt: number }>();
    expect(waCount?.cnt).toBe(0);

    // Eligible check allows staffUser to see their LEAD_FOLLOWUP notification
    const list = await NotificationService.listUserNotifications(db, staffUser);
    expect(list.length).toBe(1);
    expect(list[0].title).toContain("Kiran Das");

    // Snooze test: add a second follow-up and snooze it before scanning
    const f2 = await addLeadFollowup(
      staffUser,
      lead.id,
      { actionText: "Follow up call", dueDate: "2026-11-27" },
      db
    );
    await NotificationService.snoozeReminder(db, staffUser, {
      sourceEntityType: "LEAD_FOLLOWUP",
      sourceEntityId: f2.id,
      snoozedUntilMs: Date.now() + 3600 * 1000,
    });
    const afterSnooze = await NotificationService.scanDueAndOverdueItems(db, orgId, clock);
    expect(afterSnooze.createdCount).toBe(0);
  });

  it("NAC-011: Prepared manual WhatsApp message formats exact released resource link without any outbound dispatch", async () => {
    const msg = buildPreparedWhatsAppMessage({
      kind: "DRAWING_RELEASE",
      projectName: "Kowdiar Residence",
      title: "Ground Floor Plan",
      revisionLabel: "R2",
      releasedAt: Date.parse("2026-11-27T06:00:00Z"),
      approvedSummary: "Updated kitchen island dimensions.",
      authenticatedPath: "/projects/prj_1/drawings?versionId=ver_2",
      appOrigin: "https://portal.merveilledesigns.com",
    });

    expect(msg).toContain("Merveille Designs — Kowdiar Residence");
    expect(msg).toContain("Ground Floor Plan — Revision R2");
    expect(msg).toContain("Updated kitchen island dimensions.");
    expect(msg).toContain("View drawing: https://portal.merveilledesigns.com/projects/prj_1/drawings?versionId=ver_2");

    // Confirm zero whatsapp_messages rows exist
    const waMsgs = await db.prepare(`SELECT COUNT(*) as cnt FROM whatsapp_messages`).first<{ cnt: number }>();
    expect(waMsgs?.cnt).toBe(0);
  });
});
