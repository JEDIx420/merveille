# P09 — References, materials and additional-work controls

**Status:** not started. **Dependencies:** P03, P07.

## Outcome

Turn client decisions into traceable outcomes without unauthorised scope changes.

## Read before implementation

- [materials-and-references.md](../../../docs/workflows/materials-and-references.md)
- [change-requests.md](../../../docs/workflows/change-requests.md)
- [13-materials-references.md](../../../docs/screens/13-materials-references.md)
- [14-change-requests.md](../../../docs/screens/14-change-requests.md)

## Implementation order

1. Implement client/representative reference uploads, comments and staff-organised decision options.

2. Record main-client material decisions against exact options; representatives cannot overwrite them.

3. Implement change requests, estimate versions, price/time impact and required pre-work payment.

4. Enforce main-client estimate acceptance, correct admin-confirmed payment allocation and manager authorisation before work starts.

5. Invalidate stale acceptance/authorisation for revised scope and recompute required payment deliberately.

6. Link work tasks to approved change scope and show blocked states rather than allow a premature start.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/materials/`
- `src/server/domain/changes/`
- `src/features/client-decisions/`
- `tests/domain/changes/`

## Acceptance cases

Run AC-039, AC-040, AC-041, AC-042, AC-043 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Only authorised main-client decisions bind; additional work fails each missing-gate test; revised estimates do not inherit old consent.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
