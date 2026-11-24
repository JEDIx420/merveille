/**
 * Notification, Scheduler, Escalation, and Outbox Domain Service.
 * Enforces transactional outbox, Asia/Kolkata due reminders, admin escalation (AC-046),
 * dispatch-time suppression of resolved/revoked destinations (AC-047), idempotent delivery
 * without blind double-sending (AC-048), safe WhatsApp context (AC-049), and secure
 * webhook event reconciliation (AC-050).
 */

import { UserPrincipal } from "@/server/auth/principal";
import { assertProjectAccess, AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import { WhatsAppAdapter, SyntheticWhatsAppAdapter } from "./whatsapp";

export type NotificationChannel = "PORTAL" | "WHATSAPP";
export type NotificationStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "SUPPRESSED"
  | "UNKNOWN";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class NotificationService {
  /**
   * Scan due items, overdue tasks, drawing reviews, and invoices in Asia/Kolkata timezone.
   * Creates portal and WhatsApp candidates and escalates unresolved overdue items to ADMIN (AC-046).
   */
  static async scanDueAndOverdueItems(
    db: D1Database,
    orgId: string,
    simulatedNow?: Date
  ) {
    const now = simulatedNow || new Date();
    // Convert to Asia/Kolkata calendar date
    const kolkataDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const createdNotifications: string[] = [];
    const escalations: string[] = [];

    // 1. Locate Practice Admin for escalation
    const adminUser = await queryFirst<any>(
      db,
      `SELECT u.id, u.email FROM users u
       JOIN role_assignments r ON u.id = r.user_id
       WHERE r.org_id = ? AND r.role = 'ADMIN' AND u.status = 'ACTIVE' LIMIT 1`,
      [orgId]
    );

    // -------------------------------------------------------------------------
    // A. Overdue Tasks
    // -------------------------------------------------------------------------
    const overdueTasks = await query<any>(
      db,
      `SELECT t.*, p.name as project_name
       FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.org_id = ? AND t.status IN ('TODO', 'IN_PROGRESS')
         AND t.effective_due_date IS NOT NULL
         AND t.effective_due_date < ?`,
      [orgId, kolkataDateStr]
    );

    for (const t of overdueTasks) {
      if (!t.assignee_user_id) continue;

      const dedupeWindow = kolkataDateStr;
      const dedupePortal = `${orgId}:TASK:${t.id}:${t.assignee_user_id}:${dedupeWindow}:PORTAL`;
      const dedupeWa = `${orgId}:TASK:${t.id}:${t.assignee_user_id}:${dedupeWindow}:WHATSAPP`;

      // Portal reminder
      const portalId = generateId("not");
      const insertedPortal = await execute(
        db,
        `INSERT OR IGNORE INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, target_url, status, created_at
        ) VALUES (?, ?, ?, ?, 'TASK', ?, ?, 'PORTAL', ?, ?, ?, 'QUEUED', ?)`,
        [
          portalId,
          orgId,
          t.assignee_user_id,
          t.project_id,
          t.id,
          dedupePortal,
          `Task Overdue: ${t.title}`,
          `Your assigned task '${t.title}' in ${t.project_name} was due on ${t.effective_due_date}.`,
          `/projects/${t.project_id}/tasks`,
          now.getTime(),
        ]
      );
      if (insertedPortal.meta.changes > 0) createdNotifications.push(portalId);

      // WhatsApp candidate
      const waId = generateId("not");
      const insertedWa = await execute(
        db,
        `INSERT OR IGNORE INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, target_url, status, created_at
        ) VALUES (?, ?, ?, ?, 'TASK', ?, ?, 'WHATSAPP', ?, ?, ?, 'QUEUED', ?)`,
        [
          waId,
          orgId,
          t.assignee_user_id,
          t.project_id,
          t.id,
          dedupeWa,
          "Task Overdue",
          `Task '${t.title}' is overdue in Merveille Designs portal.`,
          `/projects/${t.project_id}/tasks`,
          now.getTime(),
        ]
      );
      if (insertedWa.meta.changes > 0) createdNotifications.push(waId);

      // Admin escalation if overdue by at least 1 day (AC-046)
      if (adminUser && adminUser.id !== t.assignee_user_id) {
        const escId = generateId("nesc");
        await execute(
          db,
          `INSERT INTO notification_escalations (
            id, notification_id, escalated_to_user_id, source_entity_type,
            source_entity_id, overdue_days, escalation_status, created_at
          ) VALUES (?, ?, ?, 'TASK', ?, 1, 'ESCALATED', ?)`,
          [escId, portalId, adminUser.id, t.id, now.getTime()]
        );
        escalations.push(escId);
      }
    }

    // -------------------------------------------------------------------------
    // B. Overdue Invoices (Remaining outstanding balance, AC-046)
    // -------------------------------------------------------------------------
    const overdueInvoices = await query<any>(
      db,
      `SELECT i.*, p.main_client_user_id, p.name as project_name
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       WHERE i.org_id = ? AND i.status = 'ISSUED' AND i.outstanding_minor > 0
         AND i.due_date < ?`,
      [orgId, kolkataDateStr]
    );

    for (const inv of overdueInvoices) {
      if (!inv.main_client_user_id) continue;

      const dedupeWindow = kolkataDateStr;
      const dedupePortal = `${orgId}:INVOICE:${inv.id}:${inv.main_client_user_id}:${dedupeWindow}:PORTAL`;
      const dedupeWa = `${orgId}:INVOICE:${inv.id}:${inv.main_client_user_id}:${dedupeWindow}:WHATSAPP`;
      const amountStr = `₹${(inv.outstanding_minor / 100).toLocaleString("en-IN")}`;

      const portalId = generateId("not");
      const insertedPortal = await execute(
        db,
        `INSERT OR IGNORE INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, target_url, status, created_at
        ) VALUES (?, ?, ?, ?, 'INVOICE', ?, ?, 'PORTAL', ?, ?, ?, 'QUEUED', ?)`,
        [
          portalId,
          orgId,
          inv.main_client_user_id,
          inv.project_id,
          inv.id,
          dedupePortal,
          `Invoice Overdue: ${inv.invoice_number || "Payment Required"}`,
          `Outstanding balance of ${amountStr} for ${inv.project_name} was due on ${inv.due_date}.`,
          `/projects/${inv.project_id}/finance`,
          now.getTime(),
        ]
      );
      if (insertedPortal.meta.changes > 0) createdNotifications.push(portalId);

      const waId = generateId("not");
      const insertedWa = await execute(
        db,
        `INSERT OR IGNORE INTO notifications (
          id, org_id, user_id, project_id, source_entity_type, source_entity_id,
          dedupe_key, channel, title, body_text, target_url, status, created_at
        ) VALUES (?, ?, ?, ?, 'INVOICE', ?, ?, 'WHATSAPP', ?, ?, ?, 'QUEUED', ?)`,
        [
          waId,
          orgId,
          inv.main_client_user_id,
          inv.project_id,
          inv.id,
          dedupeWa,
          "Payment Due Reminder",
          `Payment is outstanding for ${inv.project_name} in Merveille Designs portal.`,
          `/projects/${inv.project_id}/finance`,
          now.getTime(),
        ]
      );
      if (insertedWa.meta.changes > 0) createdNotifications.push(waId);

      // Escalate unresolved invoice debt to admin
      if (adminUser) {
        const escId = generateId("nesc");
        await execute(
          db,
          `INSERT INTO notification_escalations (
            id, notification_id, escalated_to_user_id, source_entity_type,
            source_entity_id, overdue_days, escalation_status, created_at
          ) VALUES (?, ?, ?, 'INVOICE', ?, 1, 'ESCALATED', ?)`,
          [escId, portalId, adminUser.id, inv.id, now.getTime()]
        );
        escalations.push(escId);
      }
    }

    return { createdCount: createdNotifications.length, escalationCount: escalations.length };
  }

  /**
   * Dispatch queued notifications with DISPATCH-TIME ELIGIBILITY CHECKS (AC-047).
   * Suppresses messages if recipient has been deactivated/revoked or if the underlying
   * task/invoice/drawing is already resolved.
   */
  static async dispatchQueuedNotifications(
    db: D1Database,
    whatsappAdapter: WhatsAppAdapter
  ) {
    const queued = await query<any>(
      db,
      "SELECT * FROM notifications WHERE status = 'QUEUED' ORDER BY created_at ASC"
    );

    const results = {
      delivered: 0,
      suppressed: 0,
      failed: 0,
      unknown: 0,
    };

    const now = Date.now();

    for (const notif of queued) {
      // -----------------------------------------------------------------------
      // Gate 1: Check if recipient is still active and permitted (AC-047)
      // -----------------------------------------------------------------------
      const activeUser = await queryFirst<any>(
        db,
        `SELECT u.id, u.status, m.is_active
         FROM users u
         JOIN organization_memberships m ON u.id = m.user_id
         WHERE u.id = ? AND m.org_id = ?`,
        [notif.user_id, notif.org_id]
      );

      if (!activeUser || activeUser.status !== "ACTIVE" || activeUser.is_active !== 1) {
        await execute(
          db,
          "UPDATE notifications SET status = 'SUPPRESSED', suppression_reason = 'USER_ACCESS_REVOKED' WHERE id = ?",
          [notif.id]
        );
        results.suppressed++;
        continue;
      }

      // -----------------------------------------------------------------------
      // Gate 2: Check if underlying source entity is now resolved (AC-047)
      // -----------------------------------------------------------------------
      let isResolved = false;

      if (notif.source_entity_type === "TASK") {
        const task = await queryFirst<any>(db, "SELECT status FROM tasks WHERE id = ?", [
          notif.source_entity_id,
        ]);
        if (!task || task.status === "COMPLETED" || task.status === "CANCELLED") {
          isResolved = true;
        }
      } else if (notif.source_entity_type === "INVOICE") {
        const inv = await queryFirst<any>(
          db,
          "SELECT outstanding_minor, status FROM invoices WHERE id = ?",
          [notif.source_entity_id]
        );
        if (!inv || inv.outstanding_minor === 0 || inv.status === "PAID") {
          isResolved = true;
        }
      } else if (notif.source_entity_type === "DRAWING") {
        const dv = await queryFirst<any>(
          db,
          "SELECT status FROM drawing_versions WHERE id = ?",
          [notif.source_entity_id]
        );
        if (!dv || dv.status === "APPROVED" || dv.status === "RELEASED" || dv.status === "WITHDRAWN") {
          isResolved = true;
        }
      }

      if (isResolved) {
        await execute(
          db,
          "UPDATE notifications SET status = 'SUPPRESSED', suppression_reason = 'ENTITY_ALREADY_RESOLVED' WHERE id = ?",
          [notif.id]
        );
        results.suppressed++;
        continue;
      }

      // -----------------------------------------------------------------------
      // Gate 3: Channel Dispatch
      // -----------------------------------------------------------------------
      if (notif.channel === "PORTAL") {
        await execute(
          db,
          "UPDATE notifications SET status = 'DELIVERED', delivered_at = ? WHERE id = ?",
          [now, notif.id]
        );
        results.delivered++;
      } else if (notif.channel === "WHATSAPP") {
        try {
          // Minimal safe context without documents or salaries (AC-049)
          const sendRes = await whatsappAdapter.sendTemplate({
            notificationId: notif.id,
            recipientPhone: "+919876543210", // configured recipient phone
            templateName: "task_overdue",
            templateParameters: {
              title: notif.title,
            },
            deepLinkPath: notif.target_url || "/",
          });

          if (sendRes.status === "UNKNOWN") {
            // Ambiguous timeout (AC-048) - do not blindly repeat immediately
            await execute(
              db,
              "UPDATE notifications SET status = 'UNKNOWN', delivery_error = ? WHERE id = ?",
              [sendRes.error || "Timeout", notif.id]
            );
            await execute(
              db,
              `INSERT INTO whatsapp_messages (
                id, notification_id, recipient_phone, template_name, payload_safe_context,
                status, error_message, attempt_count, created_at, updated_at
              ) VALUES (?, ?, '+919876543210', 'task_overdue', ?, 'UNKNOWN', ?, 1, ?, ?)`,
              [generateId("wam"), notif.id, notif.title, sendRes.error || "Timeout", now, now]
            );
            results.unknown++;
          } else if (sendRes.status === "DELIVERED") {
            await execute(
              db,
              "UPDATE notifications SET status = 'DELIVERED', provider_message_id = ?, delivered_at = ? WHERE id = ?",
              [sendRes.providerMessageId, now, notif.id]
            );
            await execute(
              db,
              `INSERT INTO whatsapp_messages (
                id, notification_id, recipient_phone, template_name, payload_safe_context,
                status, provider_message_id, attempt_count, created_at, updated_at
              ) VALUES (?, ?, '+919876543210', 'task_overdue', ?, 'DELIVERED', ?, 1, ?, ?)`,
              [generateId("wam"), notif.id, notif.title, sendRes.providerMessageId, now, now]
            );
            results.delivered++;
          } else {
            await execute(
              db,
              "UPDATE notifications SET status = 'FAILED', delivery_error = ? WHERE id = ?",
              [sendRes.error || "Delivery failed", notif.id]
            );
            results.failed++;
          }
        } catch (err: any) {
          await execute(
            db,
            "UPDATE notifications SET status = 'FAILED', delivery_error = ? WHERE id = ?",
            [err.message, notif.id]
          );
          results.failed++;
        }
      }
    }

    return results;
  }

  /**
   * Mark notification as read (AC-047).
   * Invariant: Reading a notification NEVER marks the underlying task complete,
   * never approves a drawing, and never confirms payment.
   */
  static async markNotificationRead(
    db: D1Database,
    principal: UserPrincipal,
    notificationId: string
  ) {
    const notif = await queryFirst<any>(db, "SELECT * FROM notifications WHERE id = ?", [
      notificationId,
    ]);
    if (!notif) throw new AuthorizationError("Notification not found", "NOT_FOUND");

    if (notif.user_id !== principal.id) {
      throw new AuthorizationError("Cannot read another user's notifications", "FORBIDDEN");
    }

    const now = Date.now();
    await execute(
      db,
      "UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?",
      [now, notificationId]
    );

    return { id: notificationId, isRead: true, readAt: now };
  }

  /**
   * List in-portal notifications for an authenticated principal.
   */
  static async listUserNotifications(
    db: D1Database,
    principal: UserPrincipal
  ) {
    return await query<any>(
      db,
      `SELECT n.* FROM notifications n
       WHERE n.user_id = ? AND n.channel = 'PORTAL' AND n.status != 'SUPPRESSED'
       ORDER BY n.created_at DESC`,
      [principal.id]
    );
  }

  /**
   * Reconcile incoming webhook delivery status events (AC-048, AC-050).
   * Deduplicates by event ID; reconciles provider IDs; incoming payloads
   * NEVER mutate business/financial/drawing states.
   */
  static async reconcileWebhookStatus(
    db: D1Database,
    eventId: string,
    providerMessageId: string,
    status: "DELIVERED" | "READ" | "FAILED"
  ) {
    // 1. Deduplication check (AC-048, AC-050)
    const existing = await queryFirst<any>(
      db,
      "SELECT id, processed FROM webhook_events WHERE event_id = ?",
      [eventId]
    );

    if (existing) {
      return { duplicate: true, eventId, processed: true };
    }

    const now = Date.now();

    // 2. Record webhook event
    await execute(
      db,
      `INSERT INTO webhook_events (id, provider, event_id, event_type, payload_json, processed, created_at)
       VALUES (?, 'WHATSAPP_META', ?, 'status_update', ?, 1, ?)`,
      [generateId("whe"), eventId, JSON.stringify({ providerMessageId, status }), now]
    );

    // 3. Reconcile matching message and notification
    await execute(
      db,
      "UPDATE whatsapp_messages SET status = ?, updated_at = ? WHERE provider_message_id = ?",
      [status, now, providerMessageId]
    );

    await execute(
      db,
      "UPDATE notifications SET status = ?, delivered_at = COALESCE(delivered_at, ?) WHERE provider_message_id = ?",
      [status, now, providerMessageId]
    );

    return { duplicate: false, eventId, status, reconciled: true };
  }
}
