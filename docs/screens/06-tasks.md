# SCR-06 — Project tasks and task detail

**Routes:** `/projects/:projectId/tasks`, `/projects/:projectId/tasks/:taskId`. **Requirements:** REQ-TSK, REQ-DAS, REQ-NOT. **Workflow:** [tasks](../workflows/tasks.md).

## Purpose and permission

Let staff manage assigned work without a heavy project-management interface. TEAM_MEMBER can create tasks and mark assigned work complete. MANAGER assigns work, controls deadlines and can reopen a completed task. External task visibility is limited to explicitly exposed records; internal tasks/discussions are not automatically shared with clients or consultants.

## Layout and fields

Default to a grouped list with status, title, owner, due date, stage and priority. Filters: mine/all permitted, status, due date and stage. Detail includes description, related drawing/site issue, attachments, activity and completion/reopen history. Status and overdue labels use text and colour.

**Primary action:** “Add task” for authorised staff; task detail presents the next valid transition, such as “Mark complete.” Managers can assign/change deadline in a clear edit form. A staff-created task with a proposed date must still follow the manager's deadline authority; the UI must not grant silent schedule control.

## Interaction and service contract

Read permitted tasks, assignee choices from current project membership and task history. Write creation, assignment, manager-authorised deadline changes, completion and manager reopen. Require a reason for reopening or material due-date change; retain previous values. A task cannot be assigned to an unassigned/deactivated person.

Completion records who acted and when. The interface must not treat self-reported completion as an irreversible approval. Changing deadlines must not erase overdue history used by the owner's reporting. Client-requested rework is not automatically classified as staff error.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). A task completed elsewhere displays its current state on retry. Archived projects disable task mutation. On mobile, list and detail are sequential pages; primary action remains easy to reach without covering form fields. Network failure preserves local form input in the current screen but does not claim offline submission.

## Acceptance criteria

- Staff can complete an assigned task and the manager can reopen it with history intact.
- Staff cannot change the authoritative due date through a direct request.
- Reassignment rejects invalid project members.
- Overdue reminders stop/resolve according to actual task state, not notification dismissal.
- Internal task content is absent from external-user responses and search.
