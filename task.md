# Merveille Designs — current task state

## Studio workspace — 28 November 2026

Implemented on `codex/studio-workspace`, source `8f257a5`, under the [accepted studio plan](docs/design/studio-workspace.md). Premium task/board interaction, templates/labels/private saved views, drawing cards, scoped navigation and bounded project/personal rules are implemented. Rule simulation/drafts are available; live execution and Gemini remain gated.

Protected studio Preview: https://studio-merveille-web-staging.rhelo-bible.workers.dev. It uses the existing staging data; it is not a disposable data sandbox. The original team UAT deployment remains `364b339c-36d3-4b6f-8362-1516e9cd2d19`. Migration 0029 applied after a private export, with no business-record rewrites. Jobs, policy recipients and paid plans unchanged. Actual signed-in Jay simulation succeeded without saving a rule or creating work.

Current checks: 170 tests/34 files, 16 workerd verification groups through 29 migrations, 168 dedicated built-Worker browser checks, 264 broader rendered records, typecheck/build and private HTTP/Access ingress checks. Detailed [evidence](docs/next-phase/evidence/studio-workspace.md) and [rollout/testing handoff](docs/operations/studio-automation-rollout.md) separate local, hosted and team status.

**Next exact action:** Team reviews the protected studio Preview using fictional work and existing invited identities. Before activating rules or promoting over the UAT baseline, complete actual Free CPU/account-headroom checks for representative rule effects and the UAT checkpoint. Gemini additionally needs a privately supplied key and verified project free-model quota; no key or paid fallback is installed. Carry forward existing recovery/backup/company-installation gates.


## Active simplification checkpoint — 27 November 2026

The user approved the [simple project workspace amendment](docs/design/simple-workspace.md). Home/Inbox/My Tasks/Projects replace the daily administrative interface; Leads and specialist tools stay secondary. Shared interactive task List/Board/month-week Calendar and side panel, private view/favorites persistence, progress charts and drawing side panel implemented. Voice is disabled before inference and the web AI binding removed. Manual WhatsApp, history and permission boundaries remain.

Source `1461c4d`; staging web `364b339c-36d3-4b6f-8362-1516e9cd2d19`; 144 tests, 13 workerd checks, 150 new browser checks and 264 broader regression records passed, plus built-Worker privacy checks/typecheck/build. Targeted signed-in hosted Home, Tasks/Board/Calendar/panel, saved-view reload, project directory/progress, More and Inbox review passed. Final deployment is recorded in [current evidence](docs/next-phase/evidence/simple-workspace.md). Earlier N00–N05 voice-pilot and production-authorization next-action text below is historical, not the current task. No production rollout is included.


## Active next phase recorded 27 November 2026

The current work order is [docs/next-phase/README.md](docs/next-phase/README.md), with [N00–N05 dependencies](docs/next-phase/manifest.json).

| Stage | Work | Implementation | Local verification | Hosted verification | Team acceptance | Evidence |
|---|---|---|---|---|---|---|
| N00 | Baseline and enforceable free-tier envelope | Passed | Passed | In progress | Not started | [N00](docs/next-phase/evidence/n00.md) |
| N01 | Simple workspace and preserved business authority | Passed | Passed | In progress | Not started | [N01](docs/next-phase/evidence/n01.md) |
| N02 | Simple leads and reviewed spreadsheet imports | Passed | Passed | In progress | Not started | [N02](docs/next-phase/evidence/n02.md) |
| N03 | Open-source dictation and reviewed structured entry | Passed | Passed | Blocked | Blocked | [N03](docs/next-phase/evidence/n03.md) |
| N04 | In-app reminders and manual WhatsApp messages | Passed | Passed | In progress | Not started | [N04](docs/next-phase/evidence/n04.md) |
| N05 | Integrated verification, migration, recovery and pilot | Passed | Passed | In progress | Blocked | [N05](docs/next-phase/evidence/n05.md) |

