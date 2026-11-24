# Changes, estimates and authorization for extra work

**Requirements:** REQ-CHG-001–005, REQ-IAM-005, REQ-FIN-002/005/006, REQ-MAT-003.

**Confirmed gate:** Main-client estimate acceptance + administrator-confirmed required payment + manager authorization are required before additional work starts.

## Purpose and records

Capture a requested departure from the accepted scope without letting a chat message, material selection or drawing upload silently authorize extra cost. A change record contains:

- Project, requester, source (discussion, drawing, material selection, site issue or new request) and affected original scope.
- Clear proposed work, exclusions, dependencies and whether it affects existing completed work.
- Versioned estimate with currency, priced items, total, configured tax treatment, required pre-work payment and schedule impact.
- Named main-client acceptance and the exact accepted estimate snapshot.
- Confirmed receipt/allocation evidence supporting the required payment, visible according to financial permissions.
- Manager authorization, related tasks/drawing versions and completion evidence.

The payment threshold must be an explicit amount or rule in the estimate. Do not assume either 100% or a particular advance percentage. A zero-payment shortcut is not included in the confirmed scope.

## Transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → REQUESTED | Authorized project participant proposes change | Project membership and ability to submit the source request | Record proposal only; no execution authority; `change_requested`. |
| REQUESTED → ESTIMATING | Manager accepts for assessment | Scope sufficiently clear; assigned estimator | Create estimating work; `change_estimation_started`. |
| ESTIMATING → AWAITING_CLIENT | Manager issues estimate | Complete immutable estimate; main client active; payment and timing conditions explicit | Create main-client action; `change_estimate_issued`. |
| AWAITING_CLIENT → ACCEPTED_AWAITING_PAYMENT | Main client accepts | Current estimate version; required acknowledgement | Record acceptance, expected payment and schedule impact; `change_estimate_accepted`. |
| AWAITING_CLIENT → DECLINED | Main client declines | Current offer | Stop execution path; record reason if given; `change_declined`. |
| ACCEPTED_AWAITING_PAYMENT → PAYMENT_CONFIRMED | Admin confirms qualifying external receipts | Correct currency; allocation available; required amount fully satisfied | Record money/allocations; create manager action; `change_payment_satisfied`. |
| PAYMENT_CONFIRMED → AUTHORIZED | Manager authorizes work | Acceptance still current; payment still sufficient; required project scope/assignments valid | Record authorized version/scope; unblock relevant work; `change_authorized`. |
| AUTHORIZED → IN_PROGRESS | Assigned staff starts work | Authorization effective; project active | Start associated delivery tasks; `change_work_started`. |
| IN_PROGRESS → COMPLETED | Manager records completion | Delivery evidence; related drawing release/snags accounted for | Preserve scope and outcome; `change_completed`. |
| Open pre-execution state → CANCELLED | Manager cancels | Reason; admin handles any received funds separately | Cancel pending requests/reminders; no automatic refund; `change_cancelled`. |
| Issued/accepted pre-execution version → SUPERSEDED | Manager issues revised estimate | Reason and versioned changes | Require fresh main-client acceptance and re-evaluate payment; `change_estimate_revised`. |

The UI can show “Accepted — payment pending,” “Paid — manager approval pending” and “Authorized to start.” These states must remain distinct.

## Revising scope, price or terms

Changing scope, price, required pre-work payment or schedule impact creates a new estimate version. Previous acceptance cannot authorize the changed version. Previously confirmed cash remains real, but its allocation must be reviewed against the new obligation; do not record it twice or pretend it disappeared.

If work has already begun, preserve the original authorization and work performed. A further change becomes a linked new change request for the remaining/additional scope. Do not retroactively rewrite the prior accepted contract or mark already completed work as never authorized.

Changing only a spelling or other noncommercial label may use an audited metadata correction if it cannot alter the meaning of what was accepted.

## Blocking rules

- A representative may propose and comment but cannot accept the estimate.
- A consultant may identify a technical change but cannot commit the client to its price.
- A client-reported bank transfer does not satisfy the payment gate until an administrator confirms it.
- A manager cannot both claim missing payment is satisfied and proceed through a generic override.
- Tasks/drawing drafts may be prepared for planning before authorization, but operational start/completion transitions for the extra work remain blocked.
- A reversed qualifying receipt removes a pre-start authorization's payment readiness. For work already in progress, flag a financial hold and require manager/admin review before additional execution; preserve the historical authorization and work already done.
- Client cancellation does not automatically refund, credit or write off money. Follow the [accounting correction workflow](invoices-and-accounting.md).

## Client communication

Present the additional work, cost, required payment and expected time impact together before acceptance. Do not bury a new charge in an upload or an internal note. Payment history shows the confirmed transaction and its allocation, while raw verification evidence remains restricted.

## Review evidence

Demonstrate rejection of representative acceptance, manager authorization before payment, payment evidence without admin confirmation and use of a superseded estimate. Demonstrate partial payment, fresh acceptance after revision, a reversed receipt and an authorized change proceeding through delivery.
