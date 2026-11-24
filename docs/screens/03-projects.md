# SCR-03 — Active projects index

**Route:** `/projects`. **Requirements:** REQ-PRJ, REQ-IAM, REQ-ARC. **Related:** [project overview](05-project-overview.md), [archive](19-archive.md).

## Purpose and permission

Find the right active project quickly. Every role sees only its memberships/capabilities. A client can have multiple projects. The list must remain useful at the starting scale of about 30 projects without pretending that all projects belong to every user.

## Layout and controls

Header: “Projects,” permitted count and one primary action. Default to a restrained table/list: project title/code, client/site descriptor, current stage, next milestone, last published or internal update as appropriate and accountable manager where permitted. Offer search, stage filter and “Assigned to me” for internal users. Keep archive as a clear separate destination.

**Primary action:** “New enquiry” for authorised internal users. Clients/consultants have no creation action. A view switch is optional, not required; one excellent list is preferable to maintaining redundant card/list interfaces.

## Interaction and service contract

Read a paginated, permission-filtered project projection; search runs over authorised records only. Row selection opens the project overview. Preserve filters in harmless route state. Create enquiry is a separate workflow, not a project activated by a single “Create” click.

Internal users may see draft/pipeline status only if their access permits it. External users see published milestones rather than internal task counts. Archive action belongs in an authorised project menu with context and consequences, not as a row icon easily tapped by mistake.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). No projects assigned: explain that access is assigned by the administrator. No matches: preserve search and offer reset. On mobile use labelled rows/cards with stage and next milestone; avoid shrinking a wide table into unreadable text. Long project/client names wrap without hiding the identifier. A closed project moved to archive disappears from this active list after successful confirmation.

## Acceptance criteria

- A main client with two projects sees both and no other client's project.
- A consultant search cannot reveal names or counts of unassigned projects.
- Empty, filtered-empty and revoked-membership results are distinct and safe.
- Archive access is discoverable without mixing closed projects into the default list.
- Project selection remains usable with long names on a 390 px viewport.
