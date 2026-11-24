# Drawing versions, consultant approval and manager release

**Requirements:** REQ-DRW-001–008, REQ-FIL-001–005, REQ-IAM-003/004.

**Confirmed authority:** Team prepares/reviews → relevant consultant approves → **manager finally releases**. There is **no client drawing-approval gate**. This latest confirmation resolves the earlier discovery ambiguity.

## Objects and evidence

A logical drawing has a stable identity, project, discipline, title/reference and at most one current released version. Each version has its own label, author, immutable submitted file references, content identity, submission note, required reviewers and history.

Consultant approval and manager release must reference the exact version and files reviewed. Editing a submitted file in place, carrying approval into changed content or treating the newest upload as current is prohibited.

The default is that all designated **required** consultants for this version must approve. This does not mean every consultant on the project. Optional advisers can comment without becoming an approval gate. Configure the relevant reviewers when submitting; changing the required reviewer set is an audited manager action and cannot be used to quietly remove a rejection.

## Version transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → DRAFT | Authorized staff creates version | Assigned project/drawing scope; allowed file type/size | Draft can be edited before submission; `drawing_version_created`. |
| DRAFT → IN_REVIEW | Author/manager submits | Complete files; at least the required consultant path defined; valid reviewers | Freeze submitted snapshot; notify required consultants; `drawing_submitted`. |
| IN_REVIEW → IN_REVIEW | Assigned consultant approves one review | Reviewer assigned; exact current submission; no altered content | Record immutable approval; recompute remaining reviewers; `drawing_consultant_approved`. |
| IN_REVIEW → CONSULTANT_APPROVED | Final required consultant approves | All required approvals valid for exact version | Queue manager release decision; `drawing_consultant_review_complete`. |
| IN_REVIEW → CHANGES_REQUESTED | Assigned consultant returns | Reason referencing the issue | Preserve all reviews; block release; author prepares a new version; `drawing_changes_requested`. |
| IN_REVIEW → REJECTED | Assigned consultant declines submission | Reason; used for explicit rejection, not routine replacement | End this submission; preserve evidence; `drawing_rejected`. |
| CONSULTANT_APPROVED → CHANGES_REQUESTED | Manager returns before release | Reason | Block release; revised content requires new consultant approvals; `drawing_release_returned`. |
| CONSULTANT_APPROVED → RELEASED | Manager releases | All required approvals current; project permits release; expected current-version pointer matches | Atomically set current version; supersede previous release; publish authorized availability; `drawing_released`. |
| RELEASED → SUPERSEDED | System as part of manager replacement release | Replacement version successfully released | Preserve old file/approvals; move “current” pointer only once; `drawing_superseded`. |
| RELEASED → WITHDRAWN | Manager withdraws | Reason; operational impact acknowledgement | Remove current-use status; notify affected audience; no automatic fallback to older version; `drawing_withdrawn`. |
| DRAFT/IN_REVIEW/CONSULTANT_APPROVED → CANCELLED | Author where still draft; manager after submission | Reason after submission | Stop pending reviews; retain history; `drawing_submission_cancelled`. |

Returning a submission creates work on a **new DRAFT version**; it does not reopen the original submitted files for undetectable edits. A non-content clerical label correction can be a separately audited metadata amendment if it cannot change the reviewed artifact or meaning.

## Manager release is the publication boundary

The release screen must show the version label, files, required consultant approvals and any unresolved comments, plus the currently released version it will replace. A manager without valid approvals cannot release. An administrator or owner needs the manager capability for this action.

A consultant may approve while a manager returns or another reviewer requests changes. The server must resolve against the current state; stale approvals must not race the version into release. Double-clicking release or retrying after a timeout must produce one effective release.

## Client and consultant views

- Clients see the current **released** drawing as the primary version. “Uploaded yesterday” is not enough to make it current.
- A previously released version may remain in permitted history with a clear **Superseded — do not use as the current version** label. Rejected drafts are not client history.
- Clients/representatives may raise a question or request a change. Their response is neither consultant approval nor manager release.
- Consultants see assigned review versions, their review scope, released project drawings within scope and permitted site updates.
- Internal reviewer discussions do not automatically become client comments.
- File originals, previews and thumbnails follow the same version permissions. A client must not retrieve a draft by modifying a file identifier.

## Revision and withdrawal behavior

Keep the prior released drawing current while a replacement is under review. If the replacement is returned or rejected, the prior release remains current. If the manager believes the current drawing must no longer be used, they withdraw it explicitly; the workspace then shows **No current released version** and the withdrawal reason appropriate to the audience.

Do not automatically promote an older version after withdrawal. A manager must deliberately re-release a suitable version under a recorded review policy. Previous approval evidence remains attached to its original version; any re-release must identify the exact artifact and reason.

A commercial change can produce new drawing work only after its [execution gates](change-requests.md). A revised drawing itself does not establish that a client agreed to extra cost.

## Review evidence

Prove: client approval is absent; consultant approval alone cannot publish; manager cannot release without required reviews; the correct prior version remains current during revision; only one current version survives concurrent releases; old released versions are superseded; rejected drafts stay private; withdrawal removes current status; and revoked consultants cannot review or download through stale links.
