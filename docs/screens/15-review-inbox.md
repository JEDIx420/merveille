# SCR-15 — Consultant review and manager release inbox

**Route:** `/reviews`. **Requirements:** REQ-DRW, REQ-NOT, REQ-DAS. **Workflow:** [drawings](../workflows/drawings.md).

## Purpose and permission

Give consultants a concise list of drawing revisions awaiting their decision across assigned projects, and managers a distinct list of revisions approved by all designated required consultants and awaiting release. Ordinary update publication and invoice approvals may be linked from “Waiting on you”; do not mix different approval meanings behind one unlabeled button.

## Layout and fields

Group by “Awaiting my review” and “Awaiting my release” only when the person has those capabilities. Each row includes project, drawing number/title, discipline, submitted revision, author, submission date, review deadline and current state. The detail panel opens the exact version with its preview, notes, prior released revision and relevant consultant decision history.

**Primary action:** “Review next drawing” in the list. In detail, consultant “Approve this revision” or manager “Release this revision”; return-for-changes requires a reason. Avoid batch approval/release in the initial product because each decision needs version-specific review.

## Interaction and service contract

Read only reviews assigned to the current consultant and release work in the manager's authorised project scope. Writes call the drawing workflow with item/version/state and operation identifier. Link to related project finance only through the project's separately authorised view; a review notification does not grant access to all files or discussions.

If a newer draft is uploaded, the existing review remains tied to its specified version until the workflow withdraws/replaces it. Show outstanding required reviewers separately from completed reviews; one approval does not imply all required reviews are complete. If an approval is revoked or the file changes, manager release must fail safely and explain the new required action. The same person holding multiple roles must still perform the distinct recorded transitions unless the product policy changes explicitly.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). An empty queue says no reviews/releases are awaiting this person. A stale notification opens the current decision history, not an actionable old approval. Mobile uses list-to-detail navigation with the revision/state fixed above the preview. Archived projects have no active review/release actions.

## Acceptance criteria

- Consultant and manager actions have different labels and server checks.
- Managers cannot release unapproved or different revisions.
- Consultants cannot read another consultant's private assigned review solely by changing the URL.
- Reopening a completed review shows the recorded outcome without duplicate side effects.
- Clients have neither drawing approval nor release controls/endpoints.
