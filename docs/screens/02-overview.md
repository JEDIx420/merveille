# SCR-02 — Personal and owner overview

**Route:** `/overview`. **Requirements:** REQ-DAS, REQ-NOT, REQ-TSK. **Related:** [Waiting on you](16-waiting-on-you.md), [performance](12-performance.md).

## Purpose and permission

Show what this person needs to act on across their authorised projects. OWNER sees the agreed priority order: delayed tasks, approvals waiting on them, upcoming project deadlines. MANAGER sees the same operational pattern within managed projects; TEAM_MEMBER sees their assigned work. MAIN_CLIENT/CLIENT_REP see published project progress and relevant decisions; CLIENT_REP payment details/reminders require the explicit financial-read grant. CONSULTANT sees drawing reviews and permitted project information. Salary/profit data requires ADMIN independently; performance requires OWNER independently. OWNER portfolio visibility does not itself confer consultant, manager or admin mutation authority.

## Information hierarchy

1. Date, greeting and a short count of items needing action.
2. Three priority groups with the most urgent real items, not decorative scorecards.
3. Active projects and their next milestones.
4. Secondary authorised finance summary; “Invoiced” and “Received” are separate.
5. Links to the full queues and permitted reports.

Each work row includes project, item, due date, days overdue if applicable, responsible person and the direct next action. A client sees stage/progress summaries approved for publication; internal blockers and notes are not copied into their page.

**Primary action:** “Review next item” when an approval is actually available. Otherwise use the most relevant permitted next task; do not invent a call to action solely to fill the header.

## Interaction and data contract

Read role/capability-filtered priority projections, authorised project summaries and dated aggregate figures. Selecting a row opens the original record; consequential actions occur in its detailed context. Filters support project and period, with a clear reset. Pagination/load-more preserves priority order.

Totals and counts are filtered on the server. The page must not fetch company-wide totals and conceal them client-side. No hidden OWNER/ADMIN payload may be embedded in HTML, prefetch data or client state.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). “Nothing waiting on you” is a success state with links to projects. A failed finance summary cannot turn into a displayed zero. On phones stack priority lists before charts and project cards. Archived projects are omitted from active work unless a permitted exceptional action exists.

## Acceptance criteria

- Owner priorities appear in the required order at desktop and mobile widths.
- Changing a task/approval updates its source record and then the overview.
- Counts expose no unassigned-project metadata.
- OWNER without ADMIN cannot see salary/profit; ADMIN without OWNER cannot see staff-performance results.
