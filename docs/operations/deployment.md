# Build, deployment and release procedure

This is the future implementation procedure. The repository initially contains a plan and assets, not a runnable portal. No application test/build/deploy result should be claimed until that phase is implemented and evidence is recorded.

## 1. Establish a supported runtime

Read the current official [Next.js on Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) and the architecture [compatibility spike](../architecture/overview.md). Pin package manager, supported Node version, React/Next.js conventions, vinext adapter/tooling and Wrangler. Check package engine requirements rather than using an arbitrary old Node release. Retain a lockfile.

Generate the project in an isolated path/branch and transfer the scaffold intentionally, preserving this handoff. Some scaffold commands offer immediate deployment; choose the non-deploying option while implementation is local. Avoid installing an unreviewed agent skill merely because a guide advertises it; the ordinary CLI/config path is sufficient.

If a proven compatibility blocker requires OpenNext, record the alternative in an ADR with reproduced failure, selected supported versions, runtime test and migration cost. The current framework recommendation is not a substitute for a tested production readiness decision.

## 2. Create truthful scripts

After the scaffold exists, provide stable repository scripts for local dev, formatting/lint, type checks, unit/domain tests, local D1 migration, Worker integration tests, end-to-end tests, build, Workerd preview, binding type generation and explicitly named staging/production deploys. Their actual commands depend on the pinned scaffold. At handoff time none of those npm scripts is claimed to exist.

Avoid implicit deployment from `dev`, `test` or a default install hook. Separate local migration from remote migration. Show target environment/database clearly in scripts that affect remote data. A public preview must use synthetic data and equivalent access protection.

## 3. Verify locally

Exercise the actual Workers runtime, not only Next.js's Node dev server. Migrate an empty local D1 database and an existing-data fixture. Verify D1 transactional guards, foreign keys, R2 chunking/ranges, fake Access identities restricted to local mode, and queue retries. Use synthetic demo projects with each role, project overlaps, private updates, consultant financial access, superseded drawings and an archived project.

Local verification should include visual checks on desktop and a narrow mobile viewport, keyboard navigation, empty/loading/forbidden/error states, file progress and the primary end-to-end domain journeys. The required journeys are those in the implementation and workflow specs, not simply a successful homepage render.

## 4. Provision staging intentionally

Only once resource creation/deployment is within the user's authorized task scope, create explicit staging resources and record non-secret IDs in the staging configuration. Create separate Access policy/audience and test its complete invite/disable lifecycle. Configure no public R2 access. Set WhatsApp fake/test mode and a recipient allowlist.

Run remote migrations on the confirmed staging database, deploy the web/jobs components, then test login, role separation, release gates, a realistic large upload and private download. Verify alternate Worker hostnames do not bypass identity. Capture logs without private data or credentials. The report must distinguish local fake tests from remote provider tests.

## 5. Production readiness

Before production data is accepted, the owner inputs in [environment setup](environments.md) must be configured. Validate backup exports and restore to a fresh non-production environment. Validate the live sender/template setup using only authorized test recipients. Review cost/limit monitoring and fail states; no fixed monthly price is promised in this plan.

Release readiness requires server-side cross-project and sensitive-finance tests, no unresolved critical integrity failures, a usable admin recovery path, operational documentation and a rollback/recovery plan. Record outstanding limitations honestly; “frontend finished” is not “project complete.”

## 6. Release changes

Deploy backward-compatible schema additions before code that requires them. If a migration needs destructive transformation, prepare the exact data migration/backup/recovery procedure and obtain the authorization required for that specific action. Do not treat a generic build instruction as permission to delete production data.

Record commit SHA, versions, environment, migration set, deployment identifier and test evidence. Apply a controlled deployment, verify authenticated key journeys and inspect scheduled/queue health. If frontend/backend versions coexist during rollout, command contracts must stay compatible.

## Rollback strategy

Code rollback and data rollback are different. Rolling the Worker to an older version does not undo D1 writes or restore R2 objects. Prefer forward fixes or backward-compatible code when new records have already been created. Use database restore only after impact review and an explicit recovery point, because it can discard later legitimate work. Reconcile audit/outbox/provider effects after any restore. The [backup procedure](backup-and-recovery.md) covers recovery evidence.

## Completion report

The implementing agent reports implemented features by requirement/phase, tests run and results, real deployment URL/environment if deployed, unresolved setup inputs, known limitations and the exact next action. It must not claim production readiness solely from type checks, mock screenshots or a successful build.
