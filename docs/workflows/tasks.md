# Tasks, deadlines and delivery evidence

**Requirements:** REQ-TSK-001–006, REQ-DAS-001/003/004.

**Provenance:** Staff creation/completion and manager assignment/deadline/reopening are confirmed. The detailed state vocabulary and performance evidence rules are engineering defaults.

## Records and visibility

A task belongs to one project and optionally a stage, drawing, approved change or snag. It has a title, useful description, creator, responsible person, manager, priority, due date, status, blockers, attachments and event history.

Tasks and their discussion are internal by default. Client progress is communicated through manager-published updates, not by exposing every internal task. Consultants receive assigned drawing-review actions through that workflow; they are not automatically made internal team members.

## Transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → PENDING_ASSIGNMENT | Staff creates task | Authorized active project; meaningful description | Record creator and optional proposed owner/date; `task_created`. |
| PENDING_ASSIGNMENT → TODO | Manager assigns | Assignee has valid project membership; due date policy satisfied | Notify assignee; retain assignment and baseline deadline; `task_assigned`. |
| TODO → IN_PROGRESS | Assignee starts | Task not cancelled; project active; any linked change authorized | Start work event; `task_started`. |
| TODO/IN_PROGRESS → BLOCKED | Assignee/manager records blocker | Reason and responsible follow-up if known | Surface blocker without treating it as completed; `task_blocked`. |
| BLOCKED → TODO/IN_PROGRESS | Assignee/manager clears blocker | Resolution noted | Preserve blocked interval; `task_unblocked`. |
| TODO/IN_PROGRESS/BLOCKED → COMPLETED | Assignee marks complete | Completion note/evidence where required; linked work was authorized | Save completed time and actor; notify manager if relevant; `task_completed`. |
| COMPLETED → TODO/IN_PROGRESS | Manager reopens | Reason and reason category; responsible person/date reviewed | Preserve original completion; create rework event; `task_reopened`. |
| Any open state → CANCELLED | Manager cancels | Reason; linked obligations considered | Stop reminders; retain evidence; `task_cancelled`. |
| Any editable state → same state | Manager reassigns/changes deadline | New assignee valid; reason recorded | Retain previous owner/date and changed-at time; `task_assignment_changed` / `task_deadline_changed`. |

An optional staff-created self-assignment may be supported only when an explicit policy enables it. The default is that the manager controls assignment and due dates. Staff may propose changes; a suggestion does not become the official deadline.

## Due dates and priority

Overdue is a computed condition: the effective due time has passed and the task is not completed/cancelled. Store date-only deadlines with a configured business-day cutoff rather than allowing each browser to invent one.

Keep at least the original deadline, every revision, the reason, who changed it and the current effective deadline. Moving a deadline must not erase that the original plan was missed. Display operational urgency from the current deadline while keeping historical performance definitions explicit.

Manager priority and deadline are separate. An urgent task without a due date is not automatically “overdue,” and a low-priority late task still needs attention.

## Quality and performance boundaries

The owner may review deadline adherence, completion, reopened work and documented site progress. Do not turn raw counts into an unexplained quality score. Proposed reopen categories include correction/defect, changed client scope, external dependency and administrative correction; these categories require firm confirmation before scoring.

Distinguish:

- Work completed by staff.
- Work reopened by a manager.
- Work changed because the brief changed.
- Verified snag closure or drawing release, which have their own workflows.

Completing a drawing-preparation task does not release the drawing. Completing a snag-related task does not verify the snag. A manager can see operational work details needed to supervise delivery, but individual performance reports/exports remain owner-only.

## Guarded links and failure cases

- Do not start a task for extra work until its change authorization is effective.
- Removing an assignee from the project creates a reassignment need; it must not preserve their access or silently mark the task done.
- A task spanning a paused/archived project shows the project restriction. Archive does not delete it.
- Concurrent completion/reopen/reassignment requests use the current version/state and retain a coherent event order.
- A failed attachment upload does not count as completion evidence. Show the failure and allow a safe retry.

## Review evidence

Exercise manager-only assignment/deadline changes, staff completion, manager reopening, deadline history, unauthorized client access, linked-change start gating and a stale concurrent update. Confirm that operational task views work without exposing owner-only performance reports.
