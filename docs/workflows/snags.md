# Site snag reporting and verified closure

**Requirements:** REQ-SNG-001–004, REQ-TSK-005, REQ-UPD-002/003.

**Confirmed scope:** Snag tracking is included. Detailed assignment/verification behavior is an engineering default.

## Record

A snag is a specific site issue with project/location, title, description, reporter, photographs, observed date, severity, responsible person, manager, target date, shared/internal audience, resolution evidence and event history.

Suggested severity labels are Low, Medium, High and Urgent. Their exact meanings should be configured by the firm. They help prioritize work; the portal does not claim to certify structural safety or replace professional judgment.

Authorized clients, representatives and consultants may report an issue within their assigned scope. An external reporter can see their own submitted report and its permitted responses; reporting does not reveal other internal snags or cost notes.

## Transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → REPORTED | Authorized participant reports | Project/location/context; files completed if referenced | Capture source; manager triage action; `snag_reported`. |
| REPORTED → OPEN | Manager accepts/triages | Clear issue; severity; assignee and due date | Establish responsibility; `snag_triaged`. |
| REPORTED → DUPLICATE/NOT_ACCEPTED | Manager classifies | Reason and linked original when duplicate | Preserve reporter evidence; explain appropriate outcome; `snag_classified`. |
| OPEN → IN_PROGRESS | Assignee starts remediation | Current assignment; project allows work; any extra work authorized | Record start; `snag_work_started`. |
| OPEN/IN_PROGRESS → BLOCKED | Assignee/manager records blocker | Reason and follow-up | Surface blocked item; `snag_blocked`. |
| BLOCKED → OPEN/IN_PROGRESS | Assignee/manager resolves blocker | Resolution noted | Resume work; `snag_unblocked`. |
| OPEN/IN_PROGRESS → READY_FOR_VERIFICATION | Assignee reports resolution | Resolution description/evidence; task completion is not itself verification | Manager action; `snag_resolution_submitted`. |
| READY_FOR_VERIFICATION → CLOSED | Manager verifies | Sufficient evidence or recorded inspection; reviewer identity/date | Record verified closure; `snag_closed`. |
| READY_FOR_VERIFICATION/CLOSED → OPEN | Manager rejects/reopens | Reason, responsible person and date reviewed | Preserve prior evidence/closure; `snag_reopened`. |

If the firm needs consultant review for a particular issue, the manager can request it and record the response. Do not introduce a universal consultant or client approval gate for every snag without a new requirement.

## Shared versus internal discussion

Keep client-facing issue description/status/evidence separate from internal remediation comments, supplier disputes and costs. A manager approves the information that becomes visible to a broader client/consultant audience. An external person's own report remains visible to them while awaiting triage; that does not publish it to everyone.

A published update may summarize several resolved snags but must not expose restricted notes or attachments through its links. Company announcements never inherit snag photos automatically.

## Relationship to tasks and changes

- A snag can produce one or more internal tasks. Completing those tasks makes the snag ready for verification; it does not automatically close it.
- A snag requiring work outside accepted scope must use the change estimate/payment/authorization workflow. Label any commercial dependency without assuming every defect is chargeable.
- Reopening a snag records the reason. Owner performance reporting must distinguish genuine rework from a new problem or changed scope.
- Archive does not silently close an unresolved snag. Open issues are disclosed during completion/archive review and remain visible under retained access.

## Review evidence

Show external report privacy, manager assignment, staff resolution, manager rejection/reopening, verified closure, a linked task that cannot auto-close the snag, and a restricted cost note excluded from client views.
