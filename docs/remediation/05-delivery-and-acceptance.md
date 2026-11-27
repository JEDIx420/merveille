# Delivery sequence and acceptance

**27 November 2026 next-phase scope:** [The active N00–N05 plan](../next-phase/README.md) supersedes conflicting instructions below. Use Cloudflare Free only, bounded open-source voice, external billing with version-bound ADMIN commercial clearance, and manually prepared WhatsApp messages with API delivery disabled. Preserve completed work, historical records, access/approval rules and applicable recovery gates. Older finance/provider setup and execution sequences below are retained as reference; they are not current work or permission to enable paid services.

Use [manifest.json](manifest.json) for dependencies and [task.md](../../task.md) for the session checkpoint. R00–R05 is the current work; P00–P14 remains reference history. Every stage starts **not started** in this documentation handoff. Only the implementing agent can change that status after obtaining evidence.

## R00 — Establish the actual baseline and contain demo behavior

Read the amendment and all four implementation contracts before changing shared foundations. Inspect branch/working tree, lockfile, migrations, actual routes and effective Wrangler environment. Preserve current data and application history. Inventory demo users versus legitimate identities without publishing personal records.

Run the existing typecheck/tests/Workers build in an isolated local environment and record actual outcomes, including stale or weak tests. Inspect the existing shell and the three reference routes at desktop and phone sizes using fictional records. Capture enough baseline evidence to assess the redesign; do not spend this stage creating a broad new test framework.

Implement F01 containment: remove public mutating runtime diagnostics and deployed synthetic authentication, make unauthenticated access fail closed and correct root/Overview routing. Reconcile the canonical origin and environment binding names. Do not exercise the live diagnostic GET as a health check because the audited implementation writes data. If authorized hosted access is unavailable, prepare the configuration changes and record hosted containment as pending; independent local work continues.

**Exit:** baseline commit/environment recorded; local deployment artifact has no fixture-login or unsafe diagnostic path; known failures classified honestly; next concrete actions recorded. No real clients are onboarded while the hosted identity boundary remains unverified.

## R01 — Real identity, bootstrap and people administration

Implement [02 — Real accounts](02-identity-and-real-user-testing.md): Google/Access verification, exact identity binding, one-time Jay bootstrap, invitations and edge admission synchronization, multiple administrators, current project grants, suspension, revocation and last-admin protection. Coordinate F02's capability/participant contracts before dependent screens use them.

Build sign-in, invitation states and the People workflow against the shared component foundation as it becomes available. Exact emails/configuration are private inputs; do not insert examples that become production administrators. A missing sender leads to an honest copied-link workflow. Pending Access admission must be visible and retryable.

**Exit:** positive and negative authentication/invitation cases pass meaningful local tests; role sets and project scope survive real request boundaries; a configured staging run proves invited Google access and second-admin delegation. If that staging input is blocked, record code/local completion separately and proceed with independent interface/function work. R05 and real onboarding remain blocked.

## R02 — Shared visual foundation and reference screens

Implement [03 — Premium interface](03-premium-interface.md): one token source, actually loaded licensed font, shared accessible components, AuthShell/AppShell/ProjectShell, real-user navigation and responsive behavior. Retire ineffective utility classes and undefined variable families as their consumers migrate. Do not preserve the old olive/gold/serif design through compatibility aliases.

Build functional manager overview, client project home and drawing review/release compositions using the real domain services and corrected permissions. Use typed loading/error/empty states and genuine file/photo previews. Test representative populated, empty and failed responses. Self-review screenshots and interactions against the exact contract, then continue; do not stop after these three screens to ask whether to build the rest.

R02 and R03 are intentionally parallel after identity contracts agree. Start R02 shells/components immediately, and start the relevant F02–F04 repairs when a reference screen needs them. R02's integrated drawing/financial verification waits for those repairs; R03 must not wait for R02 completion. Record partial progress and continue the dependency-ready work rather than blocking on an unfinished parallel stage.

**Exit:** all three compositions work at 1440×900, 1024×768 and 390×844; no giant stacked mobile navigation; logo/name, active nav, controls, focus and type are coherent; component and API contracts are reusable. Record actual screenshots and behavior, not source-string checks. Identity contracts must be ready, but missing provider credentials alone do not block isolated local rendering.

## R03 — Functional integrity and operational services

Execute F02–F08 in [04 — Functional repairs](04-functional-repairs.md), respecting its package order. Prioritize publication/file authorization, exact-version release, invoice/receipt/allocation integrity and scoped selectors before exposing business records. Implement durable reminders and recoverable backups, with fake providers confined to the test harness.

Preserve existing migrations and add upgrades. Verify representative existing records survive. Establish D1-supported atomic/idempotent commands rather than assuming a sequence of writes is transactional. Keep provider-dependent checks distinct from local behavior. Do not defer backend defects merely because their UI now looks complete.

