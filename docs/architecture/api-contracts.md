# API and command contracts

Status: target contracts for the implementation agent. There is no running API yet. Route naming may be refined in an ADR without changing behavior. Server actions may wrap the same domain services; never implement different permission rules for two entry points.

## Common protocol

Use a versioned application prefix such as `/api/v1`. JSON uses explicit resource IDs, ISO timestamps, business dates as `YYYY-MM-DD`, and money `{ "amountMinor": "12500000", "currency": "INR" }`. Return only the fields that principal can see. Responses include a correlation ID; collections return items, a next cursor and authorized counts. Keep arbitrary SQL/filter expressions out of input.

Mutating commands carry an `Idempotency-Key` and, for an existing aggregate, `expectedRevision`. The authenticated principal supplies actor/organization; never trust a submitted `actorId` or `role`. Resource IDs supplied by the client are reloaded and scoped at the server. The database transaction includes audit/outbox events when needed.

Use `401` for unauthenticated identity, `403` for a forbidden action on a resource the caller may know exists, and `404` for a resource outside their allowed scope. Use `409` for stale revision, conflicting idempotency, illegal transition, duplicate numbering or conflicting approved state. Use `422` for valid JSON with invalid fields/business prerequisites, `413` for upload size limits, and `429` for throttling. A failure returns a stable error code and safe message; it does not disclose another client's name or financial amount.

Example command intent (illustrative, not implemented):

```json
{
  "drawingVersionId": "opaque-version-id",
  "expectedRevision": 7,
  "releaseNote": "Issued for the agreed site stage"
}
```

