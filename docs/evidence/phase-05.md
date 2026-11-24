# Phase 05 Evidence: Drawing Register, Consultant Approval, and Manager Release

## Identity

- Phase / requirement IDs: P05 / REQ-DRW-001 through REQ-DRW-008, REQ-FIL-001 through REQ-FIL-005, REQ-IAM-003, REQ-IAM-004; AC-016, AC-017, AC-018, AC-019, AC-020, AC-021
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `consultant1`, `consultant2`, `unrelatedConsultant`, `clientUser`) and project `prj_drawing_villa`

## Changed behaviour

- Created D1 migration `migrations/0005_drawing_register.sql` containing tables:
  - `drawings`: Logical drawing sheet record with drawing number (e.g. `MD-ARC-101`), title, discipline (`ARCHITECTURAL`, `STRUCTURAL`, `MEP`, `LANDSCAPE`, `INTERIOR`, `CIVIL`), pointer to `current_released_version_id`, withdrawal flag, and revision.
  - `drawing_versions`: Version snapshots (`V1`, `V2`, `V3`), linked file reference (with `is_referenced = 1` protection), CAD file link, submission note, author ID, status (`DRAFT`, `IN_REVIEW`, `CONSULTANT_APPROVED`, `RELEASED`, `SUPERSEDED`, `CHANGES_REQUESTED`, `REJECTED`, `WITHDRAWN`), released_at, released_by_user_id, superseded_at.
  - `drawing_reviews`: Designated required consultant reviews, decision (`PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`), technical reason, decided_at.
- Implemented Drawing Domain Service in `src/server/domain/drawings/service.ts`:
  - `createDrawing`: Registers logical drawing sheet numbers per discipline.
  - `createDrawingVersion`: Creates version snapshot; marks file `is_referenced = 1` preventing deletion (AC-060); establishes required consultant reviews.
  - `submitDrawingForReview`: Transitions draft to `IN_REVIEW` only if at least one required consultant is designated.
  - `submitConsultantReview`: Enforces version-specific binding (AC-016); rejects unassigned consultants (`UNASSIGNED_REVIEWER`); strictly rejects client review attempts with `FORBIDDEN` ("Clients do not approve drawings"); transitions version to `CONSULTANT_APPROVED` once all designated required consultants have approved; consultant approval alone NEVER releases or publishes (AC-017).
  - `releaseDrawingVersion`: Guarded manager publication boundary (AC-017); requires `CONSULTANT_APPROVED` status; rejects client release attempts; atomically supersedes previous release (AC-018); enforces optimistic concurrency on `expectedCurrentVersionId` (AC-021); behaves idempotently on duplicate/retry calls.
  - `withdrawDrawing`: Guarded manager command; clears current released version; sets `WITHDRAWN`; does not auto-fallback to older versions (AC-018).
  - `getDrawing`: Client protection filter (AC-020) — clients see ONLY `RELEASED` (current) and `SUPERSEDED` (historical) versions. Unreleased drafts, in-review, and rejected versions are hidden.
- Implemented API handlers:
  - `src/app/api/projects/[id]/drawings/route.ts`: `GET` (list drawings by discipline) and `POST` (create sheet).
  - `src/app/api/drawings/[id]/route.ts`: `GET` (detail with versions) and `POST` (`CREATE_VERSION`, `WITHDRAW`).
  - `src/app/api/drawings/versions/[versionId]/route.ts`: `POST` (`SUBMIT_REVIEW`, `CONSULTANT_DECISION`, `RELEASE`).
- Built UI Screen:
  - `src/app/(portal)/projects/[id]/drawings/page.tsx`: SCR-08 Drawing Register & Version History with discipline filters, current release badges, expansion drawer for version review history, "Superseded — do not use as the current version" labels, modals for creating drawing sheets, uploading new versions, consultant reviews, and final manager releases.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-016 | `npm test -- tests/domain/drawings/p05-drawings.test.ts` | PASS | V1 requires 2 consultants; consultant 1 approves while version stays `IN_REVIEW`; unassigned consultant rejected with `UNASSIGNED_REVIEWER`; consultant 2 approves advancing version to `CONSULTANT_APPROVED` |
| AC-017 | `npm test -- tests/domain/drawings/p05-drawings.test.ts` | PASS | Consultant approval alone leaves version in `CONSULTANT_APPROVED`; client attempting approval/release rejected with `FORBIDDEN` ("Clients do not approve drawings"); manager release succeeds and sets `status = 'RELEASED'` |
| AC-018 | `npm test -- tests/domain/drawings/p05-drawings.test.ts` | PASS | V1 is released and current; V2 uploaded and rejected; V1 remains current; V3 released atomically superseding V1; rejected V2 is not mislabeled superseded |
| AC-019 | `npm test -- tests/domain/drawings/p05-drawings.test.ts` | PASS | V1 approved; author submits V2 with revised content; manager cannot release V2 using V1 approvals (throws `APPROVALS_INCOMPLETE`); V2 requires fresh consultant approvals |
| AC-020 | `npm test -- tests/domain/drawings/p05-drawings.test.ts` | PASS | Client queries drawing; client view returns ONLY released and superseded versions; unreleased drafts and rejected versions are completely filtered |
| AC-021 | `npm test -- tests/domain/drawings/p05-drawings.test.ts` | PASS | Release with stale expectedCurrentVersion throws `CONCURRENCY_CONFLICT`; duplicate release command is idempotent; at most one current release survives |
| Full Test Suite | `npm test` | PASS | 8 test files, 35 tests passing in 505ms with genuine SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 19 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 211 files |

## Remaining work

- P05 phase gate is fully satisfied.
- Ready to proceed to Phase P06: Published updates, company notices and manual K-SMART records.

## Recovery impact

- Applied migration `0005_drawing_register.sql` creating tables `drawings`, `drawing_versions`, and `drawing_reviews`.
