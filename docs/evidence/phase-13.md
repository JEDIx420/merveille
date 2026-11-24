# Phase 13 Evidence: Archive, Audit Exports and Recovery

## Identity

- Phase / requirement IDs: P13 / REQ-ARC-001 through REQ-ARC-005, REQ-OPS-004; AC-054, AC-055, AC-066
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd`, D1 SQLite, and private R2 storage
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`ownerUser`, `adminUser`, `managerUser`, `staffUser`, `consultantUser`, `clientUser` as `MAIN_CLIENT`, `revokedClientUser`, `outsiderUser`) and project `prj_archive_azure`

## Changed behaviour

- Implemented Archive and Recovery Domain Service in `src/server/domain/archive/service.ts`:
  - `assertProjectNotArchived`: Guards against operational changes on archived projects, raising `AuthorizationError` with code `PROJECT_ARCHIVED_READ_ONLY` (AC-055).
  - Integrated `assertProjectNotArchived` across operational mutation entrypoints:
    - Task creation (`createTask` in `src/server/domain/tasks/service.ts`)
    - Logical drawing creation (`createDrawing` in `src/server/domain/drawings/service.ts`)
    - Drawing version submission (`createDrawingVersion` in `src/server/domain/drawings/service.ts`)
    - Quotation drafting (`createQuotation` in `src/server/domain/finance/service.ts`)
    - Invoice drafting (`draftInvoice` in `src/server/domain/finance/service.ts`)
    - Project update creation & version submission (`createProjectUpdate`, `createUpdateVersion`, `publishUpdate` in `src/server/domain/updates/service.ts`)
    - Snag reporting (`reportSnag` in `src/server/domain/snags/service.ts`)
  - `archiveProject`: Enforces manager/admin authority, non-empty formal reason, records snapshot of unresolved obligations (open tasks, open snags, unpaid invoices), transitions project to `ARCHIVED`, and logs audit trail.
  - `getArchivedProjectRecords`: Implements AC-054:
    - Authorized clients and consultants retain view and download access to permitted released drawings (both current and historical superseded releases) and published updates.
    - Draft drawings, in-review versions, draft updates, internal notes, and private expenses are strictly omitted.
    - Revoked project members (`is_active = 0`) and outsiders are denied with `CROSS_PROJECT_DENIED`.
    - Unpaid financial obligations remain displayed; balances are not forgiven.
  - `settleArchivedInvoice`: Implements AC-055 ADMIN-only exception:
    - Allows administrators to record receipt allocations against existing unpaid invoices without reopening the project.
    - Updates outstanding balances by exact minor units (paise) and updates settlement status (`PAID` or `PARTIALLY_PAID`).
    - Does not create new work, revised payment schedules, or new invoices.
  - `reopenProject`: Controlled manager reopening requiring mandatory justification reason and revalidating active manager and client assignments.
  - `exportProjectBackup`: Disaster recovery manifest export (REQ-OPS-004, AC-066):
    - Exports project entities (stages, memberships, users, drawings, versions, updates, invoices, tasks, snags, files metadata).
    - Verifies private R2 file integrity and computes SHA-256 hashes for all stored files and the manifest itself.
    - Saves manifest JSON to private R2 storage under `backups/projects/`.
  - `restoreBackupToIsolatedEnv`: Isolated environment restoration reconciliation (REQ-OPS-004, AC-066):
    - Restores self-contained backup into a clean target database.
    - Reconciles 100% of drawing counts, invoice counts, membership counts, file counts, and outstanding balances.
    - Leaves source production database intact and unmutated.
- Built API endpoints:
  - `src/app/api/archive/route.ts`: List archived projects accessible to the current user.
  - `src/app/api/projects/[id]/archive/route.ts`: Fetch archived records (`GET`) and perform archive actions (`POST`: `archive`, `reopen`, `settle`).
  - `src/app/api/projects/[id]/export/route.ts`: Trigger disaster recovery backup export to R2.
- Built UI screens:
  - `src/app/(portal)/archive/page.tsx`: SCR-19 Archived projects and historical downloads screen:
    - Archived project directory with search and obligation indicators.
    - "Archived — view and download" banner with operational mutation protections.
    - Released drawing register table with current and superseded release indicators and individual download buttons.
    - Published client updates log.
    - Outstanding financial obligations card with ADMIN settlement modal.
    - Reopen project modal with mandatory justification reason.
    - Disaster recovery backup export button with SHA-256 confirmation.
  - Updated `src/app/layout.tsx` navigation rail with links to `Waiting on you`, `Archive`, and `Finance`.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-054 | `npx vitest run tests/domain/archive/p13-archive.test.ts` | PASS | Manager archives project; active client accesses archived records and sees both current (V2) and superseded (V1) released drawings; unreleased draft drawing `drw_02` is 100% absent; published update is present while draft update is absent; consultant accesses released drawings and published updates while invoice details are omitted; revoked client (`is_active = 0`) is denied with `CROSS_PROJECT_DENIED`; outsider is denied with `CROSS_PROJECT_DENIED` |
| AC-055 | `npx vitest run tests/domain/archive/p13-archive.test.ts` | PASS | Archived project rejects task creation, drawing creation, drawing version creation, quote creation, invoice drafting, and snag reporting with `PROJECT_ARCHIVED_READ_ONLY`; unpaid invoice balance remains due; manager attempt to settle invoice throws `FORBIDDEN`; admin settles ₹1,00,000 against existing invoice, reducing balance from ₹2,50,000 to ₹1,50,000 while project remains `ARCHIVED`; staff/client reopen attempts throw `FORBIDDEN`; empty reason is rejected; manager reopens with reason, transitioning status to `ACTIVE` and enabling task creation |
| AC-066 | `npx vitest run tests/domain/archive/p13-archive.test.ts` | PASS | Admin exports disaster recovery backup of project with verified storage files; manifest stored in R2 with SHA-256 checksum; backup restored into isolated clean target database; reconciles 100% of drawings (2/2), invoices (1/1), memberships (5/5), files (3/3), and outstanding balance (₹2,50,000); production database remains unmodified |
| Full Test Suite | `npm test` | PASS | 16 test files, 71 tests passing in 769ms with full SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 37 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with exit code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 292 files |

## Remaining work

- P13 phase gate is fully satisfied.
- Ready to proceed to Phase P14: Integrated verification, staging and launch readiness (AC-061, AC-062, AC-063, AC-065, AC-067, AC-068, AC-069).

## Recovery impact

- Created domain service `src/server/domain/archive/service.ts`, API endpoints `/api/archive`, `/api/projects/[id]/archive`, `/api/projects/[id]/export`, and UI screen `/archive`.
- Added `ArchiveService.assertProjectNotArchived` guards to `tasks`, `drawings`, `finance`, `updates`, and `snags` domain services.
