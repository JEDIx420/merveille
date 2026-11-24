# Acceptance catalogue

This catalogue defines the future application outcomes. **All cases are currently NOT RUN.** Source: [acceptance-cases.json](acceptance-cases.json). Phase assignments: [manifest.json](../implementation/manifest.json). Requirement coverage: [traceability.md](traceability.md).

Use [testing strategy](testing.md), [fixtures](fixtures.md) and [evidence template](evidence-template.md). Early phases may prove a policy layer with fixtures; only complete integrated evidence passes the whole case.

## Access

### AC-001 — An invited representative signs in with their own identity

Requirements: REQ-IAM-001, REQ-IAM-002.

- **Given:** Main client and representative have separate invites.
- **When:** Both sign in.
- **Then:** Each has a distinct audited user; representative cannot submit a main-client contractual decision.
- **Evidence status:** not run.

### AC-002 — Cross-project enumeration is denied

Requirements: REQ-IAM-003, REQ-PRJ-007.

- **Given:** User belongs only to Project A.
- **When:** Request Project B list rows, detail, search, dashboard counts, file IDs and export.
- **Then:** No Project B names, records, counts, amounts or files are disclosed.
- **Evidence status:** not run.

### AC-003 — Consultant financial scope is intentional

Requirements: REQ-IAM-004, REQ-FIN-007.

- **Given:** Consultant assigned Project A.
- **When:** Open that project's quotation, schedule, invoice and payment history.
- **Then:** Client-facing financial records are visible; internal notes, receipt evidence, expenses, salaries and profit remain denied.
- **Evidence status:** not run.

### AC-004 — Representative authority cannot be escalated

Requirements: REQ-IAM-005, REQ-MAT-004.

- **Given:** Representative has project access.
- **When:** Call quote acceptance, change acceptance or binding material-selection endpoint.
- **Then:** 403 or equivalent denial; no acceptance/event is recorded; permitted comment remains possible.
- **Evidence status:** not run.

### AC-005 — Admin and owner capabilities remain separate

Requirements: REQ-IAM-006, REQ-FIN-009, REQ-DAS-002.

- **Given:** Create admin-without-owner, owner-without-admin and manager accounts.
- **When:** Read payroll/profit and individual-performance endpoints and exports.
- **Then:** Admin can see payroll/profit only; owner can see performance only; manager sees neither, including inferred aggregate values.
- **Evidence status:** not run.

### AC-006 — Account removal is effective across surfaces

Requirements: REQ-IAM-007, REQ-ARC-004.

- **Given:** Signed-in user has a file URL and a queued notification.
- **When:** Admin disables them then they request a page/download and job executes.
- **Then:** All new access and notification dispatch is denied; historic authorship remains.
- **Evidence status:** not run.

### AC-007 — Access changes have an audit record

Requirements: REQ-IAM-008, REQ-OPS-003.

- **Given:** Admin changes assignment, elevated capability and main-client contact.
- **When:** Inspect authorised audit history.
- **Then:** Actor, subject, old/new scope, reason and time are recorded without secrets.
- **Evidence status:** not run.

### AC-008 — Identity cannot be forged

Requirements: REQ-IAM-001, REQ-OPS-002.

- **Given:** Worker endpoint reachable and attacker sends fabricated identity headers.
- **When:** Use unsigned/expired/wrong-audience JWT, absent assertion, or guessed email.
- **Then:** All fail in staging; developer fixture auth is impossible on deployed bindings.
- **Evidence status:** not run.


## Intake

### AC-009 — Enquiry can finish without a project

Requirements: REQ-PRJ-001.

- **Given:** New lead with requirements and site feasibility.
- **When:** Record study then mark enquiry lost/declined.
- **Then:** History and reason remain; no active project or invoice appears as a side effect.
- **Evidence status:** not run.

### AC-010 — Activation requires the two commercial gates

Requirements: REQ-PRJ-002.

- **Given:** Quoted enquiry with no acceptance or confirmed advance.
- **When:** Try activation with each gate missing, client-reported transfer, then both valid.
- **Then:** Missing gates deny; manager activation succeeds only with current accepted quote and admin-confirmed required advance.
- **Evidence status:** not run.

### AC-011 — Client portfolio and project assignment

Requirements: REQ-PRJ-003, REQ-PRJ-005.

