# Phase 02 Evidence: Client Portfolios, Project Records and Enquiry Intake

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P02 / REQ-PRJ-001 through REQ-PRJ-008, REQ-IAM-001, REQ-IAM-002; AC-009, AC-010 (commercial activation gate), AC-011, AC-012
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `mainClientUser`, `clientRepUser`) and test projects (`prj_1`, `prj_2`, `prj_demo`, `prj_gate`)

## Changed behaviour

- Created D1 migration `migrations/0002_projects_and_enquiries.sql` containing tables:
  - `enquiries`: Prospect name, email, phone, site location, requirements, status (`OPEN`, `FEASIBILITY_REVIEW`, `QUOTE_PREPARATION`, `ON_HOLD`, `LOST`, `DECLINED`, `CONVERTED`), decline reason, linked project reference, revision, timestamps.
  - `feasibility_studies`: Observations, site constraints, recommendations, reviewer ID, status (`DRAFT`, `COMPLETED`), revision, timestamps.
  - `project_stages`: Ordered architectural stages (1 to 6) with status (`PENDING`, `IN_PROGRESS`, `COMPLETED`), actual completion date, and optimistic revision counter.
  - `project_events`: Append-only lifecycle event journal (`PROJECT_ACTIVATED`, `STAGE_COMPLETED`, `PROJECT_PAUSED`, `PROJECT_RESUMED`, `PROJECT_CANCELLED`).
  - Extended `projects`: Added columns `site_location`, `quote_accepted_at`, `advance_confirmed_at`, `activated_at`, `activated_by_user_id`, `pause_reason`, `cancel_reason`.
- Implemented Enquiry domain services in `src/server/domain/enquiries/service.ts`:
  - `createEnquiry`: Records client prospect and requirements with immutable audit trail.
  - `recordFeasibilityStudy`: Logs site observations, zoning constraints, and massing/structural recommendations; transitions enquiry to `FEASIBILITY_REVIEW`.
  - `closeEnquiry`: Marks enquiry as `LOST` or `DECLINED` with structured reason; verifies that NO active project record is created (AC-009).
  - `convertEnquiryToProject`: Initializes draft project with standard 6 architectural stages and assigns main client and manager project memberships.
  - `listEnquiries` & `getEnquiry`: Provides internal practice-only pipeline views with authorization barriers preventing client/consultant enumeration.
- Implemented Project Portfolio & Lifecycle domain services in `src/server/domain/projects/service.ts`:
  - `listProjects`: Strictly filters visible portfolio by role (AC-002, AC-011). Main client sees all their assigned projects; representatives see only assigned projects.
  - `getProject`: Enforces project-level permission boundary and retrieves ordered stage timeline, assigned team members, and lifecycle event history.
  - `activateProject`: Guarded manager command enforcing REQ-PRJ-002 and DEC-007 commercial gates (fails closed with `ACTIVATION_GATES_UNMET` unless BOTH accepted quotation and confirmed advance receipt are recorded).
  - `updateProjectStage`: Enforces optimistic concurrency (`CONCURRENCY_CONFLICT` on stale revision); auto-advances project current stage upon stage completion (AC-012).
  - `pauseProject` & `resumeProject`: Transitions between `ACTIVE` and `PAUSED` with mandatory reason and audit journal recording (AC-012).
- Implemented API handlers:
  - `src/app/api/enquiries/route.ts`: `GET` (list) and `POST` (create).
  - `src/app/api/enquiries/[id]/route.ts`: `GET` (detail with studies) and `POST` (`RECORD_FEASIBILITY`, `CLOSE`, `CONVERT`).
  - `src/app/api/projects/route.ts`: `GET` (portfolio list with stage, search, and archived filters).
  - `src/app/api/projects/[id]/route.ts`: `GET` (detail) and `POST` (`ACTIVATE`, `UPDATE_STAGE`, `PAUSE`, `RESUME`).
- Built complete UI screens:
  - `/projects`: SCR-03 Projects Directory with stage dropdown filter, search input, status pills, and commercial gate readiness badges.
  - `/projects/[id]/overview`: SCR-05 Project Overview & Stage Timeline with guarded "Activate Project Baseline" button, pause/resume modals with reasons, stage completion actions, team member list, and lifecycle audit log.
  - `/enquiries`: SCR-04 Enquiry Pipeline with status filters (All, Active, Converted, Lost/Declined), timestamps, and quick action links.
  - `/enquiries/new`: Enquiry intake form capturing prospect brief, location, and contact information.
  - `/enquiries/[id]`: Enquiry detail page with feasibility study history and creation form, "Close Enquiry" modal, and "Convert to Project" modal.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-009 | `npm test -- tests/domain/project-lifecycle/p02-lifecycle.test.ts` | PASS | Enquiry closed as `DECLINED` with reason "Environmental buffer and CRZ setbacks preclude requested built footprint"; linked_project_id is null; 0 projects created in database |
| AC-010 | `npm test -- tests/domain/project-lifecycle/p02-lifecycle.test.ts` | PASS | Activation without accepted quote or confirmed advance fails with `ACTIVATION_GATES_UNMET`; succeeds and sets `status = 'ACTIVE'` once both gates are satisfied |
| AC-011 | `npm test -- tests/domain/project-lifecycle/p02-lifecycle.test.ts` | PASS | Main client with 2 projects sees both (`PRJ-2026-001`, `PRJ-2026-002`); client representative assigned only to Project 1 sees only Project 1; accessing Project 2 throws `Access denied: You are not assigned to this project` |
| AC-012 | `npm test -- tests/domain/project-lifecycle/p02-lifecycle.test.ts` | PASS | Completing Stage 1 advances project stage to "Design Development"; stale revision update throws `CONCURRENCY_CONFLICT`; pause with reason sets `PAUSED`; resume clears pause and logs `PROJECT_RESUMED` |
| Full Test Suite | `npm test` | PASS | 5 test files, 22 tests passing in 350ms with genuine SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 16 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 178 files |

## Remaining work

- P02 phase gate is satisfied.
- Ready to proceed to Phase P03: Private documents, media storage, and authenticated file delivery.

## Recovery impact

- Applied migration `0002_projects_and_enquiries.sql` to local D1 database.
- Migration creates tables `enquiries`, `feasibility_studies`, `project_stages`, `project_events`, and adds commercial gate columns to `projects`.
