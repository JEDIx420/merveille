# Simple workspace implementation evidence

Date: 27 November 2026. Branch: implement/merveille-portal. Baseline: 2a8a038. Source `1461c4d` (main implementation `b9d9af2`, permission cleanup `73240ec`, copy cleanup `7eeb123`). Local verification complete; targeted hosted review passed, deployed versions recorded below. Not a team acceptance claim.

## Implemented

- One shared task workspace for My Tasks/project tasks and compact Home work, with List, movable Board, real month/week calendar, personal view preference and search/filter controls.
- Shared native-dialog side panel used by task views, Home and task links in Inbox. Comments/files, checklists, one-level subtasks, controlled assignment/deadline/completion/block/reopen actions and owner-only private details. Failed writes reload current data without clearing drafts; explicit dismissal warns about unsaved text.
- Home recent projects/decisions/progress, concise unread/all Inbox, searchable project list/cards and personal favorites, secondary workspace tools and project More navigation.
- Authorized non-cancelled progress totals/eight-week completion-event graph; no private personal task aggregation or external task visibility. Existing drawing detail/revision/release workflow moved into the shared side-dialog presentation.
- Voice forms removed; endpoint returns 410 before binding/audio/quota access; web AI binding removed. Dormant inference code/history retained. No external billing activation, messages, permissions or production provisioning performed.
- Additive migration 0028: workspace preferences and owner-scoped personal-task comments. Existing data unchanged. Existing backup schema traversal includes these tables and retains quarantine on restore.

## Verification

- `npm test`: 144 tests / 31 files passed. `npm run typecheck`, Workers build, handoff checker and diff whitespace check passed.
- `npm run test:workerd`: 13 actual workerd/D1 checks passed through all 28 migrations, including private task details/revision guards, preferences, scoped progress and existing financial/file/identity/recovery checks.
- `node scripts/check-simple-workspace.mjs`: final 150 isolated fictional browser checks passed across Dark/Light and 1440/1024/390px. Includes List/Board/Calendar, native drag-and-drop and select-based transitions, comments/checklists, conflicts preserving draft text, Escape/unsaved-text dismissal, keyboard tab arrows, reduced motion, saved view, favorites, Inbox links/read state, button contrast hiding unavailable transitions, failed-detail retry and client favorites opening the authorized overview. No JS errors or page overflow.
- Broader `test:browser` runs passed 132 records per theme (264 total), including prior release/access/financial/appearance routes. Those full runs preceded the final two-condition hiding of unavailable board controls; the final 150-check suite covers that correction. No overflow, JS errors or enabled-button contrast failures. Results in ignored `.private/simple-regression-{dark,light}/browser-results.json`.
- Built OpenNext Worker served locally with Wrangler: 15 real HTTP privacy/retirement cases, root redirect and login containment passed. New workspace/private-task/progress endpoints rejected anonymous requests with private/no-store; voice returned 410. The first HTTP run used localhost Origin against a staging-canonical configuration and correctly received CSRF 403; the harness now accepts an explicit canonical test Origin without weakening application checks.
- Logs: `.private/simple-{tests,typecheck,build,workerd,browser,http,handoff}.log`. Public fictional screenshots/results: [simple UI](simple-ui/results.json).

Rendered review caught over-wide quick-add controls and a horizontally clipped phone calendar; corrected responsive rules before final verification. The legacy drawing test attempted to click behind the new modal detail panel; updated it to close the detail panel before Add drawing. This initial timeout is not a pass.

Public screenshots contain fictional fixture records only. Private logs/Cloudflare exports and any real-account screenshots stay ignored. Existing Free CPU measurement, multi-person UAT, separate company installation, scheduled backup monitoring and populated remote recovery remain open. Retired voice acoustic/model verification is outside the accepted scope.


## Hosted staging verification

`wrangler whoami` confirmed the pinned account. Exported the actual staging D1 database to ignored `.private/simple-pre-migration.sql` before applying only additive migration 0028. Migration applied successfully; no data-clearing or commercial-mode command ran. Web deployment has no AI binding; jobs are unchanged and WhatsApp remains disabled.

Actual signed-in Chrome review passed: new Home/navigation, project list with real scoped counts, Board and Calendar, existing task detail/current permission controls, project progress, More destinations and Inbox activity. Board selection persisted through reload after the asynchronous preference request completed; restored the account's original List view afterward. The initial request arrived before deployment propagation and showed the prior UI; reload after upload/trigger completion showed the new version. No task/comment/checklist, notification read-state, permission, financial or external-message mutation was submitted in this review. Real-account proof stays private under `.private/simple-live-*.png`.

Hosted anonymous workspace/progress/voice requests redirected to configured Cloudflare Access. The actual account review exposed an unnecessary single-option move selector for an ADMIN without manager/assignee authority; final source hides that selector and drag capability while retaining comments/internal read access. A dedicated browser regression verifies both conditions.

Remaining: distinct-person staff/manager/client/consultant UAT, actual Free CPU workload measurement, company-owned installation, backup automation/monitoring and populated remote recovery. Existing exact-version drawing/business gates are preserved, not waived. Voice pilots are retired from this delivery. No production rollout occurred.


Final hosted cleanup on version `94205cec-a0e2-4e28-af1b-9e0ecdb76f59` verified zero unavailable move controls and zero draggable cards for the actual read-only-status account. The original List preference was restored and the updated staging tab left open. Final follow-ups remove a stale Leads voice invitation, add task-detail retry rather than an indefinite error spinner, and route client/consultant favorites to their authorized project overview. The final 150-check browser suite covers these flows; client project-list tests also verify internal task/member aggregates are omitted. The saved-view browser assertion now waits for the asynchronous selected state instead of testing the initial default before preferences load. Its Workers build is separately logged in `.private/simple-build-final.log`.

Rollback: use a previously verified simplified deployment with voice already disabled; retain additive migration 0028 and all records. Do not roll back to a voice-enabled build or drop tables.

Final web deployment: `364b339c-36d3-4b6f-8362-1516e9cd2d19`, source `1461c4d`, protected staging only. No further migration or jobs deployment.

Final signed-in browser read-back on source `1461c4d` confirmed Home data/progress loaded and Leads had no voice controls/copy or page overflow. Updated Home is left open for review.
