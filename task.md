# Merveille Designs — current task state

Updated 24 November 2026. The application foundation exists on `implement/merveille-portal`. The current assignment is [remediation](docs/remediation/README.md), based on audited source `813ef8b765045b95ff713665a3217e4487491d75`. This documentation update performs no application changes, deployment or account setup.

## Active stages

| Stage | Work | Implementation | Local verification | Hosted verification | Team acceptance |
|---|---|---|---|---|---|
| R00 | Baseline and demo/diagnostic containment | Not started | Not started | Not started | Not started |
| R01 | Real Google accounts and admin lifecycle | Not started | Not started | Not started | Not started |
| R02 | Neutral shared UI and reference screens | Not started | Not started | Not started | Not started |
| R03 | Functional integrity, jobs and recovery | Not started | Not started | Not started | Not started |
| R04 | All remaining routes and interactions | Not started | Not started | Not started | Not started |
| R05 | Integrated verification and real-person UAT | Not started | Not started | Not started | Not started |

Dependencies and exact contracts: [active manifest](docs/remediation/manifest.json), [delivery gates](docs/remediation/05-delivery-and-acceptance.md).

## Current checkpoint

- Current work: remediation instructions prepared; implementation has not begun under this new plan.
- Next exact action: inspect the latest implementation branch and effective deployment configuration, read the ordered work order, then begin R00 without recreating the app.
- Existing hosted preview: [merveille-web.rhelo-bible.workers.dev](https://merveille-web.rhelo-bible.workers.dev). Its observed fixture login/diagnostic experience is part of the repair baseline, not an accepted testing model.
- Earlier claims that P00–P14 were fully verified and ready for production are superseded pending meaningful re-verification. The original acceptance JSON still lists cases as not-run; do not infer a pass from old prose.
- Required future setup inputs: Jay's exact Google email and other identities privately; explicit optional grants; Google/Cloudflare Access configuration; authorized review deployment; messaging/provider inputs where applicable. These do not block independent code and visual work.
- Application checks in this documentation update: not run. The documentation/link/manifest validation result belongs to the publishing handoff, not application readiness.

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
