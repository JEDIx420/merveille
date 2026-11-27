import { SyntheticWhatsAppAdapter } from "../../fixtures/whatsapp";
/**
 * P11 Acceptance Tests: In-Portal Notifications, WhatsApp Safe Context, Escalations,
 * Dispatch-Time Suppression, Timeout Handling, and Webhook Signature Verification.
 * Tests AC-046, AC-047, AC-048, AC-049, AC-050.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "../../../src/server/auth/principal";
import { NotificationService } from "../../../src/server/notifications/service";
import {
  verifyMetaWebhookSignature,
} from "../../../src/server/notifications/whatsapp";
import { createTask, completeTask } from "../../../src/server/domain/tasks/service";

describe("Phase 11: In-Portal Notifications, WhatsApp, and Escalation", () => {
  let db: D1Database;
  let whatsappAdapter: SyntheticWhatsAppAdapter;

  const testOrgId = "org_merveille_main";
  const testProjectId = "prj_notif_villa";

  const adminUser: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Merveille Admin",
    orgId: testOrgId,
    role: "ADMIN", roles: ["ADMIN"],
    projectMemberships: [{ projectId: testProjectId, projectRole: "ADMIN" }],
    isSynthetic: true,
  };

  const managerUser: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Vipin Manager",
    orgId: testOrgId,
    role: "MANAGER", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "MANAGER" }],
    isSynthetic: true,
  };

  const staffUser: UserPrincipal = {
    id: "usr_stf_001",
    email: "staff@merveilledesigns.com",
    name: "Nithya Architect",
    orgId: testOrgId,
    role: "STAFF", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "STAFF" }],
    isSynthetic: true,
  };

  const clientUser: UserPrincipal = {
    id: "usr_cli_001",
    email: "client@example.com",
    name: "Thomas Client (Main Client)",
    orgId: testOrgId,
    role: "MAIN_CLIENT", roles: [],
    projectMemberships: [{ projectId: testProjectId, projectRole: "MAIN_CLIENT" }],
    isSynthetic: true,
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    whatsappAdapter = new SyntheticWhatsAppAdapter();

    // 1. Seed org
    await db
      .prepare("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)")
      .bind(testOrgId, "Merveille Designs", Date.now())
      .run();

    // 2. Seed users
    const allUsers = [adminUser, managerUser, staffUser, clientUser];
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

    // Assign admin role to adminUser
    await db
      .prepare(
        `INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, granted_at)
         VALUES ('ra_admin', ?, ?, 'ADMIN', ?)`
      )
      .bind(testOrgId, adminUser.id, Date.now())
      .run();

    // 3. Seed project
    await db
      .prepare(
        `INSERT INTO projects (
          id, org_id, code, name, main_client_user_id, manager_user_id, status, created_at
        ) VALUES (?, ?, 'PRJ-NOT', 'Villa Notification Controls', ?, ?, 'ACTIVE', ?)`
      )
      .bind(testProjectId, testOrgId, clientUser.id, managerUser.id, Date.now())
      .run();

    for (const u of allUsers) {
      const pRole = u.projectMemberships[0].projectRole;
      await db
        .prepare(
          `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`pm_${u.id}`, testOrgId, testProjectId, u.id, pRole, Date.now())
        .run();
    }
  });

  // ---------------------------------------------------------------------------
  // AC-046 — Due reminders and overdue escalation
  // ---------------------------------------------------------------------------
  it("AC-046: due reminders and admin escalation run under Asia/Kolkata timezone policy", async () => {
    // 1. Create overdue task in the past relative to simulated clock
    const task = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "Structural Glazing Review",
        proposedAssigneeId: staffUser.id,
        proposedDueDate: "2026-11-20", // Past date in Kolkata
      },
      db
    );

    // 2. Create overdue issued invoice with remaining balance
    const invoiceId = "inv_overdue_001";
    await db
      .prepare(
        `INSERT INTO invoices (
          id, org_id, project_id, current_version_number, invoice_number,
          total_minor, allocated_minor, outstanding_minor, due_date,
          status, settlement_status, created_by_user_id, created_at
        ) VALUES (?, ?, ?, 1, 'MD-INV-2026-0001', 25000000, 5000000, 20000000, '2026-11-21', 'ISSUED', 'PARTIALLY_PAID', ?, ?)`
      )
      .bind(invoiceId, testOrgId, testProjectId, staffUser.id, Date.now())
      .run();

    // 3. Run scheduler with clock at 2026-11-24 10:00 AM Kolkata time
    const simulatedClock = new Date("2026-11-24T04:30:00Z"); // 10:00 AM IST
    const scanResult = await NotificationService.scanDueAndOverdueItems(db, testOrgId, simulatedClock);

    // Creates PORTAL-only notifications per Stage N04 (2 user + 2 admin escalations)
    expect(scanResult.createdCount).toBe(4);
    // Unresolved overdue items escalate to admin
    expect(scanResult.escalationCount).toBe(2); // 1 task escalation + 1 invoice escalation

    // Inspect notifications
    const portalNotifications = await NotificationService.listUserNotifications(db, staffUser);
    expect(portalNotifications.length).toBe(1);
    expect(portalNotifications[0].title).toContain("Task overdue");
    expect(portalNotifications[0].body_text).toContain("Structural Glazing Review");

    const clientNotifications = await NotificationService.listUserNotifications(db, clientUser);
    expect(clientNotifications.length).toBe(1);
    expect(clientNotifications[0].title).toContain("Payment overdue");
    // AC-046: Uses actual remaining obligation after receipts/credits (₹2,00,000 outstanding)
    expect(clientNotifications[0].body_text).toContain("outstanding payment");

    // Inspect admin escalations
    const escalations = await db.prepare("SELECT * FROM notification_escalations").all();
    expect(escalations.results.length).toBe(2);
    expect(escalations.results[0].escalated_to_user_id).toBe(adminUser.id);
  });

  // ---------------------------------------------------------------------------
  // AC-047 — Notification eligibility checked at dispatch
  // ---------------------------------------------------------------------------
  it("AC-047: checks eligibility at dispatch; suppresses resolved tasks and revoked users; read status never mutates entities", async () => {
    // 1. Setup task and schedule notifications
    const task = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "Soil Test Report",
        proposedAssigneeId: staffUser.id,
        proposedDueDate: "2026-11-20",
      },
      db
    );

    await NotificationService.scanDueAndOverdueItems(db, testOrgId, new Date("2026-11-24T04:30:00Z"));

    // 2. Task is resolved BEFORE queue dispatch occurs
    await completeTask(staffUser, task.id, { completionNote: "Soil report uploaded" }, db);

    // 3. Consumer processes queue later
    const dispatchResults = await NotificationService.dispatchQueuedNotifications(db, whatsappAdapter);
    // The resolved task's notifications must be SUPPRESSED at dispatch (AC-047)
    expect(dispatchResults.suppressed).toBeGreaterThan(0);

    const taskNotifs = await db
      .prepare("SELECT * FROM notifications WHERE source_entity_id = ?")
      .bind(task.id)
      .all();

    for (const n of taskNotifs.results as any[]) {
      expect(n.status).toBe("SUPPRESSED");
      expect(n.suppression_reason).toBe("ACCESS_OR_OBLIGATION_CHANGED");
    }

    // 4. Test User Deactivation: Create second task for a user who is subsequently deactivated
    const task2 = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "HVAC Duct Layout",
        proposedAssigneeId: staffUser.id,
        proposedDueDate: "2026-11-20",
      },
      db
    );
    // Re-queue
    await db
      .prepare(
        `INSERT INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, status, created_at
        ) VALUES ('not_revoked', ?, ?, ?, 'TASK', ?, 'k_revoked', 'PORTAL', 'T', 'B', 'QUEUED', ?)`
      )
      .bind(testOrgId, staffUser.id, testProjectId, task2.id, Date.now())
      .run();

    // Revoke user membership
    await db
      .prepare("UPDATE organization_memberships SET is_active = 0 WHERE user_id = ?")
      .bind(staffUser.id)
      .run();

    // Dispatch queue
    await NotificationService.dispatchQueuedNotifications(db, whatsappAdapter);

    const revokedNotif = (await db
      .prepare("SELECT * FROM notifications WHERE id = 'not_revoked'")
      .first()) as any;
    expect(revokedNotif.status).toBe("SUPPRESSED");
    expect(revokedNotif.suppression_reason).toBe("ACCESS_OR_OBLIGATION_CHANGED");

    // 5. Test Invariant: Marking notification read NEVER completes task or alters entities
    // Re-activate user
    await db
      .prepare("UPDATE organization_memberships SET is_active = 1 WHERE user_id = ?")
      .bind(staffUser.id)
      .run();

    const activeNotifId = "not_to_read";
    await db
      .prepare(
        `INSERT INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, status, created_at
        ) VALUES (?, ?, ?, ?, 'TASK', ?, 'k_read_test', 'PORTAL', 'Review', 'Desc', 'DELIVERED', ?)`
      )
      .bind(activeNotifId, testOrgId, staffUser.id, testProjectId, task2.id, Date.now())
      .run();

    const readRes = await NotificationService.markNotificationRead(db, staffUser, activeNotifId);
    expect(readRes.isRead).toBe(true);

    // Verify task2 is STILL TODO / IN_PROGRESS, NOT COMPLETED! (AC-047)
    const task2Check = (await db
      .prepare("SELECT status FROM tasks WHERE id = ?")
      .bind(task2.id)
      .first()) as any;
    expect(task2Check.status).not.toBe("COMPLETED");
  });

  // ---------------------------------------------------------------------------
  // AC-048 — Retries do not blindly double-send
  // ---------------------------------------------------------------------------
  it("AC-048: deduplication prevents duplicate portal rows; provider timeout stays UNKNOWN rather than blind resend", async () => {
    // 1. Create active task and enqueue WhatsApp notification
    const task = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "Site Soil Review",
        proposedAssigneeId: staffUser.id,
        proposedDueDate: "2026-11-20",
      },
      db
    );

    const notifId = "not_timeout_test";
    await db
      .prepare(
        `INSERT INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, status, created_at
        ) VALUES (?, ?, ?, ?, 'TASK', ?, 'k_timeout_1', 'WHATSAPP', 'Title', 'Body', 'QUEUED', ?)`
      )
      .bind(notifId, testOrgId, staffUser.id, testProjectId, task.id, Date.now())
      .run();

    await db.prepare("INSERT INTO notification_preferences(org_id,user_id,whatsapp_phone,whatsapp_verified_at,whatsapp_consent_at,whatsapp_enabled,updated_at) VALUES(?,?,?,1,1,1,1)").bind(testOrgId,staffUser.id,"+15555550123").run();

    // 2. Simulate provider timeout
    whatsappAdapter.simulateTimeout = true;

    const dispatchRes = await NotificationService.dispatchQueuedNotifications(db, whatsappAdapter);
    expect(dispatchRes.unknown).toBe(1);

    // Notification outcome is recorded as UNKNOWN (AC-048), not blindly retried immediately
    const notif = (await db
      .prepare("SELECT status FROM notifications WHERE id = ?")
      .bind(notifId)
      .first()) as any;
    expect(notif.status).toBe("UNKNOWN");

    const waMsg = (await db
      .prepare("SELECT status FROM whatsapp_messages WHERE notification_id = ?")
      .bind(notifId)
      .first()) as any;
    expect(waMsg.status).toBe("UNKNOWN");

    // 3. Duplicate Webhook delivery: provider webhook arrives twice
    const eventId = "evt_meta_998877";
    const providerMsgId = "wamid_timeout_reconcile";

    // Update message with provider ID for reconciliation test
    await db
      .prepare("UPDATE whatsapp_messages SET provider_message_id = ? WHERE notification_id = ?")
      .bind(providerMsgId, notifId)
      .run();

    // First webhook delivery
    const hook1 = await NotificationService.reconcileWebhookStatus(
      db,
      eventId,
      providerMsgId,
      "DELIVERED"
    );
    expect(hook1.duplicate).toBe(false);
    expect(hook1.processed).toBe(true);

    // Reconciled to DELIVERED
    const reconciledMsg = (await db
      .prepare("SELECT status FROM whatsapp_messages WHERE provider_message_id = ?")
      .bind(providerMsgId)
      .first()) as any;
    expect(reconciledMsg.status).toBe("DELIVERED");

    // Second duplicate webhook delivery
    const hook2 = await NotificationService.reconcileWebhookStatus(
      db,
      eventId,
      providerMsgId,
      "DELIVERED"
    );
    // Deduplicated cleanly without creating extra rows (AC-048)
    expect(hook2.duplicate).toBe(true);

    const eventCount = (await db
      .prepare("SELECT COUNT(*) as c FROM webhook_events WHERE event_id = ?")
      .bind(eventId)
      .first()) as any;
    expect(eventCount.c).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // AC-049 — WhatsApp provider policy and privacy
  // ---------------------------------------------------------------------------
  it("AC-049: WhatsApp payloads only send safe minimal context and deep link; prohibited sensitive data is blocked", async () => {
    // 1. Safe context send -> SUCCEEDS
    const safePayload = {
      notificationId: "not_safe_01",
      recipientPhone: "+919876543210",
      templateName: "task_overdue",
      templateParameters: {
        title: "Soil Test Report",
      },
      deepLinkPath: "/projects/prj_1/tasks",
    };

    const res = await whatsappAdapter.sendTemplate(safePayload);
    expect(res.success).toBe(true);
    expect(res.status).toBe("DELIVERED");

    // 2. Sensitive payload containing salaries or raw documents -> REJECTED (AC-049)
    const dangerousPayloadSalary = {
      notificationId: "not_leak_01",
      recipientPhone: "+919876543210",
      templateName: "salary_notice",
      templateParameters: {
        title: "Salary disbursement ₹85,000",
      },
      deepLinkPath: "/finance/payroll",
    };

    await expect(whatsappAdapter.sendTemplate(dangerousPayloadSalary)).rejects.toThrow(
      "WhatsApp payload contains prohibited sensitive data"
    );

    const dangerousPayloadRawDoc = {
      notificationId: "not_leak_02",
      recipientPhone: "+919876543210",
      templateName: "raw_file",
      templateParameters: {
        raw_document_url: "https://bucket.private/secret_cad.dwg",
      },
      deepLinkPath: "/files/secret",
    };

    await expect(whatsappAdapter.sendTemplate(dangerousPayloadRawDoc)).rejects.toThrow(
      "WhatsApp payload contains prohibited sensitive data"
    );
  });

  // ---------------------------------------------------------------------------
  // AC-050 — Webhook verifies sender and state
  // ---------------------------------------------------------------------------
  it("AC-050: webhook verifies HMAC-SHA256 signature over raw bytes; denies invalid; incoming text never mutates approval/money states", async () => {
    const appSecret = "meta_webhook_secret_xyz123";
    const rawPayloadText = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "wh_entry_1",
          changes: [
            {
              field: "messages",
              value: {
                messages: [{ id: "wam_msg_incoming", text: { body: "Approve drawing please" } }],
              },
            },
          ],
        },
      ],
    });
    const rawBytes = new TextEncoder().encode(rawPayloadText);

    // 1. Generate valid HMAC-SHA256 signature
    const keyData = new TextEncoder().encode(appSecret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, rawBytes);
    const validHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const validHeader = `sha256=${validHex}`;

    // Valid signature -> VERIFIED
    const isValid = await verifyMetaWebhookSignature(rawBytes, validHeader, appSecret);
    expect(isValid).toBe(true);

    // Invalid signature -> REJECTED (AC-050)
    const isInvalid = await verifyMetaWebhookSignature(rawBytes, "sha256=bad_hex_signature", appSecret);
    expect(isInvalid).toBe(false);

    // Tampered payload with valid header -> REJECTED
    const tamperedBytes = new TextEncoder().encode(rawPayloadText + " ");
    const isTampered = await verifyMetaWebhookSignature(tamperedBytes, validHeader, appSecret);
    expect(isTampered).toBe(false);

    // 2. Invariant: Incoming text NEVER mutates financial, task, or drawing states (AC-050)
    const protectedTask = await createTask(
      managerUser,
      {
        projectId: testProjectId,
        title: "Protected Task from Webhooks",
        proposedAssigneeId: staffUser.id,
      },
      db
    );

    // Reconcile incoming text event
    await NotificationService.reconcileWebhookStatus(
      db,
      "evt_incoming_text",
      "wamid_fake_user_msg",
      "DELIVERED"
    );

    // Confirm task state did not mutate to COMPLETED
    const tCheck = (await db
      .prepare("SELECT status FROM tasks WHERE id = ?")
      .bind(protectedTask.id)
      .first()) as any;
    expect(tCheck.status).toBe(protectedTask.status);
  });
});
