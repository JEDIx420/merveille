# Invoices, schedules, receipts and accounting

**27 November 2026 next-phase scope:** [The active plan](../next-phase/01-scope-and-free-tier-baseline.md) moves billing outside the portal. Retain this specification for historical financial integrity and unchanged acceptance/authority rules; do not extend in-portal accounting or configure new billing/provider services from it. Implement the version-bound ADMIN external commercial-clearance transition without bypassing main-client acceptance or manager authorization, and preserve existing records/access.

**Requirements:** REQ-FIN-001–013, REQ-IAM-004/006, REQ-DAS-002, REQ-ARC-005.

**Confirmed:** The portal maintains accounts. Manager controls payment schedules; administrator confirms money received. Salaries/profit are administrator-only. There is no portal payment checkout.

**Accepted working interpretation:** Staff draft → manager approves → staff issues invoices. Preserve this provenance note; it resolves ambiguous discovery for the build.

## Scope and separation

The accounting workspace covers client quotations, payment schedules, invoicing, external receipts, allocations, advances, non-payroll expenses, consultant fees, salary costs, payables, financial postings and reports. A balanced journal foundation is an engineering default needed to keep “full accounts” coherent.

The brief does not specify tax rates, statutory filing behavior, legal invoice rules, payroll deductions or a jurisdiction-specific chart of accounts. Do not invent them. The firm must approve its accounting configuration and reporting basis before real financial operation. This document is a product/data specification, not tax or accounting advice.

## Independent records

| Record | Represents | Must not be confused with |
|---|---|---|
| Accepted quotation | Agreed commercial value/scope | Revenue earned, invoice issued or cash collected |
| Payment schedule item | Expected obligation with amount and date/stage trigger | An invoice or proof of payment |
| Invoice | Issued request for payment | A schedule line or bank transaction |
| Receipt | Administrator-confirmed externally received money | A client's “I paid” message |
| Allocation | A portion of a receipt applied to an obligation | A second receipt or additional income |
| Customer advance/credit | Confirmed money not yet consumed by an eligible invoice | Automatically recognized service revenue |
| Expense/consultant bill | Reviewed cost or liability | Proof that cash has already been paid |
| Outgoing payment | Administrator-confirmed settlement of a liability/refund | The expense recognition event itself |
| Journal posting | Balanced accounting effect of an approved source event | An editable spreadsheet-style total |
| Salary record | Restricted payroll cost/payment evidence | A general project expense visible to staff |

## Payment schedules

Create the expected advance/installments with the quotation. Each item needs amount/currency, description, trigger type, applicable date and/or stage, required stage confirmer, and links to amounts later invoiced. Manager alone changes the schedule.

Supported trigger policies should be explicit: date-only, stage-only, date **and** stage, or date **or** stage. The firm must select the appropriate policy; do not infer precedence. A date arriving before the stage is complete can produce different outcomes under those policies.

Stage completion is a manager-recorded project event. An eligible schedule item prompts invoice preparation; it does not automatically issue an invoice. The UI distinguishes “Scheduled, not yet invoiced” from “Invoice due.” Avoid double-counting both as the same receivable.

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → DRAFT | Authorized staff proposes schedule with quote | Correct currency and structured conditions | Proposed rows; `schedule_drafted`. |
| DRAFT → AGREED | Accepted quote establishes schedule | Exact accepted quote version | Baseline schedule snapshot; `schedule_agreed`. |
| AGREED → revised AGREED version | Manager changes schedule | Reason; no unapproved change to total commercial scope; affected invoices identified | Preserve original dates/amounts; notify authorized client audience; `schedule_revised`. |
| Not eligible → ELIGIBLE | System derives from confirmed date/stage facts | Explicit trigger policy satisfied | Create billing action, not an invoice; `schedule_item_eligible`. |
| Eligible → partly/fully billed | Staff issues approved invoice | Invoice-to-schedule mapping valid | Record billed amount without deleting schedule history; `schedule_item_billed`. |

A schedule revision cannot silently rewrite the terms or due date on an issued invoice snapshot. Any financial amendment must retain the original issued terms and use the firm's configured amendment/correction policy. Extra charges require the [change workflow](change-requests.md), not a schedule-edit shortcut.

## Invoice lifecycle

