import { reconcileAccessAdmission } from "../../src/server/auth/admission";
import { NotificationService } from "../../src/server/notifications/service";
import {
  createWhatsAppAdapter,
  type WhatsAppSettings,
} from "../../src/server/notifications/whatsapp";
interface Env
  extends
    WhatsAppSettings,
    Pick<
      CloudflareEnv,
      | "ACCESS_ACCOUNT_ID"
      | "ACCESS_APP_ID"
      | "ACCESS_POLICY_ID"
      | "ACCESS_API_TOKEN"
      | "ACCESS_IDP_ID"
      | "ACCESS_GOOGLE_IDP_ID"
    > {
  DB: D1Database;
  JOB_QUEUE: Queue<{ notificationId: string; outboxId: string }>;
}
export async function publishPending(env: Env) {
  // Scans atomically persist notification/outbox pairs. Failure before marking dispatched safely republishes.
  const orgs = await env.DB.prepare(
    "SELECT id FROM organizations WHERE status='ACTIVE'",
  ).all<{ id: string }>();
  for (const org of orgs.results) {
    await reconcileAccessAdmission(env, org.id);
    await NotificationService.scanDueAndOverdueItems(env.DB, org.id);
  }
  const events = await env.DB.prepare(
    "SELECT id,entity_id FROM outbox_events WHERE event_type='NOTIFICATION_READY' AND status='PENDING' ORDER BY created_at LIMIT 100",
  ).all<{ id: string; entity_id: string }>();
  for (const event of events.results) {
    await env.JOB_QUEUE.send({
      notificationId: event.entity_id,
      outboxId: event.id,
    });
    await env.DB.prepare(
      "UPDATE outbox_events SET status='DISPATCHED',dispatched_at=? WHERE id=? AND status='PENDING'",
    )
      .bind(Date.now(), event.id)
      .run();
  }
  // Known-safe transient rejections are eligible again at their stored deadline.
  const retries = await env.DB.prepare(
    "SELECT id FROM notifications WHERE status='FAILED' AND attempt_count<5 AND next_attempt_at<=?",
  )
    .bind(Date.now())
    .all<{ id: string }>();
  for (const n of retries.results)
    await env.JOB_QUEUE.send({ notificationId: n.id, outboxId: "" });
}
export default {
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(publishPending(env));
  },
  async queue(
    batch: MessageBatch<{ notificationId: string; outboxId: string }>,
    env: Env,
  ) {
    const adapter = createWhatsAppAdapter(env);
    for (const message of batch.messages) {
      try {
        if (typeof message.body?.notificationId !== "string") {
          message.ack();
          continue;
        }
        await NotificationService.dispatchQueuedNotifications(
          env.DB,
          adapter,
          message.body.notificationId,
        );
        message.ack();
      } catch {
        message.retry({
          delaySeconds: Math.min(3600, 30 * 2 ** Math.min(message.attempts, 7)),
        });
      }
    }
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
