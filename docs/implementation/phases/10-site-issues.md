# P10 — Site issue and snag tracking

**Status:** not started. **Dependencies:** P03, P04, P09.

## Outcome

Close site problems with assignment and evidence.

## Read before implementation

- [snags.md](../../../docs/workflows/snags.md)
- [17-site-issues.md](../../../docs/screens/17-site-issues.md)

## Implementation order

1. Implement issue capture with location/context, severity, photo and reporter.

2. Implement manager triage/assignment/deadline and assignee resolution evidence.

3. Implement manager verified closure and reopening; keep resolved and verified closed distinct.

4. Separate internal remediation/cost notes from approved client-visible status.

5. Deliver mobile issue capture, list filters, detail history and linked task behaviour.

6. Enforce P09 change-estimate/payment/manager gates before charged additional snag work starts. An issue report or assignment is not spending authority. Emit notification/action events through the shared outbox without sending live messages.

Also read [the change workflow](../../workflows/change-requests.md) for charged remediation.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/domain/snags/`
- `src/features/snags/`
- `tests/domain/snags/`

## Acceptance cases

Run AC-044, AC-045, AC-070 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

An issue can be reported, assigned, resolved and verified or reopened; external views never expose internal remediation or private cost records.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