- **Given:** One main client has two projects and different representatives.
- **When:** Each contact opens project switcher.
- **Then:** Only each contact's assigned projects appear; single main-client authority per project is enforced.
- **Evidence status:** not run.

### AC-012 — Stages and lifecycle are explicit

Requirements: REQ-PRJ-004, REQ-PRJ-006.

- **Given:** Active project with linked milestone invoice schedule.
- **When:** Manager completes a stage, pauses and resumes project.
- **Then:** Actor/reason/history preserved; stage may trigger due evaluation but does not issue invoice or assert government permission.
- **Evidence status:** not run.


## Tasks

### AC-013 — Staff task and manager deadline authority

Requirements: REQ-TSK-001, REQ-TSK-002.

- **Given:** Assigned team member creates a project task.
- **When:** Staff proposes task; manager assigns and revises deadline.
- **Then:** Task persists; manager-only assignment/deadline changes enforced and prior values retained.
- **Evidence status:** not run.

### AC-014 — Complete and reopen tasks

Requirements: REQ-TSK-003, REQ-TSK-004.

- **Given:** Open task with due date and assignee.
- **When:** Assignee completes; manager reopens with reason; clock moves beyond due date.
- **Then:** History is retained; current overdue classification uses current open state and agreed due date.
- **Evidence status:** not run.

### AC-015 — Internal task evidence stays internal

Requirements: REQ-TSK-005, REQ-TSK-006.

- **Given:** Task contains notes and attachments.
- **When:** Client/consultant requests task evidence or related search results.
- **Then:** Access denied; owner performance can use permitted event metadata without publishing notes.
- **Evidence status:** not run.


## Drawings

### AC-016 — Version-bound consultant review

Requirements: REQ-DRW-001, REQ-DRW-002.

- **Given:** Drawing version V1 sent to two required assigned consultants.
- **When:** First approves; second has not approved; unrelated consultant tries approval.
- **Then:** Approval refers to V1; incomplete set blocks release; unassigned reviewer cannot decide.
- **Evidence status:** not run.

### AC-017 — Manager release is a distinct gate

Requirements: REQ-DRW-003, REQ-DRW-004.

- **Given:** Consultant approved V1.
- **When:** Client attempts approval/release, then manager releases.
- **Then:** Client cannot approve/release; manager release succeeds and records actor/time. Consultant approval alone never publishes.
- **Evidence status:** not run.

### AC-018 — Replacement never hides the current release prematurely

Requirements: REQ-DRW-005, REQ-DRW-006.

- **Given:** V1 released; V2 uploaded and returned for changes.
- **When:** Client views drawing; V3 later approved and released.
- **Then:** V1 stays current during review; V3 release supersedes V1; rejected V2 is not mislabeled superseded.
- **Evidence status:** not run.

### AC-019 — Revision invalidates only the changed version's approvals

Requirements: REQ-DRW-007.

- **Given:** V1 approved but unreleased.
- **When:** Author revises content to V2; attempts release based on V1 approval.
- **Then:** V2 requires fresh approvals; manager cannot release edited content under V1's approval.
- **Evidence status:** not run.

### AC-020 — Draft file and preview URLs are protected

Requirements: REQ-DRW-008, REQ-FIL-004.

- **Given:** Client knows draft object/thumbnail identifier.
- **When:** Request original, thumbnail, preview and notification URL.
- **Then:** All unreleased internal content denied; released current and permitted historical versions work.
- **Evidence status:** not run.

### AC-021 — Concurrent drawing releases remain consistent

Requirements: REQ-DRW-003, REQ-DRW-005, REQ-OPS-003.

- **Given:** Two eligible revisions share expected current-version value.
- **When:** Release concurrently or retry same release command.
- **Then:** At most one current version; stale operation conflicts; retry is idempotent; audit/outbox agree with committed state.
- **Evidence status:** not run.


## Updates

### AC-022 — Manager publishes selected audience

Requirements: REQ-UPD-001, REQ-UPD-002, REQ-UPD-003.

- **Given:** Staff submits photos/progress and keeps separate internal note.
- **When:** Client checks feed before and after manager publication.
- **Then:** Only published approved audience content appears; internal notes never appear.
- **Evidence status:** not run.

### AC-023 — Published update edit needs review

Requirements: REQ-UPD-004.

- **Given:** Published update V1.
- **When:** Staff proposes V2 and another manager returns it.
- **Then:** V1 remains published until reviewed replacement/retraction; changed text does not silently reach clients.
- **Evidence status:** not run.

