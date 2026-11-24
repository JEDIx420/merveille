# P04 — Tasks, deadlines and completion history

**Status:** not started. **Dependencies:** P02, P03.

## Outcome

Deliver daily team work with manager-controlled deadlines and honest status.

## Read before implementation

- [tasks.md](../../../docs/workflows/tasks.md)
- [06-tasks.md](../../../docs/screens/06-tasks.md)
- [api-contracts.md](../../../docs/architecture/api-contracts.md)

## Implementation order

1. Implement staff-created and manager-assigned tasks with explicit scope, owner, manager-controlled deadline and stage association.

2. Support in progress, blocked, completion, cancellation and manager reopening with reasons.

3. Keep original/revised deadline and completion events for later performance reporting; avoid counting scope changes as quality failures.

4. Make internal comments/attachments inaccessible to clients/consultants.

5. Deliver list/detail/filter/mobile task experiences with reliable optimistic feedback and conflict recovery.

6. Record pending outbox events for due/overdue transitions; real notification dispatch arrives in P11.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/tasks/`
- `src/features/tasks/`
- `src/app/(portal)/projects/[projectId]/tasks/`
- `tests/domain/tasks/`

## Acceptance cases

Run AC-013, AC-014, AC-015 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Staff and manager task flows pass, private evidence stays private, and reopened/overdue logic produces the expected history.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
