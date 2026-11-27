# Functional repairs and release evidence

**27 November 2026 next-phase scope:** [The active N00–N05 plan](../next-phase/README.md) supersedes conflicting instructions below. Use Cloudflare Free only, bounded open-source voice, external billing with version-bound ADMIN commercial clearance, and manually prepared WhatsApp messages with API delivery disabled. Preserve completed work, historical records, access/approval rules and applicable recovery gates. Older finance/provider setup and execution sequences below are retained as reference; they are not current work or permission to enable paid services.

This is an implementation brief for the existing application, based on source commit `813ef8b765045b95ff713665a3217e4487491d75`. It does not authorize live messages, production migrations or deployment changes. Preserve working domain services, historical records, identifiers and migrations. Improve the existing Cloudflare application; do not replace it with a new product.

Read [identity and real-person testing](02-identity-and-real-user-testing.md), [interface requirements](03-premium-interface.md), [confirmed requirements](../product/requirements.md), [permissions](../product/roles-and-permissions.md) and the relevant [workflows](../workflows/README.md). The current source has real implementation work, but comments, synthetic results and checked task boxes are not release evidence.

## Execution order and gates

Complete F01–F04 before exposing business records to real external users. F05–F08 finish the agreed workflows and release verification. Interface work and isolated developer tests can proceed alongside these repairs. Provider credentials can block hosted identity, real WhatsApp delivery or an actual remote restore drill; they must not block implementing and testing independent code locally. Record each dependency accurately and leave incomplete integrations visibly disabled.

For every consequential command, establish the actor capability, current organisation membership and applicable global or project scope, valid prior state, immutable version, expected revision, idempotency key and audit event. Global ADMIN operations follow their explicit authority; do not add an accidental project-membership prerequisite. Enforce these in the service and HTTP boundary. Repeated identical commands return the original outcome; reuse of a key with different input conflicts. Concurrent commands must not both spend money, issue numbers or replace a release.

## F01 — Close production entry points and establish a safe baseline

**Targets:** [Wrangler configuration](../../wrangler.jsonc), [session resolution](../../src/server/auth/session.ts), [JWT validation](../../src/server/auth/jwt.ts), [runtime diagnostic](../../src/app/api/runtime/spike/route.ts), [root page](../../src/app/page.tsx).

Coordinate identity changes with document 02. The default deployment currently combines production bindings with `ALLOW_SYNTHETIC_AUTH: "true"`; a safer named environment does not protect that default. The JWT helper checks decoded claims without verifying the signature. Neither is an acceptable real-user boundary. Eliminate deployed synthetic identity paths and require verified, active, invited identities before private business operations. Pending identities may use only the narrowly scoped, authenticated bootstrap/invitation acceptance flow that validates their exact invitation before activating membership.

Remove the public diagnostic route or make it unavailable outside an isolated local harness, rejecting before accessing bindings. Its GET currently writes D1 and R2. Remove its dashboard link and ensure routine GET/HEAD requests cannot mutate business data. Map the normal landing page to the role-appropriate application home.

Keep the existing supported Next/OpenNext runtime unless a demonstrated incompatibility requires a change. Make local, staging and production bindings explicit and prevent local tests from targeting production resources. Add migrations for later repairs; do not rewrite already-applied migrations. Use a disposable copy of the prior schema with representative records to prove upgrades preserve versions, memberships and balances.

**Exit evidence:** forged/expired identity rejected; unauthenticated diagnostic requests cause zero writes; revoked identities cannot retrieve files; actual default configuration cannot enable demo auth. Hosted verification is separately recorded when deployment access is available.

## F02 — Make permissions and project selection consistent

**Targets:** [principal resolution](../../src/server/auth/session.ts), [policy](../../src/server/auth/policy.ts), [people service](../../src/server/domain/identity/service.ts), [drawing screen](../../src/app/%28portal%29/projects/%5Bid%5D/drawings/page.tsx).

Replace the single priority role with explicit capabilities plus project grants. Preserve users holding several legitimate capabilities; do not silently convert an unrecognised or empty role to staff. ADMIN controls people, salaries and profit; OWNER controls individual performance; MANAGER controls operational approvals. ADMIN/OWNER alone must not release drawings or approve invoices. Bind main-client contractual authority to the specific project.

Apply the same policy to lists, detail routes, aggregates, reports, exports, background delivery and attachment access. Consultants retain the assigned project's client quotation, payment schedule, issued invoices and payment history, without internal notes, bank evidence, costs, payroll or profit. Representatives receive only their explicit grants. Membership revocation must immediately affect fresh requests and queued delivery.

Create a limited project-participant endpoint for eligible assignees/reviewers. The drawing screen currently calls ADMIN-only `/api/people`, then presents failures as an empty consultant list. Task and snag selectors need the same scoped contract. Return only necessary identity fields; do not loosen the global people endpoint or require users to type raw user IDs.

**Exit evidence:** HTTP requests demonstrate cross-project denial, correct multi-capability access, denied restricted totals, and valid non-admin selectors. Include an account that is manager on one project and representative on another. Test service callers as well as hidden-button behaviour.

## F03 — Repair drawing release and attachment publication together

