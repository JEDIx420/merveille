# Phase 04 Evidence: Tasks, Deadlines and Completion History

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P04 / REQ-TSK-001 through REQ-TSK-006, REQ-DAS-001, REQ-DAS-003, REQ-DAS-004; AC-013, AC-014, AC-015
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `consultantUser`, `clientUser`) and project `prj_pavilion_01`

## Changed behaviour

- Created D1 migration `migrations/0004_tasks_and_deadlines.sql` containing tables:
  - `tasks`: Project ID, stage association, title, description, priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), status (`PENDING_ASSIGNMENT`, `TODO`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`), creator ID, official assignee ID, `original_due_date`, `effective_due_date`, `completed_at`, `completed_by_user_id`, blocker reason, reopen counter, revision.
  - `task_events`: Full lifecycle journal (`TASK_CREATED`, `TASK_ASSIGNED`, `TASK_STARTED`, `TASK_BLOCKED`, `TASK_UNBLOCKED`, `TASK_COMPLETED`, `TASK_REOPENED`, `TASK_CANCELLED`, `TASK_DEADLINE_CHANGED`, `TASK_ASSIGNMENT_CHANGED`).
  - `task_comments`: Internal discussion notes and attached files.
- Implemented Task Domain Service in `src/server/domain/tasks/service.ts`:
  - `createTask`: Assigned staff can propose tasks in `PENDING_ASSIGNMENT` status (AC-013).
  - `assignTask`: Guarded manager authority; assigns project member and establishes baseline deadline; preserves prior state in `task_events` (AC-013).
  - `changeTaskDeadline`: Guarded manager authority; records new effective due date while preserving `original_due_date` and deadline change reason (AC-013).
  - `startTask`, `blockTask`, `completeTask`: Assignee actions; records completion time and optional completion note.
  - `reopenTask`: Guarded manager authority; transitions completed task back to `TODO`, increments `reopen_count`, and logs rework event with reason and category (`CORRECTION_DEFECT`, `CLIENT_SCOPE_CHANGE`, `EXTERNAL_DEPENDENCY`, `ADMINISTRATIVE`) (AC-014).
  - `computeIsOverdue`: Evaluates if current open task is past its effective deadline (AC-014).
  - `assertTaskAccess`: Denies clients (`MAIN_CLIENT`, `CLIENT_REP`) and consultants access to tasks, comments, and internal notes (AC-015).
- Implemented API handlers:
  - `src/app/api/projects/[id]/tasks/route.ts`: `GET` (list with filters) and `POST` (create task).
  - `src/app/api/tasks/[id]/route.ts`: `GET` (detail with events & comments) and `POST` (`ASSIGN`, `CHANGE_DEADLINE`, `START`, `COMPLETE`, `REOPEN`, `BLOCK`, `CANCEL`, `ADD_COMMENT`).
- Built UI Screen:
  - `src/app/(portal)/projects/[id]/tasks/page.tsx`: SCR-07 Task Manager with status tabs, priority badges, visual OVERDUE badges, modal for proposing tasks, modal for manager assignment & deadline control, modal for manager reopening with structured categories, and explicit internal confidentiality notice.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-013 | `npm test -- tests/domain/tasks/p04-tasks.test.ts` | PASS | Staff proposes task in `PENDING_ASSIGNMENT`; non-manager cannot assign or revise deadline; manager assigns team member with deadline; deadline revision updates effective date while preserving original plan in DB and logging `TASK_DEADLINE_CHANGED` |
| AC-014 | `npm test -- tests/domain/tasks/p04-tasks.test.ts` | PASS | Assignee completes task; completed timestamp recorded; manager reopens task with `[CORRECTION_DEFECT]` reason; status returns to `TODO`; reopen counter increments; task past deadline computes `isOverdue: true` |
| AC-015 | `npm test -- tests/domain/tasks/p04-tasks.test.ts` | PASS | Clients and consultants requesting task detail or task listing are rejected with `FORBIDDEN` ("Tasks and completion history are internal practice records"); staff and manager read internal notes |
| Full Test Suite | `npm test` | PASS | 7 test files, 30 tests passing in 365ms with zero mocks and real relational SQLite integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 19 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 204 files |

## Remaining work

- P04 phase gate is fully satisfied.
- Ready to proceed to Phase P05: Drawing register, consultant approval and manager release.

## Recovery impact

- Applied migration `0004_tasks_and_deadlines.sql` creating tables `tasks`, `task_events`, and `task_comments`.
