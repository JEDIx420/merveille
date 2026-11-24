# ADR 0001: Cloudflare Workers Runtime and Framework Adapter Selection

## Status

Accepted (Verified via Phase 00 Compatibility Spike on 2026-11-24)

## Context

The Merveille Designs portal requires a robust, responsive web application utilizing Next.js App Router conventions and TypeScript, running on Cloudflare Workers with D1 relational persistence, private R2 object storage, and Wrangler configuration as the deployment source of truth.

Cloudflare guidance previously suggested evaluating `vinext` for new applications while documenting `@opennextjs/cloudflare` as the established, supported fallback. Engineering constraints explicitly state:
1. All application compute, database, object storage, and jobs use Cloudflare, managed through Wrangler.
2. The user's explicit Wrangler choice must be preserved even if tooling defaults to the newer `cf` CLI.
3. The framework adapter must be verified in `workerd` with real local D1 and R2 bindings before proceeding with business modules.
4. The OpenNext fallback must be used when an evidenced blocker in vinext is documented.

## Spike Evaluation Results

### 1. vinext (v1.4.6) Evaluation

A full compatibility spike was executed in an isolated test environment evaluating `vinext` v1.4.6, `@vinext/cloudflare` v1.4.0, `@cloudflare/vite-plugin` v1.70.1, Vite v8.3.8, and Wrangler v4.167.0.

**Blockers Encountered:**
- **Build Resolution Failure:** During the worker bundle generation pass with Vite 8 and Rolldown, the build failed with:
  ```
  Error: [vite]: Rolldown failed to resolve import "virtual:vite-rsc/encryption-key" from "@vitejs/plugin-rsc/dist/utils/encryption-runtime.js"
  ```
  Under the legacy Wrangler setup (`--legacy-wrangler-cloudflare-init`), `@cloudflare/vite-plugin` v1 creates a custom environment whose environment name does not match the server environment expected by `@vitejs/plugin-rsc`.
- **Tooling Divergence:** Upstream `vinext` and its migration skill prioritize the experimental `cf` CLI with `cloudflare.config.ts`, directly contradicting the project's strict requirement for Wrangler configuration and deployment control.

### 2. OpenNext (`@opennextjs/cloudflare` v1.20.18) Evaluation

An identical spike was executed evaluating `@opennextjs/cloudflare` v1.20.18 with Next.js v15.5.29, React v19.0.0, and Wrangler v4.167.0.

**Verification Results:**
- **App Router SSR:** Successfully rendered Server Components in `workerd`.
- **D1 Database Binding:** Successfully executed schema migration, prepared statements, and transaction queries via `env.DB` in local `workerd`.
- **R2 Storage Binding:** Successfully executed object uploads and stream reads via `env.PROJECT_FILES` in local `workerd`.
- **HTTP Semantics:** Successfully processed dynamic cookies and headers bidirectionally.
- **Wrangler Integration:** Completely native `wrangler.jsonc` configuration with local bindings, environment separation (`staging`, `production`), and preview server.

## Decision

Adopt **`@opennextjs/cloudflare` (v1.20.18)** with **Next.js (v15.5.29)**, **React (v19.0.0)**, and **Wrangler (v4.167.0)** as the runtime foundation for the Merveille Designs portal.

## Pinned Version Matrix

| Package | Pinned Version | Purpose |
|---|---|---|
| `next` | `15.5.29` | Next.js App Router framework |
| `react` | `19.0.0` | UI component library |
| `react-dom` | `19.0.0` | DOM renderer |
| `@opennextjs/cloudflare` | `1.20.18` | OpenNext Cloudflare Workers adapter |
| `wrangler` | `4.167.0` | Cloudflare development and deployment CLI |
| `node` | `22.23.1` | Local development runtime |
| `typescript` | `5.7.3` | Type checking |
| `vitest` | `3.0.5` | Unit and integration test runner |

## Consequences

- Direct support for App Router conventions, React Server Components, Route Handlers, and Server Actions.
- Native access to Cloudflare bindings via `getCloudflareContext()` in server endpoints and pages.
- Deployment remains strictly managed via `wrangler.jsonc` and `wrangler` commands.
- Consistent local testing using Wrangler's `workerd` runtime with local D1 and R2 emulation.
