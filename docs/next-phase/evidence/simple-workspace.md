# Simple workspace implementation evidence

Date: 27 November 2026. Branch: implement/merveille-portal. Baseline: 2a8a038. Current verification in progress; not a team acceptance claim.

## Implemented

- One shared task workspace for My Tasks/project tasks and compact Home work, with List, movable Board, real month/week calendar, personal view preference and search/filter controls.
- Shared native-dialog side panel used by task views, Home and task links in Inbox. Comments/files, checklists, one-level subtasks, controlled assignment/deadline/completion/block/reopen actions and owner-only private details. Failed writes reload current data without clearing drafts; explicit dismissal warns about unsaved text.
- Home recent projects/decisions/progress, concise unread/all Inbox, searchable project list/cards and personal favorites, secondary workspace tools and project More navigation.
- Authorized non-cancelled progress totals/eight-week completion-event graph; no private personal task aggregation or external task visibility. Existing drawing detail/revision/release workflow moved into the shared side-dialog presentation.
- Voice forms removed; endpoint returns 410 before binding/audio/quota access; web AI binding removed. Dormant inference code/history retained. No external billing activation, messages, permissions or production provisioning performed.
- Additive migration 0028: workspace preferences and owner-scoped personal-task comments. Existing data unchanged. Existing backup schema traversal includes these tables and retains quarantine on restore.

## Verification

Preliminary local: 144 tests/31 files and TypeScript passed. Actual local workerd/D1 run passed 13 checks including personal details/privacy/revisions, preferences and progress. New isolated fictional browser harness passed 100 checks across dark/light and 1440/1024/390px before final layout refinements. Final reruns and hosted outcome will be recorded before completion.

Rendered review caught over-wide quick-add controls and a horizontally clipped phone calendar; corrected responsive rules before final verification. The legacy drawing test attempted to click behind the new modal detail panel; updated it to close the detail panel before Add drawing. This initial timeout is not a pass.

Public screenshots contain fictional fixture records only. Private logs/Cloudflare exports and any real-account screenshots stay ignored. Existing Free CPU measurement, multi-person UAT, separate company installation, scheduled backup monitoring and populated remote recovery remain open. Retired voice acoustic/model verification is outside the accepted scope.
