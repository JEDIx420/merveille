# Reminders and manual WhatsApp sharing

Stage N04 implements simple portal reminders and prepared messages that staff copy into their existing WhatsApp groups. All infrastructure must fit the verified Cloudflare Free allocation. Automatic WhatsApp sending, new email providers and a visual automation builder are outside this phase.

## Existing code and required changes

Read [the jobs handler](../../workers/jobs/index.ts), [its configuration](../../workers/jobs/wrangler.jsonc), [NotificationService](../../src/server/notifications/service.ts), [the adapter](../../src/server/notifications/whatsapp.ts) and [notification schema](../../migrations/0011_notifications_and_outbox.sql).

The jobs Worker already runs every 15 minutes, publishes `NOTIFICATION_READY` records and consumes notification IDs with retries. Notification creation uses D1 batches and deduplication keys. Existing listing/read commands check the recipient and current eligibility. Preserve these foundations through additive migrations.

The scanner currently creates both `PORTAL` and `WHATSAPP` records, despite the disabled adapter. Change active generation to `PORTAL` only. Suppress outstanding WhatsApp dispatch obligations with an explicit reason, preserve history, and prevent their later replay. Keep existing adapters disabled; do not provision credentials or remove unrelated code. Copying or sharing a message must never enqueue an outbound delivery.

Current domain scans and retry queries are not comprehensively bounded. Existing eligibility covers tasks, invoices and consultant reviews; it does not implement the new presets or fully check rescheduled deadlines. Extend those paths explicitly. The billing exclusion does not authorize deleting historical financial notifications; do not introduce new accounting reminders in this phase.

## Fixed reminder presets

Expose authorized managers' settings as preset enabled, timing and escalation controls. Recipients come from current assignments and permissions. Do not add arbitrary conditions, scripts, recipient lists or a workflow canvas. These are proposed defaults, adjustable within each preset:

| Preset | Trigger and recipient | Frequency and stop condition |
| --- | --- | --- |
| Task due | Current assignee at the task's due time; date-only work uses 09:00 local | Once per deadline version; stop on completion, cancellation or reassignment |
| Task overdue | Assignee; scoped manager receives a digest after one working day | One daily digest, not one alert per scan; stop when resolved or rescheduled |
| Lead follow-up | Current lead owner at the saved next-action time | Once per action version; stop on completion, ownership change or new date |
| Lead needs attention | Active lead with no next action and no activity for three working days | Daily owner digest; exclude Won/Lost and explicitly snoozed leads |
| Consultant review pending | Assigned consultant when an exact version enters review | Initial notice, then daily digest after one working day; stop when reviewed or superseded |
| Manager release waiting | Project manager when required consultant approvals are complete for that version | Initial notice and daily digest until release, changes or withdrawal |
| Client publication | Authorized project recipients after manager release/publication commits | Once per released drawing or published update version; no draft/upload notification |

Preserve required administrative escalation through its applicable scope, consolidating it into the digest. Manager and administrator authority remain distinct. Clients receive publication notices, not internal delays or staff reminders. A client receipt never becomes drawing approval or contractual acceptance.

Use `Asia/Kolkata` for date interpretation and configurable office hours; store timestamps consistently. Proposed active hours are 09:00–18:00 on configured working days. Hold attention reminders until the next active window. A published item can remain visible immediately; quiet hours defer its attention notice. Snooze changes reminder timing, not the underlying deadline. Imported historical dates must not create a notification burst.

Due times are scheduling targets. Under normal pilot load, materialize eligible reminders on the next 15-minute tick; do not promise exact-minute delivery. Show an administrator-visible delayed-job state if backlog, unavailable quota or a failed scheduler prevents that target.

## Durable scheduling and quiet delivery

Store each obligation's source ID, source version/deadline, recipient, preset, scheduled time, state and deduplication key in D1. Lead reminders may have no project: check organization membership plus lead access rather than inventing project membership or treating all organization users as eligible.

Commit a business transition and its publication outbox event atomically using supported D1 operations. Derive ordinary reminders from current canonical tasks/lead actions. A uniqueness constraint on organization, source/version, recipient, preset and occurrence prevents repeat creation. Digest keys additionally identify recipient and local day. Do not maintain a second editable task or lead follow-up database.

