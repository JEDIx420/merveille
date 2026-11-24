# P06 — Published updates, company notices and manual K-SMART records

**Status:** not started. **Dependencies:** P02, P03.

## Outcome

Give clients reliable visible progress while preserving internal work.

## Read before implementation

- [updates-and-announcements.md](../../../docs/workflows/updates-and-announcements.md)
- [k-smart.md](../../../docs/workflows/k-smart.md)
- [08-updates.md](../../../docs/screens/08-updates.md)
- [09-permits.md](../../../docs/screens/09-permits.md)

## Implementation order

1. Separate internal notes, submitted updates and published snapshots with explicit audiences.

2. Implement manager review, return, publication, revised publication and retraction; client feeds contain published fields/files only.

3. Implement manually entered sanction/completion milestone status, checked date, recorder, reference and evidence.

4. Apply publication permissions to client/consultant permit summaries and sensitive supporting files.

5. Deliver company announcements through explicit audiences and the same publication discipline, with feature availability configurable.

6. Add stage/progress-oriented update composer, readable history and truthful stale/manual status labels.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/updates/`
- `src/server/domain/permits/`
- `src/features/updates/`
- `src/features/permits/`
- `tests/domain/publication/`

## Acceptance cases

Run AC-022, AC-023, AC-024, AC-025, AC-026 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Internal content never appears externally; updates and K-SMART summaries publish only after manager review; the app makes no automatic government-verification claim.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
