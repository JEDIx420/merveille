# Phase 07 Evidence: Quotations, Schedules, Invoices and Receipts (Commercial Finance)

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P07 / REQ-FIN-001 through REQ-FIN-006, REQ-FIN-010, REQ-FIN-011, REQ-FIN-013, REQ-PRJ-002, REQ-PRJ-004, REQ-IAM-004; AC-010, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `managerUser`, `staffUser`, `clientUser`, `repUser`) and project `prj_finance_villa`

## Changed behaviour

- Created D1 migration `migrations/0007_commercial_finance.sql` containing tables:
  - `quotations`: Versioned commercial proposals with integer minor unit precision (paise for INR), required advance amounts, and contractual client acceptance tracking.
  - `quotation_items`: Detailed scope line items per quotation version.
  - `payment_schedules`: Upfront agreed milestone schedules with manager-only revision authority, reason retention, and version history.
  - `payment_schedule_items`: Explicit trigger types (`DATE_ONLY`, `STAGE_ONLY`, `DATE_AND_STAGE`, `DATE_OR_STAGE`), target dates, stage names, and advance flags.
  - `invoices`: Staff draft -> Manager approve -> Staff issue lifecycle with unique sequential numbering (`MD-INV-YYYY-XXXX`), immutable issued snapshots, and settlement status (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `SETTLED_BY_CREDIT`).
  - `invoice_versions`: Version snapshots where any post-approval edit invalidates approval and creates an unapproved draft version (AC-029).
  - `invoice_line_items`: Line items per invoice version snapshot.
  - `receipts`: External payment records reported by staff/client, confirmed exclusively by administrators (`ADMIN`), with idempotency keys and reversal tracking.
  - `receipt_allocations`: Exact integer minor unit allocations applied to invoices, capping allocations at invoice outstanding and retaining unallocated advance balances without negative numbers.
  - `journal_entries` & `journal_lines`: Double-entry balanced ledger foundation (`SUM(debit_minor) == SUM(credit_minor)`) tracking receivables, bank cash, customer advances, and design fee revenue.
- Implemented Commercial Finance Domain Service in `src/server/domain/finance/service.ts`:
  - `createQuotation`: Staff/manager creates versioned proposals.
  - `acceptQuotation`: Enforces `canAcceptContractualDecisions` (AC-004) — only the designated primary client can accept binding proposals; representatives and staff are rejected.
  - `createOrReviseSchedule`: Restricts schedule changes to project managers (AC-027); supersedes previous schedules while preserving historical records.
  - `isScheduleItemDue`: Evaluates due rules deterministically across date-only, stage-only, both, and either (AC-028).
  - `draftInvoice` & `editDraftInvoice`: Staff drafts invoices; editing an approved version invalidates approval and increments version (AC-029).
  - `approveInvoice`: Manager reviews and approves specific invoice revision.
  - `issueInvoice`: Staff issues approved invoice; enforces approval gate; allocates unique invoice number; posts balanced journal entry; forbids subsequent mutations (AC-030).
  - `reportReceipt`: Staff or client reports payment transfer with reference and evidence.
  - `confirmReceipt`: Strictly restricted to administrators (`ADMIN`, AC-031); idempotent under identical payload and idempotency key (AC-033); posts balanced bank/advance journal entry.
  - `allocateReceipt`: Admin allocates confirmed receipt funds; caps at outstanding balance; avoids floating-point drift and negative outstanding; preserves unallocated advance (AC-032).
  - `activateProject`: Commercial activation gate (AC-010) — requires BOTH an accepted quotation AND an admin-confirmed required advance payment before allowing manager activation.
- Built API endpoints:
  - `src/app/api/projects/[id]/finance/quotes/route.ts`: List quotations / Create quotation / Accept quotation.
  - `src/app/api/projects/[id]/finance/schedule/route.ts`: Get schedule / Create or revise schedule.
  - `src/app/api/projects/[id]/finance/invoices/route.ts`: List invoices / Draft invoice.
  - `src/app/api/invoices/[id]/route.ts`: Edit draft invoice, approve invoice, issue invoice.
  - `src/app/api/projects/[id]/finance/receipts/route.ts`: Report receipt, confirm receipt, allocate receipt.
  - `src/app/api/projects/[id]/finance/activate/route.ts`: Commercial project activation.
- Built UI screen:
  - `src/app/(portal)/projects/[id]/finance/page.tsx`: SCR-10 Commercial Finance screen with tabs for Quotations, Payment Schedule, Invoices, and Receipts, activation gate status summary, modals for drafting invoices, reporting payments, and allocating receipts.
  - Updated `src/app/(portal)/projects/[id]/overview/page.tsx`: Added navigation link to Finance & Invoicing.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-010 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Activation with missing quote fails; representative cannot accept quote; quote accepted but advance unpaid fails; client reports payment but unconfirmed fails; admin confirms receipt; manager activates successfully |
| AC-027 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Schedule created; staff revision rejected (`FORBIDDEN`); manager revises with documented reason; V1 superseded; V2 agreed |
| AC-028 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Date passed with incomplete stage: `DATE_ONLY` due, `STAGE_ONLY` not due, `DATE_AND_STAGE` not due, `DATE_OR_STAGE` due; when stage completes, all 4 are due |
| AC-029 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Staff drafts; manager approves V1; staff edits lines creating V2 in `DRAFT`; attempt to issue V2 fails; manager approves V2; staff issues V2 |
| AC-030 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Issued invoice cannot be edited (`editDraftInvoice` throws error); unique reference allocated; balanced journal entry posted |
| AC-031 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Payment reported; staff/client confirmation rejected (`FORBIDDEN`); only admin successfully confirms receipt |
| AC-032 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Invoice 10,000.00; Receipt 1 (3,000.00) leaves 7,000.00 outstanding; Receipt 2 (8,000.00) allocated 7,000.00; invoice outstanding 0.00; receipt unallocated advance 1,000.00; no negative balances |
| AC-033 | `npx vitest run tests/domain/finance/p07-finance.test.ts` | PASS | Duplicate receipt confirmation with same idempotency key is idempotent; single receipt and single journal entry survive |
| Full Test Suite | `npm test` | PASS | 10 test files, 47 tests passing in 647ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 20 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 229 files |

## Remaining work

- P07 phase gate is fully satisfied.
- Ready to proceed to Phase P08: Expenses, consultant fees, payroll and profit (Accounting).

## Recovery impact

- Applied migration `0007_commercial_finance.sql` creating tables `quotations`, `quotation_items`, `payment_schedules`, `payment_schedule_items`, `invoices`, `invoice_versions`, `invoice_line_items`, `receipts`, `receipt_allocations`, `journal_entries`, and `journal_lines`.
