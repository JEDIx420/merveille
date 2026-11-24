# P08 — Expenses, consultant fees, payroll and profit

**Status:** not started. **Dependencies:** P07.

## Outcome

Complete the requested internal accounts with restricted sensitive reporting.

## Read before implementation

- [finance-integrity.md](../../../docs/architecture/finance-integrity.md)
- [invoices-and-accounting.md](../../../docs/workflows/invoices-and-accounting.md)
- [11-firm-finance.md](../../../docs/screens/11-firm-finance.md)
- [roles-and-permissions.md](../../../docs/product/roles-and-permissions.md)

## Implementation order

1. Implement non-payroll expense and consultant-fee capture, evidence, project allocation, manager review and admin posting/payment.

2. Implement admin-only payroll records/allocation and sensitive financial capabilities independent of OWNER.

3. Complete balanced journal events, reversals, account/period configuration, opening balances and controlled closure.

4. Build labelled invoiced, received, cost and profit reports using configured accounting basis; do not call cash balance profit.

5. Audit all queries/exports/aggregates for hidden salary/profit inference; do not send a restricted total for the browser to subtract.

6. Use a fully worked synthetic ledger to reconcile invoices, receipts, credits, expenses and payroll; production policy comes from the operational-input register.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/accounting/`
- `src/features/firm-finance/`
- `src/app/(portal)/finance/`
- `tests/domain/ledger/`
- `tests/authorization/financial-privacy/`

## Acceptance cases

Run AC-034, AC-035, AC-036, AC-037, AC-038 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Financial records reconcile and journal invariants hold; only admins see salary/profit; reports state their basis and never imply statutory compliance.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