### AC-024 — Announcements have a separate audience

Requirements: REQ-UPD-005.

- **Given:** Manager prepares company announcement for selected clients.
- **When:** Publish and open feeds as included and excluded users.
- **Then:** Only selected audience sees it; project data is not auto-promoted to company-wide content.
- **Evidence status:** not run.


## Permits

### AC-025 — K-SMART evidence is manual and dated

Requirements: REQ-KSM-001, REQ-KSM-002, REQ-KSM-003.

- **Given:** Project with sanction and completion milestones.
- **When:** Staff enters observed statuses and uploads screenshots.
- **Then:** Separate records show entered-by, checked date and evidence; no automatic verification or legal validity claim.
- **Evidence status:** not run.

### AC-026 — Permit evidence can remain restricted

Requirements: REQ-KSM-004.

- **Given:** Internal supporting screenshot and proposed client status update.
- **When:** Manager publishes redacted/permitted update.
- **Then:** Client receives approved status and shared files only; original sensitive screenshot remains private.
- **Evidence status:** not run.


## Finance

### AC-027 — Schedule is upfront and versioned

Requirements: REQ-FIN-001, REQ-FIN-002.

- **Given:** Accepted quotation with advance/date/stage instalments.
- **When:** Manager revises schedule; staff attempts same action.
- **Then:** Only manager succeeds; prior schedule/reason retained; clients see correct current schedule and history policy.
- **Evidence status:** not run.

### AC-028 — Due rules resolve date/stage disagreement explicitly

Requirements: REQ-FIN-002, REQ-PRJ-004.

- **Given:** Date-only, stage-only, both and either synthetic schedule items.
- **When:** Date passes while stage incomplete, then stage completes.
- **Then:** Each configured policy gives deterministic due state; no accidental default makes every item due.
- **Evidence status:** not run.

### AC-029 — Invoice issue uses approved content

Requirements: REQ-FIN-003.

- **Given:** Staff drafts invoice and manager approves it.
- **When:** Staff edits line/amount after approval then tries issue.
- **Then:** Edited version requires reapproval; approved unchanged version can issue once.
- **Evidence status:** not run.

### AC-030 — Issued invoice cannot be overwritten

Requirements: REQ-FIN-004, REQ-FIN-013.

- **Given:** Invoice is issued with unique reference.
- **When:** Attempt edit/delete; then create permitted correction.
- **Then:** Mutation denied; linked credit/reversal/replacement preserves original and audit, including concurrent numbering.
- **Evidence status:** not run.

### AC-031 — Only admin confirms real money

Requirements: REQ-FIN-005.

- **Given:** Client/staff uploads evidence claiming payment.
- **When:** They call confirm receipt; admin later verifies and confirms.
- **Then:** Only admin records confirmed receipt; evidence alone never activates a project or extra work.
- **Evidence status:** not run.

### AC-032 — Part payment and overpayment remain exact

Requirements: REQ-FIN-006, REQ-FIN-010.

- **Given:** Invoice INR 10000.00; confirmed receipts INR 3000.00 and 8000.00.
- **When:** Allocate up to outstanding balance.
- **Then:** Paid allocation 10000.00, outstanding 0.00, unallocated 1000.00; no floating-point drift or negative outstanding.
- **Evidence status:** not run.

### AC-033 — Duplicate receipt confirmation is idempotent

Requirements: REQ-FIN-006, REQ-FIN-011.

- **Given:** Pending receipt with stable idempotency key.
- **When:** Confirm twice and replay queue event.
- **Then:** One economic posting, one receipt and matching audit/outbox; changed payload under same key conflicts.
- **Evidence status:** not run.

### AC-034 — Expense approval and posting

Requirements: REQ-FIN-008.

- **Given:** Staff submits non-payroll expense or consultant fee.
- **When:** Manager reviews then admin posts; staff tries posting.
- **Then:** Correct actor separation; evidence and project allocation retained; no posting without authorised review.
- **Evidence status:** not run.

### AC-035 — Payroll does not leak through totals

Requirements: REQ-FIN-009, REQ-IAM-006.

- **Given:** Project has salary allocation.
- **When:** Non-admin queries total costs, export, chart, search, logs and difference of reports.
- **Then:** Restricted amounts cannot be obtained directly or by supplied totals; admin sees permitted cost/profit views.
- **Evidence status:** not run.

