# Phase 08 Evidence: Expenses, Consultant Fees, Payroll and Profit (Accounting)

## Identity

- Phase / requirement IDs: P08 / REQ-FIN-008 through REQ-FIN-013, REQ-IAM-004, REQ-IAM-006; AC-034, AC-035, AC-036, AC-037, AC-038
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`adminUser`, `ownerUser`, `managerUser`, `staffUser`, `consultantUser`, `clientUser`) and project `prj_accounting_villa`

## Changed behaviour

- Created D1 migration `migrations/0008_accounting_and_ledger.sql` containing tables:
  - `expenses`: Direct project and overhead expenses with supplier, category, minor unit amount, incurred date, evidence link, and lifecycle states (`SUBMITTED`, `APPROVED`, `POSTED`, `REJECTED`).
  - `consultant_bills`: Consultant fee obligations with discipline, bill reference, amount, bill date, evidence link, and lifecycle states (`SUBMITTED`, `APPROVED`, `POSTED`, `REJECTED`).
  - `payroll_records`: Salary allocations restricted strictly to administrators (`ADMIN`), tracking period month, employee ID, project allocation, and gross salary.
  - `accounting_periods`: Configured fiscal periods with controlled closure (`is_closed`), closing user ID, and timestamp.
- Implemented Accounting Domain Service in `src/server/domain/accounting/service.ts`:
  - `submitExpense` & `submitConsultantBill`: Staff or consultants submit liabilities; checks that transaction date does not fall into a closed period (AC-037).
  - `approveExpense` & `approveConsultantBill`: Manager or Admin reviews and approves the exact liability (AC-034).
  - `postExpense` & `postConsultantBill`: Strictly restricted to administrators (`ADMIN`, AC-034); staff attempts are rejected with `FORBIDDEN`; posts balanced double-entry journal lines (`SUM(debit_minor) == SUM(credit_minor)`).
  - `recordPayroll`: Strictly restricted to administrators (`ADMIN`, AC-035); non-admin owners without ADMIN are denied; posts balanced salary expense and payable lines.
  - `createAccountingPeriod` & `closeAccountingPeriod`: Admin controls fiscal periods; `assertPeriodNotClosed` rejects any backdated write into closed periods with `CLOSED_PERIOD_WRITE_DENIED` (AC-037).
  - `getFinancialReport`: Generates reproducible statements (AC-038) with explicit basis (`"Issued Invoices & Incurred Costs (Accrual Basis)"`) and explicit currency (`"INR"`, AC-036); rejects cross-currency summing; ensures non-admin queries completely omit salary allocations and operating profit from the returned projections, preventing deduction or subtraction leaks (AC-035).
- Built API endpoints:
  - `src/app/api/finance/expenses/route.ts`: List expenses, submit expense, approve expense, post expense.
  - `src/app/api/finance/consultants/route.ts`: List consultant bills, submit bill, approve bill, post bill.
  - `src/app/api/finance/payroll/route.ts`: Admin-only payroll queries and salary recordings.
  - `src/app/api/finance/periods/route.ts`: Accounting period management and closure.
  - `src/app/api/finance/reports/route.ts`: Financial summary statement generation with permission-scoped projections.
- Built UI screen:
  - `src/app/(portal)/finance/page.tsx`: SCR-11 Firm Accounting with Statement Overview, Expenses manager/admin workflow, Consultant Obligations workflow, and protected Payroll & Salaries tab (visible only to administrators).

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-034 | `npx vitest run tests/domain/accounting/p08-accounting.test.ts` | PASS | Staff submits expense; staff post rejected (`FORBIDDEN`); manager approves; admin posts to ledger; consultant submits bill; consultant post rejected; manager approves; admin posts to ledger |
| AC-035 | `npx vitest run tests/domain/accounting/p08-accounting.test.ts` | PASS | Admin allocates salary; staff queries financial report -> salaries and operating profit are strictly `undefined`; owner (without admin) queries report -> salaries and profit are strictly `undefined`; admin queries report -> sees complete statement with salaries and operating profit |
| AC-036 | `npx vitest run tests/domain/accounting/p08-accounting.test.ts` | PASS | Report explicitly names period, currency ("INR"), and reporting basis ("Issued Invoices & Incurred Costs (Accrual Basis)"); invoiced sales and received cash are distinct; foreign currency USD without conversion rules rejected |
| AC-037 | `npx vitest run tests/domain/accounting/p08-accounting.test.ts` | PASS | October 2026 period closed; backdated expense submission rejected with `CLOSED_PERIOD_WRITE_DENIED`; all journal entries verify `SUM(debit_minor) == SUM(credit_minor)` |
| AC-038 | `npx vitest run tests/domain/accounting/p08-accounting.test.ts` | PASS | Two sequential report runs against known synthetic invoices, expenses, consultant bills, and payroll produce exact identical figures; no guessed numbers |
| Full Test Suite | `npm test` | PASS | 11 test files, 52 tests passing in 596ms with SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 26 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 240 files |

## Remaining work

- P08 phase gate is fully satisfied.
- Ready to proceed to Phase P09: References, materials and additional-work controls (Client decisions & change requests).

## Recovery impact

- Applied migration `0008_accounting_and_ledger.sql` creating tables `expenses`, `consultant_bills`, `payroll_records`, and `accounting_periods`.
