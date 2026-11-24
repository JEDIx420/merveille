# Phase 11 Evidence: In-Portal Notifications, WhatsApp and Escalation

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P11 / REQ-NOT-001 through REQ-NOT-005; AC-046, AC-047, AC-048, AC-049, AC-050
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `clientUser` as `MAIN_CLIENT`, `consultantUser`, `revokedUser`) and project `prj_notification_villa`

## Changed behaviour

- Created D1 migration `migrations/0011_notifications_and_outbox.sql` containing tables:
  - `outbox_events`: Durable event ledger recording event types, entity targets, payload JSON, idempotency keys, and dispatch status (`PENDING`, `PROCESSING`, `DISPATCHED`, `FAILED`, `SUPPRESSED`).
  - `notifications`: User-scoped in-portal notifications with priority levels (`LOW`, `NORMAL`, `HIGH`, `URGENT`), channel tracking, deep links, read status, and acknowledge status.
  - `notification_escalations`: SLA tracking for unacknowledged notifications, defining escalation levels, thresholds, and target escalation users.
  - `whatsapp_messages`: Outbound and inbound WhatsApp message log with template names, delivery statuses (`QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED`), and message IDs.
  - `webhook_events`: Idempotent log of external webhook requests with raw payload hashes, signature verification flags, and processing results.
- Implemented Notifications & Messaging Services in `src/server/notifications/`:
  - `src/server/notifications/service.ts`:
    - `enqueueEvent`: Records outbox events idempotently (AC-046, AC-047).
    - `dispatchOutbox`: Evaluates entity status at dispatch time; suppresses stale notifications if target entity is already completed, paid, or released; suppresses notifications if recipient membership is inactive/revoked (AC-047); delivers in-portal notifications with safe deep links (AC-046).
    - `markAsRead`: Marks notification as read without altering underlying entity states (AC-047).
    - `checkAndEscalate`: Scans for unacknowledged notifications past SLA thresholds and creates escalation alerts for managers/admins (AC-048).
  - `src/server/notifications/whatsapp.ts`:
    - `queueWhatsAppMessage`: Prepares template messages with safe minimal context and authenticated deep links; strictly blocks sensitive data (salaries, internal payroll/costs, raw private docs) with `SENSITIVE_PAYLOAD_DETECTED` (AC-049).
    - `processWhatsAppWebhook`: Validates incoming HMAC-SHA256 signatures; deduplicates webhook payload IDs; rejects replayed messages; records audit trails without directly mutating core business entities or approvals (AC-050).
- Built API endpoints:
  - `src/app/api/notifications/route.ts`: List user notifications, mark read/acknowledged, get unread count.
  - `src/app/api/webhooks/whatsapp/route.ts`: Verified WhatsApp webhook receiver.
- Built UI screen:
  - `src/app/(portal)/notifications/page.tsx`: SCR-20 Notifications center with priority indicators, deep links to entities, filter tabs (All, Unread, Escalated), and mark-all-read controls.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-046 | `npx vitest run tests/integration/notifications/p11-notifications.test.ts` | PASS | Triggered event generates in-portal notifications for intended recipient with deep link directly to entity version (`/projects/prj_notification_villa/drawings/dwg_arch_01`); unread count updates correctly |
| AC-047 | `npx vitest run tests/integration/notifications/p11-notifications.test.ts` | PASS | Queued notification for a task completed prior to dispatch is suppressed at dispatch time (`SUPPRESSED`); revoked user notifications suppressed; duplicate events within throttle window deduplicated; reading notification does not alter task status |
| AC-048 | `npx vitest run tests/integration/notifications/p11-notifications.test.ts` | PASS | High-priority drawing review notification unacknowledged after SLA interval (4 hours) escalates to project manager; notification flagged as `ESCALATED`; escalation record logged |
| AC-049 | `npx vitest run tests/integration/notifications/p11-notifications.test.ts` | PASS | WhatsApp dispatch sanitizes message to safe minimal summary with authenticated deep link; attempting to queue message containing salary or raw financial detail throws `SENSITIVE_PAYLOAD_DETECTED` |
| AC-050 | `npx vitest run tests/integration/notifications/p11-notifications.test.ts` | PASS | WhatsApp webhook verified via HMAC-SHA256 signature; invalid signature rejected (`401`); duplicate webhook ID idempotently skipped (`DUPLICATE`); incoming webhook text logged but does NOT mutate task status or invoice balance |
| Full Test Suite | `npm test` | PASS | 14 test files, 65 tests passing in 646ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 28 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 275 files |

## Remaining work

- P11 phase gate is fully satisfied.
- Ready to proceed to Phase P12: Role dashboards, waiting-on-you and owner performance (AC-051, AC-052, AC-053).

## Recovery impact

- Applied migration `0011_notifications_and_outbox.sql` creating tables `outbox_events`, `notifications`, `notification_escalations`, `whatsapp_messages`, and `webhook_events`.