### AC-036 — Reporting basis and currency are explicit

Requirements: REQ-FIN-010, REQ-FIN-012.

- **Given:** Posted INR events and a separate foreign-currency draft.
- **When:** Open invoiced, received and profit reports.
- **Then:** No cross-currency summing; report names period/basis and costs; invoiced and received are distinct, not additive sales.
- **Evidence status:** not run.

### AC-037 — Balanced postings and period closure

Requirements: REQ-FIN-011.

- **Given:** Approved invoice/receipt/expense and closed period.
- **When:** Post, attempt edit, reverse with explicit authority.
- **Then:** Debits equal credits per event/currency; journal immutable; closed-period write denied; authorised correction audit retained.
- **Evidence status:** not run.

### AC-038 — Report reproduces source records

Requirements: REQ-FIN-013, REQ-FIN-012.

- **Given:** Known synthetic invoices, credits, receipts and expenses.
- **When:** Generate same filtered report twice and reconcile with rows.
- **Then:** Amounts match source formula and permissions; period, currency and generation time shown; no guessed profit.
- **Evidence status:** not run.


## Changes

### AC-039 — Only main client accepts additional estimate

Requirements: REQ-CHG-001, REQ-CHG-002.

- **Given:** Change with quoted price and time impact.
- **When:** Representative or consultant attempts accept; main client accepts current version.
- **Then:** Only main-client acceptance binds the current estimate version; others can comment.
- **Evidence status:** not run.

### AC-040 — Extra work gate requires all conditions

Requirements: REQ-CHG-003, REQ-CHG-004.

- **Given:** Accepted change without payment or manager authorisation.
- **When:** Attempt start with each condition missing, then fully satisfy.
- **Then:** Work remains blocked until required admin-confirmed payment and manager authorisation; prepared task is not permission to start.
- **Evidence status:** not run.

### AC-041 — Change revision cannot reuse old acceptance

Requirements: REQ-CHG-005.

- **Given:** Accepted/paid but unstarted change.
- **When:** Revise scope/price and attempt execution.
- **Then:** Revised work requires fresh acceptance and authorisation plus correct payment assessment; old record remains auditable.
- **Evidence status:** not run.


## Materials

### AC-042 — References and material decisions

Requirements: REQ-MAT-001, REQ-MAT-002.

- **Given:** Main client and representative upload inspiration.
- **When:** Staff creates decision options; main client selects.
- **Then:** Files scoped correctly; comments distinct from authoritative main-client selection.
- **Evidence status:** not run.

### AC-043 — Material selection respects commercial gates

Requirements: REQ-MAT-003, REQ-MAT-004.

- **Given:** Selected material increases agreed cost.
- **When:** Representative changes selection or staff starts extra work.
- **Then:** Representative cannot overwrite; added cost enters change process; selection alone doesn't authorise work.
- **Evidence status:** not run.


## Snags

### AC-044 — Snag resolution needs verification

Requirements: REQ-SNG-001, REQ-SNG-002, REQ-SNG-003.

- **Given:** Issue with photo/location and assignee.
- **When:** Staff provides resolution; manager verifies or reopens.
- **Then:** States/history distinguish resolved from verified closed; evidence and due date retained.
- **Evidence status:** not run.

### AC-045 — Shared snag hides internal remediation

Requirements: REQ-SNG-004.

- **Given:** Public-facing issue with internal cost note.
- **When:** Client/consultant opens detail and attachments.
- **Then:** Only approved visible fields and files appear; internal notes/costs remain denied.
- **Evidence status:** not run.

### AC-070 — Charged snag remediation obeys the change gate

Requirements: REQ-SNG-002, REQ-CHG-004.

- **Given:** A snag requires work outside the agreed scope.
- **When:** Manager assigns remediation before change acceptance, payment or authorisation is complete.
- **Then:** Assignment may prepare the task but starting charged work is blocked until P09 commercial gates pass; existing included-scope remediation remains usable.
- **Evidence status:** not run.


## Notifications

### AC-046 — Due reminders and overdue escalation

Requirements: REQ-NOT-001, REQ-NOT-003.

- **Given:** Clock set to known Asia/Kolkata policy with eligible due items.
- **When:** Scheduler runs through normal reminder and escalation times.
- **Then:** Portal notification and eligible WhatsApp delivery created; unresolved item escalates to admin after configured threshold.
- **Evidence status:** not run.

