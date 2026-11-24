# Phase 03 Evidence: Private Documents, Media Storage and Authenticated File Delivery

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P03 / REQ-FIL-001 through REQ-FIL-005, REQ-IAM-007; AC-056, AC-057, AC-058, AC-059, AC-060
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite & in-memory R2
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `mainClientUser`, `revokedClientUser`) and test projects (`prj_villa_alpha`, `prj_residence_beta`)

## Changed behaviour

- Created D1 migration `migrations/0003_files_and_media.sql` containing tables:
  - `files`: File metadata, class (`IMAGE`, `PDF`, `CAD`, `VIDEO`, `DOCUMENT`), server-assigned immutable storage key, upload status (`PENDING`, `READY`, `DELETED`), internal-only flag, reference type/id, and retention flag `is_referenced`.
  - `upload_sessions`: Multipart upload tracker with expected size, R2 multipart upload ID, part count, status (`ACTIVE`, `COMPLETED`, `ABORTED`, `EXPIRED`), and 24-hour expiration window.
  - `upload_parts`: Individual uploaded chunk ETags, byte size, and timestamp for safe online retries.
- Implemented Private Storage Domain Service in `src/server/files/service.ts`:
  - `validateUploadParameters`: Enforces size ceilings (IMAGE: 25 MiB, PDF: 100 MiB, CAD: 250 MiB, VIDEO: 1 GiB, DOCUMENT: 50 MiB); strictly rejects active executable extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.bin`, `.html`, `.htm`, `.js`, etc.) and active HTML MIME types (AC-058).
  - `initUploadSession`: Re-verifies project access; blocks foreign project IDs; blocks client attachment to internal notes or official drawings/invoices (AC-057); blocks new uploads to archived projects except admin settlement evidence; assigns immutable server-side key (`org/{orgId}/project/{projectId}/file/{fileId}/original`).
  - `uploadPart`: Streams chunk to R2; records/upserts part record so failed parts can retry online without restarting the whole upload (AC-056).
  - `completeUploadSession`: Completes R2 multipart upload; strictly verifies finalized object size matches expected total bytes before transitioning from `PENDING` to `READY` (AC-056, AC-058).
  - `getFileForDownload`: Enforces current authorization on every request (AC-059); verifies project membership and active status (revocation denies downloads immediately); hides internal files from clients/consultants; sets private non-cacheable headers (`Cache-Control: private, no-cache, no-store, must-revalidate`, `X-Content-Type-Options: nosniff`); handles valid HTTP `Range` headers returning HTTP 206 Partial Content.
  - `cleanupOrphanedUploadSessions`: Purges only abandoned/expired upload sessions and temporary chunks; strictly preserves retained files (`is_referenced = 1` or attached to drawings/invoices) (AC-060).
  - `deleteFile`: Guarded manager/admin delete; prevents deletion of retained files with `FILE_RETAINED_PROTECTED` (AC-060).
- Implemented API handlers:
  - `src/app/api/files/init/route.ts`: `POST` (initializes upload session).
  - `src/app/api/files/part/route.ts`: `PUT` (receives and streams chunk body).
  - `src/app/api/files/complete/route.ts`: `POST` (finalizes multipart session or aborts).
  - `src/app/api/files/[id]/download/route.ts`: `GET` & `HEAD` (authenticated download and range streaming).
  - `src/app/api/projects/[id]/files/route.ts`: `GET` (list project files) and `DELETE` (guarded delete).
- Built Document & File Manager UI:
  - `src/app/(portal)/projects/[id]/documents/page.tsx`: SCR-09 Document Manager with client-side chunking, progress bar, retry loop on failed parts, honest CAD download-only notice (no fake browser previews), video player, and honest storage disclaimer stating no automated antivirus scanning claim is made.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-056 | `npm test -- tests/integration/files/p03-files.test.ts` | PASS | 16 MiB multipart upload; chunk 2 retried; finalized object verified; CAD file classified as CAD without fake preview |
| AC-057 | `npm test -- tests/integration/files/p03-files.test.ts` | PASS | Client uploading to foreign project rejected with `CROSS_PROJECT_DENIED`; client creating internal attachment or invoice tamper rejected; server assigns key `org/.../original` |
| AC-058 | `npm test -- tests/integration/files/p03-files.test.ts` | PASS | `.html` and `.exe` rejected with `PROHIBITED_FILE_TYPE`; `text/html` MIME rejected with `PROHIBITED_MIME_TYPE`; 30 MiB image rejected with `FILE_TOO_LARGE`; honest CAD download-only disclaimer rendered |
| AC-059 | `npm test -- tests/integration/files/p03-files.test.ts` | PASS | Authenticated download returns `Cache-Control: private, no-cache, no-store, must-revalidate` and `nosniff`; HTTP `Range: bytes=100-199` returns HTTP 206 Partial Content; revoked client denied with HTTP 403 |
| AC-060 | `npm test -- tests/integration/files/p03-files.test.ts` | PASS | `deleteFile` on file with `is_referenced = 1` or `reference_type = 'DRAWING'` throws `FILE_RETAINED_PROTECTED`; `cleanupOrphanedUploadSessions` purges only abandoned upload debris while preserving retained files |
| Full Test Suite | `npm test` | PASS | 6 test files, 27 tests passing in 321ms with zero mocks and real relational D1 & R2 logic |
| Production Build | `npm run build && npm run build:worker` | PASS | 19 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 194 files |

## Remaining work

- P03 phase gate is fully satisfied.
- Ready to proceed to Phase P04: Tasks, deadlines and completion history.

## Recovery impact

- Applied migration `0003_files_and_media.sql` creating tables `files`, `upload_sessions`, and `upload_parts`.
- R2 bucket binding `PROJECT_FILES` actively used for private storage.
