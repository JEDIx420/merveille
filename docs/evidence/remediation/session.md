# Remediation implementation and verification

Date: 24 November 2026. Branch: `implement/merveille-portal`. Baseline: `82921d6`, fast-forwarded from clean `813ef8b`; no local work was discarded. Final application source: `7e08db6` (backend checkpoint `7622499`, jobs `fbf6e00`, dashboard/cache `c01cdd1`, shared UI `c8a435b`, integrated repairs `9544571`, filename preview `8ec3a34`, parent-bound file safety `ba81a9b`, confirmed advances `001c94b`, controlled legacy identity linking `7e08db6`). Documentation-only commits may follow this source checkpoint.

## Implemented

- R00: no request/cookie synthetic login; diagnostics return 404 without bindings; actual overview routing; explicit local/fail-closed deployment configuration; private canonical-origin HTTP boundaries.
- R01: jose/JWKS signature validation, issuer/subject identity binding, current memberships/capability sets, one-time exact-email bootstrap, invitation digests/expiry/admission/delivery states, multiple admins, current-actor/last-admin atomic guards, scoped selectors, grant editing/history and operator identity recovery. See [identity evidence](identity.md).
- R02/R04: shared neutral tokens, licensed self-hosted Inter, compact unchanged logo, Auth/App/Project shells, all route destinations/equivalents, functional reference compositions, accessible dialogs/forms/feedback, role-specific controls, photo/file previews and mobile containers. Browser evidence/report is linked below; no deployed role selector or demo authentication exists.
- R03: financial state/version/money/concurrency/replay guards; unique numbering and balanced journals/audit/outbox; current commercial gates; parent-derived attachment privacy; manager release/publication; task and snag state/event batches; archive read-only backstops plus ADMIN settlement receipts bound to existing obligations; durable reminders and independent byte-preserving recovery. See [finance evidence](../remediation-finance.md), [operations evidence](../remediation-operations.md), and [authority ADR](../../architecture/decisions/0002-remediation-authority.md).
- R05: reproducible technical checks and [operator/browser-only real-account handoff](../../operations/real-account-handoff.md) prepared. Hosted and real-person acceptance remain blocked, not complete.

## Baseline and corrected failures

Baseline `npm test`: 77 passed, 1 failed (legacy source-string APP_ENV assertion). Baseline typecheck and OpenNext build passed. Historical evidence did not establish release readiness.

Intermediate actual failures were retained or corrected, not waived: obsolete fixture-auth/source-string tests; OpenNext internal URL normalization denying valid writes; wildcard public cache headers on private IDs ending `.png`; stale aggregate scope/receipt basis; phone filter bars overflowing; inaccessible dialog labels/focus/feedback; long filename clipping. The browser report before the phone fixes remains as explicit failed evidence. Final command results below supersede those failures only for their stated scope.

## Verification

| Command/check | Actual result and scope |
|---|---|
| `npm run typecheck` | PASS on the integrated application |
| `npm test` | PASS: 105 tests in 21 files; Node SQLite, service/permission/route-handler tests, ephemeral signed JWKS fixtures and runtime containment checks |
| `npm run build:worker` | PASS: optimized Next.js 15.5.29/OpenNext 1.20.18 Worker and assets |
| `node scripts/check-workerd.mjs` | PASS: nine local workerd checks, all migrations through 0020 applied to fresh isolated D1/R2 state; no remote bindings |
| `BASE_URL=http://127.0.0.1:8799 node scripts/check-private-http.mjs` | PASS: 11 actual HTTP checks, including private ID suffix caching; missing/forged/old-demo identity rejected; direct GET/HEAD downloads denied; diagnostic GET/POST 404; cross-origin mutation 403; valid-origin unauthenticated mutation reaches 401; root redirects to `/overview` |
| Unconfigured `/api/auth/login` | HTTP 303 to `/login?setup=pending`; calm setup-required screen with no sign-in loop |
| `npm run types:bindings -- --check` | PASS: generated bindings match Wrangler source configuration |
| `wrangler deploy --dry-run --config workers/jobs/wrangler.jsonc` | PASS: jobs bundle/DB/Queue contract packaged; no deployment |
| `npm audit` | PASS: zero reported dependency vulnerabilities after the documented scoped dependency repairs |
| `node scripts/check-handoff.mjs` | PASS: document links, original brand hashes, 15 historical phases, six active remediation stages and 70 legacy cases; this is not an application test |
| `BASE_URL=http://127.0.0.1:8799 npm run test:browser` | PASS: 112 recorded route/state/interaction checks, covering all 29 pages at three sizes, including pure external-client navigation; no overflow or browser JavaScript errors. [UI evidence](ui.md), [route inventory](route-inventory.md), [raw report](ui/browser-results.json). Fictional browser API fixtures only; this is not hosted Google/UAT evidence. |

