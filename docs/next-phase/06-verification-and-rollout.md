# N05 — Verification, migration and rollout

Use [the work order](README.md) and [manifest](manifest.json). This document defines required evidence, not completed results. Record hosted and team checks separately from local implementation. Old remediation test totals must not be reused as evidence for new behavior.

## Acceptance cases

Each case needs an observed result, relevant commit/environment and concise evidence. Automated tests should exercise behavior and meaningful failures; screenshots or source-string matches cannot substitute for authorization, durability or quota checks.

| ID | Required behavior | Primary stage |
|---|---|---|
| NAC-001 | Inventory routes, features, current data/migrations, account plan, storage, Access seats and source baseline; preserve existing business authority | N00 |
| NAC-002 | Representative authenticated requests, mutations and scheduled batches fit actual Free CPU and service limits; quota exhaustion blocks affected work without paid fallback | N00 |
| NAC-003 | Today/My Tasks/Projects and List/Board/Calendar share canonical records; project-manager assignment/deadline/reopen rules, private personal ownership, explicit scope transitions and keyboard alternatives work | N01 |
| NAC-004 | Each real role sees only its authorized data, search results, counts, files and notifications; consultant approval and manager release refer to the exact drawing revision | N01 |
| NAC-005 | External-commercial clearance is ADMIN-recorded, version-bound and auditable on correction/revocation; client acceptance and manager authorization remain required; server billing cutover preserves historical records | N01 |
| NAC-006 | A lead can be saved with name and note, followed up and handed to authorized project setup without fake contact data or automatic activation | N02 |
| NAC-007 | Spreadsheet preview, mapping, date/phone preservation, duplicate review, interrupted import, export and conditional undo work without losing later edits or triggering historical messages | N02 |
| NAC-008 | Real speech produces a reviewed note/field proposal; names, numbers and dates remain confirmable; unsupported audio, denial, cancellation and ambiguous fields fail honestly | N03 |
| NAC-009 | Concurrent voice requests and retries cannot exceed the app's reserved budget; model unavailability/exhaustion keeps the draft and never calls a paid service | N03 |
| NAC-010 | Reminders survive duplicate/out-of-order/retried work, cancel stale obligations, respect current membership and keep each recipient's read state independent | N04 |
| NAC-011 | Copy/Open/Share use only the published exact resource; clipboard denial is usable; staff choose the group and send; no WhatsApp dispatch row/call or fabricated delivery status is created | N04 |
| NAC-012 | Populated migration and restore preserve records, immutable drawing bytes, permissions and history; backups run within quota and stale success is visible | N05 |
| NAC-013 | Company Free-account installation and real-role desktop/mobile pilot pass applicable gates, with a documented rollback and honest outstanding limitations | N05 |

## Verification sequence

1. **Baseline first.** Record the current commit and clean/dirty state, dependency lockfile, bindings and applied migrations. Read the actual current results before deciding which failures are pre-existing. Preserve unrelated local changes.
2. **Per vertical slice.** Run affected domain/authorization/integration cases, type checks and browser journeys that resolve a concrete risk. Test the unauthorized path and concurrency where the command changes business state. Do not repeatedly run every historical browser scenario after each small UI edit.
3. **Workers compatibility.** Build with the existing `build:worker` script and run the relevant workerd/HTTP checks. Node development passing does not establish Workers compatibility. A local runtime passing also does not establish hosted Free CPU, quotas, identity policy or model access.
4. **Integrated local candidate.** Run the current repository's applicable typecheck, tests, Worker build and browser suite. Fix regressions introduced by the change. Record pre-existing failures separately with enough evidence to reproduce them. Keep test-only actors/fixtures outside deployed sign-in paths.
5. **Authorized hosted candidate.** On the actual Free account, measure representative cold/warm page/API requests, bounded import chunks, file operations and scheduled jobs; test supported voice models and quota accounting. Record p50/p95 and worst observed CPU where available, tested workload size and remaining headroom. A p95 below 10 ms alone does not excuse observed 10 ms limit failures. Do not run an unbounded load test that risks exhausting the account.
6. **Real-user pilot.** Staff, manager, consultant, main client, representative, ADMIN without OWNER and OWNER without ADMIN use their actual authorized identities with fictional business data. Include a revoked/unrelated account. If the people/devices are unavailable, mark that evidence blocked and finish other work; never demonstrate access by impersonation.

Existing scripts include `npm run check:handoff`, `npm run typecheck`, `npm test`, `npm run build:worker`, `npm run test:workerd`, `npm run test:http` and `npm run test:browser`. Inspect each script's setup and environment before execution; do not assume an integration script is safe against production. Add targeted scenarios for genuinely new behavior, not tests that merely repeat implementation strings.

## Migration and recoverability

Use new numbered migrations; never edit applied SQL. Rehearse from a populated representative baseline with tasks, enquiries, converted projects, released/review drawing versions, file objects, archive records and commercial history. Capture row relationships and object checksums before and after. Use synthetic local fixtures for public test evidence; private real backups must not enter Git or screenshots.

