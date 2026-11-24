# Phase 09 Evidence: References, Materials and Additional-Work Controls (Client Decisions & Changes)

## Identity

- Phase / requirement IDs: P09 / REQ-CHG-001 through REQ-CHG-005, REQ-MAT-001 through REQ-MAT-004, REQ-IAM-005; AC-039, AC-040, AC-041, AC-042, AC-043
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `clientUser` as `MAIN_CLIENT`, `repUser` as `CLIENT_REP`, `consultantUser`) and project `prj_changes_villa`

## Changed behaviour

- Created D1 migration `migrations/0009_client_decisions_and_changes.sql` containing tables:
  - `client_references`: Inspiration images, document links, room/area tags, and uploader identities scoped to projects.
  - `client_reference_comments`: Discussion comments on references from representatives and team members.
  - `material_selection_items`: Decision questions framed by practice staff with options, needed-by dates, binding selection status, and confidential internal sourcing notes.
  - `material_selection_options`: Decision options with label, description, cost implications in minor units, schedule impact days, and recommendation tags.
  - `material_selection_suggestions`: Non-binding preferences and suggestions from representatives and consultants.
  - `change_requests`: Formal departure proposals with sequential request numbers (`CR-001`), source types (`MATERIAL_SELECTION`, `CLIENT_REQUEST`, etc.), affected original scope, and lifecycle states.
  - `change_request_versions`: Immutable versioned estimates with scope summaries, exclusions, currency, prices, taxes, required pre-work advance payments, schedule impact days, allocated payments, and main-client acceptance and manager authorization timestamps.
  - `change_request_comments`: Threaded comments and clarifications on change requests.
  - Added `change_request_id` column to `tasks` and `receipt_allocations` to link tasks and advance funds directly to authorized change requests.
- Implemented Materials Domain Service in `src/server/domain/materials/service.ts`:
  - `addReference` & `addReferenceComment`: Allows main clients, representatives, and team members to upload inspiration without altering contractual scope or drawing release states (AC-042).
  - `createSelectionItem`: Only practice staff can frame material decisions; clients cannot frame selection items directly.
  - `recordSuggestion`: Representatives and consultants record suggestions/preferences; does NOT alter selection status or binding selection options (AC-042).
  - `selectOption`: **Strictly guarded to MAIN_CLIENT**; representative attempts are rejected with `MAIN_CLIENT_SELECTION_REQUIRED` (AC-042); representatives cannot overwrite prior selections (AC-043); checks whether chosen option increases cost.
  - `markReadyForExecution`: Manager action guarded by commercial change gates (AC-043); if selected option has cost implication > 0, an AUTHORIZED change request is mandatory; un-authorized change requests reject execution readiness with `CHANGE_REQUEST_NOT_AUTHORIZED`.
  - `getSelectionItem` & `listSelectionItems`: Projections strictly strip confidential `internal_notes` for clients and consultants, preventing supplier margin disclosures (SCR-13, AC-042).
- Implemented Changes Domain Service in `src/server/domain/changes/service.ts`:
  - `createChangeRequest`: Any authorized project participant (client, rep, staff, consultant) can propose changes.
  - `startEstimating` & `issueEstimate`: Manager issues immutable estimate versions with explicit price, schedule impact, and pre-work advance conditions.
  - `acceptEstimate`: **Strictly guarded to MAIN_CLIENT**; representatives and consultants attempting to accept estimates are rejected with `MAIN_CLIENT_ACCEPTANCE_REQUIRED` (AC-039); binds the exact issued version number.
  - `confirmChangePayment`: **Strictly guarded to ADMIN**; validates receipt is CONFIRMED; allocates funds to the change request; partial payments update allocated balances but do not satisfy the gate until fully satisfied (AC-040).
  - `authorizeChangeWork`: **Guarded by THREE independent conditions** (AC-040):
    1. Main-client estimate acceptance.
    2. Admin-confirmed required pre-work payment.
    3. Manager authorization.
    Attempting authorization with any condition missing throws descriptive authorization errors (`ESTIMATE_NOT_ACCEPTED`, `PAYMENT_NOT_CONFIRMED`).
  - `reviseEstimate`: Manager action revising scope, price, or terms (AC-041); marks previous version `SUPERSEDED`; increments version number; resets status to `AWAITING_CLIENT`; invalidates previous client acceptance and manager authorization; requires fresh acceptance and re-evaluated payment.
  - `startChangeWork`: Verifies change request is in `AUTHORIZED` status before allowing work to begin.
