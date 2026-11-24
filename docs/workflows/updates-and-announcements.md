# Updates, internal notes and controlled announcements

**Requirements:** REQ-UPD-001–005, REQ-IAM-003/004, REQ-NOT-001/002.

**Confirmed rule:** Ordinary client-visible updates require manager approval. Internal-only content is supported. Company updates were part of the original client profile request; their controlled announcement treatment is an engineering default.

## Three content types

| Type | Purpose | Default audience |
|---|---|---|
| Internal note | Working discussion, planning, review and issues | Authorized internal project staff only; finance notes may be more restricted |
| Project update | Reviewed site/stage/drawing progress for clients/consultants | Explicit project audience after manager publication |
| Company announcement | Firm-wide news relevant to selected clients or participants | Nobody until an audience is selected and the item is published |

Do not use a single unrestricted feed with a decorative “internal” tag. Audience is an enforced access property. Sharing an internal note requires preparing a reviewed outward-facing update; it is not a bulk visibility switch that accidentally exposes its history and attachments.

## Project update fields

Project, stage if relevant, title, body, observed date, author, attachments, intended audience, review status, manager feedback, published version and publication/retraction history. A progress percentage must come from the explicit project progress record or be clearly labeled as a staff observation; do not invent one from the number of photographs.

## Transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → DRAFT | Assigned staff/manager drafts | Active project scope; source files accessible | Create unpublished version; `update_drafted`. |
| DRAFT → IN_REVIEW | Author submits | Complete content; intended audience; attachments ready and safe to share | Freeze submitted version; manager action item; `update_submitted`. |
| IN_REVIEW → CHANGES_REQUESTED | Manager returns | Reason | Author revises a draft; nothing client-visible; `update_returned`. |
| IN_REVIEW → PUBLISHED | Manager publishes | Reviewed exact content/files; audience permitted; referenced drawings released if shared | Create immutable published snapshot; notify permitted recipients; `update_published`. |
| PUBLISHED → PUBLISHED with revised snapshot | Manager publishes revised version | Revised draft passed review; prior version retained | Show corrected version and revision indication; `update_revision_published`. |
| PUBLISHED → RETRACTED | Manager retracts | Reason | Remove from active feed or show appropriate withdrawal notice; preserve audit; `update_retracted`. |
| DRAFT/IN_REVIEW → CANCELLED | Author for draft; manager for submitted | Reason after submission | Stop review/reminders; `update_cancelled`. |

Do not allow an author to edit a published body or replace a published attachment in place. A material correction requires review again. A failure to send a notification does not roll back a valid publication; it creates a visible delivery problem.

## Internal notes

Authorized internal staff may create notes without client-publication review. Preserve author/time and an edit history; deletion becomes a recorded redaction or tombstone where retention is required. Administrators can restrict finance-sensitive notes more tightly than general internal project notes.

Consultants, main clients and representatives cannot find internal notes through search, counts, exports, notification previews or file URLs. A manager copying an excerpt into a shared update must select suitable evidence separately.

## Company announcements

Start the module empty/disabled until the firm configures it. An administrator controls available audience definitions; a delegated manager publishes. Possible audiences are a selected project cohort, selected client accounts or all active clients explicitly chosen. “All” must be a conscious audience choice, not the default.

Use the same draft/review/publish/retract states. Preview the audience and ensure attachments contain no unrelated client information. Archived clients are excluded by default unless an explicit announcement audience includes them. Consultants see announcements only when included.

Company announcements do not grant access to projects referenced in them. Avoid embedding private project identifiers or photographs in a general audience item without an explicit share decision.

## Review evidence

Demonstrate a staff draft remaining private, manager publication, a correction requiring review, a returned submission, a retraction, an internal note excluded from consultant/client search, and a company announcement visible only to its selected audience.