The workerd drill proves singleton bootstrap/elevation/admin-removal races, financial issue rollback/number replay, parallel allocation limits, failed drawing release preserving the prior version, release audit replay, and recovery of actual R2 bytes/full financial history into quarantined access. Verified fixture identity claims enter only an isolated service harness; this is not a real Google login test.

## Browser artifact boundary

The built app runs locally at `http://127.0.0.1:8799` with isolated state. Populated UI inspection uses Playwright-only fictional API fixtures; there is no application authentication bypass. Tests independently exercise actual unauthenticated HTTP and real local workerd D1/R2 services. Browser fixture screenshots do not establish hosted end-to-end authorization or live financial operations.

Use the [route and UI evidence](ui.md), [final browser report](ui/browser-results.json), and reference images under `ui/`. The old preview was not changed. No real account address, token, storage state, client data or payroll is in those artifacts.

## Runtime and tooling

Next.js 15.5.29, React/React-DOM 19.0.0, OpenNext 1.20.18 and Wrangler 4.167.0 remain pinned. jose 6.1.3 adds maintained signature verification. Vitest was pinned to 5.1.1 and scoped build dependency overrides repair reported advisories without a framework/adapter migration; current lockfile audit reports zero. Node used: 22.23.1. Relevant project-local skills were read and reused with their full upstream commits in skills-lock.json; build-merveille was preserved. No global IDE/tool configuration was changed.

## External gates and exact next step

Read-only inspection confirmed Wrangler infrastructure authentication, zero Access applications and zero identity providers in the authenticated account (HTTP 200), and organization lookup denied (HTTP 403). No Cloudflare resources, policies, secrets, real identities, records or deployment were changed. No WhatsApp messages were sent.

Jay's exact supplied Google address is held only in ignored, protected private setup data. Initial bootstrap is ADMIN-only and has not been executed against a hosted environment. Google OAuth/Access team/app/audience/exact-email policies, protected authorized review ingress, named environment resources, hosted Queue/provider checks, remote restore and real-person UAT remain blocked/pending.

Next: configure the approved Google/Access review environment, then let the coding operator apply reviewed migrations/build, prepare bootstrap, and run the real-account walkthrough with Jay and the pilot team. All setup/operational commands are in the handoff; the team is not asked to use a terminal. Production readiness is not claimed.

## R05 staging provisioning — 24 November 2026

User explicitly authorized isolated protected staging and Google Access setup. Source artifact remains application source `7e08db6` (documentation baseline `21ec699`).

- Created APAC `merveille-data-staging`, ID `55b52363-a87e-4b4f-a551-607ad26c6b20`, and private `merveille-files-staging`; existing resources untouched.
- `npx wrangler d1 migrations apply DB --remote --env staging`: PASS, all 20 migrations applied to the new empty database. Read-only query: 20 migration records, zero `financial_reconciliation_errors`.
- `npx wrangler deploy --env staging --dry-run`: PASS for isolated bindings. `npx wrangler deploy --env staging`: uploaded Worker version `9837f799-b94b-4912-a92c-79238d14e019`, no targets deployed. Issuer/audience empty: fail closed pending actual configuration.
- API verification: Worker subdomain `enabled:false, previews_enabled:false`; Worker routes empty; R2 managed public domain `enabled:false`. Anonymous proposed origin returned 404. These prove disabled ingress, not working Access protection.
- `npm run types:bindings` and `npm run typecheck`: PASS. No application behavior changed; previous local tests not represented as rerun.
- Read-only account inspection: zero Access apps/IdPs, organization 403; Wrangler OAuth scope inventory has no Access write permission. Need actual Zero Trust domain, dashboard-tested Google provider, short-lived account-scoped Access setup token. Exact private instructions in real-account handoff.
- No bootstrap, Access policy, real-person login, provider send, production mutation or team UAT performed. Staging is uploaded but unavailable to testers until protection is configured and verified. R05 hosted/team gates remain blocked.

