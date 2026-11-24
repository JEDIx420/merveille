# Relational data model and integrity

Status: logical schema and migration contract. Implement and test D1 SQL migrations; this document is not a migration file. Cross-check [requirements](../product/requirements.md) and [domain workflows](../workflows/).

## Common conventions

Use stable opaque IDs. Every business row carries `organization_id`; project-scoped rows also carry `project_id`. Use composite foreign keys or equivalent database constraints so a row cannot attach a resource from a different organization/project. Store UTC timestamps and explicit business dates. Display the configured business timezone, initially `Asia/Kolkata`. INR is the proposed base currency; record currency explicitly rather than assuming every amount is INR forever.

Mutable aggregate roots have an integer `revision`. Commands supply `expectedRevision`. Historical snapshots and approval/event rows are append-only. Avoid hard delete of referenced users, drawings, invoices, receipts and archived projects. Enumerations must use checked values or reference tables, not arbitrary frontend strings.

Money is stored in integer minor units, bounded so storage/driver/aggregation cannot lose precision. JSON represents money as decimal integer strings with currency. Do not use floating-point currency arithmetic. SQLite integer range is wider than JavaScript's safe integer range; enforce safe conversion and aggregate bounds or use an explicitly tested alternative representation. Cloudflare notes precision concerns in [D1 export behavior](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

## Identity and access tables

| Entity | Essential fields and constraints |
|---|---|
| `organizations` | ID, working/display name, timezone, base currency, status |
| `users` | ID, display name, email, status, created/disabled timestamps; identity linkage separated from editable profile |
| `identities` | User ID, provider issuer, subject; unique `(issuer, subject)` |
| `organization_memberships` | Organization/user, active state; unique pair |
| `role_assignments` | Membership, role/capability bundle, scope; audited grant/revoke |
| `invitations` | Organization, normalized email, intended role/project grants, expiry, token digest if used, inviter, provisioning state, accepted timestamp |
| `client_accounts` | Client person/household/business grouping; distinct from login user |
| `client_account_memberships` | Client account/user, MAIN_CLIENT or CLIENT_REP; designated main-client rule explicit |
| `project_memberships` | Organization/project/user, project role, active state, assigned/revoked timestamps; unique active assignment per intended role |
| `access_provisioning_jobs` | Invitation/user, intended policy change, attempt count, status, last sanitized error |

Main-client authority should be attached to the particular project/contract if clients share projects differently. Changing the main client is an audited admin action; it must not rewrite who accepted earlier quotations or changes.

## Project operations

| Entity | Essential fields and constraints |
|---|---|
| `enquiries` | Client account, contact, requirements, location/site reference, owner, stage, source, revision |
| `feasibility_studies` | Project/enquiry, immutable revision, scope/findings, supporting file links, prepared/released actor and dates |
| `projects` | Client account, code/name, location, manager, stage, status, main client, activation evidence IDs, archive timestamp/reason, revision |
| `project_stages` | Project, order, planned dates, actual completion, completion actor, revision |
| `tasks` | Project, creator, assignee, title, description, manager-approved deadline, status, completed/reopened timestamps, revision |
| `task_events` | Task, event type, actor, old/new status/deadline, reason, command ID |
| `updates` | Project, author, content, visibility intention, DRAFT/IN_REVIEW/CHANGES_REQUESTED/PUBLISHED/RETRACTED/CANCELLED, reviewer/publisher, published snapshot/revision |
| `update_revisions` | Immutable submitted/published content and referenced file versions |
| `internal_comments` | Project/entity, author, body, internal visibility, edits as history |
| `announcements` | Organization, draft/published state, explicit audience, manager/admin publisher |
| `government_records` | Project, SANCTION or COMPLETION record, manually entered application/status dates/reference, updater, revision |
| `government_record_events` | Status history and immutable supporting file references; no integration credential |
| `snags` | Project, location/category, description, reporter, assignee, severity, due date, status, resolution/reopen history |
| `material_selections` | Project, options, reference attachments, proposer, selected option, main-client decision, revision |
| `reference_submissions` | Project, client/representative uploader, caption, file IDs, created timestamp |

