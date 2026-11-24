# Merveille Designs — current task state

Updated 24 November 2026. The application foundation exists on `implement/merveille-portal`. The current assignment is [remediation](docs/remediation/README.md), based on audited source `813ef8b765045b95ff713665a3217e4487491d75`. Remediation is locally verified; isolated staging provisioning is underway and real-account acceptance remains a separate gate.

## Active stages

| Stage | Work | Implementation | Local verification | Hosted verification | Team acceptance |
|---|---|---|---|---|---|
| R00 | Baseline and demo/diagnostic containment | Passed | Passed | Blocked | Not started |
| R01 | Real Google accounts and admin lifecycle | Passed | Passed | Blocked | Blocked |
| R02 | Neutral shared UI and reference screens | Passed | Passed | Blocked | Blocked |
| R03 | Functional integrity, jobs and recovery | Passed | Passed | Blocked | Blocked |
| R04 | All routes and interactions | Passed | Passed | Blocked | Blocked |
| R05 | Integrated verification and real-person handoff | Passed: handoff prepared | Passed | Blocked | Blocked |

Dependencies and exact contracts: [active manifest](docs/remediation/manifest.json), [delivery gates](docs/remediation/05-delivery-and-acceptance.md).

## Current checkpoint

- Application source commit: `7e08db6` on `implement/merveille-portal`. Existing Next/OpenNext/Cloudflare/Wrangler foundation and logo preserved. Earlier commits contain real identity, money/file/state repair, durable jobs and shared neutral UI.
- Current work: R00–R04 implemented and locally verified; R05 technical handoff prepared. Isolated staging is uploaded with ingress disabled; Google/Access and real-person gates remain blocked.
- Actual checks: typecheck passed; 105 tests across 21 files passed; optimized Workers build passed; nine isolated workerd identity/concurrency/rollback/recovery checks passed through migration 0020; 11 actual private HTTP/CSRF/diagnostic/cache checks passed; generated binding check and jobs dry run passed; dependency audit reports zero advisories; documentation checker passes. See [session evidence](docs/evidence/remediation/session.md).
- Browser: final built frontend passed 112 recorded checks covering all 29 pages at 1440×900, 1024×768 and 390×844, pure external-client navigation, 13 focused interactions/failures and setup states; no overflow/JavaScript errors. Reference screenshots were inspected. Tests use fictional browser-only API fixtures; actual Google/hosted business journeys remain unverified.
- Next exact action: receive the actual Zero Trust team domain, dashboard-tested Google provider and private Access setup token per the real-account handoff; create exact-email Google protection, verify it, activate staging ingress, then bootstrap Jay and run hosted/UAT checks.
- Hosted state: new isolated staging Worker version `9837f799-b94b-4912-a92c-79238d14e019` uploaded; workers.dev/previews disabled, no routes, private R2 public domain disabled. New APAC staging D1 has all 20 migrations and zero reconciliation errors. Old preview unchanged.
- Private input: Jay's exact supplied Google email is in ignored protected setup data, absent from public source/evidence. No initial hosted administrator or extra capability was silently granted.
- External gates: Google OAuth/Access team/app/audience/exact-email policies, authorized protected review hostname/resources, hosted Queue/provider checks, remote restore and real-person UAT. These block hosted acceptance and release, not the completed independent local implementation. Use the [real-account handoff](docs/operations/real-account-handoff.md).
- Authorized isolated remote staging resources, migrations and dark Worker upload completed. No Access policy, Google account setup, bootstrap or WhatsApp send performed. P00–P14 historical release claims remain superseded. Legacy acceptance cases remain not-run until their complete scenarios are observed.

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
