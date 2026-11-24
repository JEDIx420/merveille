# In-portal reminders, WhatsApp and escalation

**Requirements:** REQ-NOT-001–006, REQ-IAM-003/006/007, REQ-DAS-003.

**Confirmed channels:** In-portal and WhatsApp. Unresolved overdue items escalate to the administrator. Timings, contact details and sender arrangements are later operational inputs.

## Purpose and boundary

Notifications point a person to an authorized current action or published update. They are not the authoritative state of the task, drawing, invoice or payment. Reading a message never approves work or confirms money.

The build uses a local fake/sink until sender configuration and an explicitly authorized test recipient exist. Implementing the integration is not permission to message real clients. Production delivery requires the firm's approved operational setup, contact preferences and actual authorization.

## Recipient defaults

| Event/action | Default recipient | Important limit |
|---|---|---|
| Task assigned, due or overdue | Assigned staff; responsible manager as configured | No client/consultant exposure of internal task notes |
| Drawing review required | Required assigned consultant reviewer(s) | Clients do not receive a drawing-approval action |
| Drawing ready for release | Assigned manager | Consultant approval does not announce a client-ready release |
| Drawing released/withdrawn | Authorized affected project audience | Link to permitted version/current state; no attachment leak |
| Project update awaiting review | Assigned manager | Draft remains private |
| Project update published | Selected authorized audience | Respect publication audience, not all project members blindly |
| Quotation/change estimate awaiting acceptance | Main client | Representatives may receive optional FYI only; no acceptance control |
| Material selection needed | Main client | Representatives contribute without binding authority |
| Required payment/due invoice | Main client; explicitly granted finance representative if configured | Consultant financial visibility does not make consultant responsible for the client's bill |
| Reported payment needs verification | Administrator | Bank evidence stays restricted |
| Paid change ready for work authorization | Assigned manager | Never send “start work” before actual authorization |
| Snag needs triage/verification | Assigned manager | Keep private remediation/cost content out of the message |
| Unresolved overdue escalation | Administrator | Administrative follow-up does not grant the source's approval capability |
| Company announcement | Explicit selected audience | Archived contacts excluded unless deliberately included |

The owner sees priority dashboards but does not automatically receive every administrator escalation unless also configured as administrator. Salary/profit and individual-performance notifications, if later added, must use their restricted capabilities rather than general project distribution.

## Reminder policy

Define policy by event type: initial reminder timing, upcoming-due window, overdue interval, escalation threshold, maximum repetition, quiet hours, timezone, channel preferences and who may tune the rule. Do not invent a universal daily WhatsApp blast.

Upcoming scheduled payments and overdue invoices are distinct source types. A message must say whether it concerns an expected installment or an issued invoice. Use the actual remaining obligation after receipts/credits; do not send a full original amount after partial payment.

An overdue item escalates only while unresolved and after the configured threshold. Escalation records should say what action remains and who currently owns it. Admin may follow up or arrange reassignment through the proper workflow; receiving an escalation does not make admin a consultant or manager.

## Delivery transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| Source event → CANDIDATE | Successful workflow event or scheduled evaluation | Eligible event; active policy | Construct source/version/recipient/window identity; `notification_candidate_created`. |
| CANDIDATE → SUPPRESSED | Policy/authorization check | Already resolved, duplicate, no membership, disallowed channel or obsolete version | Retain bounded suppression reason; no external message; `notification_suppressed`. |
| CANDIDATE → QUEUED | Notification service schedules | Current recipient authorized; contact/channel configured; no duplicate | Queue minimal message and in-portal item; `notification_queued`. |
| QUEUED → SENT/DELIVERED when observable | Delivery service dispatches | Recheck current authorization/state; applicable quiet hours | Record dispatch/provider reference and observed delivery result; `notification_sent`. |
| QUEUED → FAILED | Delivery attempt fails | Actual error observed | Record safe error/retry eligibility; show operational failure; `notification_failed`. |
| FAILED → QUEUED | Controlled retry | Retry budget; still relevant/authorized; duplicate checks | Attempt again without creating a new business action; `notification_retry_scheduled`. |
| Dispatch response uncertain → UNKNOWN | Delivery service cannot determine outcome | Timeout/ambiguous response | Record uncertainty; reconcile before blind repeat; `notification_delivery_unknown`. |
| Open in-portal item → READ | Recipient reads | Authorized identity | Mark read only; source action remains open; `notification_read`. |
| Outstanding item → RESOLVED/OBSOLETE | Source action resolves or changes | Source authoritative state | Close action notification; cancel pending obsolete reminders; `notification_resolved`. |

“Sent” means dispatch succeeded, not necessarily that a person read the message. Only show delivery/read labels supported by an actual observation. Do not promise exactly-once external delivery; combine durable deduplication, bounded retry and reconciliation of uncertain results.

## Deduplication and cancellation

Use a stable identity based on source entity, immutable version where relevant, event kind, recipient, channel and reminder window. The same event retried must not produce multiple indistinguishable reminders. A deliberate later overdue reminder is a new configured window, not a retry of the first one.

Cancel or suppress pending jobs when:

- The action completes, is cancelled or becomes obsolete.
- A new drawing/estimate version replaces the requested one.
- The assignee/main-client authority changes.
- Membership is revoked or the identity is suspended.
- A payment reduces the due amount to zero.
- Archive policy pauses the underlying operational action.

Recheck at dispatch, not only when queued. Events can resolve or permissions can change between those moments.

## Content and privacy

Use concise messages such as “A drawing review is waiting for you in Marvel” plus a sign-in link to the permitted record. As an engineering default, external messages avoid amounts, bank details, draft drawings, salary/profit values, performance data and internal notes.

The link requires authentication and current authorization. It must not embed a reusable broad-access token or directly expose a private object. Delivery logs contain only necessary routing/outcome metadata; sensitive payloads do not belong in generic logs.

In-portal messages can show more context only when the viewer is authorized. Revoked users cannot continue reading old notification previews containing restricted content through an otherwise accessible inbox.

## Review evidence

Demonstrate correct role-specific recipients, duplicate-event suppression, failed/uncertain delivery, resolution before dispatch, revoked membership before dispatch, partial-payment reminder amount/context, no client drawing-approval reminder and administrator escalation without approval authority leakage. Use a fake sink until live recipient authorization exists.
