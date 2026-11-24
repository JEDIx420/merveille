# SCR-12 — Owner-only team performance

**Route:** `/performance`; optional person detail `/performance/:userId`. **Requirements:** REQ-DAS, REQ-TSK, REQ-IAM. **Related:** [tasks](06-tasks.md), [overview](02-overview.md).

## Purpose and permission

Give OWNER a private, explainable view of deadline adherence, work quality, corrections and site progress. This route, its data and exports require OWNER. ADMIN or MANAGER alone is insufficient; staff do not see their own results unless the user changes the agreed scope later.

## Layout and metrics

Show period and project filters, a compact team table, then individual trends with source evidence. Columns may include completed work, on-time completion against the appropriate agreed due date, current overdue work, quality-review entries and correction categories. Definitions and denominators must be visible. Site progress is a separate project measure, not simply the percentage of tasks checked off.

**Primary action:** “Review person” from the table or “Add review note” when the qualitative review feature is implemented. Avoid a single opaque score, ranking podium or gamified badges. Quality and fewer corrections require recorded context; client scope changes should not automatically become staff errors.

## Interaction and service contract

Read owner-authorised metric projections and underlying permitted task/review evidence. Write owner review notes only if included in the agreed measure definitions. Preserve original deadlines, manager changes, completion/reopen timestamps and correction reasons so a later deadline edit cannot fabricate an improved record.

Calculate over a defined period, with missing information explicit. A small sample shows its size. Charts have tables and labels explaining the comparison. Performance content must not enter ordinary employee activity feeds, WhatsApp templates, client exports or shared project search.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Insufficient data is a meaningful state, not a zero score. Empty filters preserve the selected period. Mobile begins with the person/period summary and expands evidence; no hover-only tooltips. Deactivated staff can remain in historical reports with access attribution retained.

## Acceptance criteria

- Non-OWNER sessions cannot fetch any individual performance result or aggregate.
- Historical deadline changes do not overwrite the evidence used in the metric.
- Each displayed measure explains its source and denominator.
- Client-requested changes can be distinguished from quality corrections.
- No numeric quality score is invented from task completion alone.
