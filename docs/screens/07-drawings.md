# SCR-07 — Drawing register, versions and release

**Routes:** `/projects/:projectId/drawings`, `/projects/:projectId/drawings/:drawingId`, `/projects/:projectId/drawings/:drawingId/versions/:versionId`. **Requirements:** REQ-DRW, REQ-FIL, REQ-IAM. **Workflow:** [drawings](../workflows/drawings.md).

## Purpose and permission

Make the drawing approved for use unmistakable. TEAM_MEMBER uploads/revises and submits for review. Each designated required CONSULTANT approves the precise revision; the version is consultant-approved only when all required approvals are valid. MANAGER controls final release. Clients view released drawings and may request a change; **there is no client drawing approval action**.

## Layout and information

Register columns: drawing number/title, discipline, current released revision, pending revision state, reviewer, review deadline and last activity. Detail leads with the current released revision; a clearly separated panel shows a pending revision to permitted reviewers. Include file preview/download, revision notes and version history.

States shown accurately: DRAFT, IN_REVIEW, CHANGES_REQUESTED, CONSULTANT_APPROVED, RELEASED, REJECTED, SUPERSEDED, WITHDRAWN and CANCELLED. “Changes requested” differs from explicit rejection. Only replacement release supersedes the previous release. Historical released files are marked “Previous version — not current.”

**Primary action:** staff “Upload revision”/“Submit for review”; consultant “Approve this revision”; manager “Release this revision”; client “Download current drawing.” Return-for-changes is secondary and requires a reason. Never show release on a merely uploaded file.

## Interaction and service contract

Read role-filtered drawing/versions, current release pointer, assigned review and applicable approval record. Write new immutable version, review submission, consultant decision and manager release. Every action carries the specific version and expected current state. Concurrent replacement/revocation produces a conflict requiring a fresh decision, not automatic retry against another file.

Re-upload creates a new version and review cycle. The current release remains usable while a new revision is pending. A manager may explicitly withdraw a current release with a reason; show “No current released version” and do not automatically promote an older version. Internal annotations must not leak into a client download/preview. For CAD originals require a downloadable file and optionally an attached PDF preview; do not promise browser editing or conversion.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Unavailable preview offers authorised download, not a broken canvas. Large uploads display progress. The mobile detail prioritises revision/state above the preview. Archive mode allows permitted historical downloads but no uploads, reviews or release.

## Acceptance criteria

- Consultant approval alone does not release a drawing.
- Manager release requires every designated required consultant approval for that exact immutable version.
- Returning for changes, explicit rejection and withdrawal retain their distinct states; a withdrawn release never silently falls back to an older version.
- Client requests cannot call consultant approval or manager release endpoints.
- Uploading a replacement does not hide/supersede the existing release.
- A revoked member cannot download using a copied internal link.
