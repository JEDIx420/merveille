# SCR-08 — Progress updates, publication and announcements

**Route:** `/projects/:projectId/updates`; authorised practice announcements may appear on `/overview`. **Requirements:** REQ-UPD, REQ-FIL. **Workflow:** [updates and announcements](../workflows/updates-and-announcements.md).

## Purpose and permission

Capture meaningful changes in design/site work and publish an understandable client summary after manager review. Updates are event-driven, not mandatory daily posts. TEAM_MEMBER creates drafts and internal entries; MANAGER approves external publication. External people see only the published content and permitted attachments.

## Layout and fields

The external view is a dated progress feed: stage, short summary, photos/drawings, status and next step. Internal view adds a clear Internal / Pending review / Published filter and review status. Composer fields: title, change/stage, site progress note, attachments, proposed audience and optional next step. Internal discussion is a separate private area, not a collapsed portion of an external article.

**Primary action:** staff “Add update”; manager reviewing a specific update “Publish to client”; external viewer has no publication action. Make the audience visible before submission and again before publication. Company announcements require an explicit recipient scope and privileged publication; a project update must never accidentally become company-wide.

## Interaction and service contract

Read only the caller's allowed feed, review items and author information. Write draft edits, submit for review, return with reason and publish. Published content is a snapshot/version; editing a draft must not silently alter what a client previously saw. Updating public content follows review again, with a correction history.

A preview shows exactly the external text and attachments. It must not include author-only comments, hidden draft fields or raw internal attachment lists. Attachment access follows the published item and the underlying file permission. Notifications are generated only after successful publication.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). An early project says “No published updates yet”; staff may still have internal work. Pending uploads prevent final submission until all intended files are accepted. Mobile supports camera/file input and reorder/removal with accessible controls. Archived feeds remain viewable but read-only.

## Acceptance criteria

- A draft/internal update is absent from external HTML, API responses, search and notification previews.
- Manager publication changes the audience only after an authorised state transition.
- Rejected updates preserve the manager's reason privately.
- Publishing a project update cannot target other clients.
- No daily-update absence is treated as automatic poor performance.
