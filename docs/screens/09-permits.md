# SCR-09 — K-SMART permit records

**Route:** `/projects/:projectId/permits`. **Requirements:** REQ-KSM, REQ-FIL, REQ-UPD. **Workflow:** [K-SMART tracking](../workflows/k-smart.md).

## Purpose and permission

Provide a clear record of sanction and completion permit progress entered by the team. The portal does not log into, scrape, poll or integrate with K-SMART. It stores the practice's status entries, screenshots and documents. External members see the approved/published record appropriate to them, not internal administrative commentary.

## Layout and fields

Two distinct record groups, Sanction permit and Completion permit, each with current recorded status, application/reference number if provided, relevant dates, responsible person and supporting files. Timeline entries include the status as recorded, source/check date, entry date, author and explanatory note. The record can link to the actual government website for a user to open independently, without claiming synchronised data.

**Primary action:** authorised staff “Add status update.” Manager reviews any client-facing publication under the update policy. External people see “View supporting document” where allowed. Do not show a misleading refresh/sync button.

## Interaction and service contract

Read current published status and allowed historical entries/files. Write a new status entry, attach evidence, correct an entry with history and publish approved external fields. Screenshots are evidence supplied by staff, not a portal-certified government decision. Use factual labels provided by the firm; do not infer permit legality or construction eligibility from arbitrary status text.

A new entry does not erase the previous screenshot or date. File uploads are private and related to a specific permit entry. A correction displays its author/reason internally and preserves the appropriate audit history.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). “Not yet recorded” differs from “Pending with government.” Show “Last recorded by the team on …” to prevent stale information from appearing live. Mobile allows uploading screenshots/documents while connected. Archived projects retain the visible record and permitted supporting downloads.

## Acceptance criteria

- No automated K-SMART fetch, credentials or polling is present.
- Sanction and completion records remain distinguishable.
- New screenshots retain their original entry context.
- External viewers cannot see unpublished entries or private administrative notes.
- Unknown status never automatically becomes “Approved.”
