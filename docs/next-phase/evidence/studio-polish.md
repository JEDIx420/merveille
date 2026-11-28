# Portfolio and control polish — 28 November 2026

Implemented on `codex/studio-workspace` under the accepted portfolio/control amendment in [studio workspace](../../design/studio-workspace.md).

## Behavior

Projects has a six-stage architectural Board, structured Cards and compact List, with locally remembered selection. Canonical/historical stage labels remain visible; stage changes stay in the existing manager command workflow. Manager Review stage links to the stage timeline. Project identities, favorites, status/stage badges, manager and progress have explicit layout slots. Empty lanes do not invent records.

Shared keyboard-native selects have consistent chevrons/padding; Radix filter/density/saved-view popovers restore trigger focus. Checkbox sizing no longer inherits search-input flex sizing. Mobile quick entry gets its own row. Group/Sort remain visible; active filter summaries can be cleared. Shared task controls cover Home, My Tasks and project Tasks; retained specialist controls inherit the consistent select treatment.

Automations is visible in internal primary navigation and project tabs. The new hub reuses existing permission predicates and API scopes; archived projects and external identities do not receive project rule entry points. Existing deterministic execution and Gemini flags remain disabled. No migration, job activation, paid provider or external messaging change.

## Local verification

- Typecheck and OpenNext Workers build passed.
- 170 unit tests across 34 files passed.
- 16 actual workerd/D1 groups passed, including authority, immutable drawing release, financial history and recovery checks.
- 278 dedicated built-Worker browser checks passed; results and selected **fictional** screenshots: [studio-polish](studio-polish/results.json). Covers stages, zero/one/many projects, long names, List/Cards persistence, four viewport widths, checkbox bounds, Escape/focus restoration, grouped task views, actual builder simulation, read-only controls, internal navigation, external hub denial and 200% CSS zoom.
- Broader browser checks: 132 records per theme, no page overflow, JavaScript errors or button contrast failures. These are local fictional API fixtures, not hosted identity or team UAT evidence.

Rendered screenshots were inspected directly in dark/light desktop and mobile layouts. Review corrected cramped mobile task entry, redundant utility navigation and inconsistent card alignment. CSS zoom is explicitly a layout check, not a claim of every browser's native zoom behavior.

## Hosted status

Pending final protected studio Preview update and ingress verification. The Preview shares staging D1/private R2 records. Original UAT deployment, jobs, Access admission and all activation/UAT/Free-runtime gates remain unchanged. No real task, rule, stage transition, invitation, approval or message is created for demonstrations.
