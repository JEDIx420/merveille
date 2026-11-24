# Business workflow index

These files define the business transitions the implementation must enforce. They are specifications, not claims that endpoints or screens already exist. Read the [product requirements](../product/requirements.md) and [permission matrix](../product/roles-and-permissions.md) first.

| Workflow | Primary requirements | Decision owner |
|---|---|---|
| [Enquiry to active project](enquiry-to-activation.md) | REQ-PRJ-001–007; REQ-FIN-002/005 | Manager; main client accepts quote; admin confirms advance |
| [Tasks and delivery](tasks.md) | REQ-TSK-001–006; REQ-DAS-004 | Manager and assigned staff |
| [Drawing review and release](drawings.md) | REQ-DRW-001–008 | Relevant consultant approves; manager releases |
| [Updates, internal notes and announcements](updates-and-announcements.md) | REQ-UPD-001–005 | Manager publishes |
| [Manual K-SMART records](k-smart.md) | REQ-KSM-001–004 | Staff records; manager reviews shared information |
| [Changes and additional work](change-requests.md) | REQ-CHG-001–005 | Main client accepts; admin confirms payment; manager authorizes |
| [Invoices, schedules and accounting](invoices-and-accounting.md) | REQ-FIN-001–013 | Manager for issue approval/schedules; admin for receipts/accounts |
| [Materials and client references](materials-and-references.md) | REQ-MAT-001–004 | Main client makes binding selections |
| [Site snags](snags.md) | REQ-SNG-001–004 | Manager assigns and verifies |
| [Archive and access lifecycle](archive-and-access.md) | REQ-IAM-001–008; REQ-ARC-001–005 | Administrator access control; manager project lifecycle |
| [Reminders and notifications](notifications.md) | REQ-NOT-001–006 | Configured recipients; admin escalation |
| [Waiting on you and dashboard priorities](waiting-on-you.md) | REQ-DAS-001–005 | Each action's actual authorized actor |

## Shared transition contract

Every consequential transition must:

1. Identify the resource, project, immutable content version where applicable and expected current state.
2. Check the acting identity's current capability, project membership, section/document scope and record visibility.
3. Check the guard against authoritative current records. A disabled button, a cached balance or a prior page load is insufficient.
4. Apply the state change, related accounting/version effects and audit event consistently; a failure must not leave a half-approved state.
5. Make duplicate submissions safe. A retry must not release a drawing twice, issue two invoice numbers or confirm two receipts.
6. Reject stale/conflicting actions with an understandable message and show the current state. Never silently apply an approval to a different version.
7. Generate notifications only after a successful transition, with current recipient authorization checked again before delivery.

## Audit envelope

The event names in these files describe business events; exact technical naming may be finalized in the architecture. Preserve the meaning. Record:

- Event ID, type, entity ID, project ID where applicable and immutable version/snapshot reference.
- Acting person, role/capability used and server-recorded event time.
- Prior and resulting state; changed field references or a bounded before/after summary.
- Required reason, reviewer comment or acceptance evidence where applicable.
- Correlation/idempotency reference for repeated requests and linked commercial/accounting events.

Do not log credentials, full private file contents or unrestricted payroll data. Sensitive audit records inherit their source's restrictions; a generic activity feed must not reveal their content or existence to unauthorized people.

## State vocabulary

- **Draft**: editable preparation not yet submitted or shared.
- **Submitted/in review**: the reviewed version is fixed; revisions produce a new version.
- **Approved**: a named actor approved a precise business object/version. It does not imply every other gate is satisfied.
- **Released/published/issued**: the relevant authority made the approved version effective for its audience.
- **Changes requested**: a reviewer returned work with actionable feedback.
- **Rejected/declined**: a decision-maker explicitly declined a submission or offer.
- **Superseded**: a newer authorized version replaced an older one; the older record remains valid history.
- **Cancelled/withdrawn**: a recorded action stops future use/activity, with a reason and any financial consequences handled separately.
- **Archived**: retained with operational content read-only and permitted access preserved; admin may append normally authorized settlement events for existing obligations.

## Global constraints

All workflows are online. A lost connection must not appear to have saved or approved work. Business dates use a configured firm timezone; event timestamps retain an unambiguous server time. Do not silently assume that a due date is midnight UTC or that a browser's timezone defines overdue status.

Files are private and inherit their parent/version/audience restrictions. The person who can see a task does not automatically see every file linked from it. Every reference should either open an authorized record or present a safe access-denied/unavailable state.

No workflow bypasses the sensitive-capability distinction: salary/profit is administrator-only; individual performance is owner-only. No ordinary workflow creates public links or grants authority to an uninvited recipient.

## Connections to the rest of the handoff

- [Architecture](../architecture/overview.md) translates these rules into services, records and transaction boundaries.
- [Implementation roadmap](../implementation/roadmap.md) orders delivery and verification.
- [START_HERE](../../START_HERE.md) is the build agent entry point.
