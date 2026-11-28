# Studio workspace implementation evidence — 28 November 2026

Accepted contract: [studio workspace](../../design/studio-workspace.md), extending the simple workspace and appearance amendments. Work is on `codex/studio-workspace`, based on `18651b8`. Core source `3f9d7a0`, focused template/preview correction `6657de3`, final application source `8f257a5`.

## Implemented

- Charcoal studio surfaces, refined typography/spacing, restrained project identity and initials, compact responsive task controls, connected selection/panels and retained original logo/themes/status colors. Motion and popovers use pinned MIT Motion 14.14.0, dnd-kit React 0.5.3 and Radix Popover 1.3.1; [licenses](../../implementation/studio-dependencies.md) retained. Existing original milestone celebrations stay permission-aware; quiet/off preferences also reduce interface motion.
- Shared task grouping/sorting/density, named private views, controlled labels, task/checklist templates, contextual title/assignee/date commands, accessible board handles/overlay/drop feedback, keyboard cancellation, scoped quick navigation and current-release drawing cards. Existing workflows remain secondary and retain their authority. Templates and new task creation commit together.
- Project/personal rule templates/manual builder, optional generic AI drafting, local person binding, side-effect-free simulation, versioned publication, pause and run history. Managers alone publish shared rules; private routines belong to their owner. Three supported deterministic actions: create/assign a task with a relative deadline, internal reminder, task label. No drawing/commercial/publication decision or external messaging action is exposed.
- The existing jobs source invokes the bounded runner only when explicitly enabled. Each effect rechecks live authorization, rule publication, source version/state, recipient membership and archive state in the same D1 transaction as its idempotency marker. Explicit system audit records authorizing publisher; no synthetic session. Generated tasks cannot chain rules. Retries keep a stable scheduled occurrence and preserve earlier successful effects. Restore quarantines rules as paused.
- Closed AI schema and independent validation, server-only secret, generic-only confirmation, bounded request/output, 10/person/day and 50/org/day admission, no automatic entity context, no paid fallback. Actual provider setup remains pending.

Changed areas: `src/components/workspace`, shared UI/shell/themes, tasks and drawings services, new `src/server/automations`, new studio/automations/automation-drafts APIs, existing notification visibility and jobs handler, migration 0029, tests, operator rollout guide. No existing record or applied migration was deleted.

## Local verification

- `npm test`: **170 tests, 34 files passed**. New tests cover unsupported actions/schema, IST scheduling, private rules, real SQLite permissions, atomic templates, overdue/due deduplication, revocation/archive/pause, immutable live publications, caps, generated-task loop prevention, partial-effect retry and generic-AI privacy/quota/failure boundaries. AI requests are mocked here; this is not a real Gemini pass.
- `npm run test:workerd`: **16 actual workerd/D1 verification groups passed** through all 29 migrations, including two new studio groups and an explicit restored-rule quarantine check. Existing financial rollback, drawing release, backup bytes and quarantined recovery regressions remained green.
- `npm run build:worker` and type checking passed. The isolated local Preview runs the actual OpenNext Worker using local bindings, not Node development or a deployed synthetic identity.
- `node scripts/check-studio-workspace.mjs`: **168 checks passed**; final result in [studio browser evidence](studio-ui/results.json). Both themes and 1440/1024/390 widths; task views/panels, pointer and keyboard drag/cancel, reduced motion, contrast, retry/conflict draft retention, saved views, private/external destinations, rule simulation/publication UI and AI-unavailable fallback. All API fixtures and screenshots are fictional and localhost-only.
- Broader `scripts/check-browser.mjs`: **132 records per theme, 264 total**, zero overflow/JS errors/button-contrast failures across specialist/administrative/client screens. The checker now accepts the descriptive drawing-card accessible name and the accepted desktop typography (mobile inputs still 16px). Results remain private, with a sanitized summary recorded in the checkpoint. These preceded the last new-rule-builder-only refinement; the dedicated suite reran afterward.
- Five anonymous HTTP checks on the built Worker rejected the three new API families with 401 and private/no-store. Hosted ingress checks are separate below.

## Hosted verification and remaining gates

Wrangler identity/account and Workers Free current plan were checked. The existing `merveille-web-staging` Worker Access screen showed **All traffic**, production and previews, using the existing exact-email policy and unchanged audience. Preview routing now uses that policy. No access grant, provider permission, identity, company resource or paid subscription was created.

A private staging export `.private/studio-pre-migration.sql` completed before migration 0029, which applied 14 statements successfully. The existing 100% staging deployment remained `364b339c-36d3-4b6f-8362-1516e9cd2d19`, with an unchanged deployment list before/after Preview creation. Jobs were not deployed or activated.

Studio Preview: https://studio-merveille-web-staging.rhelo-bible.workers.dev

This is a real Cloudflare Worker Preview, with separate code/configuration but **shared existing staging D1/R2 data**, not a disposable data sandbox or version URL with version-retention expiry. The generator explicitly disables rule execution and Gemini, binds the existing staging resources and does not copy the Access administration secret.

Anonymous ingress to alias and unique deployment URLs redirected to the expected Access issuer. Jay's existing real identity reached Home, My Tasks and the private automation builder. An actual authenticated weekly-rule simulation returned one scheduled sample and “No records were changed.” Publish stayed disabled. No rule, task, invitation, business approval or message was created during this hosted review.

Not passed: representative hosted Free CPU/quota profiling of new rule execution, real Gemini/free-project verification, multi-person UAT and its usability targets, populated remote recovery/continuous backup monitoring and separate company setup. Do not convert startup time, successful Preview upload or mocked provider tests into those passes. [Rollout/handoff](../../operations/studio-automation-rollout.md) defines the remaining gates.

## Final checkpoint

Application source: `8f257a5`. Final studio Preview deployment: `f0d9bdb9-af6b-446a-92fa-01b36f6884de`, stable alias above, unique deployment `https://f0d9bdb9-merveille-web-staging.rhelo-bible.workers.dev`. All eight final alias/unique anonymous ingress checks redirected to Access; the original staging deployment list stayed unchanged. Preview metadata reported 138ms startup; this is **not** per-request CPU evidence. No platform secrets were inherited into this Preview.

[Machine-readable verification summary](studio-ui/verification-summary.json) records 170 tests/34 files, 16 workerd groups, 168 focused browser checks and the two 132-record broad runs. The final UI pass includes editing an existing saved rule, first-Escape search dismissal and read-only card access. The last server-only correction additionally suppresses default assignee reminders after reassignment; it passed real SQLite tests and the workerd regression.

Next action: existing invited team members review the studio Preview with fictional work. The unchanged original staging remains the current UAT baseline. Complete representative hosted Free rule-effect profiling and the UAT promotion checkpoint before enabling execution; configure an approved privately supplied Gemini key only after actual free-project/model quota verification. These are open activation/acceptance gates, not application passes or missing voice work.
