# SCR-05 — Project overview and shared shell

**Route:** `/projects/:projectId/overview` (project root may redirect here). **Requirements:** REQ-PRJ, REQ-DAS, REQ-UPD, REQ-KSM. **Related:** [navigation](../design/navigation-and-content.md).

## Purpose and permission

Answer: where is the project now, what changed, and what happens next? All members use the same project identity with server-filtered projections. A MAIN_CLIENT/CLIENT_REP sees released drawings, published progress, recorded permit status and their decision context; CLIENT_REP payment summaries require the explicit financial-read grant. A CONSULTANT additionally sees their review work and the client quotation/payment history. Internal users see their authorised operational detail.

## Information hierarchy

Header shows project title, site descriptor, current stage, manager/contact and archive status when applicable. Below it show current milestone/next date, the most relevant “Waiting on you” item, latest published progress, current released drawings and a short permit/payment summary. Avoid putting six equal-weight metric cards above actual progress.

The project sections are Overview, Tasks, Drawings, Updates, Permits, Finance, Selections, Changes and Site issues as authorised. The header persists across sections. Internal-only context is clearly labelled and excluded from external responses.

**Primary action:** role-specific next action with a real record, such as “Review drawing,” “Add update,” or “View payment schedule.” If nothing needs action, use simple navigation rather than a false task.

## Interaction and service contract

Read project membership, current phase, approved/public summaries, current release references and permitted next actions. Do not compute progress from task count and display it as physical site completion unless the product has defined that measure. Expose last-recorded timestamps for progress and permit summaries.

Record changes occur in their owning screens; this page links to them. Switching projects clears old project-specific selections and cancels stale requests. An unauthorised bookmarked section returns a safe denial even if the project overview itself is accessible.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). An early project may have no released drawings or site update; say so. Permit data is labelled “Recorded by the team,” not live government data. On mobile, show stage, next action and latest progress before supporting sections. Archived overview is read-only with visible archive date and permitted downloads.

## Acceptance criteria

- Switching between a client's projects never briefly shows the previous project's sensitive values.
- Latest released drawing and latest uploaded draft are never confused.
- External activity contains only published events and permitted documents.
- Physical progress, financial progress and task progress remain separately labelled.
