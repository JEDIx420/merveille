# Background work and notifications

**27 November 2026 next-phase scope:** [The active N00–N05 plan](../next-phase/README.md) supersedes conflicting instructions below. Use Cloudflare Free only, bounded open-source voice, external billing with version-bound ADMIN commercial clearance, and manually prepared WhatsApp messages with API delivery disabled. Preserve completed work, historical records, access/approval rules and applicable recovery gates. Older finance/provider setup and execution sequences below are retained as reference; they are not current work or permission to enable paid services.

## Required behavior

Send in-portal and WhatsApp reminders for payments due, overdue drawings and overdue tasks. Escalate unresolved overdue items to ADMIN. Add notifications for assigned reviews or decisions where they support “Waiting on you.” A notification describes the state of a real entity; dismissing it does not resolve that entity.

WhatsApp is an external delivery service. All Merveille Designs compute, scheduling, persistence and delivery status records remain on Cloudflare. Use the Meta Cloud API through a small adapter, with a fake adapter for local development. Do not add a third-party notification platform or browser automation of WhatsApp.

## Durable architecture

Write a domain event into a D1 outbox in the **same transaction** as the business mutation. A scheduled/background dispatcher publishes pending events to Cloudflare Queues. The consumer processes a stable event ID, writes notification/job records and acknowledges only after state is stored. Queue delivery is [at least once](https://developers.cloudflare.com/queues/reference/delivery-guarantees/), so retries and deduplication are part of the design.

When queue publication succeeds but marking the outbox dispatched fails, publication may repeat. The recipient notification uniqueness key must prevent duplicate in-portal rows. When the external API accepts a send but the Worker loses its response, the outcome is ambiguous; **do not promise exactly-once WhatsApp delivery**. Track `DELIVERY_UNKNOWN`, reconcile provider IDs/webhooks if available, and avoid blind immediate retries. Manual retry should explain that ambiguity.

Queues carry event IDs and minimal routing metadata, not full documents, financial reports, salary values or long-lived credentials. The consumer loads current records and permissions. A removed consultant must not receive a message queued while their old access was active.

## Scheduling and escalation defaults

These are engineering defaults pending operational tuning:

- Scheduled scan every 15 minutes; actual due-date logic uses organization timezone and business date.
- Payment reminder at the configured due threshold; overdue reminder once per business day while unpaid.
- Drawing/task overdue reminder once per business day to the currently responsible person.
- Admin escalation after one business day unresolved, then daily digest while still unresolved.
- Quiet hours default 20:00–08:00 in `Asia/Kolkata` for routine outbound WhatsApp reminders; portal items remain visible immediately.
- Deduplication identity includes organization, entity, due/schedule revision, recipient, channel and reminder window.

Make thresholds and quiet hours configurable. Do not treat these timings as client-confirmed requirements. Date-based instalments use their date. Stage-based instalments become due only after the authorized stage completion event and the configured offset; if both conditions are configured, the schedule must explicitly declare AND/OR semantics before publication. Never guess which wins.

Cloudflare [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) run on UTC schedules. Convert business thresholds explicitly; a scheduled invocation is not itself the due-date authority. Scans use a last-success cursor and lookback to recover missed intervals without duplicating notices.

## Recipient policy

| Event | Intended recipient | Escalation |
|---|---|---|
| Client payment due/overdue | Main client; representatives only if explicitly subscribed to finance notifications | Admin for unresolved debt |
| Consultant review overdue | Assigned consultant | Manager visibility; admin unresolved escalation |
| Manager release/update approval overdue | Assigned manager | Admin unresolved escalation |
| Task overdue | Current assignee | Admin unresolved escalation |
| Client contractual decision pending | Main client | Manager/admin according to project assignment |
| Failed notification delivery | Internal admin operations view | Retry/dead-letter recovery |

Do not message all project members automatically. A consultant can view client financial records but that does not automatically subscribe them to the client's payment reminders. Notification content is permission-filtered separately from recipient selection.

On archived projects, retain reminders for existing unsettled financial obligations while suppressing ordinary new-work/task/drawing reminder generation by default. The archive review must disclose unresolved work rather than silently complete it; reopening can resume the relevant work reminders. ADMIN settlement updates recompute the debt reminders without reopening the project. This is the initial lifecycle policy and must stay aligned with the archive workflow.

## WhatsApp prerequisites and templates

The deployment owner supplies a legitimate WhatsApp Business account, sender/phone-number ID, application credentials, selected Graph API version and approved utility templates. Record verified numbers and opt-in evidence; honor opt-out. Meta's [Business Messaging Policy](https://business.whatsapp.com/policy) and [platform documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/) govern channel setup. Recheck current sender/template rules before enabling production sends; do not hardcode a dated API version as permanently supported.

Use minimal notification text and an authenticated portal deep link. Proposed template intents: `payment_due`, `task_overdue`, `drawing_review_due`, `approval_pending`, and `admin_overdue_digest`. Avoid attaching private drawings, receipt evidence or detailed financial statements. In-portal history remains the source of full context.

Sending must be disabled by default in development/staging. Use explicit test-recipient allowlists and fake delivery status. Portal notifications must still work when WhatsApp is disabled or fails. The UI distinguishes queued, accepted, delivered, failed, skipped (opted out), and unknown outcomes. API acceptance is not proof of delivery or reading.

## Webhook trust boundary

Use a dedicated narrow public callback endpoint. Verify Meta's subscription challenge token during setup. For POST events, validate the signature over the **raw request bytes** using the configured App Secret and a constant-time comparison before parsing or acting. Meta documents the `X-Hub-Signature-256` mechanism in its [webhook setup guide](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/).

Enforce body-size limits, expected object/event shape, phone-number/account association and deduplication. Reject invalid signatures. Persist valid events durably before acknowledging; return success only when the processing handoff has succeeded. Handle delayed/out-of-order status events without regressing a delivered message to queued. Webhooks do not have authority to confirm client payments, approve drawings or grant app access.

## Retry, monitoring and operations

Use bounded exponential backoff for transient failures, provider retry-after when present, and a dead-letter queue or explicit failed-job state after exhaustion. Authentication errors and rejected templates should produce actionable admin errors, not endless retries. Monitor last scan success, oldest outbox age, queue backlog, delivery failures, webhook rejection rate and admin escalations.

Tests include duplicate/out-of-order events, queue republish, API timeout after send, recipient removal, phone change, opt-out after enqueue, archived project with unpaid invoice, schedule revision, task completion before send, timezone boundary, missed cron interval, invalid webhook signature and unsigned local callbacks rejected in deployed mode.
