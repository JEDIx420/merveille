# R03 operational repair evidence — local verification

Branch: `implement/merveille-portal`, base `82921d6`. Date: 24 November 2026.

Implementation includes independent ADMIN/manager archive authority, guarded archive/reopen batches, prior lifecycle retention, confirmed-receipt-only archived allocation through the normal financial service, scoped archived commercial visibility, durable notification/outbox pairs, scheduled Queue publication and consumer, dispatch leases, bounded known-safe transient retries, uncertain-result reconciliation, verified contact/consent requirement, exact-byte signed webhooks and monotonic delivery state. No product route constructs a fake adapter. Missing delivery setup records unavailable; provider acceptance records SENT, never DELIVERED.

Recovery now creates an organization checkpoint, including cross-project accounting dependencies, in a separately protected R2 backup binding. A D1 batch takes the row snapshot. Source objects are copied into bounded 8 MiB independent segments with SHA-256 hashes and a completion manifest. Missing bytes invalidate the checkpoint. Restore checks segment and manifest hashes, copies recovered bytes into an isolated destination and quarantines all restored users/grants/invitations/outbox state. Current identity/access reconciliation is mandatory before opening access. It deliberately does not restore identity credentials or bootstrap access.

## Commands and observed results

- `npx vitest run tests/remediation/operations.test.ts`: PASS, 7 tests. Includes logical scan deduplication/admin escalation, missing provider/contact state, project revocation suppression, no blind retry of uncertain delivery, monotonic duplicate webhook processing, manager archive authority, independent-byte restore after deleting source, quarantined permissions, missing-source and corrupt-backup failures.
- `npx vitest run tests/integration/notifications/p11-notifications.test.ts tests/domain/archive/p13-archive.test.ts`: PASS, 8 tests updated to current rules. Prior fabricated receipt-free settlement and source-bucket manifest-only restore expectations were replaced with confirmed financial allocation and independent-byte recovery.
- `npx wrangler deploy --dry-run --config workers/jobs/wrangler.jsonc`: PASS, Wrangler 4.167.0 bundles the separate scheduled/queue worker. No remote deployment or resource creation.

The test database adapter now enables SQLite foreign keys and returns SELECT/PRAGMA rows from batches, matching D1 result structure. This is local SQLite evidence, not a substitute for the workerd drill recorded separately.

## Open external gates and practical limits

- Jobs configuration is local-only. Hosted D1/Queue/dead-letter resources and environment-specific names must be configured and verified before scheduling real work.
- Google/Access dedicated policy credentials and exact-email administration require authorized setup. Scheduled admission reconciliation is implemented but unverified against the actual provider. Application revocation is immediate in D1; external Access session revocation remains a separate operational action.
- WhatsApp remains disabled until real platform secrets, graph version, templates, verified consent/contact and explicitly authorized test recipient exist. No live messages were sent.
- Separate protected backup storage and operator restore environment are not provisioned. Remote Cloudflare recovery, access reconciliation, retention permissions and restored integration credentials remain blocked gates.
- Recovery supports a bounded 20 MiB JSON row manifest and streams file segments; larger checkpoints fail explicitly and require a controlled operator export rather than risking Worker memory. Source files must be immutable as enforced by their parent workflows. Large real-world checkpoint duration/subrequest limits require hosted verification.

## Actual Workers runtime drill

`node scripts/check-workerd.mjs`: PASS in real local `workerd`, with separate source and restore D1 bindings and three local R2 buckets. The script creates fresh ignored state under `.private/workerd-tests/<timestamp>`, applies all migrations to both D1 databases using `--local`, starts the isolated test worker, runs the service commands and stops the worker. This harness is absent from application routes and deployment configuration.

Observed checks:

1. Injected final failing CHECK into an actual D1 invoice-issue batch. Parent remained approved; number and journal/sequence remained absent.
2. Successful issue and replay retained one invoice number and one journal source.
3. Parallel allocations of 700 minor units against one 1000-unit receipt produced exactly one winner and 300 remaining.
4. Injected failed drawing-release batch preserved the prior released version and current pointer.
5. Successful drawing release and replay produced one release audit.
6. Independent backup restored actual R2 object bytes after source deletion, complete invoice/receipt/allocation/journal records, 300 remaining, and zero active restored memberships.

The first drill exposed destination audit triggers generating duplicate outbox events during restore. Restore now disables and reinstates destination triggers inside the same atomic row-import batch; replay does not invent new business events. The drill passed after this fix.

`npx wrangler d1 migrations apply DB --local --config workers/jobs/wrangler.jsonc --persist-to /tmp/merveille-operations-workerd --force`: PASS through migration 0015. `npx wrangler dev --local --config workers/jobs/wrangler.jsonc --persist-to /tmp/merveille-operations-workerd --test-scheduled --port 8793 --inspector-port 9293`, followed by GET `http://localhost:8793/__scheduled`: HTTP 200, “Ran scheduled event.” All bindings reported local. This proves the scheduled handler executes; it is not hosted Queue/provider delivery evidence.

## Extended identity concurrency drill

`node scripts/check-workerd.mjs`: PASS, **nine actual-workerd checks**, applying migrations through **0016** to three isolated D1 bindings (`DB`, `RESTORE_DB`, `IDENTITY_DB`). The original six financial/drawing/recovery checks remain passing. The three added identity outcomes are:

- Concurrent acceptance of the same bootstrap token with the same exact identity produces one accepted initial ADMIN and a consumed singleton.
- Removing the temporary operator setup row cannot reset bootstrap: another setup fails against persisted consumed state.
- Additional ADMIN invitation requires explicit elevation confirmation and recent authentication. After an explicit test-only admission-ready step and identity acceptance, concurrent administrators trying to suspend each other produce one successful suspension and retain one active accepted administrator. The guard counts accepted identity bindings, not seeded or pending users.

The test calls the service with fixture `AccessJwtPayload` values representing an **already verified boundary**. It does not add an authentication fallback to the app, fetch Google identity, validate a live Access policy, or prove hosted provider setup. Real Google sign-in, exact-email edge admission, account binding and team UAT remain separate blocked integration gates.