Example stale response:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "This drawing changed. Reload it before releasing.",
    "correlationId": "opaque-request-id"
  }
}
```

## Identity and projects

| Endpoint family | Contract and access |
|---|---|
| `GET /me` | Active identity, permitted role labels, capabilities, project switcher summaries; no secret/session token echo |
| `POST /invitations` | ADMIN only; email, explicit project roles/grants, expiry; creates pending provisioning and audit. Global ADMIN/OWNER elevation uses a separately visible audited policy, never an ordinary project-role field |
| `POST /invitations/:id/revoke` | ADMIN only; expires invitation, cancels pending delivery/provisioning |
| `PUT /users/:id/project-memberships` | ADMIN only; desired grants with revision; preserve history and prevent self-lockout without another active admin |
| `POST /users/:id/disable` | ADMIN only; immediate D1 disable and async identity-policy cleanup |
| `GET /projects` | Authorized projects; filters active/archive, stage and client; counts scoped before aggregation |
| `POST /enquiries` | Authorized staff; requirements/contact/site reference; stable permission scope from creation |
| `POST /enquiries/:id/feasibility-revisions` | Staff; findings and permitted file references; immutable submitted revisions |
| `POST /projects/:id/activate` | Actor with assigned MANAGER capability; accepted quote version plus confirmed advance must satisfy activation gate |
| `POST /projects/:id/archive` | Authorized admin/manager per role matrix; retain records and external read/download grants |
| `POST /projects/:id/reopen` | Explicit archive-reopen capability for ADMIN or assigned MANAGER per policy; reason, expected revision, audited return to active state |

An archive operation must not erase pending money obligations or staff membership history. Outstanding obligations remain visible and may retain authorized reminders. Project-content writes, new work, new invoices and schedule changes require controlled reopening. A narrow ADMIN settlement command may append confirmed receipts, allocations, refunds/reversals and normally approved corrections against existing obligations while archived. It must identify the pre-existing obligation and preserve normal manager-approval/admin-posting requirements for a correction; archive status never supplies an approval bypass. Settlement evidence may be attached only to that restricted financial record, not published as new project content.

## Operational work

| Endpoint family | Contract and access |
|---|---|
| `GET/POST /projects/:id/tasks` | Assigned internal team; create self-task or manager-assigned task; manager controls authoritative deadlines |
| `POST /tasks/:id/complete` | Assigned member/authorized team per policy; completion note/evidence, revision |
| `POST /tasks/:id/reopen` | MANAGER; reason required; preserves previous completion event |
| `POST /tasks/:id/set-deadline` | MANAGER; new date, reason, revision; updates reminders by milestone revision |
| `POST /projects/:id/updates` | Team draft; content, attachment IDs, internal or proposed-public audience |
| `POST /updates/:id/submit` | Author/authorized staff; freezes submitted revision for review |
| `POST /updates/:id/publish` | MANAGER; only reviewed revision and allowed files become visible externally |
| `POST /updates/:id/return` | MANAGER; feedback; does not leak internal reviewer notes to clients |
| `GET/POST /projects/:id/government-records` | Manual K-SMART status/supporting screenshots; staff writes and reviewed external projection |
| `GET/POST /projects/:id/snags` | Permission-filtered reports; create with location, photos, assignee and urgency |
| `POST /snags/:id/resolve` | Assigned staff submits resolution evidence to `READY_FOR_VERIFICATION`; does not close the snag |
| `POST /snags/:id/verify` / `reopen` | MANAGER verifies closure or reopens with evidence/reason; preserves previous history |
| `POST /projects/:id/references` | Client or representative; images/caption; no authority to publish internal drawings |
| `POST /material-selections/:id/decide` | MAIN_CLIENT if a binding selection is requested; representative may suggest/comment |
| `GET /waiting-on-me` | Derived authorized actions with deep link, due date, responsible role and current revision |

Government records are stored information, not an automated assertion that a government approval is genuine. Preserve who entered each status and the evidence that supports it. Public-facing labels should show manual update time.

## Drawings

| Endpoint | Actor and invariant |
|---|---|
| `POST /projects/:id/drawings` | Internal team; drawing code, title, discipline, proposed consultant review scope |
| `POST /drawings/:id/versions` | Internal team; new immutable source file and optional safe preview; do not overwrite released bytes |
| `POST /drawing-versions/:id/submit` | Internal team; required metadata and verified upload ready |
| `POST /drawing-versions/:id/review` | Assigned CONSULTANT; approve or request changes; exact content/version target |
| `POST /drawings/:id/release` | MANAGER; consultant-approved exact version, expected drawing revision, release note |
| `POST /drawings/:id/withdraw` | MANAGER; current released version, reason, impact acknowledgement; no automatic fallback to old versions |
| `GET /drawings/:id/versions` | Role-filtered history; clients receive released/superseded material only by default |

Client drawing approval endpoints do not exist. Manager release is a separate command from consultant review. Reassignment, new version upload or stale review does not implicitly release anything. The release response reports the new current version only after transaction success.

## Finance

| Endpoint family | Actor and contract |
|---|---|
| `POST /projects/:id/quotation-versions` | Finance-authorized team/manager; draft complete line-item snapshot |
| `POST /quotation-versions/:id/issue` | Per financial policy; issued snapshot and schedule references frozen |
| `POST /quotation-versions/:id/accept` | MAIN_CLIENT; exact issued terms/version; representatives and staff cannot substitute client acceptance |
| `POST /projects/:id/payment-schedule-versions` | MANAGER only; changed schedule, reason and revision; prior schedule retained |
| `POST /projects/:id/invoices` | Authorized staff; draft invoice and line items |
| `POST /invoices/:id/approve` | MANAGER; exact invoice revision and totals |
| `POST /invoices/:id/issue` | Authorized staff; requires manager-approved unchanged revision; transactional unique number |
| `POST /invoices/:id/adjustments` | Authorized finance author prepares linked correction draft/reason; original issued snapshot remains intact |
| `POST /invoice-adjustments/:id/approve` | MANAGER approves the exact correction revision and affected balances |
| `POST /invoice-adjustments/:id/post` | ADMIN posts unchanged manager-approved correction; existing-obligation checks also apply when archived |
| `POST /projects/:id/receipts/confirm` | ADMIN; received date/reference/amount/method/allocations; idempotent and auditable |
| `POST /receipts/:id/allocations` | ADMIN; allocate/reallocate available confirmed value with source/target history and balance constraints |
| `POST /receipts/:id/reverse` | ADMIN; reason and offsetting record, no destructive delete |
| `POST /change-estimates/:id/accept` | MAIN_CLIENT; exact terms and version |
| `POST /change-estimates/:id/authorize-work` | MANAGER; accepted version plus required confirmed payment; no browser-only override |
| `GET /projects/:id/client-finance` | Authorized clients/consultants: client quote, issued invoices, schedule and confirmed receipts only |
| `GET/POST /finance/expenses` | Internal authorized accounting role; excludes payroll unless ADMIN |
| `GET/POST /finance/salaries` | ADMIN only; explicit sensitive projection/export policy |
| `GET /finance/profit` | ADMIN only; report basis/date range disclosed; no inference through generic totals |
| `GET/POST /performance` | OWNER only; separate from ADMIN privilege |

Browser-submitted receipt evidence is not payment confirmation. Never let uploading a bank screenshot unlock a project or extra work. Numbering, correction and period close behavior must be tested against [finance integrity](finance-integrity.md).

## Files, jobs and notification endpoints

Upload endpoints create an authorized session, accept bounded multipart chunks, list known part state, finalize verification, or abort. The server assigns the R2 key; the browser cannot choose a different project's prefix. Finalization rechecks permission. `GET /files/:id/content` and preview endpoints independently authorize current file visibility and support bounded range requests for previews/video. See [file storage](files-and-media.md).

`GET /notifications`, read/dismiss commands and preferences operate on the current user. Changing a delivery number requires verification and new opt-in evidence. Admin can inspect sanitized delivery failure state, not everyone else's private notification body. The Meta callback is a separate signed endpoint; it cannot use app cookie authentication as its trust basis.

Exports are explicit requests with type, filters, audience and authorization checked at generation and download. A queued export does not preserve access after revocation. Poll through an authenticated job endpoint; no public job lookup by opaque ID alone. All export files inherit the originating record's sensitivity and expire according to a documented short retention policy, unlike permanent project originals.

## Contract-level test checklist

For every mutating command: happy path, unauthorized role, cross-project input, inactive user, archived state, stale revision, double submission, changed payload with same idempotency key, storage failure and transaction rollback. For list endpoints: one user with two projects, another with one overlapping project, sensitive field omission, pagination stability and private caching. For files: guessed ID, revoked grant, oversize/type mismatch, interrupted upload, unauthorized finalize and byte-range behavior.
