# Waiting on you, priorities and performance

**Requirements:** REQ-DAS-001–005, REQ-NOT-006, REQ-IAM-005/006.

**Confirmed priorities:** Delayed tasks, pending approvals and approaching deadlines. Waiting-on-you is included. Invoiced and received sales are separate; individual performance is owner-only.

## One action index, many authoritative workflows

Waiting-on-you is a permission-filtered projection of unresolved source actions. Do not create a second editable task store that drifts from the drawing, invoice, change or selection workflow.

Each item identifies source entity/version, project, action type, required capability, actual responsible person, requested time, due time if any, blocker, next permitted action and source state. Counts use the same authorized query as the list.

## Action mapping

| Source condition | Person who can act | Action and completion condition |
|---|---|---|
| New/unassigned task | Manager | Assign and set deadline |
| Assigned open task | Assignee | Start/update/complete under task rules |
| Submitted drawing review | Required consultant | Approve or return exact version |
| All required consultant reviews approved | Manager | Release or return exact version |
| Submitted update/permit-sharing item | Manager | Publish or return reviewed content |
| Quotation awaiting acceptance | Main client | Accept or decline current offer |
| Accepted quote awaiting advance | Main client for external payment; admin for reported-payment verification | Separate “payment expected” and “verify receipt” items; no fake payment button |
| Ready-to-activate project | Manager | Activate after actual gates |
| Change estimate awaiting acceptance | Main client | Accept/decline exact estimate |
| Accepted change awaiting payment | Main client; admin verification where reported | External payment/confirmed receipt states remain distinct |
| Paid change awaiting authorization | Manager | Authorize or return; no extra-work start beforehand |
| Material selection awaiting decision | Main client | Select current option/version |
| Invoice awaiting review | Manager | Approve or return exact draft |
| Approved invoice not issued | Assigned invoice-issuing staff | Issue unchanged approved snapshot |
| Confirmed schedule item ready for billing | Assigned finance staff | Prepare invoice; eligibility is not issue approval |
| Expense awaiting review/posting | Manager/admin according to state | Review or post through finance workflow |
| Snag awaiting triage/verification | Manager | Assign or verify/return |
| Unresolved overdue escalation | Administrator | Follow up, inspect permitted context or arrange reassignment; not substitute for source approval |

Client representatives may see pending project decisions as context, but only the main client receives the binding decision action. A manager sees “Waiting for consultant” as a dependency, not an enabled release action before approval.

## Projection lifecycle

| Derived state | Trigger | Display/action behavior |
|---|---|---|
| AVAILABLE | Source action becomes eligible and viewer authorized | Show the actual available action and current version |
| BLOCKED/WAITING_ON_OTHER | A dependency is unsatisfied | Explain the dependency; do not provide a bypass |
| OVERDUE | Open eligible action passes configured due time | Add lateness/priority context; same underlying source action |
| RESOLVED | Source transition succeeds | Remove from active list; preserve source/audit history |
| SUPERSEDED | New source version invalidates old request | Replace with current request if authorized; stale link explains change |
| NO_LONGER_AUTHORIZED | Membership/authority changes | Remove without revealing the new recipient's private details |

Clicking a notification or marking it read does not resolve this projection. Actions always revalidate the current source state and permission. A stale card cannot approve a replaced drawing or issue an altered invoice.

## Owner/admin overview

Lead with a manageable action queue:

1. Overdue work requiring intervention, with age, project and responsible person.
2. Approval/release decisions awaiting the current viewer.
3. Upcoming deadlines and payment obligations.
4. Blocked work and its named dependency.
5. Authorized sales/accounting summaries with clear metric definitions.

Do not show fabricated ranking precision. Initial sorting can use severity/explicit priority, overdue age and nearest due date, with an explanatory label and user filters. An item without a deadline is “No deadline set,” not automatically late.

For combined admin/owner users, show both capability sets. For owner-only users, omit salary/profit cards and salary-inclusive totals. For admin-only users, omit individual-performance charts. A locked placeholder that reveals sensitive values or counts is still a leak.

## Performance evidence — owner only

The user wants deadline, quality, rework and site-progress evidence. Start with transparent measures rather than a single score:

- Tasks completed by the relevant baseline and current deadlines, with denominator and period.
- Open overdue work and blocker history.
- Reopened tasks/snags, separated by recorded cause where available.
- Documented review comments/quality observations, with their author and context.
- Manager-recorded stage/site progress against the agreed baseline.

Before displaying rates, define eligible tasks, treatment of cancellations, reassignment, scope changes, reopened completions, missing due dates and zero denominators. Do not compare task counts as if every task has equal size. A staff member's raw number of updates is not a quality measure.

Project progress must use a declared stage/weight policy or show plain stage status. Do not fabricate a percentage from completed task count, uploaded images or money received. The firm supplies the performance definitions and any stage weighting before those figures are treated as management evidence.

Only `OWNER` can access individual performance dashboards/exports. Manager task supervision and administrator activity review remain operational views, not a route around that restriction.

## Review evidence

Demonstrate correct action ownership for all approval types, replacement of stale versions, no client drawing-approval item, separate payment-report and receipt-confirmation actions, permission-filtered counts, source resolution clearing the card, and independent owner/admin dashboard capabilities.
