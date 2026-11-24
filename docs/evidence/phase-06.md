# Phase 06 Evidence: Published Updates, Company Notices, and Manual K-SMART Records

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P06 / REQ-UPD-001 through REQ-UPD-005, REQ-KSM-001 through REQ-KSM-004, REQ-IAM-003, REQ-IAM-004, REQ-FIL-002, REQ-FIL-004; AC-022, AC-023, AC-024, AC-025, AC-026
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `clientUser`, `otherClientUser`) and projects `prj_updates_villa`, `prj_other_residence`

## Changed behaviour

- Created D1 migration `migrations/0006_updates_and_permits.sql` containing tables:
  - `project_updates`: Logical update container with stage reference, author ID, pointer to `current_published_version_id`, retraction flag, and revision.
  - `update_versions`: Immutable version snapshots (`V1`, `V2`, ...), title, body text, observed date, review status (`DRAFT`, `IN_REVIEW`, `PUBLISHED`, `CHANGES_REQUESTED`, `RETRACTED`), review feedback, published timestamp, and publisher ID.
  - `update_attachments`: Version-bound attachment mapping marking files `is_referenced = 1` (AC-060).
  - `project_internal_notes`: Private internal discussion space strictly isolated from clients and consultants (`canReadInternalNotes`), with confidentiality flags and attachment links.
  - `company_announcements`: Controlled announcements with explicit audience targeting (`SELECTED_PROJECTS`, `SELECTED_CLIENTS`, `ALL_CLIENTS`), draft/review/publish states, and retraction tracking.
  - `announcement_audiences`: Explicit targeting mappings linking announcements to specific project cohorts or client IDs.
  - `ksmart_milestones`: Discrete Sanction and Completion records per project (`SANCTION`, `COMPLETION`), application numbers, organizational tracking labels (`NOT_STARTED`, `IN_PROGRESS`, `AWAITING_RESPONSE`, `FOLLOW_UP_NEEDED`, `RECORDED_COMPLETE`), and pointer to `current_published_observation_id`.
  - `ksmart_observations`: Manual dated observation history with status text, document date, mandatory `last_checked_date`, source description, reference URL, internal staff notes, and sharing status (`INTERNAL`, `SUBMITTED_FOR_SHARING`, `SHARED`, `RETURNED`, `RETRACTED`).
  - `ksmart_observation_files`: Observation attachments with `is_client_shared` privacy flag separating sensitive internal screenshots from client-safe evidence.
- Implemented Updates Domain Service in `src/server/domain/updates/service.ts`:
  - `createProjectUpdate`: Staff/manager creates draft update; attaches photos; keeps drafts hidden from client feed (AC-022).
  - `createUpdateVersion`: Staff proposes revised version (e.g. V2); V1 remains published until V2 passes review (AC-023).
  - `submitUpdateForReview`: Transitions draft to `IN_REVIEW`.
  - `returnUpdate`: Manager requests changes with private feedback; returns V2 to `CHANGES_REQUESTED`; published V1 remains unaffected (AC-023).
  - `publishUpdate`: Manager publishes reviewed snapshot; atomically updates parent `current_published_version_id`.
  - `retractUpdate`: Manager retraction command.
  - `listProjectUpdates`: Client/consultant queries return ONLY active published snapshots where `is_retracted = 0` and parent pointer is valid. Unreleased drafts and internal notes are strictly filtered.
  - `createInternalNote` & `listInternalNotes`: Enforces `canReadInternalNotes`; strictly throws `FORBIDDEN` for clients and consultants.
  - `createCompanyAnnouncement` & `publishCompanyAnnouncement`: Restricts announcement creation and publication to managers/admins.
  - `listCompanyAnnouncements`: Enforces explicit audience scoping (AC-024) — clients see only published announcements targeting all clients, their client ID, or their assigned projects.
- Implemented Permits Domain Service in `src/server/domain/permits/service.ts`:
  - `ensureMilestones`: Ensures separate `SANCTION` and `COMPLETION` records per project.
  - `recordObservation`: Records manual observation with observed status text, check date, and evidence (AC-025).
  - `submitObservationForSharing`: Staff requests client update.
  - `reviewObservationSharing`: Manager approval gate; updates milestone `current_published_observation_id`.
  - `getProjectPermits`: External clients receive ONLY approved status and shared files (`is_client_shared = 1`); sensitive screenshots (`is_client_shared = 0`) remain private (AC-026); displays clear attribution: "Recorded by [staff] · Last checked [date]" and explicit disclaimer that it is a manual practice record and not an automated government verification.
- Built API endpoints:
  - `src/app/api/projects/[id]/updates/route.ts`: List updates / Create update / Create internal note.
  - `src/app/api/projects/[id]/updates/[updateId]/route.ts`: Version proposal, submit review, return with feedback, publish, retract.
  - `src/app/api/projects/[id]/permits/route.ts`: Get permit milestones and observations, record observation, submit for sharing, review sharing.
  - `src/app/api/announcements/route.ts`: List targeted announcements, create announcement, publish announcement.
- Built UI screens:
  - `src/app/(portal)/projects/[id]/updates/page.tsx`: SCR-08 Progress updates & feed with tabs for Updates Feed and Private Internal Notes, modal composer for updates and internal notes, manager review modal with publish/return actions.
  - `src/app/(portal)/projects/[id]/permits/page.tsx`: SCR-09 K-SMART Permit Records with distinct Sanction and Completion milestone cards, manual check date display, practice boundary statement, modal for recording observations, and manager client-sharing controls.
  - Updated `src/app/(portal)/projects/[id]/overview/page.tsx`: Added navigation links to Updates and Permits & K-SMART.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-022 | `npx vitest run tests/domain/updates/p06-updates.test.ts` | PASS | Staff drafts update with photo and creates separate internal note; client feed query before publication returns 0 items; client internal notes query throws `FORBIDDEN`; manager publishes; client receives approved update and photo; internal notes remain inaccessible |
| AC-023 | `npx vitest run tests/domain/updates/p06-updates.test.ts` | PASS | V1 published and visible to client; staff proposes V2 with honeycombing note; manager returns V2 with feedback; client feed retains original V1; changed text does not leak to client |
| AC-024 | `npx vitest run tests/domain/updates/p06-updates.test.ts` | PASS | Manager publishes announcement targeting project A; client on project A sees announcement; client on project B receives 0 announcements |
| AC-025 | `npx vitest run tests/domain/updates/p06-updates.test.ts` | PASS | Sanction and completion exist as separate milestone groups; staff records observation with check date and source; client sees "Recorded by Nithya Architect · Last checked 2026-11-24" with manual practice record disclaimer |
| AC-026 | `npx vitest run tests/domain/updates/p06-updates.test.ts` | PASS | Staff attaches sensitive screenshot (`isClientShared = false`) and permit summary (`isClientShared = true`); manager approves sharing; client receives approved status and summary doc only; sensitive screenshot is strictly excluded; internal staff sees both files |
| Full Test Suite | `npm test` | PASS | 9 test files, 40 tests passing in 491ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 20 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 218 files |

## Remaining work

- P06 phase gate is fully satisfied.
- Ready to proceed to Phase P07: Quotations, schedules, invoices and receipts (Commercial finance).

## Recovery impact

- Applied migration `0006_updates_and_permits.sql` creating tables `project_updates`, `update_versions`, `update_attachments`, `project_internal_notes`, `company_announcements`, `announcement_audiences`, `ksmart_milestones`, `ksmart_observations`, and `ksmart_observation_files`.
