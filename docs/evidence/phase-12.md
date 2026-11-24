# Phase 12 Evidence: Role Dashboards, Waiting-on-you and Owner Performance

## Identity

- Phase / requirement IDs: P12 / REQ-DAS-001 through REQ-DAS-005, REQ-TSK-006; AC-051, AC-052, AC-053
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`ownerUser`, `adminUser`, `managerUser`, `staffUser`, `consultantUser`, `clientUser` as `MAIN_CLIENT`, `clientRepUser` as `CLIENT_REP`) and project `prj_villa_azure`

## Changed behaviour

- Implemented Dashboard & Performance Domain Service in `src/server/domain/dashboard/service.ts`:
  - `getWaitingOnYou`: Dynamically derives actionable responsibilities from authoritative workflow tables without duplicate mutable checklists (REQ-DAS-001, REQ-DAS-003, AC-051):
    - Staff: assigned active tasks (with overdue items highlighted) and assigned snag remediations.
    - Consultants: pending technical drawing reviews for their discipline; strictly excludes drawing release, invoices, and client change decisions.
    - Managers: drawing versions awaiting release (`CONSULTANT_APPROVED`), invoices awaiting review, change requests awaiting estimate, change requests accepted awaiting manager authorization, and snags awaiting triage/verification.
    - Admins: reported client receipts awaiting verification and approved invoices ready for issuance.
    - Main Client: pending change requests awaiting estimate acceptance (exact version), material selections awaiting decision, issued quotations awaiting acceptance, and payment due expectations.
    - Client Representatives: strictly excluded from binding contractual decision items (AC-004, AC-051).
    - Sorting by useful urgency: overdue items first, then urgency levels (`URGENT` -> `HIGH` -> `NORMAL` -> `LOW`), then due date ascending.
    - Exact version links: drawing reviews/releases link to exact version numbers; change decisions link to exact version numbers.
  - `getOwnerPerformanceMetrics`: Evidence-based team performance analytics (REQ-DAS-002, REQ-DAS-004, REQ-TSK-006, AC-052):
    - STRICTLY OWNER-ONLY: Any attempt by staff, managers, or admin-only users without the Owner role is denied with `FORBIDDEN`.
    - Disclosed transparent definitions: explicitly documents formulas and denominators for deadline adherence, rework, and site progress.
    - Fairness separation: client-driven scope additions or variations (via `change_request_id` or client reasons) are tracked under `clientScopeRevisionsCount` and are strictly excluded from employee defect/reopened counts.
    - Project stage milestone progress is evaluated by verified stage completions, never fabricated from task checkboxes.
  - `getClientProjectOverview`: Calm, private client project overview (REQ-DAS-005, REQ-PRJ-007, AC-053):
    - Published site progress: shows only approved published updates (`update_versions.status = 'PUBLISHED'`), strictly omitting internal notes and draft updates.
    - Current released drawings: shows only drawings with active released version IDs, strictly omitting unreleased drafts.
    - Billing summary: shows issued invoices with balance due and payment instructions for main client (or null for client representatives without explicit financial grants).
    - Pending decisions: displays client decision cards for quotations, change requests, and material selections.
    - Zero internal leakage: completely conceals internal tasks, internal comments, internal expenses, consultant fees, payroll, profit, and unshared snags.
  - `getRoleOverview`: Personal and owner overview (REQ-DAS-001, REQ-DAS-002):
    - Separate invoiced vs received totals (REQ-DAS-002).
    - Salary and profit cards displayed only when viewer holds `ADMIN` capability.
    - Team performance entrypoint displayed only when viewer holds `OWNER` capability.
- Built API endpoints:
  - `src/app/api/dashboard/waiting/route.ts`: Role-scoped waiting-on-you queue.
  - `src/app/api/dashboard/overview/route.ts`: Role-tailored overview summary.
  - `src/app/api/dashboard/performance/route.ts`: Owner-only performance analytics endpoint with 403 guard.
  - `src/app/api/projects/[id]/client-overview/route.ts`: Calm client project overview endpoint.
- Built UI screens:
  - `src/app/(portal)/overview/page.tsx`: SCR-02 Personal and owner overview with waiting priority list, active projects, and separate invoiced/received financial cards.
  - `src/app/(portal)/waiting/page.tsx`: SCR-16 Waiting-on-you queue with urgency indicators, category filters, and direct actionable links.
  - `src/app/(portal)/performance/page.tsx`: SCR-12 Owner-only team performance screen with period filters, metric definitions, team table, and expandable task evidence.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-051 | `npx vitest run tests/domain/dashboard/p12-dashboard.test.ts` | PASS | Staff sees overdue task flagged `isOverdue: true` with direct link `/projects/prj_villa_azure/tasks?taskId=tsk_overdue_01`; consultant sees drawing review v1 and cannot see tasks/approvals; manager sees drawing release v1 and invoice approval; main client sees change decision v1 and cannot see drawing approvals or internal tasks; client representative receives no binding decision items; items ordered by urgency |
| AC-052 | `npx vitest run tests/domain/dashboard/p12-dashboard.test.ts` | PASS | Staff attempt to fetch performance throws `FORBIDDEN`; manager attempt throws `FORBIDDEN`; admin attempt throws `FORBIDDEN`; owner query succeeds with disclosed definitions; staff member with 2 completed tasks has 1 internal quality rework (`reopen_count = 2`) and 1 client-driven scope change; client scope revision is tracked separately and not scored as employee defect |
| AC-053 | `npx vitest run tests/domain/dashboard/p12-dashboard.test.ts` | PASS | Client project overview returns published update and released drawing A-101 v1; draft update, draft drawing A-102, internal task `tsk_internal`, and internal expense `exp_secret` are 100% absent; billing summary returns next due invoice for main client; client representative without financial grant receives `billingSummary = null` while viewing published progress |
| Full Test Suite | `npm test` | PASS | 15 test files, 68 tests passing in 671ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 35 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 285 files |

## Remaining work

- P12 phase gate is fully satisfied.
- Ready to proceed to Phase P13: Archive, audit exports and recovery (AC-054, AC-055, AC-066).

## Recovery impact

- Created domain service `src/server/domain/dashboard/service.ts`, API endpoints `/api/dashboard/*` and `/api/projects/[id]/client-overview`, and UI screens `/overview`, `/waiting`, and `/performance`.