Preserve an enquiry without an active project if the firm is still investigating. Either a project-like prospect container or a nullable linked project is acceptable, provided documents and permissions already have a stable scope and conversion does not duplicate finance records.

## Drawings and file references

| Entity | Essential fields and constraints |
|---|---|
| `drawings` | Project, drawing code/title/discipline, reviewer scope, `current_released_version_id`, revision; unique project drawing code |
| `drawing_versions` | Drawing/project, version number, immutable source file, preview file, notes, content hash if available, lifecycle, created actor/date; unique `(drawing_id, version_number)` |
| `drawing_review_assignments` | Exact version, assigned consultant, required/optional flag, assigning manager, assignment revision and history; all designated required reviewers must approve |
| `drawing_reviews` | Exact version, consultant identity/assignment, decision, comments, decided timestamp; immutable decision event |
| `drawing_releases` | Exact version, manager, consultant review reference, release timestamp, previous current version, command ID |
| `files` | Organization/project, opaque R2 key, original/safe display name, declared/detected MIME, byte length, checksum metadata, uploader, security state, retention classification |
| `file_links` | File, owning entity/revision, relationship purpose, visibility; validate same project and prevent scope broadening |
| `upload_sessions` | File/project/user, upload identifier, expected size/type, expiry, status, multipart state, last activity |

Drawing lifecycle: `DRAFT → IN_REVIEW → CONSULTANT_APPROVED → RELEASED`. A draft may change its linked immutable file objects before submission; the submitted version snapshot then freezes. A returned version is `CHANGES_REQUESTED`/`REJECTED` according to the product workflow and is not mutated into different bytes. A replacement is a new version. Old released material becomes `SUPERSEDED` only when a new approved version is released by the manager. The previous current version remains available while the replacement is in review. Manager withdrawal marks it `WITHDRAWN` with no automatic fallback; cancellation stops an unissued submission. Client approval is absent from this state machine.

Use a unique current pointer and a transactional release command; do not infer current from maximum upload time. A consultant's permission removal or reassignment must be checked before accepting a review, and release must verify the required approval policy against the version being released.

## Financial entities

| Entity | Essential fields and constraints |
|---|---|
| `quotations` / `quotation_versions` | Project, version, line items, currency, totals, status, expiry, issued snapshot, main-client acceptance evidence |
| `payment_schedules` / `schedule_versions` | Project/quotation, manager, version, published timestamp, reason for change |
| `payment_milestones` | Schedule version, fixed-date or stage trigger, amount, linked stage/date, due state, activation event |
| `invoices` / `invoice_lines` | Project, number, draft revision, manager approval, issued immutable snapshot, subtotal/tax/total, due date, currency, status |
| `invoice_adjustments` | Credit/debit/reversal link, amount, reason, approver, issued timestamp; no silent replacement |
| `receipts` | Project, paid date, reference, method, currency, amount, admin confirmer, immutable confirmation/reversal evidence |
| `receipt_allocations` | Receipt to invoice/milestone/change estimate; sum cannot exceed confirmed un-reversed receipt value |
| `change_requests` / `change_estimates` | Scope, price/schedule effect, immutable accepted version, main-client agreement, manager approval, required payment and allocation |
| `expenses` | Project or overhead, category, supplier, amount, incurred/paid dates, approval, linked evidence |
| `consultant_bills` | Project/consultant, agreed fee, bill/credit, due/paid amounts; not automatically exposed with client finance |
| `salary_records` / `salary_allocations` | Employee, pay period, confirmed amount, allocation to project/overhead, admin access classification |
| `ledger_entries` | Immutable financial event/source, account/category mapping, debit/credit or signed movement, currency, date, reversal-of ID |
| `financial_periods` | Period boundaries, open/closed state, admin close/reopen event |

The ledger represents recorded operational accounts, not an automatic statutory filing system. Before finalizing reports, define the income/cost recognition basis and salary allocations with the owner/accountant. [Finance integrity](finance-integrity.md) specifies gates and report labels.