Backfill explicit task visibility and legacy lead stage mappings conservatively. Preserve IDs and old URLs. Keep unknown imported access unresolved. The external-billing cutover must preserve accepted versions and existing obligations; it must not insert fake payments or automatically mark history complete. Do not run historical announcement, reminder, WhatsApp or celebration side effects during backfill.

Before production schema changes, confirm a current recoverable database snapshot plus referenced private file bytes and manifests. Implement the already outstanding scheduled-backup and stale-success monitoring work using bounded jobs within the Free budget. Keep at least a verified current checkpoint and a prior recoverable checkpoint; choose and document retention after measuring real bytes, including rotation overlap. Content-addressed/incremental file copies may avoid repeatedly storing immutable drawing bytes. A manifest that points only to the live bucket is not an independent file backup.

Exercise restore in an isolated authorized target. Verify a representative released drawing byte-for-byte, lead provenance, task state, current grants, archived access and history. Preserve the existing restore quarantine and suppression of message/celebration replay. Document restore time and the actual recoverable checkpoint interval; do not claim a recovery guarantee from D1 Time Travel alone. If a safe backup cycle cannot fit the R2 envelope, reduce admitted capacity or block production changes instead of deleting history or skipping backups.

Document app rollback compatibility for each migration. A rollback can disable new UI/voice/manual share while retaining additive data. It must not drop user records, recreate the database, broaden Access policy or reactivate old WhatsApp dispatch. Restore is a controlled recovery operation, not an ordinary deploy step.

## Free-tier release evidence

Use one concise capacity record including:

- Actual Free plan and account-wide inventory, including other apps, staging and reserved identities.
- Measured occupied/reserved Access seats and invitation admission behavior.
- Primary, historical, import, temporary, multipart and backup bytes; Class A/B usage; upload reservations and stale-reservation cleanup.
- Dynamic requests, Worker CPU/memory, indexed D1 read/write usage, database sizes, Queue operations and durable replay after delay.
- Supported model IDs/licences, actual Free model availability, recorded audio duration, bounded input/output accounting including reasoning, conservative retry treatment and neuron reconciliation.
- Demonstrated fail-closed states for storage, database, AI and admission exhaustion; existing saved work stays intact. No hidden paid plan, credit purchase or external provider fallback.

Scope the quota controls honestly. Published allowance figures are checked on 27 November 2026; reverify them. Local counters cannot police unrelated account operators. R2 has no demonstrated provider hard zero-overage cap, so record its metered-subscription constraint and actual activation authorization. If that constraint prevents this installation from meeting the user's strict requirement, mark production storage blocked and explain the precise issue; do not claim a guaranteed zero invoice.

## Pilot and release decision

Start with one representative project, a small synthetic lead workbook and a few real authorized users. Confirm that normal staff can find their tasks, add a lead, review dictated text, follow up, release through the existing approval chain and copy an update without coaching. Ask them to use their actual phone/desktop browsers and normal network; do not assume a development laptop proves mobile voice quality.

Use the approximately 50-recording corpus from document 04. Reuse at least 30 representative samples across the desktop and phone support tiers actually claimed, recording correction burden and latency; choose explicit additional language/code-switch samples only for claimed support. Reuse the corpus rather than asking for 50 new recordings per device, and spread inference across quota windows where needed. Failure against the proposed targets means improve or explicitly narrow supported scope, not promise Wispr-equivalent quality. Test a real manual paste into a permitted test chat only when the current session explicitly authorizes sending; otherwise verify text/copy and leave the human send check pending.

The company installation needs real resource bindings, Access policies, allowed identities and account ownership separate from Jay's staging. Do not copy staging IDs or secrets into a claimed production setup. Missing account details are an input gate, not a reason to introduce demo auth or purchase services.

Production readiness requires NAC-001–NAC-013 at their appropriate local/hosted/team levels, current backups, no unresolved material permission/data-loss defects and an agreed supported capacity. Actual hosted/team checks may remain blocked when necessary inputs are absent; the agent still completes independent implementation and leaves an exact handoff. Old official WhatsApp API/webhook/provider gates are deferred, not passed. Google Cloud/OAuth, paid transcription and billing integration are not prerequisites for this phase.

## Evidence and final report

Keep dated evidence under [evidence/](evidence/README.md), linked from the manifest. Record commit, environment, cases/commands, observed outcome, screenshots where useful and limitations. Update each stage's `implementation`, `localVerification`, `hostedVerification` and `teamAcceptance` independently. `passed` requires supporting evidence; `blocked` names the missing input or failed constraint and an exact next action.

Finish with a short change summary, commits/branch, verified journeys, supported free-tier envelope, available preview, outstanding inputs and the next step. A code-complete handoff with honest blocked hosted tests is useful; a fabricated deployment or acceptance claim is not.