Before materializing an inbox item, and again when listing, counting, reading or opening it, recheck current access, source state/version, assignee, deadline, snooze and publication audience. Rescheduling, closing, superseding or revoking access must suppress the stale obligation. Never send a stored old title/body merely because it was authorized at creation.

Retain recipient-scoped read/archive state. Reading a notification does not complete its task; another recipient's action cannot mark it read. Keep inbox pagination and permission filtering bounded, including counts. Group repetitive overdue items into a digest and avoid resetting read state every 15 minutes.

The scheduler persists reminders while browsers are closed. They appear on the user's next visit or foreground refresh. This is not a promise of background phone/browser alerts, push notifications, email or WhatsApp delivery. Present portal availability and read state without external delivery language.

## Free-tier execution and recovery

Keep one 15-minute Cron. Bound organization traversal, due candidates, fan-out, retries and recovery work with indexes, stable ordering and persisted cursors. Start with small measured batches and stop at the configured work budget; limiting only the final outbox query is insufficient. Avoid building every candidate in memory or repeating full access-admission reconciliation unnecessarily. Preserve required admission checks through bounded work.

Workers Free permits **10 ms CPU per Cron invocation**; network/database waiting is distinct from CPU. A 15-minute wall-clock allowance does not enlarge that CPU limit. Measure representative jobs in the Workers runtime before accepting the batch size. Do not silently enable a paid plan. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Retain the existing Queue only if the actual account supports the Free allocation and measured traffic fits. Current Free limits include **10,000 operations daily** and **24-hour non-configurable retention**. A normal small message commonly consumes three operations; retries add operations. Queue payloads contain IDs, not drawings or client summaries. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/).

D1 remains the recoverable source of pending obligations. Queue publication is not completion. Reconcile dispatched-but-unfinished records after a lease expires; recover from queue expiry, quota exhaustion or consumer failure using bounded D1 processing. Atomic claims and idempotent materialization must make duplicate delivery harmless. Retain reasons for suppression and failure. If Queue use is unavailable, the same bounded Cron can materialize portal notifications directly. A stale-success indicator should expose delayed jobs to administrators; no paid monitoring dependency is required.

## Prepared WhatsApp message

Offer this only on client-released drawings and manager-published updates. Prepare a deterministic preview from the approved content; no AI call is necessary:

> Merveille Designs — [Project]
>
> [Drawing title] — Revision [number]
>
> Released [date]. [Approved short summary]
>
> View drawing: [authenticated link to this revision]

**Copy update** writes the displayed message. Staff switch to their already-open WhatsApp Web tab, choose the correct group, paste and send. **Open WhatsApp Web** is an ordinary link to `https://web.whatsapp.com/`. Optional **Share** uses the device's native chooser where supported.

Do not promise automatic group selection, tab discovery, pasting or sending. Official click-to-chat documentation describes phone-number links and a text-only recipient chooser, not a supported parameter for selecting an existing project group. [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934).

Keep the exact revision link and current access checks. Exclude internal text and unreleased files; refresh a stale preview when the released version changes. Unauthenticated metadata must show generic branding, not private drawing details. Never expose public R2 links or grant access merely to improve a WhatsApp preview.

Prepare text before the click. Use HTTPS and call `navigator.clipboard.writeText` directly from user activation; show **Copied** only after success. On denial or unavailable support, retain selectable text and manual-copy guidance. Do not read the clipboard or depend on Chromium-only permission queries. [Clipboard writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText), [browser differences](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API).

Native sharing is optional; cancellation preserves the preview. The website cannot know the chosen share target, and successful handoff is not message delivery. Show no Sent, Delivered or Read status for Copy/Open/Share. [Web Share specification](https://www.w3.org/TR/web-share/).

## Acceptance evidence

Verify duplicate scans, rescheduling, reassignment, access revocation, quiet hours, recipient read isolation, publication boundaries and overdue digest consolidation. Exercise queue expiry/recovery and measured Free-tier limits. Test clipboard denial, native-share cancellation and correct revision access on the team's desktop and phone browsers. Confirm every manual sharing action produces **zero WhatsApp dispatch records or provider calls**. Record implementation, local tests, hosted verification and real-user acceptance separately.