### Verified account and Google owner handoff

`npx wrangler whoami` confirms the sole account ID matches the signed-in dashboard (`2dbda19c8f37c5d767acfd842321c4a5`), and remote reads locate the isolated staging D1 and rhelo-bible Workers subdomain. Raw whoami retained only in ignored private data. Dashboard inspection corrects the earlier incomplete API conclusion: Zero Trust already exists at `plain-dream-04be.cloudflareaccess.com`, with two unrelated applications and a Cloudflare identity provider. OAuth API empty lists are not an authoritative account inventory; organization API remains 403. Existing unrelated policies unchanged. Pinned account_id and actual staging issuer in Wrangler source; audience/ingress remain disabled. Created isolated Google project Merveille Designs Staging (`learned-thunder-515717-r7`), prepared External testing branding/contact form, stopped before agreeing to Google API services user data policy. Account-owner browser handoff pending; no OAuth client, Google IdP or staging admission policy created.

### Protected staging and initial Google administrator — 24 November 2026

- User confirmed OAuth credential creation, Cloudflare storage/provider configuration, dedicated exact-email policy, and initial staging ADMIN activation at action time. Google policy accepted by the account owner.
- Created Google Web client in isolated project `learned-thunder-515717-r7`; actual Access team origin/callback; identity scopes only; PKCE enabled. Google External testing mode has one privately recorded test user. Provider connection test showed “Your connection works!” for that real account. Initial provider/app lookup errors cleared after configuration propagated; not waived as success.
- Created dedicated Access Google IdP/app/policy (IDs in named Wrangler staging vars). Policy inspected: exact initial email Include AND Google Login Method Require. Only selected Google provider allowed, WARP off. Staging Worker production/preview destination and exact canonical public hostname covered. Existing unrelated security policies unchanged.
- `npx wrangler deploy --env staging`: PASS version `13e8888c-7342-45bc-bbe3-e0eb7b27eea6` with actual issuer/audience, isolated D1/R2 and protected workers.dev ingress. Anonymous GET /, /api/session, /api/files/private-test.png and /api/runtime each 302 to actual Access team with private/no-store cache headers. This proves edge gating, not underlying route semantics. API confirms workers.dev enabled, previews disabled, no custom routes.
- Hosted invitation inspection exposed hash parsing defect: generated `#token=...` was treated as raw token text. Fixed fragment parameter decoding and retained captured token through React StrictMode's repeated effect; scrub address bar after capture. Added `scripts/check-invitation-browser.mjs`: 3 fresh local browser cases (generated named fragment, legacy query, raw fragment), exact POST payload and URL cleanup PASS with isolated transport fixtures. An initial test run reused an already accepted same-document page for the last fragment case and timed out; corrected the harness to use a fresh page per case. This fixture check is not Google/API acceptance.
- `npm test`: 105 tests/21 files PASS before parser correction; targeted browser check, typecheck and `npm run build:worker` PASS after correction. Rebuilt/deployed version `1da9cec8-e065-4e86-8c46-66e01db7be68`.
- Operator bootstrap ran once on staging after actual edge admission. User confirmed activation; actual browser accepted invitation and opened Overview/People. Hosted session reports AUTHENTICATED, ADMIN only, 0 projects. Remote D1 confirms 1 active ADMIN, 1 identity, 0 project memberships, 1 accepted invite. First read-only verification query used the wrong role column and failed harmlessly; corrected query uses role_assignments joined to active membership/user.
- Actual browser sign-out reported successful logout; Google sign-in returned to real Overview. Used invitation replay denied. Hosted OWNER performance endpoint returned FORBIDDEN for ADMIN. No role impersonation, unknown-account login, second admin, team-role business UAT or real provider messages claimed.
- Current gate: protected staging usable by Jay. Other pilot emails/roles requested privately; Google testing and exact-email edge admission plus per-person invitations pending. Access reconciliation token absent; manual operator admission is documented. Jobs/provider/remote restore and full team acceptance remain pending.

Staging configuration and invitation repair source checkpoint: `41370d9`. No personal addresses or OAuth secrets committed. Documentation checker passed after the hosted evidence update.