### AC-047 — Notification eligibility checked at dispatch

Requirements: REQ-NOT-002, REQ-NOT-006.

- **Given:** Queued reminder for now-resolved task or removed user.
- **When:** Consumer processes queue later.
- **Then:** Obsolete message suppressed; read status never resolves task, approves drawing or confirms payment.
- **Evidence status:** not run.

### AC-048 — Retries do not blindly double-send

Requirements: REQ-NOT-004.

- **Given:** Queue redelivers event or provider times out after possible accept.
- **When:** Consumer retries and webhook arrives twice.
- **Then:** Delivery state reconciles provider ID; ambiguous timeout stays uncertain/reconciled rather than immediate blind resend; duplicates don't create extra portal rows.
- **Evidence status:** not run.

### AC-049 — WhatsApp provider policy and privacy

Requirements: REQ-NOT-005.

- **Given:** Authorised test number with required opt-in/template configuration.
- **When:** Send outside allowed conversation window via approved template path.
- **Then:** Only minimal safe context and authenticated link sent; unsupported/unapproved setup is blocked visibly, no raw documents or salaries.
- **Evidence status:** not run.

### AC-050 — Webhook verifies sender and state

Requirements: REQ-NOT-004, REQ-OPS-003.

- **Given:** Webhook endpoint receives invalid signature, replay and valid delivery status.
- **When:** Process each.
- **Then:** Invalid messages denied; valid events deduplicated; incoming text never mutates money/approval states.
- **Evidence status:** not run.


## Dashboard

### AC-051 — Waiting on you is actionable

Requirements: REQ-DAS-001, REQ-DAS-003.

- **Given:** Seed overdue task, consultant review, manager release, invoice approval and client change decision.
- **When:** Each role opens overview and waiting list.
- **Then:** Only that role's current actionable items appear, ordered by useful urgency and linked to exact version.
- **Evidence status:** not run.

### AC-052 — Performance is evidence-based and owner-only

Requirements: REQ-DAS-002, REQ-DAS-004, REQ-TSK-006.

- **Given:** Tasks have original/revised dates, reopened items and quality observations.
- **When:** Owner and normal staff open performance views.
- **Then:** Owner sees disclosed metrics and context; staff is denied; client-driven scope revisions are not auto-scored as employee errors.
- **Evidence status:** not run.

### AC-053 — Client overview is calm and private

Requirements: REQ-DAS-005, REQ-PRJ-007.

- **Given:** Project has mixed published/internal updates and multiple payments.
- **When:** Client opens phone and desktop overview.
- **Then:** Published progress, current released drawing, next due payment and relevant decisions shown; no internal task/financial-detail leakage.
- **Evidence status:** not run.


## Archive

### AC-054 — Archive preserves permitted external access

Requirements: REQ-ARC-001, REQ-ARC-002, REQ-ARC-004.

- **Given:** Completed project with current and superseded drawings.
- **When:** Archive then sign in as client, consultant, revoked user and outsider.
- **Then:** Authorised released history remains viewable/downloadable; no drafts/internal data; revoked/outsider denied.
- **Evidence status:** not run.

### AC-055 — Archive is read-only without forgiving balances

Requirements: REQ-ARC-003, REQ-ARC-005.

- **Given:** Project with unpaid invoice is archived.
- **When:** Attempt normal edit, append an ADMIN-confirmed settlement for an existing invoice, then manager reopens with reason.
- **Then:** Operational mutation is denied while archived; normally authorised existing-obligation settlement is appended without reopening, preserving correction approvals. No new invoice, schedule or work is allowed by this exception; controlled reopen rechecks memberships and reminders.
- **Evidence status:** not run.


## Files

### AC-056 — Large file upload survives bounded retry online

Requirements: REQ-FIL-001, REQ-FIL-003.

- **Given:** Configured large PDF/CAD/video and allowed chunk size.
- **When:** Upload with failed part then retry while online.
- **Then:** Only failed parts retry; finalised object verified; upload UI reports exact success/failure; no pretend CAD/video preview.
- **Evidence status:** not run.

### AC-057 — Upload cannot select its own audience or object key

Requirements: REQ-FIL-002, REQ-FIL-004.

- **Given:** Client reference uploader.
- **When:** Submit foreign project ID, payroll parent, internal path or altered completion metadata.
- **Then:** Server rejects; storage key assigned server-side; file attached only to authorised parent.
- **Evidence status:** not run.