Invoice lifecycle and settlement status are separate. An issued invoice remains issued after it is part-paid, settled or adjusted. Do not overload one status field so payment processing can accidentally return it to a draft.

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → DRAFT | Authorized staff/manager prepares | Project finance author scope; quotation/change source available | Editable lines, due terms and source mappings; `invoice_drafted`. |
| DRAFT → IN_REVIEW | Author submits | Customer details, currency, configured calculations, source and schedule mapping valid | Freeze submitted snapshot; manager action; `invoice_submitted`. |
| IN_REVIEW → CHANGES_REQUESTED | Manager returns | Reason | Require revised draft/version; `invoice_returned`. |
| IN_REVIEW → APPROVED | Manager approves | Exact content/totals/terms reviewed | Store approval against version; `invoice_approved`. |
| APPROVED → ISSUED | Authorized staff issues | Approved version unchanged; numbering/period configuration valid; no prior issue | Atomically allocate unique number, save immutable issued snapshot and source event; `invoice_issued`. |
| APPROVED → new DRAFT | Staff/manager revises before issue | Preserve previous version; invalidate approval | Fresh review needed; `invoice_approval_invalidated`. |
| DRAFT/IN_REVIEW/APPROVED → CANCELLED | Manager cancels; draft author may discard own unsubmitted work | Reason after submission | Stop pending issue; preserve submitted history; `invoice_draft_cancelled`. |
| ISSUED → issued with linked adjustment | Manager-approved correction with admin posting | Configured credit/void/reversal policy; original retained; reason and links | Create new corrective record and balanced effect; `invoice_adjusted`. |

Never reuse an issued invoice number, silently replace its PDF/lines, or erase it because a payment failed. The issued snapshot includes customer identity/details, lines, calculation inputs, totals, currency, due terms, quotation/change references and rendered artifact identity. Derived settlement information can change without modifying that snapshot.

## Receipts and allocations

Money is received externally. Authorized staff or clients may report a transfer and attach evidence where their scope allows; **only an administrator confirms it**.

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → REPORTED | Authorized person reports payment | Project/client scope; amount/currency/date and reference/evidence | Unverified claim; no balance or activation credit; `payment_reported`. |
| REPORTED → REJECTED | Admin rejects report | Reason | Notify relevant reporter without implying bank failure; `payment_report_rejected`. |
| REPORTED/new record → CONFIRMED | Admin verifies receipt | Required evidence/reference; duplicate check; valid currency/date | Create immutable receipt/source posting; make amount available; `receipt_confirmed`. |
| CONFIRMED → same receipt with allocation | Admin allocates to invoice/advance/change | Same client/project policy and currency; available amount sufficient; target eligible | Create allocation event; recompute balances/gates; `receipt_allocated`. |
| CONFIRMED → partly/fully reversed effect | Admin corrects receipt | Reason; affected allocations/gates identified; period policy | New reversal event/posting; restore obligations as appropriate; `receipt_reversed`. |
| Available customer credit → refund recorded | Admin records external refund | Verified outgoing transaction; credit/obligation exists; configured policy | Linked payment/refund posting; reduce available credit; `customer_refund_recorded`. |

A duplicate screenshot/reference is a review signal, not proof by itself. Require an idempotent confirmation action so browser retries cannot create duplicate cash. A real repeated bank reference may need an explained manual resolution; do not assume all matching text means the same transaction.

Allocations cannot exceed the receipt's remaining available amount. Currency conversion is outside the initial single-base-currency default; reject cross-currency allocation rather than using an unexplained rate. Unallocated confirmed money is a visible advance/credit, not a negative invoice balance or hidden excess.

Raw bank evidence is administrator-restricted except that a submitting client may view their own permitted evidence. Consultants see the deliberately shared client payment history, not the administrator's verification attachments or bank reconciliation notes.

## Exact money and balance rules

Use integer minor units, an explicit currency and configured currency precision. Binary floating-point arithmetic must not be the authoritative representation. Quantities, rates and percentage calculations require documented deterministic rounding; preserve the inputs used for the issued snapshot.

For a single invoice in one currency:

```text
gross_issued_amount = immutable original amount due
effective_credits = posted credits/void adjustments less their reversals
net_billed_amount = gross_issued_amount - effective_credits
net_allocated_receipts = active receipt allocations after reversals/unallocations
outstanding = max(net_billed_amount - net_allocated_receipts, 0)
```

Any excess becomes explicitly available customer credit rather than disappearing or leaving a negative “amount due.” Reclassify allocations as required when a later credit reduces the invoice obligation. Do not write off an amount merely to make a screen total reach zero.

Settlement labels should distinguish **Unpaid**, **Part-paid**, **Paid** and **Settled by credit/void**. Zero outstanding caused entirely by a credit is not evidence of cash payment. Overdue uses the effective approved due terms and positive outstanding balance.

### Reporting definitions

| Metric | Proposed definition | Visibility/limits |
|---|---|---|
| Accepted quotation value | Current accepted base scope plus accepted changes, with currency and cancelled scope treatment stated | Operational commercial access; not labeled realized revenue |
| Gross billed | Issued invoice gross amounts less effective gross credits for the selected reporting policy/period | Includes taxes where configured; state this clearly |
| Net invoiced sales | Issued service amounts less service credits, excluding separately accounted taxes | Distinct from gross billed and cash received |
| Received cash | Confirmed receipts less receipt reversals and confirmed refunds in the selected period | Allocation changes do not create additional cash |
| Invoice receivables | Positive outstanding amounts on issued invoices at the stated as-of time | Excludes unbilled schedule expectations |
| Scheduled future payments | Unbilled expected schedule amounts with their trigger/date | Forecast/obligation view; not added again to receivables |
| Payables | Posted liabilities less confirmed allocated outgoing payments/adjustments | Restricted internal finance |
| Operational profit — draft definition | Recognized revenue minus recognized project costs and explicitly allocated overhead/salary costs for the period | **ADMIN only**; disabled as a trusted metric until recognition/allocation policy approved |
| Net cash movement | Confirmed cash inflows less confirmed cash outflows for the period | Label as cash movement, never profit |

