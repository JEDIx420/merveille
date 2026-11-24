# P05 — Drawing register, consultant approval and manager release

**Status:** not started. **Dependencies:** P02, P03.

## Outcome

Make the current approved drawing unambiguous and enforce every release gate.

## Read before implementation

- [drawings.md](../../../docs/workflows/drawings.md)
- [07-drawings.md](../../../docs/screens/07-drawings.md)
- [15-review-inbox.md](../../../docs/screens/15-review-inbox.md)
- [data-model.md](../../../docs/architecture/data-model.md)

## Implementation order

1. Implement logical drawing records and immutable submitted versions with relevant required consultant assignments.

2. Implement version-specific consultant approval/return and prevent unassigned consultants from deciding.

3. Implement separate manager release command only when current required approvals are complete. No client approval screen or endpoint.

4. Retain the existing current release while a replacement is reviewed; mark prior release superseded atomically on new release.

5. Implement manager withdrawal with reason and affected-audience notification event; preserve old files and approval history.

6. Deliver register, revision history, review inbox, release preview and mobile document views. Protect all draft URLs and derived previews.

7. Run concurrent release/idempotency tests; ensure one current released version and consistent audit/outbox.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/drawings/`
- `src/features/drawings/`
- `src/app/(portal)/projects/[projectId]/drawings/`
- `src/app/(portal)/reviews/`
- `tests/domain/drawings/`

## Acceptance cases

Run AC-016, AC-017, AC-018, AC-019, AC-020, AC-021 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Consultant approval cannot publish; manager release is required; a revision cannot reuse previous approvals; concurrent operations cannot produce two current drawings.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
