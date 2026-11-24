# P12 — Role dashboards, waiting-on-you and owner performance

**Status:** not started. **Dependencies:** P04, P05, P06, P07, P08, P09, P10, P11.

## Outcome

Turn the underlying workflows into a calm, actionable home screen.

## Read before implementation

- [waiting-on-you.md](../../../docs/workflows/waiting-on-you.md)
- [02-overview.md](../../../docs/screens/02-overview.md)
- [12-performance.md](../../../docs/screens/12-performance.md)
- [16-waiting-on-you.md](../../../docs/screens/16-waiting-on-you.md)
- [05-project-overview.md](../../../docs/screens/05-project-overview.md)

## Implementation order

1. Implement role-specific overview queries using source records rather than a mutable duplicate task store.

2. Prioritise delayed tasks, pending approvals/releases and upcoming deadlines; preserve meaningful timezones and urgency.

3. Provide client project progress/current drawing/next payment; consultant reviews; manager releases/invoice/update approvals.

4. Implement waiting-on-you with exact-version links, revalidation after action and permission-filtered counts.

5. Implement owner-only evidence-based deadline/quality/rework/site-progress views using declared definitions. Separate client changes from defects.

6. Complete desktop/mobile visual QA against the supplied design direction and accessible alternatives for charts.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/overview/`
- `src/server/domain/performance/`
- `src/features/overview/`
- `src/features/waiting/`
- `tests/integration/overview/`

## Acceptance cases

Run AC-051, AC-052, AC-053 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Every role gets the correct actionable view; no fake KPI or stale approval link; performance remains owner-only and measures are transparent.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