**Next exact action:** Have an invited tester (Jay / 3-person pilot) complete Cloudflare Access OTP login on `https://merveille-web-staging.rhelo-bible.workers.dev` to exercise the integrated UI, measure live Workers AI (`@cf/openai/whisper-large-v3-turbo`, `@cf/openai/gpt-oss-20b`) within the 8,000-neuron/day ceiling (~50-sample voice pilot), and authorize production provisioning.

Carry forward applicable multi-person access/business UAT, backup automation/monitoring and populated-recovery gaps. Historical automated WhatsApp/provider checks are deferred out of this phase, not passed. The previous checkpoints below retain their original evidence and statuses; their old next-action wording is historical, not the active assignment.

## Previous remediation baseline

Recorded 25 November 2026. The foundation exists on `implement/merveille-portal`; [remediation](docs/remediation/README.md) began from audited source `813ef8b765045b95ff713665a3217e4487491d75`. Its implementation/evidence is retained below. Current next-phase work does not reopen completed stages or convert blocked hosted checks into passes.

## Recorded remediation stages

| Stage | Work | Implementation | Local verification | Hosted verification | Team acceptance |
|---|---|---|---|---|---|
| R00 | Baseline and demo/diagnostic containment | Passed | Passed | In progress | Not started |
| R01 | Real accounts and admin lifecycle | Passed | Passed | In progress | Blocked |
| R02 | Neutral shared UI and reference screens | Passed | Passed | In progress | Blocked |
| R03 | Functional integrity, jobs and recovery | Passed | Passed | In progress | Blocked |
| R04 | All routes and interactions | Passed | Passed | In progress | Blocked |
| R05 | Integrated verification and real-person handoff | Passed: handoff prepared | Passed | In progress | In progress |

Dependencies and exact contracts: [active manifest](docs/remediation/manifest.json), [delivery gates](docs/remediation/05-delivery-and-acceptance.md).

## Appearance and celebrations checkpoint

- Source `7c400dd`; protected staging web `f359c8b0-2da1-4c9c-ac7e-b17fc846925d`, all 23 migrations. Existing employee/onboarding work is preserved.
- Dark-first complete app theme, Light/System controls and personal cross-device preferences implemented. Original media and logo retained. Eight preview effects and permission-aware committed business milestones implemented, with quiet external feedback, current-state filtering, atomic claims, cooldown, reduced motion and no sound.
- Actual local checks: 120 tests/24 files; 12 actual workerd checks; typecheck/Workers build; 130 full browser checks per theme plus 25 focused reruns per theme. Both-theme screenshots reviewed, zero overflow/JS errors. [Feature contract](docs/design/appearance-and-celebrations.md) and [evidence](docs/evidence/remediation/appearance.json).
- Hosted: migration/schema/index verified, deployment succeeded and new API ingress is Access protected/private. Real signed-in dark workspace and Appearance panel inspected. Chrome disconnected during attempted Light save; no hosted preference row was written at read-back. Actual signed-in save/reload and cross-device confirmation remain **unverified** until Chrome reconnects. No business records were created for visual demonstrations.

## Button contrast repair

- Source `469f909`; deployed staging web `90c31ec4-7506-4f6f-b95e-7f5a14f7398b`. Paired legacy action backgrounds with their semantic foreground, corrected seven Cancel styles and removed native gray filter backgrounds.
- Current typecheck and Workers build passed; 132 rendered browser checks per theme (264 total), including enabled button contrast at 4.5:1, Site Issues and the payment dialog. Prior domain/workerd results below were not rerun for this CSS repair.
- Actual signed-in hosted dark review verified Site Issues report/filter buttons and payment dialog Cancel/Submit; cancellation returned to the page without creating any record. Private real-account screenshots stay ignored. Team UAT and existing R05 gates remain open.

## Current checkpoint

