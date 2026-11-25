# Merveille Designs — current task state

Updated 25 November 2026. The application foundation exists on `implement/merveille-portal`. The current assignment is [remediation](docs/remediation/README.md), based on audited source `813ef8b765045b95ff713665a3217e4487491d75`. Remediation is locally verified; isolated staging provisioning is underway and real-account acceptance remains a separate gate.

## Active stages

| Stage | Work | Implementation | Local verification | Hosted verification | Team acceptance |
|---|---|---|---|---|---|
| R00 | Baseline and demo/diagnostic containment | Passed | Passed | In progress | Not started |
| R01 | Real accounts and admin lifecycle | Passed | Passed | In progress | Blocked |
| R02 | Neutral shared UI and reference screens | Passed | Passed | In progress | Blocked |
| R03 | Functional integrity, jobs and recovery | Passed | Passed | In progress | Blocked |
| R04 | All routes and interactions | Passed | Passed | In progress | Blocked |
| R05 | Integrated verification and real-person handoff | Passed: handoff prepared | Passed | In progress | In progress |

Dependencies and exact contracts: [active manifest](docs/remediation/manifest.json), [delivery gates](docs/remediation/05-delivery-and-acceptance.md).

## Current checkpoint

- Current branch: `implement/merveille-portal`. Existing logo, Next/OpenNext and Wrangler foundation preserved. Latest deployed web `3e003439-210c-42a3-9613-b4656648e7b9`; jobs `de09aa26-c792-41d0-9b21-d91e7d6faa3b`.
- Protected staging: https://merveille-web-staging.rhelo-bible.workers.dev. User completed Cloudflare One-time PIN login. Existing initial ADMIN retained; OWNER endpoint denied. Last-administrator removal denied with clear guidance and unchanged atomic guard. Google Cloud configuration is no longer required for team sign-in.
- Explicitly approved single-policy Admin credential is installed only in web/jobs platform secrets. Temporary transfer file deleted. Unrelated policy GET denied 403; actual People & access refresh reported “Invitation access is up to date.” No broad/domain admission was added.
- Actual local checks: typecheck, 106 tests/22 files, ten workerd checks through all 21 migrations, Worker build passed. Typed last-admin assertions passed in 10 authorization tests. Earlier built frontend passed 112 checks across 29 pages/three viewport sizes with fictional API fixtures; this is distinct from real team UAT.
- Hosted jobs: real scheduled execution outcome ok and outbox dispatched; portal disabled-recipient suppression/replay passed. Isolated no-ingress platform drill observed attempts 1/2, retry success, dead-letter pull and acknowledgement. Real WhatsApp/webhook integration remains unavailable and no message was sent.
- Private D1/R2 backup transport, byte hash and isolated quarantined restore passed. Current remote snapshot has no populated business history; full populated remote business recovery remains unverified.
- Next exact action: obtain other team members’ exact sign-in emails and explicit global/project roles privately, invite through People & access, then complete second-admin, role-boundary and business UAT with their own accounts. No demo/impersonation controls exist.
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
