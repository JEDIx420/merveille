# SCR-19 — Archived projects and historical downloads

**Routes:** `/archive`; archived projects retain their original project routes with an archive state. **Requirements:** REQ-ARC, REQ-IAM, REQ-FIL. **Workflow:** [archive and access](../workflows/archive-and-access.md).

## Purpose and permission

Move completed projects out of day-to-day work while retaining their records for long-term access. MAIN_CLIENT, authorised CLIENT_REP and CONSULTANT keep view/download access to their permitted archived projects. Archive status does not grant access to internal notes, drafts, payroll or company profit. Existing explicit staff assignments persist as read-only until ADMIN separately changes them.

## Layout and fields

Archive list contains project title/code, client/site context, archive date, manager and permitted search filters. Project detail shows a clear “Archived — view and download” banner, original project sections and historical released records. Drawings identify the final current release and earlier released versions; rejected/internal revisions remain scoped by their original permissions.

**Primary action:** “Open archived project” in the list or “Download” on a permitted document. Reopen/archive-management controls are internal and privileged, not offered to external people. There is no handover-pack generator, combined download bundle or automatic archive deletion in the agreed scope.

## Interaction and service contract

Read permission-filtered archived projects and records through the same resource authorisation as active projects. Ordinary task, review, update, invoice-issue and upload mutations are disabled. Only ADMIN may append receipts or approved financial settlements against existing obligations while the project stays archived; normal correction approval rules continue to apply. This is not permission to create a new invoice, new work or a revised payment schedule. Keep existing overdue financial obligations visible and apply their reminder policy. Reopening ordinary operations is a separate authorised/audited action and must not silently reactivate all notifications and work.

Archive action from an active project states which work will stop and which historical access remains. Retained data needs backup/restore and storage management in the architecture; an archive label alone is not a preservation guarantee. Download links remain access-controlled rather than becoming permanent public assets.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Empty archive is expected for a new practice portal. Unknown/missing historical files show a repair path to authorised staff without claiming the file was deleted. Mobile list and document access follow active-project patterns. Deactivated or revoked users lose archive access as well.

## Acceptance criteria

- Archiving removes the project from the active default list without deleting records.
- Authorised clients and consultants can still download permitted released records.
- Archived external views cannot fetch internal/draft or private finance content.
- Direct ordinary mutation requests are rejected even if a stale form is open.
- ADMIN can settle an existing archived obligation with required approvals and append-only history; other new business writes remain denied.
- Reopening, if implemented, is authorised, audited and deliberate.