- Enforced task-change linking in `src/server/domain/tasks/service.ts`:
  - Tasks linked to a change request via `change_request_id` cannot be started (`IN_PROGRESS`) until the change request status is `AUTHORIZED`, `IN_PROGRESS`, or `COMPLETED` (AC-040).
- Built API endpoints:
  - `src/app/api/projects/[id]/materials/route.ts`: List and manage references, selections, suggestions, and execution readiness.
  - `src/app/api/projects/[id]/changes/route.ts`: List and manage change requests, estimates, client acceptance, payment allocation, and manager authorizations.
  - `src/app/api/changes/[id]/route.ts`: Fetch detailed change request with version history, threaded comments, and three-condition readiness evaluation.
- Built UI screens:
  - `src/app/(portal)/projects/[id]/selections/page.tsx`: SCR-13 Material Selections & Client References with distinct representative suggestions vs main-client decisions, and cost-impact alerts.
  - `src/app/(portal)/projects/[id]/changes/page.tsx`: SCR-14 Change Requests & Extra Work with three-stage readiness indicator panel, versioned estimate history, and role-based action controls.
  - `src/app/(portal)/projects/[id]/materials/page.tsx`: Route alias re-exporting selections page.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-039 | `npx vitest run tests/domain/changes/p09-changes.test.ts` | PASS | Representative attempt to accept estimate rejected with `MAIN_CLIENT_ACCEPTANCE_REQUIRED`; consultant attempt rejected; representative and consultant post comments successfully; main client accepts estimate version 1 and status becomes `ACCEPTED_AWAITING_PAYMENT` |
| AC-040 | `npx vitest run tests/domain/changes/p09-changes.test.ts` | PASS | Manager authorization before client acceptance rejected (`ESTIMATE_NOT_ACCEPTED`); starting linked task rejected (`CHANGE_REQUEST_NOT_AUTHORIZED`); client accepts; authorization before payment rejected (`PAYMENT_NOT_CONFIRMED`); reported but unconfirmed receipt rejected; non-admin receipt confirm rejected (`FORBIDDEN`); admin confirms receipt; partial payment allocated (₹20,000 / ₹50,000) -> authorization and task start still blocked; remaining payment allocated -> payment satisfied; starting task before manager authorization rejected; manager authorizes work; staff starts task -> succeeds in `IN_PROGRESS` |
| AC-041 | `npx vitest run tests/domain/changes/p09-changes.test.ts` | PASS | Manager revises scope/price of authorized change request; Version 1 marked `SUPERSEDED`; Version 2 issued; status resets to `AWAITING_CLIENT`; authorization with stale consent rejected (`ESTIMATE_NOT_ACCEPTED`); starting work rejected; main client accepts Version 2; payment re-evaluated and allocated; manager authorizes Version 2; work proceeds |
| AC-042 | `npx vitest run tests/domain/changes/p09-changes.test.ts` | PASS | Main client and representative upload inspiration references; representative comments on reference; staff frames material selection item with internal sourcing notes; client and representative views confirm `internal_notes` are stripped (`undefined`); representative attempts binding selection -> rejected with `MAIN_CLIENT_SELECTION_REQUIRED`; representative records suggestion -> saved without mutating selection status (`AWAITING_MAIN_CLIENT`); main client makes binding selection -> status becomes `SELECTED` with selector ID recorded |
| AC-043 | `npx vitest run tests/domain/changes/p09-changes.test.ts` | PASS | Main client selects upgrade option with cost increase; representative attempts to overwrite -> rejected (`MAIN_CLIENT_SELECTION_REQUIRED`); manager attempts `markReadyForExecution` without change request -> rejected (`CHANGE_REQUEST_REQUIRED`); change request linked in `AWAITING_CLIENT` state -> `markReadyForExecution` rejected (`CHANGE_REQUEST_NOT_AUTHORIZED`); change request accepted, paid, and authorized; manager marks selection ready -> succeeds (`READY_FOR_EXECUTION`) |
| Full Test Suite | `npm test` | PASS | 12 test files, 57 tests passing in 607ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 26 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 260 files |

## Remaining work

- P09 phase gate is fully satisfied.
- Ready to proceed to Phase P10: Site issues and snags (Issue tracking, remediation workflow, and confidential cost notes).

## Recovery impact

- Applied migration `0009_client_decisions_and_changes.sql` creating tables `client_references`, `client_reference_comments`, `material_selection_items`, `material_selection_options`, `material_selection_suggestions`, `change_requests`, `change_request_versions`, `change_request_comments`, and added columns to `tasks` and `receipt_allocations`.
