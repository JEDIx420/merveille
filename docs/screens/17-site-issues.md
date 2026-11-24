# SCR-17 — Site issues and snag tracking

**Route:** `/projects/:projectId/snags`, detail `/projects/:projectId/snags/:snagId`. **Requirements:** REQ-SNG, REQ-FIL, REQ-NOT. **Workflow:** [snags](../workflows/snags.md).

## Purpose and permission

Capture an observed site issue with evidence, assign responsibility and record resolution. Internal team/manager permissions control assignment, status and client publication. External reporting/viewing is only available when explicitly granted by the product policy; do not assume every consultant/client can alter site records. An external reporter can see their own submitted report while awaiting triage. Broader client/consultant publication still requires manager approval; reporting does not expose other internal issues.

## Layout and fields

Default grouped list: open, in progress, awaiting verification and resolved according to the workflow. Each issue contains title, location/room, description, priority, responsible person, due date, related drawing, before/after photos, status and audit history. Do not require a complex construction hierarchy before a small issue can be recorded.

**Primary action:** “Report site issue” for permitted reporters. Detail action changes to “Mark ready for review” or manager “Confirm resolved” as appropriate. Reopening requires a reason and preserves the previous resolution. Avoid deletion as the routine way to correct an issue.

## Interaction and service contract

Read permitted issues, evidence and eligible assignees from the project. Write report, assignment/deadline, work update, resolution evidence, verification and reopen. Publishing a client-facing summary follows manager approval; private comments and unreviewed photographs remain internal. Assignments and related drawings must belong to the same authorised project.

An issue that requires additional paid work links to a change request and cannot use a snag status transition to bypass estimate acceptance, confirmed payment and manager authorisation. It should remain visibly blocked until prerequisites are met.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Use readable photo upload progress and labelled retry. No offline guarantee: a disconnected report is not marked saved. Mobile can choose camera/photos while connected; list rows show location/priority without depending on map coordinates. Archived projects retain issue history and allowed evidence in read-only mode.

## Acceptance criteria

- Each resolved issue retains who reported, worked on and verified it.
- Reopening preserves earlier photos and resolution history.
- An assignee from another project cannot be attached via a direct request.
- Internal evidence is absent from external issue views.
- Additional paid work cannot start through the issue workflow without its change gates.