- Current branch: `implement/merveille-portal`. Existing logo, Next/OpenNext and Wrangler foundation preserved. Latest deployed web `90c31ec4-7506-4f6f-b95e-7f5a14f7398b`; jobs `de09aa26-c792-41d0-9b21-d91e7d6faa3b`.
- Protected staging: https://merveille-web-staging.rhelo-bible.workers.dev. User completed Cloudflare One-time PIN login. Existing initial ADMIN retained; OWNER endpoint denied. Last-administrator removal denied with clear guidance and unchanged atomic guard. Google Cloud configuration is no longer required for team sign-in.
- Explicitly approved single-policy Admin credential is installed only in web/jobs platform secrets. Temporary transfer file deleted. Unrelated policy GET denied 403; actual People & access refresh reported “Invitation access is up to date.” No broad/domain admission was added.
- Actual local checks: typecheck, 120 tests/24 files, twelve workerd checks through all 23 migrations, Worker build passed. Typed last-admin assertions passed in 10 authorization tests. Both-theme frontend passed 130 full checks per theme across the expanded route inventory/three viewport sizes with fictional API fixtures; this is distinct from real team UAT.
- Hosted jobs: real scheduled execution outcome ok and outbox dispatched; portal disabled-recipient suppression/replay passed. Isolated no-ingress platform drill observed attempts 1/2, retry success, dead-letter pull and acknowledgement. Real WhatsApp/webhook integration remains unavailable and no message was sent.
- Private D1/R2 backup transport, byte hash and isolated quarantined restore passed. Current remote snapshot has no populated business history; full populated remote business recovery remains unverified.
- Next exact action: reconnect Chrome for real-account appearance save/reload confirmation, then obtain other team members’ exact sign-in emails and explicit global/project roles privately, invite through People & access, then complete second-admin, role-boundary and business UAT with their own accounts. No demo/impersonation controls exist.
- Sister/company installation will use a separate Cloudflare account and fresh resources, secrets and bootstrap; cloning source alone does not transfer infrastructure. See [company setup](docs/operations/company-account-setup.md).
- R05 remains open for team UAT, real provider/webhook tests, continuous backup implementation/configuration and populated remote recovery. See [actual evidence](docs/evidence/remediation/session.md) and [handoff](docs/operations/real-account-handoff.md). No production migration or WhatsApp send was performed.

## Latest UI refinement

- Source `064f0d8`, deployed web `3e003439-210c-42a3-9613-b4656648e7b9`. User screenshot review drove aligned gutters/section rhythm, compact empty states, readable project filters, softer fields, spaced capability choices, one finance action row, and a single compact mobile header.
- Accepted invitation history now says “Account active · no scheduled access expiry.” The old date was a pre-acceptance link deadline; no account cutoff existed or was extended. Pending links remain single-use and time-limited. A regression verifies account/grants remain active after the stored invitation deadline.
- Short route fade, dialog entrance and control/nav feedback respect reduced motion. No logo, business approval or access-policy expansion.
- Actual checks: 106 tests passed; Workers build/typecheck passed; 114 built frontend browser checks passed across 29 routes/three viewport sizes, including motion/focus/expiry copy, with zero overflow or JS errors. Hosted signed-in ADMIN review verified People, invitation dialog, Finance, Projects and phone navigation. Fictional UI screenshots remain separate from private real-account proof.

## Latest independent follow-up

- Source `7b8d9dd`: moved seed-account/grant quarantine and bootstrap invalidation into the database restore transaction before fallible R2 copies. Injected storage failure passed in unit tests and actual local workerd. Full 106 tests, typecheck and Workers build passed; workerd now has 10 checks.
- Audited outstanding gates in [R05 open gates](docs/evidence/remediation/r05-open-gates.md), including the previously insufficiently prominent absence of scheduled backup/stale-success monitoring. Notification Cron is not backup automation.
- Updated current kickoff/company instructions to Cloudflare email codes and actual Refresh invitation access wording.

## Employee and existing-project onboarding

