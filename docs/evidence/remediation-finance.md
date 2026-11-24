# Financial integrity remediation — local evidence

Branch: `implement/merveille-portal`. Starting application source: `813ef8b`; remediation work order: `82921d6`. Date: 24 November 2026. This record describes source/local checks, not hosted approval or real-person acceptance.

## Changed behavior

- Global ADMIN/OWNER capabilities no longer substitute for scoped MANAGER approval. Draft/issue actions require explicit finance author/issue grants. Contractual acceptance requires project main-client authority and the current main-client pointer.
- Quotes, schedules, invoice drafts/revisions/approval/issue, receipt confirmation/allocation and project activation use D1 transactional batches with SQL CHECK predicates. Concurrent stale writes fail the transaction rather than continuing after an update affected zero rows.
- Invoice/receipt numbers are allocated from organisation/year sequences inside the issue/confirmation batch, with existing numbering inspected for safe continuation. Issuance posts one balanced journal, immutable issued version pointer, audit event and transactional outbox event. Obsolete approved versions cannot be issued and issued invoices cannot regress to approval/draft.
- Replays retain issue numbers and confirmation results; allocation keys store a fingerprint and reject reuse with different inputs. Amounts are positive safe integer minor units; excessive requests are rejected explicitly, never silently capped. Allocations require matching organisation/project/currency, confirmed funds and an issued outstanding invoice.
- Expense/consultant posting and payroll state commit with balanced journals. Posted salary allocation is unique per person/month/project. Existing duplicate source/period records make the additive migration fail for reconciliation; no historical money is deleted or guessed.
- Accepted additional-work payment reservations and manager authorisation commit with current-version predicates and audit. Estimate revisions supersede old acceptance within one transaction. Activation uses accepted quotation and actual confirmed receipt totals, never legacy timestamp flags alone.
- Accounting/financial HTTP readers enforce organisation and capability scope. External readers receive issued invoice snapshots and restricted payment history; other people's raw bank evidence is excluded. External project details/lists omit internal lifecycle reasons and member contact data.
- Archive blocks operational commands. Existing receipt confirmation/allocation remains available to ADMIN for existing obligations. New receipt reporting through the general operation requires an active project; the archive settlement wrapper uses existing confirmed funds.
- Enquiry conversion commits project, stages, memberships and enquiry link together; chosen identities must be active organisation members. Material/reference attachments must be completed shared files in the same organisation/project, and main-client/material/change links are checked.

## Checks

- `npm run typecheck` — passed after repairs (shared UI may be concurrently edited; rerun at integration gate).
- `npx vitest run tests/domain/finance tests/domain/accounting tests/domain/changes tests/domain/project-lifecycle tests/remediation/finance-integrity.test.ts` — 29 tests across five files. The final integrated command/result belongs to the parent remediation record.
- New `tests/remediation/finance-integrity.test.ts` exercises wrong actors, stale/issued versions, deterministic replay, invalid/excess/currency allocations, an injected ledger failure rolling back issuance and sequence, a competing balance change failing a guarded allocation, legacy timestamp activation rejection, atomic expense posting, and external project privacy.
- Prior finance tests now use explicit grants and assert rejection of excessive allocation followed by an explicit valid amount. Tests no longer demand silent capping or timestamp-only activation.

Node SQLite tests exercise SQL and transactional logic; they do **not** prove Cloudflare D1 runtime behavior. Workerd verification, hosted Google accounts, production reconciliation, remote recovery and team UAT remain separately recorded gates. No remote migration, real financial entry, message or deployment was performed by this work.

## Integration review follow-up

Final targeted result: `npx vitest run tests/remediation/finance-integrity.test.ts tests/domain/finance tests/domain/accounting tests/domain/project-lifecycle tests/domain/changes tests/domain/archive` — **38 passed across six files**, using Vitest 5.1.1, 24 November 2026. `npm run typecheck` passed after the review repairs.

Additional regressions cover administrator validation of illegal finance grants, external actors with forged author flags, cross-organisation accounting aggregates/project writes, original archived-settlement replay after subsequent allocation, zero-advance activation, and a legacy confirmed receipt missing its journal. Finance author/issue eligibility now requires a scoped TEAM_MEMBER or MANAGER as well as explicit flags; ADMIN/OWNER alone do not qualify. The additive read-only `financial_reconciliation_errors` view reports incomplete/unbalanced legacy financial sources before onboarding; it does not alter history. Activation excludes confirmed rows without confirmer/timestamp and balanced matching receipt posting. Hosted reconciliation remains an operator gate.

## Newly received archived settlement payment

Added `0018_receipt_settlements.sql` and a purpose-bound receipt DTO. An ADMIN can record a newly received outside payment against a selected existing issued outstanding invoice after archive, then use the normal report → confirm → allocate ledger flow. The command requires a retained operation key; invoice/project/organisation/currency/amount guards and current ADMIN authority run inside the batch. A stored `settlement_invoice_id` prevents redirecting funds to another invoice. No new invoice, schedule or operational work is enabled. Replay remains safe after full settlement.

Targeted verification: **39 tests passed across six files**; typecheck passed. The added scenario exercises a new payment after archive through confirmation/allocation, denies wrong actor/missing obligation/excess amount/reused different input/redirected invoice, and confirms new invoices/schedules remain blocked. Reapply additive migrations in the isolated Workers runtime before repeating that environment's integration gate.
