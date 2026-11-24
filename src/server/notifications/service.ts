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
  projectId: string;
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
      projectId: string,
      userId: string,
      type: string,
      entityId: string,
      title: string,
      body: string,
      path: string,
      overdue: boolean,
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
          window: date,
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
      `SELECT t.* FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.org_id=? AND p.is_archived=0 AND t.status IN ('TODO','IN_PROGRESS','BLOCKED') AND t.effective_due_date<=?`,
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
      );
    const invoices = await query<any>(
      db,
      `SELECT i.*,p.main_client_user_id FROM invoices i JOIN projects p ON p.id=i.project_id WHERE i.org_id=? AND i.status='ISSUED' AND i.outstanding_minor>0 AND i.due_date<=?`,
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
    const reviews = await query<any>(
      db,
      `SELECT r.*,d.project_id,v.created_at FROM drawing_reviews r JOIN drawing_versions v ON v.id=r.version_id JOIN drawings d ON d.id=v.drawing_id JOIN projects p ON p.id=d.project_id WHERE d.org_id=? AND p.is_archived=0 AND r.status='PENDING' AND v.status='IN_REVIEW'`,
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
    let createdCount = 0,
      escalationCount = 0;
    for (const c of candidates)
      for (const channel of c.escalation
        ? ["PORTAL"]
        : ["PORTAL", "WHATSAPP"]) {
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
    return { createdCount, escalationCount };
  }
  static async eligible(db: D1Database, n: any) {
    const user = await queryFirst<any>(
      db,
      `SELECT u.id FROM users u JOIN organization_memberships m ON m.user_id=u.id WHERE u.id=? AND u.status='ACTIVE' AND m.org_id=? AND m.is_active=1`,
      [n.user_id, n.org_id],
    );
    if (!user) return false;
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