Archive freezes project content and new work but does not erase receivables or payables. Append-only financial settlement events against existing obligations may continue through the narrow ADMIN settlement path. Record the archived-project context and original obligation on each such command; enforce normal approval/posting rules for corrections. No new invoice, schedule revision, drawing release or scope expansion is allowed through this exception. Existing membership rows remain until explicitly revoked, and retained access still obeys current user status.

## Work queues, notifications and audit

| Entity | Essential fields and constraints |
|---|---|
| `commands` | Organization/actor/operation/idempotency key, request digest, target/revision, state, safe result reference; unique request identity |
| `outbox_events` | Immutable event ID/type, entity/version, minimal payload, occurred timestamp, dispatched timestamp |
| `job_runs` | Event/job ID, attempt, lease, state, retry-after, last error; unique deduplication identity |
| `notifications` | Recipient, project/entity, channel, reason, due date/version, read/resolved timestamps, delivery status |
| `notification_preferences` | User, portal settings, verified WhatsApp number, opt-in evidence, opt-out timestamp, quiet hours |
| `notification_deliveries` | Notification, provider message ID, attempts/status timestamps; avoid claiming delivered at API acceptance |
| `webhook_events` | Provider event key, validated timestamp, processing state; deduplicate callbacks |
| `audit_events` | Actor, scope, action, entity/version, command ID, timestamp, sensitivity, redacted change summary |
| `performance_reviews` | Employee/project/period, owner-entered quality assessment, deadline/rework inputs, notes; OWNER-only |

“Waiting on you” is initially a permission-filtered query over actual pending commands/reviews, not an independently editable task duplicate. A dismissed notification does not complete its underlying approval or invoice.

## Transactions and concurrency

Cloudflare's [D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/) executes prepared statements transactionally and rolls back on statement failure. Use supported D1 APIs; do not assume arbitrary nested ORM transactions or network-spanning `BEGIN/COMMIT` work.

Each command must atomically validate the relevant current state and write the aggregate, child records, audit and outbox. A prior application `SELECT` is insufficient protection against races. For critical approvals, release, payment and permission changes, transaction guards also check the actor's current active membership/capability so a concurrent revocation cannot be ignored between an earlier authorization read and the write. Conditional updates returning zero affected rows do **not** automatically fail a batch. Guard all dependent inserts or use checked SQL assertions that deliberately fail the transaction when preconditions are false. Prove the chosen pattern in local D1/Workerd with concurrent stale commands. Never commit an outbox notification saying “released” when the release update affected zero rows.

D1 transactions do not span R2, Queues or Meta. Use explicit pending/finalized states and reconciliation for object uploads; use the transactional outbox for messages. Never describe a database-plus-object-store or external-send sequence as one atomic transaction.

For manager release, the same transaction checks organization/project/version/consultant approval and expected drawing revision; updates the current pointer; marks prior release superseded; adds release/audit/outbox records; advances revision. For payment confirmation, it checks receipt identity, amount and allocations before adding financial/audit events. For project activation, it verifies the accepted quotation version and sufficient confirmed advance allocation.

Idempotency keys must be tied to actor, operation, target and a request digest. Reusing a key with different input is a conflict. Replaying a completed request returns the same safe result; it must not create a second receipt, invoice number, drawing release or message.

## Indexes, migrations and reads

Index organization/project foreign keys, active membership lookups, task status/due date, drawing current/version keys, published updates, open invoice/due dates, receipt references, outbox dispatch state, notification recipient/unread state and archive status. Default list limit 25 with cursor pagination and a bounded maximum. Authorize before counting or grouping; dashboards can leak data through totals.

Keep authorization reads current on the primary consistency path. Do not add read replication in the initial build; if introduced later, use the documented D1 Sessions API and test revocation/read-after-write behavior. Avoid FTS virtual tables in the initial build because backup/export support must remain straightforward; add searchable metadata with scoped queries first. Migrations are additive where possible, tested against an existing-data fixture, and backed by rollback/recovery plans.
