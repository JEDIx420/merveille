# Employee access and existing-project onboarding — 25 November 2026

Source `63f0719`, branch `implement/merveille-portal`. Staging web version `f6683fd4-8326-47ab-b305-ccd56ca407a4`, https://merveille-web-staging.rhelo-bible.workers.dev. User explicitly authorized both features, testing and deployment. No production changes or messages.

## Implemented

- People & access → Add employee; separate client/consultant invitation. Default project role is explicitly Team member or Project manager, applied only to selected projects. Employee invitations show internal project roles, separate read/preparation/issue finance choices and optional independent organisation grants. No staff/admin/owner grant is silently created. No-project state explains inviting first and assigning projects later. Existing Manage access continues to expose all grants.
- Projects → Add project → New enquiry / Existing project. ADMIN-only direct existing-project command validates live administrator and active in-organisation contacts, records the reported stage/start date and immutable handover, and atomically creates project/stages/memberships/audit. Per-organisation request reference and fingerprint protect retry/changed-reuse. No enquiry is fabricated.
- Existing work starts in DRAFT, labelled Setup pending. Reported stage is retained without automatically completing prior stages. The project overview links its persistent onboarding record/checklist, documents, people and actual finance route.
- Commercial notes are reconciliation context, not an opening-balance import. Existing accepted quotation, confirmed required advance and manager activation remain authoritative; existing drawing/extra-work rules unchanged. Client/consultant projections exclude internal onboarding notes.

## Actual verification

| Check | Result |
|---|---|
| `npm test` | PASS: 111 tests / 23 files. New five onboarding tests exercise commercial/access boundaries, exact retry/changed reuse, invalid and inactive contacts, owner/stale-admin denial, private projections and injected audit rollback. Existing finance/drawing/identity tests passed. |
| `npm run typecheck` | PASS |
| `npm run test:workerd` | PASS: 11 actual local workerd checks, all 22 migrations. New real D1 creation/replay and denied premature activation; existing rollback, concurrency, identity, exact drawing release and byte recovery checks retained. |
| `npm run build:worker` | PASS: Next/OpenNext Worker artifact |
| `BASE_URL=http://127.0.0.1:8809 npm run test:browser` | PASS: 114 recorded fixture checks / 29 existing pages / three viewport sizes, no overflow or JavaScript errors. Invitation selectors updated to the new action. |
| `BASE_URL=http://127.0.0.1:8809 node scripts/check-onboarding-browser.mjs` | PASS on final source: complete employee invitation with project role + finance permission, no silent elevated role, existing-project form, failed-submit input retention, retry-key preservation and successful setup checklist at 1440/1024/390 widths. No overflow/JavaScript errors. API interception is fictional test-only; not hosted business acceptance. |
| Remote staging migration | Protected private pre-migration D1 export completed; only additive migration 0022 applied successfully. Existing records unchanged. |
| `wrangler deploy --env staging --dry-run`, then `wrangler deploy --env staging` | PASS; version recorded above. Access configuration/secrets unchanged, preview URLs remain disabled. |
| Hosted signed-in browser | PASS: Add employee dialog, independent grants/no-project state, Add project choices, existing-project form with actual active contact display names. No invitation or fictional business project submitted to hosted data. Private screenshots excluded from Git. |
| Anonymous hosted GET `/people`, `/projects/new`, `/api/projects` | Each 302 to configured Cloudflare Access tenant; no unprotected new route. |
| `npm run check:handoff` | PASS; documentation checker does not claim app testing itself. |

Fictional screenshots and machine results are in this directory. Private command logs use `.private/onboarding-*`; pre-migration export is `.private/pre-onboarding-staging.sql` mode 0600. Real identities are excluded from public evidence. An initial browser-fixture mismatch used `display_name` rather than the People API's `name`; corrected before final verification/deployment. A bulk contact-query scalar mismatch was caught by the new tests and corrected; final suites above passed.

## Limits

This implements direct project onboarding plus reconciliation guidance, not automatic import/posting of historical invoices or opening balances. Team onboarding with additional real accounts, full business UAT, continuous backup monitoring, real messaging/webhook and populated remote recovery remain the separately recorded R05 gates. No synthetic sign-in or role switching was introduced.

Final permission review: live administrator predicates require GLOBAL scope, and duplicate-code preflight reads only the actor's organisation. Re-ran all 111 tests, typecheck, Worker build and all 11 workerd checks after the service change; a targeted assertion also denies stale principals after their stored ADMIN grant becomes project-scoped. Final source `63f0719`, version `f6683fd4-8326-47ab-b305-ccd56ca407a4`. UI is unchanged from the signed-in hosted review on the preceding version.
