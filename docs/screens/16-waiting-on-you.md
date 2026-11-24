# SCR-16 — Waiting on you

**Route:** `/waiting`, with project-scoped summary links. **Requirements:** REQ-DAS, REQ-NOT, REQ-DRW, REQ-CHG. **Workflow:** [waiting on you](../workflows/waiting-on-you.md).

## Purpose and permission

Provide one dependable list of things this person can act on. It is a projection of real workflow records, not an independently maintained checklist. Consultant drawing reviews, manager releases/publications/invoice approvals, main-client quotation/change/material decisions, tasks and admin receipt/escalation actions appear only for the correct actor. Clients never receive a drawing approval item.

## Layout and fields

Group into overdue, due soon and other waiting items. Each entry shows plain-language action, project, responsible actor, due date/age, why it is waiting and a link to the exact record. Offer project/type filters without requiring configuration. Payment-due information for clients links to the payment schedule and recorded payment instructions; it is not an in-portal payment action.

**Primary action:** “Open next item,” or the first item's explicit action in its detail context. Do not provide an “Approve all” button. A snooze/personal-dismiss option is not part of initial scope; it must not erase an unresolved obligation if later introduced.

## Interaction and service contract

Read server-derived actionable items scoped by current permission and workflow state. Selecting an item opens the source screen. Completion occurs by changing the source record; then refresh/remove the queue item. Counts shown in navigation derive from the same projection to prevent contradictory badges.

An admin escalation remains an escalation record with its underlying cause, not a duplicate task someone can complete independently. Membership revocation removes access immediately. Archiving removes ordinary operational actions, while authorised ADMIN settlement actions and unresolved existing payment obligations may remain visible under the financial exception. The list must not leak private project names in a summary for an unassigned user.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). “You're up to date” includes a projects link. No results after a filter offers reset. Stale items show that someone already acted and link to permitted history. On mobile each row keeps action/project/date visible without hover. An intermittent request failure cannot clear the entire queue as if completed.

## Acceptance criteria

- Every item points to a real, currently actionable record.
- Resolving the source removes the item without a second manual completion.
- Client drawing approvals are absent.
- Badge counts and list totals use the same permission/scoping rules.
- Revoked access removes both item detail and descriptive queue metadata.