**Targets:** [drawing service](../../src/server/domain/drawings/service.ts), [file service](../../src/server/files/service.ts), [download endpoint](../../src/app/api/files/%5Bid%5D/download/route.ts), [documents screen](../../src/app/%28portal%29/projects/%5Bid%5D/documents/page.tsx).

Follow team preparation/review → assigned consultant approval → manager final release. Clients have no drawing approval step. Every required reviewer approves the exact immutable version; a replacement file or changed reviewer requirement invalidates the applicable outstanding approval state. Preserve the current client release while a new draft is reviewed.

File access currently depends mainly on project membership and `is_internal_only`; that can expose an unreleased drawing through Documents or a direct download. Derive visibility from the authoritative parent, audience and version state. Apply this to listing, previews, GET, HEAD, range requests, exports and linked update attachments. Assigned consultants can read their review versions before release; clients receive released versions only. Superseded released versions remain clearly labelled history; rejected/unreleased versions remain appropriately restricted.

Validate organisation, project, uploader authority, upload completion and attachment purpose when linking a file. Never allow another project's file ID to be attached. Keep R2 private and private responses out of shared caches. Preserve working multipart uploads; make failed/aborted uploads recoverable without marking incomplete bytes ready. Online retry is sufficient; offline sync remains out of scope.

Release must atomically validate the expected current version, supersede the previous release, publish the approved version, update the pointer and record audit/outbox state. Separate successful-looking writes are insufficient. Implement a D1-supported atomic design with conditional guards and prove rollback behaviour in the Workers-compatible runtime.

**Exit evidence:** a client cannot download an unreleased file by ID; authorised consultant review works; cross-project attachment fails; failed release preserves the previous release; concurrent releases yield one consistent winner and a conflict; duplicate commands create no duplicate audit/event effects.

## F04 — Protect financial state and commercial gates

**Targets:** [finance service](../../src/server/domain/finance/service.ts), [invoice route](../../src/app/api/invoices/%5Bid%5D/route.ts), [database helpers](../../src/server/db/index.ts), [finance schema](../../migrations/0007_commercial_finance.sql), [changes](../../src/server/domain/changes/service.ts).

Use the following command contracts, retaining the existing domain vocabulary where valid:

| Command | Required actor and guard | Committed result |
|---|---|---|
| Prepare/edit invoice | Scoped finance author; editable current draft | New current immutable content version; previous approval cannot authorise it |
| Approve invoice | Scoped MANAGER; current submitted version; never an issued parent | Approval bound to that version |
| Issue invoice | Scoped issue capability; current approved version | Immutable issued snapshot, unique number, balanced journal and audit |
| Revise payment schedule | Scoped MANAGER; permitted project state | Versioned schedule with reason/history |
| Confirm receipt | ADMIN; valid external receipt evidence/state | One confirmation, one ledger effect |
| Allocate receipt | ADMIN; confirmed receipt and issued invoice in matching organisation/project/currency | Atomic allocation and consistent balances |
| Activate project | Scoped MANAGER; main-client accepted quote and confirmed required advance | One activation with gate evidence |
| Authorise additional work | Scoped MANAGER; main-client accepted estimate and confirmed required payment | Work authorisation bound to accepted scope |

Current edit/issue commands rely on membership without sufficient actor checks, approval can regress an issued invoice, and an obsolete approved version can be issued. Repair these state transitions before polishing their screens. Corrections to issued records use traceable linked adjustments and normal approvals; never overwrite history.

Replace `COUNT(*) + 1` numbering with a database-enforced unique sequence allocation. Validate positive safe-integer minor units, currency, availability and outstanding balance; reject invalid allocation requests without silently changing the amount. Keep received totals distinct from invoiced sales. Apply equivalent controls to expenses, consultant fees and payroll posting.

Receipt confirmation, allocations, journal entries, sequence allocation and their audit/outbox records must commit consistently. A read-then-write revision check does not prevent races. Use verified D1 transaction/batch semantics and guarded updates; do not assume Node SQLite transactions prove D1 behaviour. Enforce unique operation/journal sources. Replays after a timeout must reconcile the committed result instead of posting twice or skipping a missing ledger entry.

Backfill protections carefully. Detect and report inconsistent existing records; prepare an explicit reconciliation rather than inventing payments or deleting history.

**Exit evidence:** wrong actors and stale versions rejected; double issue produces one number/journal; negative, overflow, cross-project and cross-currency allocations fail; parallel allocations cannot overspend; injected failures leave balanced committed state or no mutation. Exercise activation and extra-work gates with missing payment/acceptance and concurrent retries.

## F05 — Complete everyday workflows and honest error handling

**Targets:** existing [domain services](../../src/server/domain/), [API routes](../../src/app/api/), and [screen contracts](../screens/README.md).

Verify staff-created/manager-assigned tasks, manager-set deadlines, assignee completion and manager reopening. Manager publication is required for ordinary updates; private notes stay private. Manual K-SMART sanction/completion evidence must retain status, author, timestamp and documents without suggesting automatic government verification. Preserve references/material selection and main-client change authority. Snags need authorised assignees, evidence, resolution and manager verification/reopening. Waiting-on-you must link to a real permitted action; overdue tasks and approaching project dates must use real data.

