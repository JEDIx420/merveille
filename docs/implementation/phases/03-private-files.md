# P03 — Private documents and media

**Status:** not started. **Dependencies:** P02.

## Outcome

Deliver safe, usable online uploads and downloads before document-dependent workflows.

## Read before implementation

- [files-and-media.md](../../../docs/architecture/files-and-media.md)
- [api-contracts.md](../../../docs/architecture/api-contracts.md)
- [interaction-patterns.md](../../../docs/design/interaction-patterns.md)
- [04-enquiry-feasibility.md](../../../docs/screens/04-enquiry-feasibility.md)

## Implementation order

1. Create file metadata, parent scope, upload sessions and immutable server-assigned object keys.

2. Implement bounded multipart upload with configured limits, progress, retry, abort and final verification; no browser-supplied audience/object keys.

3. Enforce current authorisation on originals, thumbnails, previews, HEAD and Range responses. Keep R2 private and all private responses non-cacheable by shared caches.

4. Build accessible attachment controls, PDF/image previews where supported, video range playback if supported, and honest download-only CAD states.

5. Connect feasibility evidence and reference upload widgets. Validate allowed types and active-content handling; document scanning limitations rather than claim a scan happened.

6. Test access revocation, failed parts, foreign project IDs and retained-file protection.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/files/`
- `src/components/files/`
- `src/app/api/files/`
- `src/server/db/files/`
- `tests/integration/files/`

## Acceptance cases

Run AC-056, AC-057, AC-058, AC-059, AC-060 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Large permitted files upload online and authorised users can view/download them. Private objects, retained versions and revoked users behave correctly across all access paths.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
