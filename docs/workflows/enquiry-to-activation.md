# Enquiry, feasibility, quotation and activation

**Requirements:** REQ-PRJ-001–007, REQ-IAM-005, REQ-FIN-002/005, REQ-CHG-001–005.

**Provenance:** Confirmed lifecycle DEC-007. Internal quote review, intake fields and manager activation are engineering defaults that make the lifecycle implementable.

## Outcome

Turn a potential commission into an active, assigned project only when the quotation has been accepted by the main client and the required advance has been confirmed by an administrator. Preserve unsuccessful enquiries without pretending they are active projects.

## Records

- Enquiry: contact, source if known, requested services, tentative location/site reference, lead manager, notes and status.
- Requirements/feasibility study: user needs, staff observations, attachments, unresolved questions, recommendation and reviewer. Do not describe a staff feasibility note as a statutory approval.
- Quotation: version, scope, exclusions, currency, priced lines, taxes if configured, total, validity, expected stages, payment schedule and required advance.
- Client authority: named main client and separately invited representatives.
- Acceptance: accepting identity, exact quotation version, server time and displayed acceptance text/evidence.
- Advance gate: required amount/currency and qualifying confirmed receipt allocations linked to this accepted quotation/project.
- Project: lifecycle state, manager, team/consultants, baseline dates, stage template and source enquiry.

## Intake transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → ENQUIRY_OPEN | Authorized intake staff records enquiry | Required identifying/contact fields; possible duplicate review | Create enquiry; `enquiry_created`. |
| ENQUIRY_OPEN → REQUIREMENTS_REVIEW | Staff/manager starts requirements | Named responsible person | Capture brief, site questions and follow-up; `requirements_started`. |
| REQUIREMENTS_REVIEW → FEASIBILITY_REVIEW | Manager requests site/study work | Sufficient brief or recorded outstanding questions | Assign study tasks; `feasibility_requested`. |
| FEASIBILITY_REVIEW → QUOTE_PREPARATION | Manager accepts study for quoting | Study recommendation and unresolved constraints recorded | Lock reviewed study snapshot; `feasibility_reviewed`. |
| Any open intake state → ON_HOLD | Manager pauses | Reason and optional follow-up date | Pause active follow-ups; preserve documents; `enquiry_paused`. |
| ON_HOLD → previous open state | Manager resumes | Reason; assignments still valid | Reassess dates; `enquiry_resumed`. |
| Any open intake state → LOST/DECLINED | Manager closes | Reason/category; no disguised project deletion | Stop pending intake requests; `enquiry_closed`. |

## Quotation transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → DRAFT | Staff/manager prepares quote | Currency and applicable pricing configuration available | Versioned scope, estimate and proposed schedule; `quotation_drafted`. |
| DRAFT → IN_REVIEW | Author submits | Complete scope/lines, totals, main-client contact and required advance | Freeze submitted version; `quotation_submitted`. |
| IN_REVIEW → CHANGES_REQUESTED | Manager returns | Reason | Author creates revised draft; prior submission retained; `quotation_returned`. |
| IN_REVIEW → READY_TO_SEND | Manager approves | Totals/terms checked; approval references exact version | Make approved version eligible for issue; `quotation_approved`. |
| READY_TO_SEND → SENT | Authorized staff/manager issues | Still approved version; main client is active and authorized | Record immutable sent snapshot and client request; `quotation_sent`. |
| SENT → ACCEPTED | Main client accepts | Exact current offer; not expired/withdrawn; required acknowledgement | Record acceptance; create advance obligation; `quotation_accepted`. |
| SENT → DECLINED | Main client declines | Reason/comment optional unless firm policy requires it | Notify manager; no activation; `quotation_declined`. |
| SENT → WITHDRAWN/SUPERSEDED | Manager withdraws/revises | Reason; accepted contracts are not silently rewritten | Stop acceptance of old offer; issue revised version if needed; `quotation_withdrawn`. |

Expiry is evaluated against the configured offer date/time policy. Show a stale acceptance attempt the current offer; never accept a newer version on behalf of the client. A representative may ask questions but cannot accept the quotation.

An accepted quotation is not edited in place. Commercial changes use the [change workflow](change-requests.md). A purely administrative correction needs a recorded amendment with no silent change to price, scope or accepted obligations.

## Activation transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| ACCEPTED → AWAITING_ADVANCE | System derives gate | Accepted quote has a required advance | Display required/confirmed/remainder separately; no payment collection; `advance_requested`. |
| AWAITING_ADVANCE → READY_TO_ACTIVATE | Admin confirms qualifying receipt(s) | Real external receipt evidence, correct currency and sufficient allocation | Satisfy advance gate; post payment accounting; `advance_satisfied`. |
| READY_TO_ACTIVATE → ACTIVE | Manager activates | Acceptance current; advance still satisfied; main client/manager/team and stages set | Establish active project baseline and activate work; `project_activated`. |
| ACTIVE → PAUSED | Manager pauses | Reason and handling of open tasks/financial obligations recorded | Stop new work as configured, retain existing balances/history; `project_paused`. |
| PAUSED → ACTIVE | Manager resumes | Current assignments and dates reviewed | Resume work and reminders as applicable; `project_resumed`. |
| ACTIVE/PAUSED → COMPLETED | Manager completes delivery | Outstanding work/issues disclosed; completion checklist recorded | Record completion date; financial settlement remains independent; `project_completed`. |
| Non-archived project → CANCELLED | Manager records cancellation | Reason and open obligations reviewed with admin | Stop new work; preserve records; no automatic refund/write-off; `project_cancelled`. |

The confirmed rule requires an advance. Do not include a “skip payment” button, seed a zero-advance exception or allow a zero value to satisfy this gate automatically. Any future zero-advance arrangement is a new business decision that must be explicitly approved and documented before its behavior is implemented.

## Payment and lifecycle edges

- Several confirmed receipts may satisfy one advance. A reported transfer or uploaded screenshot alone does not.
- The same receipt cannot be allocated beyond its available amount or reused to satisfy unrelated gates.
- Reversal of an advance before activation removes readiness. After activation, flag the project for administrator/manager review and place new gated work on hold; do not erase work already performed.
- A quotation can be accepted while work remains inactive. Show that difference in the interface.
- Project completion and archive do not mean all invoices are settled. [Archive](archive-and-access.md) preserves open obligations and states them explicitly.
- Stage progress is an internal business record. K-SMART evidence does not automatically activate the project, certify feasibility or determine a statutory construction sequence.

## Required evidence for review

Demonstrate a successful enquiry-to-active path, a declined quote, an attempted representative acceptance, an insufficient/part advance, a stale quotation acceptance and a reversed advance. Activation must be impossible until its actual guards are satisfied.