Archive must preserve permitted read/download access while blocking operational mutations. Route ADMIN settlement of existing obligations through the same financial commands and ledger protections as F04. The archive exception must not create new invoices, schedules, tasks or drawing releases. Revoked access remains revoked in archive.

Centralise typed error handling: authentication, permission, not-found, validation, state conflict and retryable failure. Check HTTP status/content type before parsing. Preserve safe form input after failure, prevent duplicate submissions, and show explicit retry or conflict recovery. Failed requests must not appear as empty projects, zero balances or successful saves. Sanitised request references can aid support; never expose secrets or stack traces. Online connection loss must produce an honest recoverable state.

**Exit evidence:** actual browser journeys cover these transitions and one genuine interrupted request/upload. Confirm server denial for forbidden operations independently of UI visibility.

## F06 — Implement reminders as durable background work

**Targets:** [notification service](../../src/server/notifications/service.ts), [adapter](../../src/server/notifications/whatsapp.ts), [notification route](../../src/app/api/notifications/route.ts), [webhook](../../src/app/api/webhooks/whatsapp/route.ts), [Wrangler configuration](../../wrangler.jsonc).

Manual scan/dispatch currently hardcodes a synthetic adapter; this is not live delivery. Add Cloudflare scheduled processing and a durable queue/outbox consumer. Cover task, drawing-approval and payment due/overdue events, plus unresolved-item escalation to ADMIN. Commit domain events with their state changes, deduplicate scans by obligation/recipient/reminder window, and make notification read state durable.

Resolve real authorised recipients and verified contact preferences; remove the hardcoded phone/template. Recheck current access and whether work remains unresolved at dispatch. Suppress obsolete reminders after payment, completion, revocation or relevant archive rules. Retry transient failures with bounded backoff; retain failed/unknown outcomes for review. Provider acceptance is not delivery; reconcile verified webhook receipts idempotently, including duplicates and out-of-order statuses.

Keep explicit fake/test/live modes. Missing provider setup must show delivery unavailable, never a fake success. Build and exercise fake-provider integration locally; actual sends require configured templates, consent/contact details and authorised recipients.

**Exit evidence:** redelivery produces no duplicate logical notification, stale work is suppressed, unknown outcomes remain honest, escalation reaches the correct capability, and webhook validation rejects altered bytes.

## F07 — Make retention recoverable

**Targets:** [archive/backup service](../../src/server/domain/archive/service.ts), [archive tests](../../tests/domain/archive/p13-archive.test.ts), [archive workflow](../workflows/archive-and-access.md).

The current backup writes a manifest into the source bucket; it does not preserve object bytes independently. Its restore omits important records, and checksum counts do not establish restored integrity.

Create a consistent recoverable checkpoint containing required database records and actual file bytes in separately protected Cloudflare backup storage. Include memberships, immutable versions/reviews, updates, tasks, snags, permits, financial receipts/allocations/journals and audit dependencies. Record schema, checkpoint, object hashes and completion status. Missing or unreadable source objects make the backup incomplete. Stream large objects and respect runtime limits.

Restore into an empty isolated database and bucket using documented steps. Reconcile relationships and balances, then download recovered files and verify bytes against hashes. Invalidate restored invitation/bootstrap/session credentials and reconcile current suspensions, revocations and grants before reopening access; an older membership snapshot must not reactivate removed people or consumed invitations. Verify restored permissions, including denied draft/payroll access and revoked users. Keep retention and access controls explicit; do not add an automatic purge or claim indefinite durability from a manifest.

**Exit evidence:** a restore drill recovers representative drawings, photos/video and complete financial history after source storage is unavailable. Local drills prove logic; remote Cloudflare recovery remains a separate gate.

## F08 — Record proof and hand off real-person testing

Retain useful domain tests. Replace misleading checks in [release readiness tests](../../tests/integration/release/p14-readiness.test.ts) with behaviour: real HTTP cache/permission checks, actual network failures, upgrades of populated databases and rendered responsive journeys. Run typecheck, relevant tests and the Workers build; add browser coverage for the specific risks above. No CSS substring assertion proves mobile usability.

Update [task status](../../task.md), [acceptance cases](../quality/acceptance-cases.json) and evidence with commit, environment, command/result, actual URL, tested identity/capabilities and limitations. Distinguish implemented, locally verified, hosted verified and blocked. Do not inherit historical PASS claims or label synthetic delivery operational.

Hand the team document 02's real-account setup and a short UAT script: admin invites/adds another admin; staff uploads/submits; consultant approves; manager releases; client sees the correct release; staff/manager issue an invoice; admin records receipt; access revocation and archive downloads behave correctly. Use fictitious business records. Three initial people cannot prove every distinct role at once: record which real identities and explicitly assigned grants exercised each scenario, and leave untested roles outstanding until an appropriate invite/account exists. Never restore a view switcher or silently impersonate someone to complete evidence.

The completion report must identify remaining external dependencies, observed failures and the precise release gates still open. UI polish does not waive access, money, publication or recovery failures.
