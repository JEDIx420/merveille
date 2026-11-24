# Files, drawings and site media

## Storage policy

All project originals and derived previews are in **private Cloudflare R2**, with metadata and relationships in D1. Public brand assets may live with static frontend assets. Never place client drawings or screenshots in the repository, static site folder, a public R2 bucket, or a permanent public download URL.

Each object is immutable at the application level. A proposed key shape is `org/{orgId}/project/{projectId}/file/{fileId}/original`; the key is assigned server-side and is not an authorization mechanism. New drawing versions and edited evidence create new objects. There is no assumption that R2 supplies automatic object version history; Merveille Designs retains versions through separate keys and database references.

## File classes and initial limits

These are adjustable engineering defaults to validate with representative files before launch, not confirmed business limits:

| Class | Initial upload ceiling | Preview policy |
|---|---:|---|
| JPEG/PNG/WebP reference or site image | 25 MiB | Bounded decoded dimensions, safe derivative image |
| PDF document/drawing | 100 MiB | Sandboxed viewer with script/action execution disabled; download fallback |
| DWG/DXF/IFC source drawing | 250 MiB | Metadata/download, optional separately uploaded PDF preview |
| MP4/WebM site video | 1 GiB | Supported browser playback by authorized range request; no promised transcoding |
| Other office document | 50 MiB | Download-only unless a vetted renderer is explicitly added |

Reject executables, scripts, HTML and active SVG uploads by default. Allowlisted file extensions alone do not prove type; validate content where technically feasible. Archive files are excluded unless a separate bounded extraction/threat design is approved. Avoid base64 file content in JSON.

Request body limits depend on the Cloudflare zone plan; see [Workers limits](https://developers.cloudflare.com/workers/platform/limits/). A large object must not be sent in one request or buffered completely in Worker memory.

## Default large-upload design

Use authenticated **multipart uploads through the Worker and the R2 binding**, based on Cloudflare's [multipart API guide](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/). Start with 8 MiB chunks and bounded concurrency (for example two parts at once), then test on actual mobile networks. Match R2's minimum part size and final-part rules for the pinned runtime.

1. The user selects a file. The browser shows type, size, destination and progress.
2. `init` checks current role/project, accepted type/size, quota and target entity. Create a pending D1 upload session and R2 multipart upload. Use the server-assigned key. An archived project rejects new content uploads except an ADMIN settlement-evidence attachment tied to a permitted existing financial obligation; that attachment never becomes a general project update.
3. Each part request verifies identity, active membership, upload ownership, expiry, expected part number and bounded length. Stream the body into R2 rather than buffering the entire file.
4. Save accepted part metadata. A retry of the same part is safe and cannot cross sessions. The browser can query accepted parts and retry while online.
5. `complete` rechecks permissions, validates part list and completes the multipart object. Verify final size/type and available checksum metadata with R2. Do not treat a multipart ETag as a universal SHA-256 hash.
6. Move the file from `PENDING` to `READY` only after integrity/type checks. Link it to a draft domain record; readiness is not client publication or drawing approval.
7. Abort/expire abandoned sessions and clean orphaned temporary objects on a scheduled job. Do not delete referenced project originals through this cleanup path.

R2 completion and D1 finalization are not a cross-service transaction. If the object completes but the D1 status write fails, retry/reconciliation must inspect only the server-assigned key, validate the stored session and expected object metadata, recheck authority, and finalize at most once. Do not blindly start another upload or accept a browser-supplied existing object key. Conversely, failed initialization must reconcile or abort any orphaned multipart upload without deleting committed originals.

There is no offline synchronization. A network interruption retains visible retry state for the current online operation. Resume across a page reload requires reselecting the same local file and verifying its identity; do not imply the browser retains file bytes indefinitely.

## Direct R2 upload alternative

If measured Worker transit overhead warrants direct browser uploads, add narrowly scoped short-lived S3 presigned operations. Cloudflare documents [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) and [bucket CORS](https://developers.cloudflare.com/r2/buckets/cors/). Sign only the server-owned key, method and intended content properties, use exact allowed origins, and keep the signing credential server-only. The R2 binding itself does not generate S3 presigned URLs.

Treat signed URLs as bearer credentials usable until expiry. Application access removal cannot retroactively revoke a URL already issued without additional storage/key actions. Therefore finalization still reauthorizes and default private downloads still go through the Worker. Never place a presigned URL in an ordinary WhatsApp reminder, audit log or analytics event.

## Review and safe presentation

Uploads are untrusted. Do not claim malware scanning exists merely because files are stored in R2. Initial controls are type/size constraints, private storage, safe rendering, constrained download responses and manager-controlled publication. If a full malware scanner becomes a production requirement, record the actual chosen implementation and data boundary; until then, do not label a file “virus-free.”

Client reference uploads remain attachments to their authorized project and cannot become published construction drawings. Internal attachments remain internal even if a public update accidentally references their ID; publication must reject the invalid link or require a separate deliberate shared copy/reclassification with authorization.

For images, generate bounded thumbnails without trusting dimensions or metadata. For CAD, show a clean “Preview unavailable; download original” state and allow an accompanying PDF. For video, display unsupported codec errors and a download option; no costly conversion infrastructure is silently assumed. For PDF, use an actively maintained sandboxed renderer without document JavaScript, external fetches, form submissions or embedded attachment execution. Avoid rendering untrusted markup on the application's authenticated origin.

## Download contract

Resolve file metadata, current membership, parent-record visibility and archive policy on every request. Then stream the R2 object through the Worker with safe content type, safe filename, `Content-Disposition`, `X-Content-Type-Options: nosniff` and private/no-store caching. Support valid ranges for video/PDF and reject malformed or excessive multipart range requests. Do not load the whole object into an ArrayBuffer.

Clients and consultants can view/download their authorised archived records. A superseded drawing must remain visibly labelled in history and in any generated cover metadata; do not rewrite its original bytes to add the label. The current approved drawing remains prominently distinguished.

Revoking a user prevents new download requests. It cannot erase a copy already downloaded or stop bytes already delivered. Do not promise DRM. Log download metadata at a useful privacy-preserving level without storing complete URLs or document content.

## Tests and evidence

Verify large multi-part upload, retry, resume, cancel, duplicate completion, expired session, oversized final object, misdeclared MIME, cross-project file link, revoked membership before completion, orphan cleanup, empty file, non-ASCII filename, private range download, superseded drawing label and archive download. Test real PDFs/CAD samples and a representative site video in staging; synthetic tiny files do not prove large-upload usability.
