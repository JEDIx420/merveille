# ADR 0002 — Remediation authority and atomic commands

Date: 24 November 2026. Status: implemented locally; hosted integration remains gated. Supersedes the single-role and synthetic-auth assumptions in historical implementation evidence. Product authority remains governed by AGENTS.md and the remediation amendment.

## Decisions

- Keep Next.js/OpenNext and Wrangler. Use pinned jose for trusted-issuer JWKS verification; no request/cookie fixture identities and no email-only identity fallback. A verified issuer/subject mapping plus current D1 account/organization membership is required.
- Keep every global capability and project grant. `role` is a legacy display field only. Missing `roles` never grants staff. ADMIN and OWNER are independent globals; project MANAGER/staff/consultant/client authority requires an explicit project grant. Finance author/issue grants additionally require an eligible internal role.
- A project intake conversion creates memberships and main-client contractual authority. It is therefore an ADMIN action under the confirmed access-administration rule, rather than loosening `/api/people` for other intake users. Explicit intake grants still permit enquiry creation/study/closure. Organization TEAM_MEMBER and MANAGER grants provide intake and delegated company publishing respectively; they never grant project approvals without that project's role.
- Main-client authority follows the current project pointer plus active MAIN_CLIENT membership. Editing grants can deliberately remove it; unrelated edits preserve it when selected. Prior decisions retain their original actors.
- Use D1 `batch()` transactions with failing SQL CHECK assertions for stale state/versions/amounts. A zero-row UPDATE is not treated as an atomic failure. Unique sources/operation fingerprints and organization/year sequences protect financial replay and numbering. Assertions are transient; guards and business writes share the batch.
- Site-issue state, evidence and event history use guarded batches with optimistic revisions. Duplicate visible snag references fail explicitly instead of silently racing.
- Keep issued records immutable and use explicit corrections. Legacy duplicates or incomplete journal history require reconciliation; no new migration invents payments or deletes financial history. Archived settlement receipts are explicitly bound to an existing invoice, then use ordinary report/confirm/allocate commands. Archive creates no new work, invoice or schedule.
- Derive attachment visibility from authoritative drawing/update/receipt/cost parents. A public-looking MIME type or project membership cannot publish a draft or raw payment evidence. Preview is explicit and restricted to safe raster/PDF/video MIME types, with private caching, nosniff and sandbox policy.
- Validate unsafe request Origin against configured APP_ORIGIN. The actual OpenNext runtime normalizes internal NextRequest URLs; comparing browser Origin to that normalized URL incorrectly denied legitimate requests. Real HTTP regression checks cover the canonical-origin fix.
- Cache publicly only exact brand/font paths. A wildcard based on a filename extension also matched private resource identifiers ending in `.png`; the built HTTP check reproduced that leak in response headers and now requires no-store for those identifiers.
- Keep background work in a separate Cloudflare Worker and independent backup storage. Missing provider configuration means unavailable delivery, not fake success. Restore quarantines access and invalidates onboarding credentials before operator reconciliation.

## Verification boundary

Local domain/HTTP/browser/workerd evidence is linked from the [session record](../../evidence/remediation/session.md). Google/Access admission, alternate hosted ingress, remote Queue/provider delivery, remote restore and real-person UAT are separate blocked gates.

References: [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [D1 transactional batches](https://developers.cloudflare.com/d1/worker-api/d1-database/). These describe provider contracts; the local workerd drill exercises rollback, concurrent money commands and identity races in the selected runtime.
