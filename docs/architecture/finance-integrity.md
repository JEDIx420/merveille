# Financial integrity and reporting

**27 November 2026 next-phase scope:** [The active plan](../next-phase/01-scope-and-free-tier-baseline.md) moves billing outside the portal. Retain this specification for historical financial integrity and unchanged acceptance/authority rules; do not extend in-portal accounting or configure new billing/provider services from it. Implement the version-bound ADMIN external commercial-clearance transition without bypassing main-client acceptance or manager authorization, and preserve existing records/access.

This portal maintains the firm's operational accounts. It must support the requested quotations, schedules, invoices, confirmed receipts, project expenses, consultant fees, salaries and profit reporting. The requirement does not establish tax rates, statutory filing rules, payroll tax calculations, or a legally compliant invoice format. Those are owner/accountant configuration inputs before real accounting use.

## Authoritative actions

- Staff prepare an invoice; manager approves the exact revision; authorized staff issue it. This is the accepted working interpretation of the recorded conversation.
- Only MANAGER changes a published payment schedule.
- Only ADMIN confirms or reverses payment receipt.
- Only ADMIN can read salaries and profit, including reports, exports, search results and derived totals.
- Only OWNER can read individual performance information. Do not combine this automatically with ADMIN.
- A consultant may see the assigned project's **client quotation and payment history**, but does not thereby gain access to salary, profit or internal consultant cost accounting.

## Immutable issued records

Draft invoice edits increment a revision and invalidate prior approval. Issuance captures seller/client details, line descriptions, quantities, unit amounts, tax labels/rates supplied by configuration, totals, currency, due dates, approved revision, issuer, number and timestamps. The human-readable PDF is a rendering of that snapshot, not a fresh query against editable client details.

Allocate invoice numbers transactionally with a unique organization/series/number constraint. Never derive the next number from `count(*) + 1` outside a protected command. Record cancelled numbers rather than silently reusing issued numbers. Corrections use an authorized linked credit/debit/reversal and replacement as needed; preserve the original issued record and audit trail.

Corrections to issued documents require manager approval of the exact adjustment followed by admin posting. An ADMIN role alone does not substitute for the manager's domain approval; a person holding both capabilities records both actions distinctly.

## Payments and eligibility gates

Receipt confirmation requires amount, currency, received date, payment method/reference and confirming admin. Supporting screenshots can be attached but do not themselves confirm money. Allow allocations across invoices/milestones and unallocated advance balances. Allocation totals cannot exceed confirmed un-reversed receipt value. An invoice's outstanding balance cannot become negative without an explicit credit/unallocated treatment.

Project activation checks the accepted quotation version and its required confirmed advance. Additional work checks main-client agreement to the exact change estimate, required confirmed payment and manager authorization. Do not reuse the same funds for two distinct advance requirements; allocations and their reversals are authoritative. Reversing a payment creates an exception requiring manager/admin attention; it must not erase work already carried out or silently rewind a real project.

Fixed-date and stage-triggered schedules are distinct. Each milestone states its trigger, amount, grace/offset rule and responsible completion approver. A schedule version is frozen once published; changes retain earlier versions and do not rewrite old invoice due dates without an explicit correction. Show clients the effective schedule and the reason/date of a revision.

## Settlement after archive

Archived project content remains frozen, while pre-existing financial obligations may be settled. ADMIN may append confirmed receipts, allocations, outgoing settlements, refunds/reversals and normally approved corrections tied to those existing obligations. Record a specific settlement reason/context and maintain invoice snapshots, receipt history and audit. Normal manager approval and admin posting still apply to corrective documents. A manager approval of such a correction is a narrow settlement action, not a project reopen.

This exception cannot create a new invoice, add scope, authorize additional work, change a payment schedule or publish new project content. Those actions require controlled reopening. Clients and consultants retain only their existing authorized commercial views; salary/profit restrictions continue unchanged. Archived settlement evidence has the same restricted audience as ordinary payment verification evidence.

## Ledger and reports

Use immutable ledger events, preferably balanced journal entries if the implementation presents full account balances. Every posting references its domain source; every reversal references the original. One issued invoice or confirmed receipt must not post twice under retries. Balance journal lines and reject missing/invalid account mappings within the same transaction.

Maintain distinct metrics:

| Metric | Definition |
|---|---|
| Quoted/contracted value | Accepted quotation and accepted changes; not cash and not automatically revenue |
| Invoiced amount | Issued invoices less applicable credits for the selected period/basis |
| Money received | Confirmed receipts less reversals, using received dates |
| Outstanding receivables | Issued balances after valid credits and receipt allocations |
| Recorded project costs | Approved/posted direct expenses, consultant costs and salary allocations under the stated basis |
| Operating profit | Recognized income minus recognized costs under the explicitly configured reporting basis |

Do not add invoiced amounts and money received together as “sales.” Do not show billed amount minus cash expenses as an unlabeled profit figure. Label cash-flow and operating-profit views accurately and disclose the basis/date range.

The owner/accountant must choose income recognition, cost recognition, overhead allocation, salary allocation, opening balances and period close policy before relying on profit. A proposed initial management-report basis may use issued invoices and recorded incurred costs, but it must be explicitly adopted and labelled. Salaries may be entered/imported as approved amounts; automated payroll calculation is a separate feature.

## Privacy and reconciliation

Salary allocations can leak payroll through drill-downs and residual totals. Non-admin users must not receive totals that expose salary/profit by subtraction. Use separate query projections, not generic ledger endpoints with hidden columns. Bank details and supporting evidence are private; no public share links.

Include admin reconciliation views: receipt totals versus allocations/unallocated advances, issued invoices versus ledger postings, consultant bills versus payments, expense evidence completeness, and outstanding balances. Export machine-readable records with stable source IDs and an audit range for accountant review. An export is permission-checked at generation and download.

## Required tests

Test double receipt submission, concurrent invoice issuance, draft edit after approval, changed quotation after acceptance, partial payments, advance allocations, over-allocation, payment reversal, credit note, currency mismatch, rounding/precision boundary, schedule edits, stage/date trigger difference, closed-period correction, negative/zero amounts according to document type, salary/profit forbidden projections and a complete project+change-order eligibility scenario. Include valid archived receipt/approved correction, rejected archived new invoice/schedule/work, and an ADMIN correction attempt without manager approval.
