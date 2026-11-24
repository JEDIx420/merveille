# P02 — Client portfolios, project records and enquiry intake

**Status:** not started. **Dependencies:** P01.

## Outcome

Represent the firm's real project lifecycle and contact relationships.

## Read before implementation

- [enquiry-to-activation.md](../../../docs/workflows/enquiry-to-activation.md)
- [requirements.md](../../../docs/product/requirements.md)
- [03-projects.md](../../../docs/screens/03-projects.md)
- [04-enquiry-feasibility.md](../../../docs/screens/04-enquiry-feasibility.md)
- [05-project-overview.md](../../../docs/screens/05-project-overview.md)

## Implementation order

1. Create client organisations/households, individually identified contacts, one main-client authority and project memberships.

2. Deliver permission-filtered project list/switcher and project identity/stage records.

3. Implement enquiry requirements, site feasibility checklist/study metadata, outcomes and quotation linkage.

4. Represent activation as a guarded manager command. Until P07 provides real acceptance/receipt records, unmet gates must block; do not seed a fake payment shortcut.

5. Implement manager stage changes, pause/cancel/complete transitions with reasons and optimistic concurrency.

6. Wire evidence/file controls in P03 and final activation in P07; record these dependencies visibly instead of claiming those integrations are finished here.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/projects/`
- `src/server/domain/enquiries/`
- `src/app/(portal)/projects/`
- `src/features/projects/`
- `migrations/`
- `tests/domain/project-lifecycle/`

## Acceptance cases

Run AC-009, AC-011, AC-012 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Separate contacts and portfolios work; enquiry/lifecycle transitions are real and audited; activation cannot bypass the still-unmet commercial gates.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
