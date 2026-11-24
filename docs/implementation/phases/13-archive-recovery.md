# P13 — Archive, audit exports and recovery

**Status:** not started. **Dependencies:** P05, P06, P07, P09, P10, P11.

## Outcome

Keep completed projects useful and demonstrate recoverability.

## Read before implementation

- [archive-and-access.md](../../../docs/workflows/archive-and-access.md)
- [19-archive.md](../../../docs/screens/19-archive.md)
- [backup-and-recovery.md](../../../docs/operations/backup-and-recovery.md)
- [runbooks.md](../../../docs/operations/runbooks.md)

## Implementation order

1. Implement archive lifecycle separate from access revocation; preserve authorised client/consultant downloads and existing explicit staff assignments.

2. Keep archived operational content read-only. Allow ADMIN to append receipts and normally approved settlements for existing obligations, preserving correction approvals; do not allow new invoices, schedules or work through this exception. Support controlled reopening and unresolved balance visibility.

3. Implement permission-scoped individual record/accounting exports without creating a handover-pack feature.

4. Build separate protected database/object backup inventory, scheduling/failure monitoring and restored linkage verification.

5. Exercise restore into an isolated environment and reconcile synthetic files, approvals, memberships and balances.

6. Document retention intent, storage budget monitoring, export privacy and exceptional removal handling without promising platform permanence.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/archive/`
- `src/server/domain/audit/`
- `workers/jobs/backup/`
- `tests/integration/archive/`
- `docs/evidence/recovery/`

## Acceptance cases

Run AC-054, AC-055, AC-066 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Archived external access is correct; revoked users remain denied; unpaid obligations remain; a tested backup restores a coherent database and its linked file versions.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