The profit definition must disclose the revenue basis, direct cost treatment, consultant fees, salary allocations, shared overhead, period and excluded items. Do not label a project margin “statutory net profit.” Salary allocation must not double-count the underlying payroll expense. A non-admin dashboard must not expose salary-inclusive totals from which salary or profit can be derived.

## Expenses, consultant fees and salaries

The proposed non-payroll path is staff submission → manager review → admin posting/payment confirmation. Preserve supplier/consultant, category, amount/currency, incurred/bill date, due date, project allocation, evidence and payment status.

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → DRAFT | Authorized staff submits cost | Assigned expense scope; non-payroll category | Unposted expense/bill; `expense_drafted`. |
| DRAFT → IN_REVIEW | Author submits | Required amount/category/evidence | Manager review; `expense_submitted`. |
| IN_REVIEW → RETURNED/APPROVED | Manager reviews | Reason on return; exact approved version | Approved cost eligible for admin posting; `expense_reviewed`. |
| APPROVED → POSTED | Admin posts | Valid account mappings/period/project allocation | Balanced liability/expense source posting; `expense_posted`. |
| POSTED → partly/fully PAID | Admin confirms outgoing payment | External payment evidence; sufficient remaining liability | Separate payment/allocation posting; `expense_payment_confirmed`. |
| POSTED/PAID → adjusted effect | Admin corrects | Reason, linked reversal/credit and period rules | Preserve original; recompute payable and reports; `expense_adjusted`. |

Consultant fees follow this internal cost path; the consultant's confirmed access to client quotations/payment history does not grant access to internal fee ledgers. A future consultant self-service fee module would need an explicit scope decision.

Salary records, salary liabilities/payments, payslip evidence if supplied, staff-level salary allocations and salary-inclusive reports are **ADMIN only from creation onward**. They must never pass through an ordinary manager/staff expense inbox. Recording salary cost is in scope; automatic payroll calculation, deductions and filings are not assumed.

## Balanced journal foundation

Every posted source event carries a unique source reference and balanced debit/credit lines in the configured currency. Journal lines are immutable after posting. Corrections create linked reversing/new entries. Reject unbalanced postings and duplicate source-event posting.

Illustrative mechanics below are **engineering examples, not an approved accounting policy**. They assume the firm has chosen an invoice-based revenue policy and configured accounts; production account mappings/taxes/recognition must be approved first.

| Source event | Illustrative balanced effect |
|---|---|
| Invoice issued | Debit client receivable; credit service revenue and configured tax liability components as applicable |
| Receipt confirmed before allocation | Debit bank/cash account; credit customer advance/receipt-clearing account |
| Receipt allocated to invoice | Debit customer advance/receipt-clearing account; credit client receivable |
| Expense/consultant bill posted | Debit relevant cost/expense; credit payable |
| Supplier payment confirmed | Debit payable; credit bank/cash |
| Salary cost posted | Debit salary expense; credit salary payable, entirely restricted to admin |
| Salary paid | Debit salary payable; credit bank/cash, entirely restricted to admin |
| Invoice credit | Reverse the appropriate billed revenue/tax/receivable components through a linked adjustment |

The exact postings for deposits, recognition, refunds, taxes and work in progress depend on the firm's approved policy. Until configured, demonstrate with clearly fictional data and prevent real issue/posting paths from making unsupported assumptions.

Opening balances are controlled migration entries, not new sales. Preserve source totals and administrator reconciliation/sign-off. Period closing prevents backdated mutation; corrections use the approved reopening/adjustment policy and retain history. Provide an admin trial balance and source-to-ledger drill-down once journal posting is implemented.

## Commercial privacy and correction rules

- Consultant and authorized client views show their assigned project commercial records only.
- Representative finance access is an explicit grant; binding acceptance still belongs to the main client.
- An administrator without owner capability cannot use financial administration to access individual performance reports.
- An owner without admin capability cannot view payroll or profit through a chart, export, search or a hidden-inclusive total.
- Cancelled/archived projects retain invoices and balances. Archive never performs a write-off.
- All financial export totals must match the filtered authorized records and display currency, period/as-of time and generation time.

## Review evidence

Use meaningful scenarios: exact decimal-to-minor-unit conversion; partial receipt; overpayment; one receipt split over invoices; invoice split over receipts; reversed receipt; issued invoice correction; rejected staff issue without approval; stale approval after edit; schedule change without invoice mutation; duplicate issue/receipt retry; hidden payroll totals; consultant client-history access; balanced journal; and import/opening balances not counted as new sales.
