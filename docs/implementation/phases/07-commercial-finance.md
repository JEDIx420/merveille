# P07 — Quotations, schedules, invoices and receipts

**Status:** not started. **Dependencies:** P02, P03.

## Outcome

Deliver authoritative client financial visibility and project activation.

## Read before implementation

- [enquiry-to-activation.md](../../../docs/workflows/enquiry-to-activation.md)
- [invoices-and-accounting.md](../../../docs/workflows/invoices-and-accounting.md)
- [finance-integrity.md](../../../docs/architecture/finance-integrity.md)
- [10-project-finance.md](../../../docs/screens/10-project-finance.md)

## Implementation order

1. Implement versioned quotations, line items, main-client acceptance and upfront schedule items with explicit date/stage trigger policy.

2. Implement manager-only schedule revisions; preserve the accepted commercial record and agreed due rules.

3. Implement staff invoice draft, exact-version manager approval, staff issue, unique numbering and immutable issued snapshots.

4. Implement admin-confirmed external receipts, evidence, split allocation, partial/unallocated balances and auditable correction/reversal commands.

5. Use integer minor units, explicit currency/rounding and transaction/idempotency constraints; build shared journal primitives here for use by P08.

6. Expose client/consultant permitted quotation, invoice, schedule and payment history without raw bank/private evidence.

7. Finish activation against current accepted quote and confirmed required advance. Verify each missing-gate combination.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/quotes/`
- `src/server/domain/invoices/`
- `src/server/domain/payments/`
- `src/server/domain/accounting/`
- `src/features/finance/`
- `tests/domain/money/`

## Acceptance cases

Run AC-010, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032, AC-033 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Invoices cannot be issued from unapproved edited content; receipts are admin-confirmed; amounts reconcile exactly; project activation is gated by real records. Production accounting settings remain an explicit readiness gate.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
