# Phase 00 Evidence: Runtime Foundation and Compatibility

## Identity

- Phase / requirement IDs: P00 / REQ-OPS-002, AC-064
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` emulation via Wrangler
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - npm: `10.9.8`
  - Next.js: `15.5.29`
  - React / React-DOM: `19.0.0`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `typescript`: `5.7.3`
  - `vitest`: `3.2.7`
  - `@playwright/test`: `1.50.0`
  - Skills CLI: `1.9.0`
- Fixture set: Synthetic principals (`owner`, `admin`, `staff`, `consultant`, `client`, `rep`) and test database table `_runtime_spike`

## Changed behaviour

- Scaffolding and build pipeline established using OpenNext on Cloudflare Workers.
- Evaluated `vinext` v1.4.6; verified incompatibility blocker with Vite 8 / Rolldown / legacy Wrangler mode (`virtual:vite-rsc/encryption-key` unresolvable import). Recorded ADR 0001 documenting selection of `@opennextjs/cloudflare` v1.20.18.
- Configured `wrangler.jsonc` with local, staging, and production environments, binding D1 database `DB`, private R2 bucket `PROJECT_FILES`, static assets, and environment variables.
- Verified Next.js App Router SSR, Server Actions, route handlers, D1 prepared batch statements, R2 object streaming, and bidirectional cookie/header handling in `workerd`.
- Implemented branded layout shell with confirmed Merveille Designs logo, profile image, design tokens from `assets/brand/brand.css`, responsive navigation rail, and accessible typography.
- Built test-only synthetic principal resolution mechanism guarded with strict fail-closed production checks.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-064 | `npm test` | PASS | 10 unit/integration tests passing (principal security, formatting, runtime spike) |
| AC-064 | `npm run build && npm run build:worker` | PASS | Next.js build and OpenNext bundle generation to `.open-next/worker.js` |
| AC-064 | `npx wrangler dev --port 8787` & `curl http://localhost:8787/` | PASS | HTTP 200 SSR render with D1 and R2 bindings active |
| AC-064 | `curl http://localhost:8787/api/runtime/spike` | PASS | HTTP 200 JSON with D1 prepared query, R2 stream put/get, cookie & header verification |
| AC-064 | `curl -X POST -H "Content-Type: application/json" -d '{"test":"mutation-proof"}' http://localhost:8787/api/runtime/spike` | PASS | HTTP 201 Mutation verified in workerd D1 |
| AC-064 | `curl -H "x-merveille-synthetic-principal: owner" http://localhost:8787/api/runtime/spike` | PASS | HTTP 200 with resolved `OWNER` principal |
| AC-064 | `curl http://localhost:8787/merveille-designs-logo.png` | PASS | HTTP 200 brand artwork served via Cloudflare Assets |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 158 repository files |

## Remaining work

- P00 exit gate is fully satisfied.
- Ready to proceed to P01: Identity, invitations and permission foundation.

## Recovery impact

- No remote Cloudflare resources deployed during local spike.
- All bindings configured locally with zero external credential requirements.