### AC-058 — Unsafe/unrenderable upload handling is honest

Requirements: REQ-FIL-001, REQ-FIL-003.

- **Given:** HTML/SVG active payload, misleading extension, oversize and unsupported CAD.
- **When:** Attempt upload or preview.
- **Then:** Configured type/size checks enforced; unsafe active content not executed; accepted download-only types labelled; no false malware-scan claim.
- **Evidence status:** not run.

### AC-059 — Download and Range stay private

Requirements: REQ-FIL-004, REQ-IAM-007.

- **Given:** Permitted user views video/PDF then loses access.
- **When:** Request Range, HEAD, thumbnail and direct bucket address.
- **Then:** Current authenticated requests denied after revocation; bucket not public; private responses not shared-cached.
- **Evidence status:** not run.

### AC-060 — Retained file cannot be purged accidentally

Requirements: REQ-FIL-005, REQ-DRW-006.

- **Given:** File referenced by released drawing or issued invoice.
- **When:** Cleanup job and ordinary delete action run.
- **Then:** Referenced object preserved; only eligible temporary upload debris removed according to documented policy.
- **Evidence status:** not run.


## Ux

### AC-061 — Online-only save failure is visible

Requirements: REQ-OPS-001.

- **Given:** Phone loses internet while editing.
- **When:** Attempt save then reconnect.
- **Then:** No false saved message; no background offline queue; user can retry explicitly without accidental duplicate write.
- **Evidence status:** not run.

### AC-062 — Responsive accessible core flow

Requirements: REQ-OPS-001, REQ-DAS-005.

- **Given:** Synthetic client and staff sessions.
- **When:** Use keyboard and phone-sized viewport for task, drawing and invoice views.
- **Then:** Visible focus, labelled errors, readable type/contrast and reachable primary actions; no horizontal page overflow.
- **Evidence status:** not run.

### AC-063 — Empty/error/loading/forbidden states are truthful

Requirements: REQ-DAS-001, REQ-PRJ-007.

- **Given:** No projects, filter with no match, network failure and revoked access.
- **When:** Open relevant screens.
- **Then:** Distinct recoverable states; no fake KPI data or misleading zero in place of forbidden/unavailable information.
- **Evidence status:** not run.


## Operations

### AC-064 — Real Worker runtime compatibility

Requirements: REQ-OPS-002.

- **Given:** Selected pinned scaffold and local Cloudflare bindings.
- **When:** Build/preview SSR, mutation, D1 and R2 in workerd.
- **Then:** All work without Node-only assumptions; adapter and tool versions recorded; no production credentials needed for local check.
- **Evidence status:** not run.

### AC-065 — Environment and secret separation

Requirements: REQ-OPS-002, REQ-OPS-003.

- **Given:** Local/staging/production configuration.
- **When:** Run config review and bundle/log inspection.
- **Then:** Distinct bindings; no secret in client bundle, logs or repository; deploy script names environment explicitly.
- **Evidence status:** not run.

### AC-066 — Restore database and files together

Requirements: REQ-OPS-004, REQ-ARC-001.

- **Given:** Synthetic project with versions, invoices, receipts and archive grants.
- **When:** Restore separate backup to isolated recovery environment.
- **Then:** Counts/checksums/links, invoice balances and authorisation reconcile; result recorded; source production not modified.
- **Evidence status:** not run.

### AC-067 — Migration and recovery gates

Requirements: REQ-OPS-004.

- **Given:** Seeded database and current deployment.
- **When:** Apply next migration and exercise documented failed-release recovery.
- **Then:** Old retained data preserved; restore/forward-fix plan works; untested destructive migration never reaches production.
- **Evidence status:** not run.

### AC-068 — Integration blockers remain visible

Requirements: REQ-OPS-004, REQ-OPS-003.

- **Given:** WhatsApp/account policy/provider credentials missing.
- **When:** Complete local phase and inspect readiness.
- **Then:** Local fake clearly labelled; blocker recorded; live integration remains disabled; no fabricated success evidence.
- **Evidence status:** not run.

### AC-069 — Authenticated responses never cross-cache

Requirements: REQ-IAM-003, REQ-OPS-002.

- **Given:** Two users with disjoint projects.
- **When:** Repeat same routes/actions with different cookies and cache headers.
- **Then:** No response reuse discloses other user's data; static public brand assets alone use public caching.
- **Evidence status:** not run.
