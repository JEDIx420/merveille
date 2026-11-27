import type { UserPrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/principal";
import { AuthorizationError } from "@/server/auth/policy";
import { query, queryFirst, execute } from "@/server/db";
import type { WhatsAppAdapter } from "./whatsapp";
export type NotificationChannel = "PORTAL" | "WHATSAPP";
export type NotificationStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "SUPPRESSED"
  | "UNKNOWN"
  | "UNAVAILABLE"
  | "PROCESSING";
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
interface Candidate {
  orgId: string;
  projectId: string | null;
  userId: string;
  type: string;
  entityId: string;
  title: string;
  body: string;
  path: string;
  window: string;
  escalation?: boolean;
}
export class NotificationService {
  /** Scan results are durable logical obligations. Queue redelivery never creates another row. */
  static async scanDueAndOverdueItems(
    db: D1Database,
    orgId: string,
    simulatedNow?: Date,
  ) {
    const now = simulatedNow || new Date();
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const admins = await query<{ id: string }>(
      db,
      `SELECT DISTINCT u.id FROM users u JOIN organization_memberships om ON om.user_id=u.id AND om.is_active=1 JOIN role_assignments r ON r.user_id=u.id AND r.org_id=om.org_id WHERE om.org_id=? AND u.status='ACTIVE' AND r.role='ADMIN' AND r.revoked_at IS NULL`,
      [orgId],
    );
    const candidates: Candidate[] = [];
    const add = (
      projectId: string | null,
      userId: string,
      type: string,
      entityId: string,
      title: string,
      body: string,
      path: string,
      overdue: boolean,
      windowOverride?: string,
    ) => {
      if (userId)
        candidates.push({
          orgId,
          projectId,
          userId,
          type,
          entityId,
          title,
          body,
          path,
          window: windowOverride || date,
        });
      if (overdue)
        for (const admin of admins)
          if (admin.id !== userId)
            candidates.push({
              orgId,
              projectId,
              userId: admin.id,
              type,
              entityId,
              title: "Overdue work needs attention",
              body: "An unresolved item requires administrative follow-up.",
              path,
              window: date,
              escalation: true,
            });
    };
    const tasks = await query<any>(
      db,
      `SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.org_id=? AND p.is_archived=0 AND t.status IN ('TODO','IN_PROGRESS','BLOCKED') AND t.effective_due_date<=? LIMIT 100`,
      [orgId, date],
    );
    for (const t of tasks)
      add(
        t.project_id,
        t.assignee_user_id,
        "TASK",
        t.id,
        t.effective_due_date < date ? "Task overdue" : "Task due today",
        `Review your assigned task: ${t.title}`,
        `/projects/${t.project_id}/tasks`,
        t.effective_due_date < date,
        `${date}:${t.effective_due_date}`,
      );

    // Skip new invoice/payment reminders when organization is in EXTERNAL billing mode (N04)
    const orgModeRow = await queryFirst<{ commercial_mode?: string }>(
      db,
      `SELECT commercial_mode FROM organizations WHERE id=?`,
      [orgId],
    );
    if (orgModeRow?.commercial_mode !== "EXTERNAL") {
      const invoices = await query<any>(
        db,
        `SELECT i.*,p.main_client_user_id FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.org_id=? AND i.status='ISSUED' AND i.outstanding_minor>0 AND i.due_date<=? LIMIT 100`,
        [orgId, date],
      );
      for (const i of invoices)
        add(
          i.project_id,
          i.main_client_user_id,
          "INVOICE",
          i.id,
          i.due_date < date ? "Payment overdue" : "Payment due today",
          "Review the outstanding payment in your project.",
          `/projects/${i.project_id}/finance`,
          i.due_date < date,
        );
    }

    const reviews = await query<any>(
      db,
      `SELECT r.*,d.project_id,v.created_at FROM drawing_reviews r JOIN drawing_versions v ON v.id=r.version_id JOIN drawings d ON d.id=v.drawing_id JOIN projects p ON p.id=d.project_id WHERE d.org_id=? AND p.is_archived=0 AND r.status='PENDING' AND v.status='IN_REVIEW' LIMIT 100`,
      [orgId],
    );
    for (const r of reviews)
      add(
        r.project_id,
        r.consultant_user_id,
        "DRAWING",
        r.version_id,
        "Drawing review requested",
        "Review the assigned drawing version in your project.",
        `/projects/${r.project_id}/drawings`,
        now.getTime() - r.created_at > 86400000,
      );

    // N04 Preset: Manager release waiting (all consultant reviews approved for version)
    const readyToRelease = await query<any>(
      db,
      `SELECT v.id as version_id, d.project_id, d.title, p.manager_user_id
       FROM drawing_versions v
       JOIN drawings d ON d.id=v.drawing_id
       JOIN projects p ON p.id=d.project_id
       WHERE d.org_id=? AND p.is_archived=0 AND v.status='CONSULTANT_APPROVED' AND p.manager_user_id IS NOT NULL
       LIMIT 100`,
      [orgId],
    );
    for (const rv of readyToRelease)
      add(
        rv.project_id,
        rv.manager_user_id,
        "DRAWING_RELEASE",
        rv.version_id,
        "Drawing ready for release",
        `Consultant approvals complete for ${rv.title}.`,
        `/projects/${rv.project_id}/drawings`,
        false,
      );

    // N04 Preset: Lead follow-up due
    const leadFollowups = await query<any>(
      db,
      `SELECT f.*, e.contact_name FROM lead_followups f
       JOIN enquiries e ON e.id=f.enquiry_id
       WHERE f.org_id=? AND f.is_completed=0 AND f.due_date IS NOT NULL AND f.due_date<=?
         AND e.lead_stage NOT IN ('WON','LOST')
       LIMIT 100`,
      [orgId, date],
    );
    for (const lf of leadFollowups)
      add(
        null,
        lf.owner_user_id,
        "LEAD_FOLLOWUP",
        lf.id,
        lf.due_date < date ? `Lead follow-up overdue: ${lf.contact_name}` : `Lead follow-up due: ${lf.contact_name}`,
        lf.action_text,
        `/enquiries/${lf.enquiry_id}`,
        false,
        `${date}:v${lf.revision}`,
      );

    // N04 Preset: Lead needs attention (active lead with no open follow-up >= 3 days, held until 09:00-18:00 IST)
    const istHour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now),
    );
    if (istHour >= 9 && istHour < 18) {
      const threeDaysAgo = now.getTime() - 3 * 86400 * 1000;
      const staleLeads = await query<any>(
        db,
        `SELECT e.id, e.contact_name, e.lead_manager_id
         FROM enquiries e
         WHERE e.org_id=? AND e.lead_stage NOT IN ('WON','LOST')
           AND (e.snoozed_until IS NULL OR e.snoozed_until <= ?)
           AND e.created_at <= ?
           AND e.lead_manager_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM lead_followups f WHERE f.enquiry_id=e.id AND f.is_completed=0)
         LIMIT 100`,
        [orgId, now.getTime(), threeDaysAgo],
      );
      for (const sl of staleLeads)
        add(
          null,
          sl.lead_manager_id,
          "LEAD_NEEDS_ATTENTION",
          sl.id,
          `Lead needs attention: ${sl.contact_name}`,
          "No next action scheduled for 3+ days.",
          `/enquiries/${sl.id}`,
          false,
        );
    }

    let createdCount = 0,
      escalationCount = 0;
    for (const c of candidates) {
      // Respect user snoozes without altering underlying deadline
      const snoozed = await queryFirst<any>(
        db,
        `SELECT id FROM reminder_snoozes WHERE org_id=? AND user_id=? AND source_entity_type=? AND source_entity_id=? AND snoozed_until>?`,
        [orgId, c.userId, c.type, c.entityId, now.getTime()],
      );
      if (snoozed) continue;

      // Stage N04: Active generation is PORTAL only (WhatsApp is manual sharing)
      for (const channel of ["PORTAL"]) {
        const id = uid("not");
        const dedupe = [
          orgId,
          c.type,
          c.entityId,
          c.userId,
          c.window,
          channel,
          c.escalation ? "ESCALATION" : "REMINDER",
        ].join(":");
        const statements = [
          db
            .prepare(
              `INSERT OR IGNORE INTO notifications(id,org_id,user_id,project_id,source_entity_type,source_entity_id,dedupe_key,channel,title,body_text,target_url,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'QUEUED',?)`,
            )
            .bind(
              id,
              orgId,
              c.userId,
              c.projectId,
              c.type,
              c.entityId,
              dedupe,
              channel,
              c.title,
              c.body,
              c.path,
              now.getTime(),
            ),
          db
            .prepare(
              `INSERT OR IGNORE INTO outbox_events(id,org_id,event_type,entity_type,entity_id,payload_json,status,created_at) SELECT ?,?,'NOTIFICATION_READY','NOTIFICATION',id,'{}','PENDING',? FROM notifications WHERE id=?`,
            )
            .bind(`out_${id}`, orgId, now.getTime(), id),
        ];
        if (c.escalation)
          statements.push(
            db
              .prepare(
                `INSERT INTO notification_escalations(id,notification_id,escalated_to_user_id,source_entity_type,source_entity_id,overdue_days,escalation_status,created_at) SELECT ?,id,?,?,?,1,'ESCALATED',? FROM notifications WHERE id=?`,
              )
              .bind(
                uid("esc"),
                c.userId,
                c.type,
                c.entityId,
                now.getTime(),
                id,
              ),
          );
        const result = await db.batch(statements);
        if (result[0].meta.changes) {
          createdCount++;
          if (c.escalation) escalationCount++;
        }
      }
    }
    return { createdCount, escalationCount };
  }
  static async snoozeReminder(
    db: D1Database,
    actor: UserPrincipal,
    input: { sourceEntityType: string; sourceEntityId: string; snoozedUntilMs: number },
  ) {
    if (!Number.isFinite(input.snoozedUntilMs) || input.snoozedUntilMs <= Date.now()) {
      throw new AuthorizationError("Snooze timestamp must be in the future.", "INVALID_INPUT");
    }
    const id = uid("snz");
    await db
      .prepare(
        `INSERT INTO reminder_snoozes (id, org_id, user_id, source_entity_type, source_entity_id, snoozed_until, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(org_id, user_id, source_entity_type, source_entity_id) DO UPDATE SET
           snoozed_until = excluded.snoozed_until`,
      )
      .bind(id, actor.orgId, actor.id, input.sourceEntityType, input.sourceEntityId, input.snoozedUntilMs, Date.now())
      .run();
    return { id, snoozedUntil: input.snoozedUntilMs };
  }
  static async eligible(db: D1Database, n: any) {
    const user = await queryFirst<any>(
      db,
      `SELECT u.id FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=? AND u.status='ACTIVE' AND m.org_id=? AND m.is_active=1`,
      [n.user_id, n.org_id],
    );
    if (!user) return false;
    if (n.source_entity_type === "LEAD_FOLLOWUP") {
      const f = await queryFirst<any>(
        db,
        `SELECT f.is_completed, f.owner_user_id, e.lead_stage FROM lead_followups f JOIN enquiries e ON e.id=f.enquiry_id WHERE f.id=? AND f.org_id=?`,
        [n.source_entity_id, n.org_id],
      );
      return !!f && f.is_completed === 0 && f.owner_user_id === n.user_id && !["WON", "LOST"].includes(f.lead_stage);
    }
    if (n.source_entity_type === "LEAD_NEEDS_ATTENTION") {
      const e = await queryFirst<any>(
        db,
        `SELECT lead_stage, lead_manager_id FROM enquiries WHERE id=? AND org_id=?`,
        [n.source_entity_id, n.org_id],
      );
      return !!e && e.lead_manager_id === n.user_id && !["WON", "LOST"].includes(e.lead_stage);
    }
    const admin = await queryFirst<any>(
      db,
      `SELECT id FROM role_assignments WHERE user_id=? AND org_id=? AND role='ADMIN' AND revoked_at IS NULL`,
      [n.user_id, n.org_id],
    );
    const mem = await queryFirst<any>(
      db,
      `SELECT id,project_role FROM project_memberships WHERE user_id=? AND org_id=? AND project_id=? AND is_active=1`,
      [n.user_id, n.org_id, n.project_id],
    );
    if (!mem && !admin) return false;
    const project = await queryFirst<any>(
      db,
      `SELECT is_archived FROM projects WHERE id=? AND org_id=?`,
      [n.project_id, n.org_id],
    );
    if (!project) return false;
    if (project.is_archived && n.source_entity_type !== "INVOICE") return false;
    if (n.source_entity_type === "TASK") {
      const t = await queryFirst<any>(
        db,
        `SELECT status,assignee_user_id FROM tasks WHERE id=? AND project_id=?`,
        [n.source_entity_id, n.project_id],
      );
      return (
        !!t &&
        !["COMPLETED", "CANCELLED"].includes(t.status) &&
        ((t.assignee_user_id === n.user_id &&
          ["MANAGER", "TEAM_MEMBER", "STAFF"].includes(mem?.project_role)) ||
          !!admin)
      );
    }
    if (n.source_entity_type === "INVOICE") {
      const i = await queryFirst<any>(
        db,
        `SELECT i.status,i.outstanding_minor,p.main_client_user_id FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.id=? AND i.project_id=?`,
        [n.source_entity_id, n.project_id],
      );
      return (
        !!i &&
        i.status === "ISSUED" &&
        i.outstanding_minor > 0 &&
        ((i.main_client_user_id === n.user_id &&
          mem?.project_role === "MAIN_CLIENT") ||
          !!admin)
      );
    }
    if (n.source_entity_type === "DRAWING") {
      const r = await queryFirst<any>(
        db,
        `SELECT v.status,r.status AS review_status FROM drawing_versions v JOIN drawings d ON d.id=v.drawing_id LEFT JOIN drawing_reviews r ON r.version_id=v.id AND r.consultant_user_id=? WHERE v.id=? AND d.project_id=?`,
        [n.user_id, n.source_entity_id, n.project_id],
      );
      return (
        !!r &&
        r.status === "IN_REVIEW" &&
        ((r.review_status === "PENDING" &&
          mem?.project_role === "CONSULTANT") ||
          !!admin)
      );
    }
    return false;
  }
  static async dispatchQueuedNotifications(
    db: D1Database,
    adapter: WhatsAppAdapter,
    notificationId?: string,
  ) {
    const now = Date.now();
    // A crashed in-flight provider call has an uncertain outcome; never blindly send it again.
    await execute(
      db,
      `UPDATE notifications SET status='UNKNOWN',delivery_error='Interrupted delivery requires provider reconciliation.' WHERE status='PROCESSING' AND claimed_at<?`,
      [now - 600000],
    );
    const rows = await query<any>(
      db,
      `SELECT * FROM notifications WHERE (status='QUEUED' OR (status='FAILED' AND next_attempt_at IS NOT NULL)) AND attempt_count<5 AND (next_attempt_at IS NULL OR next_attempt_at<=?) ${notificationId ? "AND id=?" : ""} ORDER BY created_at LIMIT 100`,
      notificationId ? [now, notificationId] : [now],
    );
    const results = {
      delivered: 0,
      suppressed: 0,
      failed: 0,
      unknown: 0,
      sent: 0,
      unavailable: 0,
    };
    for (const n of rows) {
      const token = uid("claim");
      const claim = await execute(
        db,
        `UPDATE notifications SET status='PROCESSING',claim_token=?,claimed_at=? WHERE id=? AND (status='QUEUED' OR (status='FAILED' AND next_attempt_at IS NOT NULL)) AND attempt_count<5 AND (next_attempt_at IS NULL OR next_attempt_at<=?)`,
        [token, now, n.id, now],
      );
      if (!claim.meta.changes) continue;
      if (!(await this.eligible(db, n))) {
        await execute(
          db,
          `UPDATE notifications SET status='SUPPRESSED',suppression_reason='ACCESS_OR_OBLIGATION_CHANGED',claim_token=NULL WHERE id=? AND claim_token=?`,
          [n.id, token],
        );
        results.suppressed++;
        continue;
      }
      if (n.channel === "PORTAL") {
        await execute(
          db,
          `UPDATE notifications SET status='DELIVERED',delivered_at=?,claim_token=NULL WHERE id=? AND claim_token=?`,
          [now, n.id, token],
        );
        results.delivered++;
        continue;
      }
      const pref = await queryFirst<any>(
        db,
        `SELECT * FROM notification_preferences WHERE org_id=? AND user_id=? AND whatsapp_enabled=1 AND whatsapp_verified_at IS NOT NULL AND whatsapp_consent_at IS NOT NULL`,
        [n.org_id, n.user_id],
      );
      if (!pref?.whatsapp_phone) {
        await execute(
          db,
          `UPDATE notifications SET status='UNAVAILABLE',delivery_error='A verified destination and consent are required.',claim_token=NULL WHERE id=? AND claim_token=?`,
          [n.id, token],
        );
        results.unavailable++;
        continue;
      }
      const template =
        n.source_entity_type === "TASK"
          ? "task_due"
          : n.source_entity_type === "DRAWING"
            ? "drawing_review_due"
            : "payment_due";
      let res;
      try {
        res = await adapter.sendTemplate({
          notificationId: n.id,
          recipientPhone: pref.whatsapp_phone,
          templateName: template,
          templateParameters: {
            context: "An action is waiting in Merveille Designs.",
          },
          deepLinkPath: n.target_url || "/waiting",
        });
      } catch {
        res = {
          success: false,
          status: "UNKNOWN" as const,
          error: "Delivery outcome is uncertain.",
        };
      }
      const retry =
        res.status === "FAILED" && res.retryable && n.attempt_count + 1 < 5;
      const next = retry
        ? now + Math.min(3600000, 30000 * 2 ** n.attempt_count)
        : null;
      await db.batch([
        db
          .prepare(
            `UPDATE notifications SET status=?,provider_message_id=?,delivery_error=?,attempt_count=attempt_count+1,next_attempt_at=?,claim_token=NULL WHERE id=? AND claim_token=?`,
          )
          .bind(
            res.status,
            res.providerMessageId || null,
            res.error || null,
            next,
            n.id,
            token,
          ),
        db
          .prepare(
            `INSERT INTO whatsapp_messages(id,notification_id,recipient_phone,template_name,payload_safe_context,status,provider_message_id,error_message,attempt_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            uid("wam"),
            n.id,
            pref.whatsapp_phone,
            template,
            "Portal action reminder",
            res.status,
            res.providerMessageId || null,
            res.error || null,
            n.attempt_count + 1,
            now,
            now,
          ),
      ]);
      if (res.status === "DELIVERED") results.delivered++;
      else if (res.status === "SENT") results.sent++;
      else if (res.status === "UNKNOWN") results.unknown++;
      else if (res.status === "UNAVAILABLE") results.unavailable++;
      else results.failed++;
    }
    return results;
  }
  static async markNotificationRead(
    db: D1Database,
    p: UserPrincipal,
    id: string,
  ) {
    const n = await queryFirst<any>(
      db,
      "SELECT * FROM notifications WHERE id=? AND user_id=? AND org_id=?",
      [id, p.id, p.orgId],
    );
    if (!n || !(await this.eligible(db, n)))
      throw new AuthorizationError("Notification is no longer available.");
    const now = Date.now();
    await execute(
      db,
      "UPDATE notifications SET is_read=1,read_at=? WHERE id=?",
      [now, id],
    );
    return { id, isRead: true, readAt: now };
  }
  static async listUserNotifications(db: D1Database, p: UserPrincipal) {
    const rows = await query<any>(
      db,
      `SELECT * FROM notifications WHERE user_id=? AND org_id=? AND channel='PORTAL' AND status!='SUPPRESSED' ORDER BY created_at DESC LIMIT 100`,
      [p.id, p.orgId],
    );
    const permitted = [];
    for (const n of rows) if (await this.eligible(db, n)) permitted.push(n);
    return permitted;
  }
  static async reconcileWebhookStatus(
    db: D1Database,
    eventId: string,
    providerMessageId: string,
    status: "SENT" | "DELIVERED" | "READ" | "FAILED",
  ) {
    // CASE ordering makes delayed status webhooks monotonic; duplicate insertion gates effects.
    const rank = `CASE status WHEN 'READ' THEN 3 WHEN 'DELIVERED' THEN 2 WHEN 'SENT' THEN 1 ELSE 0 END`;
    const incoming = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 0 }[status];
    const marker = uid("whe");
    const now = Date.now();
    const results = await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO webhook_events(id,provider,event_id,event_type,payload_json,processed,created_at) VALUES(?,'WHATSAPP_META',?,'status_update',?,1,?)`,
        )
        .bind(
          marker,
          eventId,
          JSON.stringify({ providerMessageId, status }),
          now,
        ),
      db
        .prepare(
          `UPDATE whatsapp_messages SET status=?,updated_at=? WHERE provider_message_id=? AND ${rank}<=? AND EXISTS(SELECT 1 FROM webhook_events WHERE id=?)`,
        )
        .bind(status, now, providerMessageId, incoming, marker),
      db
        .prepare(
          `UPDATE notifications SET status=?,delivered_at=CASE WHEN ? IN ('DELIVERED','READ') THEN COALESCE(delivered_at,?) ELSE delivered_at END WHERE provider_message_id=? AND ${rank}<=? AND EXISTS(SELECT 1 FROM webhook_events WHERE id=?)`,
        )
        .bind(status, status, now, providerMessageId, incoming, marker),
    ]);
    return {
      duplicate: !results[0].meta.changes,
      eventId,
      status,
      processed: true,
    };
  }
  static async getPreferences(db: D1Database, p: UserPrincipal) {
    return queryFirst(
      db,
      `SELECT whatsapp_phone,whatsapp_enabled,whatsapp_verified_at,whatsapp_consent_at FROM notification_preferences WHERE org_id=? AND user_id=?`,
      [p.orgId, p.id],
    );
  }
  static async setPreferences(
    db: D1Database,
    p: UserPrincipal,
    enabled: boolean,
  ) {
    // Verification and consent are operator/provider-confirmed, never browser asserted.
    await execute(
      db,
      `UPDATE notification_preferences SET whatsapp_enabled=?,updated_at=? WHERE org_id=? AND user_id=? AND whatsapp_verified_at IS NOT NULL AND whatsapp_consent_at IS NOT NULL`,
      [enabled ? 1 : 0, Date.now(), p.orgId, p.id],
    );
    return this.getPreferences(db, p);
  }
}