- Source `63f0719`, deployed staging web `f359c8b0-2da1-4c9c-ac7e-b17fc846925d`. Add employee now explicitly assigns project roles and separate finance permissions; optional ADMIN/OWNER remain independent. Client/consultant invitations remain separate.
- Projects → Add project → New enquiry / Existing project. ADMIN-only ongoing-project creation stores immutable reported stage/start/handover and scoped contacts/team in one guarded, retry-safe D1 batch. Setup pending does not grant commercial activation, historical approvals or ledger balances. A persistent checklist links People, original documents, finance reconciliation and manager activation.
- Additive migration 0022 applied only to staging after a protected private D1 export. Existing history and Access settings preserved.
- Actual checks: 111 tests/23 files, typecheck, Worker build, 11 local workerd checks through 22 migrations, existing 114 fixture browser records and dedicated final onboarding journeys at three viewport sizes passed. Hosted signed-in employee/project forms and actual account labels verified. Anonymous new routes remain behind Access. Real invitation/project submission was exercised only in isolated test data, not hosted real accounts.
- [Detailed evidence](docs/evidence/remediation/onboarding/verification.md). Existing R05 provider, full team UAT and recovery/continuous backup gates stay open.

## Historical P00–P14 implementation records

The previous agent reported completion for the phases below. They are retained as implementation history and navigation, **not checked release gates**. Reuse valuable code/tests, inspect evidence and reopen unsupported claims during R00–R05.

- P00 — [Runtime foundation and compatibility](docs/implementation/phases/00-foundation.md) — [Evidence](docs/evidence/phase-00.md)
- P01 — [Identity, invitations and permission foundation](docs/implementation/phases/01-identity-permissions.md) — [Evidence](docs/evidence/phase-01.md)
- P02 — [Client portfolios, project records and enquiry intake](docs/implementation/phases/02-projects-intake.md) — [Evidence](docs/evidence/phase-02.md)
- P03 — [Private documents and media](docs/implementation/phases/03-private-files.md) — [Evidence](docs/evidence/phase-03.md)
- P04 — [Tasks, deadlines and completion history](docs/implementation/phases/04-tasks.md) — [Evidence](docs/evidence/phase-04.md)
- P05 — [Drawing register, consultant approval and manager release](docs/implementation/phases/05-drawings.md) — [Evidence](docs/evidence/phase-05.md)
- P06 — [Published updates, company notices and manual K-SMART records](docs/implementation/phases/06-updates-permits.md) — [Evidence](docs/evidence/phase-06.md)
- P07 — [Quotations, schedules, invoices and receipts](docs/implementation/phases/07-commercial-finance.md) — [Evidence](docs/evidence/phase-07.md)
- P08 — [Expenses, consultant fees, payroll and profit](docs/implementation/phases/08-accounting.md) — [Evidence](docs/evidence/phase-08.md)
- P09 — [References, materials and additional-work controls](docs/implementation/phases/09-client-decisions-changes.md) — [Evidence](docs/evidence/phase-09.md)
- P10 — [Site issue and snag tracking](docs/implementation/phases/10-site-issues.md) — [Evidence](docs/evidence/phase-10.md)
- P11 — [In-portal notifications, WhatsApp and escalation](docs/implementation/phases/11-notifications.md) — [Evidence](docs/evidence/phase-11.md)
- P12 — [Role dashboards, waiting-on-you and owner performance](docs/implementation/phases/12-overviews-performance.md) — [Evidence](docs/evidence/phase-12.md)
- P13 — [Archive, audit exports and recovery](docs/implementation/phases/13-archive-recovery.md) — [Evidence](docs/evidence/phase-13.md)
- P14 — [Integrated verification, staging and launch readiness](docs/implementation/phases/14-release-readiness.md) — [Evidence](docs/evidence/phase-14.md)

## Session update contract

For each session record stage, branch/commit, changed paths, requirement/acceptance IDs, actual commands/results, environment/URL, screenshots where relevant, blockers and the next exact action. Link evidence and update the active manifest. Distinguish implementation, local checks, hosted checks and team acceptance. Never mark blocked, mocked or unrun behavior as passed.
