# Phase 10 Evidence: Site Issue and Snag Tracking

## Identity

- Phase / requirement IDs: P10 / REQ-SNG-001 through REQ-SNG-004, REQ-TSK-005, REQ-UPD-002, REQ-UPD-003; AC-044, AC-045, AC-070
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `clientUser` as `MAIN_CLIENT`, `consultantUser`, `foreignStaffUser`) and projects `prj_snag_villa` & `prj_foreign_site`

## Changed behaviour

- Created D1 migration `migrations/0010_site_issues_and_snags.sql` containing tables:
  - `snags`: Project-scoped site issues with sequential numbers (`SNG-001`), severity levels (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), lifecycle states (`REPORTED`, `OPEN`, `IN_PROGRESS`, `BLOCKED`, `READY_FOR_VERIFICATION`, `CLOSED`, `REOPENED`, `DUPLICATE`, `NOT_ACCEPTED`), assignee and manager IDs, target due dates, `is_client_shared` approval flag, `is_charged_work` commercial flag, linked `change_request_id`, confidential `internal_cost_minor` and `internal_notes`, and `reopen_count`.
  - `snag_attachments`: Before/after photos and verification evidence with `is_internal_only` isolation.
  - `snag_events`: Append-only audit history of triage, assignment, work start, resolution evidence, verified closure, and reopens.
  - `snag_comments`: Threaded discussions with client-visible or internal-only flags.
  - Added `snag_id` column to `tasks` table to link remediation tasks directly to site snags.
- Implemented Snags Domain Service in `src/server/domain/snags/service.ts`:
  - `reportSnag`: Allows any authorized participant (clients, representatives, consultants, staff) to report issues with area/location, description, and initial photos (REQ-SNG-001, AC-044).
  - `triageSnag`: Restricts triage, assignment, target date setting, and client publication to project managers; strictly rejects assigning team members from other projects with `INVALID_ASSIGNEE` (SCR-17).
  - `startSnagWork`: Staff starts remediation; if marked as charged work (`is_charged_work = 1`), verifies that linked change request is authorized, blocking execution otherwise with `CHANGE_REQUEST_REQUIRED` or `CHANGE_REQUEST_NOT_AUTHORIZED` (AC-070).
  - `submitResolution`: Assignee submits resolution evidence and after-photos; transitions status to `READY_FOR_VERIFICATION`; assignees cannot verify or close snags directly (AC-044).
  - `verifyCloseSnag`: Strictly restricted to managers (`MANAGER`, `ADMIN`, `OWNER`); conducts inspection and records verified closure with reviewer ID, timestamp, and notes (AC-044).
  - `reopenSnag`: Manager rejects resolution with mandatory reason; increments `reopen_count`; sets status to `OPEN`; preserves earlier resolution evidence and full event history (AC-044).
  - `getSnag` & `listSnags`: Strictly enforces client/consultant visibility boundaries (AC-045); external participants cannot access internal-only snags unless they were the reporter or the manager approved `is_client_shared = 1`; all external projections strictly strip `internal_notes`, `internal_cost_minor`, internal-only attachments, and internal-only comments.
- Enforced task-snag linking in `src/server/domain/tasks/service.ts`:
  - When starting a task linked to a snag via `snag_id`, if the snag requires charged work, starting the task is blocked until the linked change request passes all 3 commercial gates (AC-070).
- Built API endpoints:
  - `src/app/api/projects/[id]/snags/route.ts`: List snags, report issue, triage/assign, start work, submit resolution, verify closure, reopen, and post comments.
  - `src/app/api/snags/[id]/route.ts`: Fetch detailed snag with attachment and comment confidentiality isolation.
- Built UI screen:
  - `src/app/(portal)/projects/[id]/snags/page.tsx`: SCR-17 Site Issues and Snag Tracking with grouped status tabs, severity indicators, before/after evidence cards, confidential remediation cost section (practice only), and manager triage/verification modals.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-044 | `npx vitest run tests/domain/snags/p10-snags.test.ts` | PASS | Client reports snag; assigning foreign project member rejected (`INVALID_ASSIGNEE`); manager assigns staff; staff starts work; staff submits resolution evidence -> status becomes `READY_FOR_VERIFICATION`; staff attempt to close rejected (`FORBIDDEN`); manager reopens with reason -> status becomes `OPEN`, `reopen_count` is 1, earlier evidence retained; staff re-submits; manager verifies closure -> status becomes `CLOSED`; full event history retained |
| AC-045 | `npx vitest run tests/domain/snags/p10-snags.test.ts` | PASS | Internal-only snag (`is_client_shared = 0`) with internal cost ₹15,000; external client attempt to read rejected (`FORBIDDEN`); shared snag (`is_client_shared = 1`) with internal cost ₹3,500 and internal-only comment; client and consultant view shared snag -> `internal_notes` and `internal_cost_minor` are `undefined`, internal comments omitted, only client comment visible; staff view sees complete internal notes, cost, and all comments; client list query omits unshared snag completely |
| AC-070 | `npx vitest run tests/domain/snags/p10-snags.test.ts` | PASS | Terrace waterproofing snag triaged as charged work; staff attempt to start snag work rejected (`CHANGE_REQUEST_REQUIRED`); starting linked task rejected (`CHANGE_REQUEST_REQUIRED`); change request created and estimated; attempt to start while `AWAITING_CLIENT` rejected (`CHANGE_REQUEST_NOT_AUTHORIZED`); client accepts estimate; attempt to start before payment rejected (`CHANGE_REQUEST_NOT_AUTHORIZED`); admin confirms receipt and allocates advance; attempt to start before manager authorization rejected; manager authorizes change request; staff starts snag work -> `IN_PROGRESS`; staff starts linked task -> `IN_PROGRESS` |
| Full Test Suite | `npm test` | PASS | 13 test files, 60 tests passing in 575ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 26 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 267 files |

## Remaining work

- P10 phase gate is fully satisfied.
- Ready to proceed to Phase P11: In-portal notifications, WhatsApp and escalation.

## Recovery impact

- Applied migration `0010_site_issues_and_snags.sql` creating tables `snags`, `snag_attachments`, `snag_events`, `snag_comments`, and added `snag_id` column to `tasks`.
