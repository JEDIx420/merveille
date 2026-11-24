# Interaction patterns and shared screen contract

Apply the current [premium interface contract](../remediation/03-premium-interface.md) first; it supersedes older palette/shell defaults. Real people use their own Google accounts, without demo/view switching. Every screen specification inherits this interaction contract. Implement these states explicitly; do not substitute a generic toast for a failed financial or approval action.

## Brand and orientation

Keep the Merveille Designs identity consistent across sign-in, project pages, notifications and printable records. Use the shared name and original assets from the [brand manifest](../../assets/brand/README.md). A compact logo must have readable company text beside it where the artwork’s lettering becomes too small. Do not use the company mark as a status indicator or recolour it for success, warnings or errors.

## Page and request states

| State | Required behaviour |
|---|---|
| Loading | Preserve page geometry; label the loading region; never show sample money, fake zero totals or unrelated cached project data. |
| Empty | Say what is absent and show the permitted next action. Read-only users receive an explanation, not a create button they cannot use. |
| Filtered empty | Keep filters visible and offer clear filters; distinguish from no data at all. |
| Unauthenticated | Send to the configured sign-in flow and return to an authorised destination afterward. |
| Forbidden/not found | Reveal no private project name, amount, file existence or membership. Offer a return to permitted work. |
| Validation error | Keep entered values; explain the exact field; focus an error summary for multiple errors. |
| Network/server failure | Explain whether the action was saved. Retrying a write uses the same operation identifier where required. |
| Stale/conflict | Explain that the record changed; refresh the current version and require a new decision. Never silently overwrite it. |
| Archived/read-only | Show the archive label and allowed downloads; remove ordinary project mutation controls. Preserve existing explicit staff access. Only ADMIN may append receipts/approved settlements against existing obligations, with normal correction approvals. No new invoice, work or schedule through this exception. |
| Connectivity loss | Show a clear connection message. This is an online product: do not promise queued offline submissions, cached protected drawings or background synchronisation. |

## Approvals and final actions

A review panel shows the item, exact revision, author, time, relevant amount or scope, and the effect of the action. Use specific labels: “Approve drawing,” “Release drawing,” “Publish update,” “Approve invoice,” “Confirm payment received.” A button labelled only “Approve” is insufficient when multiple decisions are adjacent.

Keep consultant drawing approval distinct from manager release. Client drawing approval does not exist. A manager must not release a revision different from the consultant-approved version. Show the pending revision without hiding the previously released drawing. A failed release leaves the previous release in place.

Rejection or return-for-changes requires a useful reason. Reopening a task records the manager and reason; it does not erase the earlier completion. A pending decision may be withdrawn when its underlying version changes, with an explanation visible to the reviewer.

## Forms and editing

Use server-authorised forms with explicit save actions for consequential records. Do not silently auto-save invoice amounts, approvals, access changes, salary entries or payment confirmations. Low-risk text drafts may have autosave only if its status is unambiguous. Warn about unsaved edits during navigation.

Show calculated financial fields as labelled derived values. Use dates in the configured practice timezone and show absolute dates on hover/detail when the list uses relative wording. Do not require a daily progress update: the composer asks what changed, not why yesterday is missing.

## File interaction

Show filename, file kind, size, upload state, revision where applicable and the person who uploaded it. For a revision, make the relationship to the drawing/document explicit. Do not treat a replacement upload as an in-place overwrite of approved evidence.

Give large uploads progress, cancel and an honest retry option; uploaded does not mean published. Show rejected/unsupported file errors before users mistake them for accepted project records. Direct-to-storage upload is an implementation choice, not proof that the file is ready to serve.

PDF/image previews should be accessible and provide a permitted download fallback. CAD/BIM files can be downloadable originals with an associated PDF preview; a browser CAD editor or automatic converter is not promised. Videos have manual playback and explicit size/duration where known. Documents and media never acquire public URLs merely because they were uploaded.

A download always points to the currently authorised record/version. Do not expose permanent storage credentials or turn a thumbnail into a privacy bypass. Shared links require sign-in and the relevant project permission.

## Notifications and activity

A notification is a pointer to a permitted action, not a second copy of the private record. WhatsApp messages should use minimal context and link back to the authenticated portal. Delivery status and read status are different; neither proves that a task was completed.

The “Waiting on you” list is derived from actionable records. Completing an item clears it because the underlying state changed, not because someone dismissed a reminder. If another person already acted, opening the notification shows the current result.

## Common acceptance evidence

Each screen needs representative screenshots at 1440 and 390 px, keyboard traversal of its main task, an empty state, a forbidden state and one recoverable error. Sensitive screens additionally need a denied server request from a disallowed role; a hidden button is not sufficient evidence. Share only fictional fixtures in repository screenshots.
