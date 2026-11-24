# Navigation, routes and language

Use one responsive application with role-adaptive navigation. Shared routes return only information allowed for the signed-in person. Do not implement a hidden “client mode” switch that changes presentation while leaving privileged data loaded in the browser.

## Global navigation

| Navigation item | Eligible people | Purpose |
|---|---|---|
| Overview | All signed-in users | Their permitted next actions and project summary; the owner's priorities lead. |
| Projects | All with project membership | Active projects; clients can have multiple projects. |
| Waiting on you | Anyone with actionable records | Cross-project decisions and assigned work. |
| Reviews | Consultants; managers with review/release work | Version-specific drawing reviews and releases. |
| Finance | Internal users with explicit finance capability | Approved accounting views, with separate protected salary/profit sections. |
| Performance | OWNER only | Private staff performance measures and review context. |
| People | ADMIN only | Invitations, project access and revocation. |
| Archive | Users with archived-project membership | Historical projects and permitted downloads. |
| Notifications | All signed-in users | Portal messages, WhatsApp preferences and delivery status where permitted. |

Use a stable left navigation on desktop. On mobile, show a compact header with project switcher and a navigation drawer; keep Overview, Projects and Waiting on you readily available without cramming all destinations into a bottom bar. Never show inaccessible admin entries as enticing disabled links.

## Project shell

Route prefix: `/projects/:projectId`. Header contains project title, code, phase, archive status if applicable and a client/site descriptor appropriate to the viewer. Sections: Overview, Tasks, Drawings, Updates, Permits, Finance, Selections, Changes and Site issues. Hide sections without authorised content/actions rather than leaking counts. Less-used sections can move to “More” on small screens.

Internal notes and drafts must be visibly labelled inside the internal experience. Client-facing previews show the exact externally visible fields and attachments; the preview is not a permission mechanism.

## Content rules

Use plain nouns and verbs: “Payment due,” “Waiting for consultant,” “Awaiting manager release,” “Published to client,” “Previous version,” “Recorded from K-SMART,” “Archived project.” Explain “superseded” as “replaced by a newer released version” in details.

Call an amount “Invoiced” or “Received”; avoid combining them into a misleading “Sales” total. Show “Profit” only within its defined accounting basis and authorised view. Missing data is “Not recorded,” not zero. Dates and amounts are not promotional copy.

The main client is the final client authority for contractual decisions covered by the workflow. Representatives may contribute without silently gaining main-client authority. No screen should display a client drawing approval action.

K-SMART status copy must state it was recorded by the team and show the recorded/source date. Do not imply live government synchronisation. Permit tracking is a record of the practice’s process, not an automated legal determination.

All notifications, empty states and buttons should describe the user’s task. Keep technical words such as Worker, D1, R2, queue, token and provider callback out of ordinary product screens.

## Route implementation

Route strings in the [screen index](../screens/README.md) are the proposed routing contract. Keep route identifiers independent of the Marvel brand. Resolve an opaque project identifier on the server; never rely on a guess-resistant URL as access control. Validate return URLs and preserve authorised filter state without putting secrets or sensitive search content in shareable links.
