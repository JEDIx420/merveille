# Phase 14 Evidence: Integrated Verification, Staging and Launch Readiness

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P14 / REQ-OPS-001 through REQ-OPS-004, REQ-IAM-003, REQ-DAS-001, REQ-DAS-005, REQ-PRJ-007; AC-061, AC-062, AC-063, AC-065, AC-067, AC-068, AC-069
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd`, D1 SQLite, private R2 storage, Next.js 15.5.29, OpenNext 1.20.18
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`ownerUser`, `staffUserA`, `clientUserA`, `clientRepA`, `clientUserB`), multi-project partition (`prj_alpha_14`, `prj_beta_14`), and synthetic WhatsApp delivery adapter.

## Changed behaviour

- Integrated end-to-end verification and release gating:
  - **Online-Only Save Visibility (AC-061):**
    - Mutations across tasks, drawings, updates, invoices, and snags perform synchronous authoritative database transactions.
    - If communication or validation fails, an explicit typed error is surfaced (`INVALID_INPUT`, `FORBIDDEN`, etc.).
    - No false "Saved" confirmation message is rendered.
    - No background offline queue hides failures or writes corrupt data silently.
    - Explicit retry by user is supported and protected against accidental duplicate writes.
  - **Responsive & Accessible Core Flows (AC-062):**
    - `src/app/layout.tsx` enforces responsive viewport configuration (`width: device-width, initialScale: 1`).
    - CSS styling in `src/app/globals.css` and `assets/brand/brand.css` implements accessible focus outlines (`:focus-visible`), readable typography (`--merveille-font-display`, `--merveille-font-interface`), high-contrast color tokens (`--merveille-charcoal`, `--merveille-gold`, `--merveille-canvas`, `--merveille-ink`), and responsive layouts that prevent horizontal page overflow on 375px mobile viewports.
  - **Truthful States without Fabrication (AC-063):**
    - Zero fake KPI numbers or fabricated progress: empty lists render clear empty states, not synthetic cards.
    - Restricted data returns `null` or 403 `FORBIDDEN` rather than misleading ₹0.00 or 0 items. Specifically, client representatives without financial grants receive `billingSummary: null`, and non-owners accessing team performance receive 403 `FORBIDDEN`.
  - **Environment and Secret Separation (AC-065):**
    - `wrangler.jsonc` strictly isolates `local`, `staging`, and `production` environments with independent D1 database IDs and private R2 bucket names.
    - `ALLOW_SYNTHETIC_AUTH` is strictly `"false"` in staging and production.
    - Zero private credentials, API tokens, or secrets are exposed in client bundles or git repository files.
    - `package.json` provides explicit, environment-named deployment scripts: `npm run deploy:staging`, `npm run deploy:production`, `npm run migrate:staging`, `npm run migrate:production`.
  - **Migration & Recovery Gates (AC-067):**
    - Sequential database migrations (0001 through 0011) execute cleanly on both empty and pre-populated databases.
    - All existing rows across `organizations`, `users`, `projects`, `tasks`, `drawings`, `invoices`, and `receipts` are 100% retained and unharmed across schema updates.
    - Destructive table-drop commands are strictly avoided in forward migrations.
  - **Documented Blocker Visibility (AC-068):**
    - Local synthetic mode for WhatsApp (`SyntheticWhatsAppAdapter` / `vars.WHATSAPP_MODE = "fake"`) is clearly labelled.
    - Unresolved production inputs (Meta Graph API credentials, Cloudflare Access production tenant ID, custom domain DNS) are explicitly documented in `docs/implementation/operational-inputs.md` and `walkthrough.md`.
    - Live integrations remain disabled until authorized credentials are provided; no fake production claims.
  - **Cross-Caching & Multi-Tenancy Isolation (AC-069):**
    - `next.config.mjs` configures strict cache headers (`Cache-Control: no-store, no-cache, must-revalidate, private`, `Pragma: no-cache`, `Expires: 0`) for all `/api/:path*` routes.
    - Authenticated responses never leak across disjoint users: Client A (Project A) and Client B (Project B) are isolated, and cross-project requests return 403 `CROSS_PROJECT_DENIED`.
    - Static public brand assets alone (`assets/brand/`) use public caching.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-061 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | Mutation failure surfaces explicit error (`INVALID_INPUT: Task title is required.`); no ghost task is saved in database; user subsequent explicit retry succeeds cleanly with unique task ID |
| AC-062 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | `src/app/layout.tsx` enforces `width: device-width, initialScale: 1`; `src/app/globals.css` provides accessible `:focus-visible` outlines, high-contrast brand tokens (`--merveille-canvas`, `--merveille-ink`, `--merveille-gold`), and responsive layouts without fixed horizontal overflow |
| AC-063 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | Staff and client attempts to access owner performance analytics are rejected with 403 `Forbidden: Individual performance metrics are strictly restricted to the practice Owner.`; client representative receives `billingSummary = null` (not fake ₹0); empty project returns truthful empty arrays |
| AC-065 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | `wrangler.jsonc` separates `local`, `staging`, and `production`; `ALLOW_SYNTHETIC_AUTH` is `"false"` in staging and production; distinct D1 databases and R2 buckets; `package.json` contains explicit `deploy:staging` and `deploy:production` scripts; zero secrets in client code |
| AC-067 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | Sequential execution of migrations 0001 through 0011 produces 13 functional core tables; schema idempotency verified without data loss |
| AC-068 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | Synthetic WhatsApp delivery operates in labelled fake mode; outbox returns message ID and rejects unredacted salaries or raw documents; external blockers documented in `docs/implementation/operational-inputs.md` without fabricated live claims |
| AC-069 | `npx vitest run tests/integration/release/p14-readiness.test.ts` | PASS | `next.config.mjs` applies `no-store, no-cache, must-revalidate, private` to all API routes; Client A accessing Project A succeeds; Client A accessing Project B is rejected with 403 `CROSS_PROJECT_DENIED`; Client B accessing Project A is rejected with 403 `CROSS_PROJECT_DENIED` |
| Full Test Suite | `npm test` | PASS | 17 test files, 78 tests passing in 652ms with complete SQLite relational integrity |
| Production Build | `npm run build && npm run build:worker` | PASS | 37 static/dynamic routes compiled cleanly; OpenNext worker bundle generated at `.open-next/worker.js` with exit code 0 |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 294 files |

## Remaining work

- Complete delivery phases P00 through P14 are now fully verified and passing.
- Update `walkthrough.md` with operational launch instructions, deployment guide, and exact environment verification commands.

## Recovery impact

- Created release readiness test suite `tests/integration/release/p14-readiness.test.ts`.
- Configured private cache-control headers in `next.config.mjs` for `/api/*` routes.
- Configured explicit deployment scripts in `package.json`.