**Exit:** permission, state, version, concurrency, idempotency and recovery risks have concrete evidence; actual business actions maintain audit/history; missing hosted/provider checks have precise blocked entries. Functional work may run alongside R02 after identity contracts agree, with distinct file ownership.

## R04 — Migrate every remaining route and interaction

Use document 03's full route table and the [screen specifications](../screens/README.md). Cover enquiry intake, projects/archive, people, finance/payroll/profit, performance, notifications/preferences, tasks, documents, updates, permits, quotations/payments, materials/references, changes and snags. Consolidate duplicate materials/selections navigation without losing data or breaking old deep links.

Replace native prompts/alerts, hardcoded user IDs, inconsistent tables, unstyled routes, missing labels and swallowed request errors. Every visible control must complete a permitted action or clearly describe an unavailable dependency. Remove developer acceptance IDs and runtime terms from product copy. Verify direct links, forbidden states, expired sessions, online failures, long filenames/amounts and permission-specific navigation.

**Exit:** a route inventory records migrated shared shell/components, permitted audiences, actual browser evidence and outstanding defects. All required destinations are reachable or have a documented equivalent that preserves their workflow. No orphaned legacy page is waived because it is rarely visited. Check mobile/tablet/desktop layouts and keyboard operation for the affected interaction types.

## R05 — Real-person UAT and release handoff

Finish the targeted regression checks and actual Workers-compatible build/preview. Prove integrated permission/cache/file behavior, populated-database upgrades and restoration. Configure the authorized review environment and obtain real Google integration evidence. Prepare a short team guide with the URL, sign-in steps, test accounts described privately by responsibility, fictional project and expected outcomes.

The team performs browser tasks; they are not asked to install Node, run commands or use developer tools. The coding agent performs technical checks. Use separate actual accounts/browser profiles; administrator permission changes are explicit and audited. Three people may cover successive test passes, with earlier incompatible grants removed where necessary. Add real accounts when simultaneous actors are necessary. Do not add impersonation to make the test matrix convenient.

### Browser-only team walkthrough

| Scenario | Who and what | Expected result |
|---|---|---|
| Access setup | Jay signs in; invites B/C; makes B an additional admin in a later pass | Each uses their own Google account; B can manage people after explicit elevation; no arbitrary signup/admin bootstrap |
| Scoped work | Staff opens an assigned project, records a task/update and submits a drawing | Correct project/context; safe upload; internal content stays internal; manager review is visible |
| Drawing release | Consultant reviews a specific version; manager then releases it | Client sees the released version; a new draft does not replace it; no client approval button |
| Client experience | Client/representative opens project, photos, permits, drawings and payments | Clear status and next actions; no private notes or internal costs; main-client authority remains distinct |
| Finance | Staff drafts, manager approves, staff issues; admin confirms an outside payment | Correct due/received/outstanding values and immutable history; no payment gateway |
| Site issue | Staff reports a snag with evidence; manager verifies resolution or reopens | Useful photos/location, responsibility and status; retained history |
| Revocation/archive | Admin removes a grant; later tests an authorized archived project | New unauthorized access/downloads fail; allowed archived files remain viewable/downloadable |
| Phone usability | Repeat common navigation/upload/review on a phone | Content appears below compact header; readable controls/files and recoverable errors |

The table is an accessible walkthrough, not a replacement for the full [acceptance catalogue](../quality/acceptance.md) or document 02's identity/authority cases. Record results and defects; repair failures and rerun affected checks. Team UAT pending is a distinct status, never a fabricated pass.

**Exit:** required local, hosted and team gates have evidence; real unresolved defects are fixed or explicitly documented with their release consequence; runtime/backup/recovery and access procedures are usable; final walkthrough links the actual deployment and build. If an external credential or owner action is genuinely unavailable, deliver all completed independent work and the exact remaining setup step without declaring the product release-ready.

## Evidence and progress format

For every stage record branch/commit, changed paths, actual environment/URL, commands/results, acceptance IDs, screenshots where useful and limitations. Use [the evidence template](../quality/evidence-template.md) and keep personal addresses, tokens, live drawings/payroll and authentication state out of this public repository. Fictional business data is appropriate; authentication in deployed UAT remains real.

Keep separate fields for **implementation**, **local verification**, **hosted verification** and **team acceptance**, with statuses `not-started`, `in-progress`, `passed`, `failed` or `blocked` as applicable. Update both task state and remediation manifest. Update existing acceptance JSON only when its full scenario actually passes, with evidence; add concrete checks for new Google/bootstrap/no-switcher requirements without deleting old cases to make totals green.

At a context boundary save the next exact action and any ownership/provider dependency. Continue automatically on resumption. Stop optional testing after the identified risks and required gates are resolved. The final report should explain what changed, why, what was verified and which external steps remain; screenshots alone do not establish completion.
