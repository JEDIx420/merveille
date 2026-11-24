# Merveille Designs implementation roadmap

## Execution contract

Build the full agreed product through the ordered phases below. This sequence is an engineering delivery plan, not a reduction of scope. Documentation/assets are prepared; application phases are unstarted.

Read [START_HERE.md](../../START_HERE.md) first. Each phase has a standalone implementation file. [manifest.json](manifest.json) contains dependency and acceptance IDs; [task.md](../../task.md) records real progress. The [acceptance catalogue](../quality/acceptance.md) defines observable completion.

## Ordered phases

| Phase | Outcome | Dependencies |
| --- | --- | --- |
| [P00](phases/00-foundation.md) | Runtime foundation and compatibility | None |
| [P01](phases/01-identity-permissions.md) | Identity, invitations and permission foundation | P00 |
| [P02](phases/02-projects-intake.md) | Client portfolios, project records and enquiry intake | P01 |
| [P03](phases/03-private-files.md) | Private documents and media | P02 |
| [P04](phases/04-tasks.md) | Tasks, deadlines and completion history | P02, P03 |
| [P05](phases/05-drawings.md) | Drawing register, consultant approval and manager release | P02, P03 |
| [P06](phases/06-updates-permits.md) | Published updates, company notices and manual K-SMART records | P02, P03 |
| [P07](phases/07-commercial-finance.md) | Quotations, schedules, invoices and receipts | P02, P03 |
| [P08](phases/08-accounting.md) | Expenses, consultant fees, payroll and profit | P07 |
| [P09](phases/09-client-decisions-changes.md) | References, materials and additional-work controls | P03, P07 |
| [P10](phases/10-site-issues.md) | Site issue and snag tracking | P03, P04, P09 |
| [P11](phases/11-notifications.md) | In-portal notifications, WhatsApp and escalation | P04, P05, P06, P07, P09, P10 |
| [P12](phases/12-overviews-performance.md) | Role dashboards, waiting-on-you and owner performance | P04, P05, P06, P07, P08, P09, P10, P11 |
| [P13](phases/13-archive-recovery.md) | Archive, audit exports and recovery | P05, P06, P07, P09, P10, P11 |
| [P14](phases/14-release-readiness.md) | Integrated verification, staging and launch readiness | P12, P13 |

## Build depth

Each phase delivers server authorisation, database changes, domain transitions, UI, failure states and targeted tests. Avoid generating every screen with mock data before implementing core permissions and state. Reuse the shell and design tokens, then connect real vertical slices.

All named code paths are implementation targets, not existing modules. Refine the scaffold if the runtime requires it and document the decision. Keep the domain, database, file, notification and UI boundaries visible.

P02 introduces project/intake records; P03 connects evidence files; P07 completes quotation/advance activation. The project remains blocked from activation until real commercial records exist. Likewise earlier phases record outbox events but P11 owns delivery. Do not claim those later integrations complete prematurely.

## Decision checkpoints

1. **P00:** runtime/version evidence and exact local commands. Current documentation recommends vinext but labels it beta; compatibility determines the final pinned selection.
2. **P01:** identity invitation/provisioning and real Access checks in staging. Total registered identities, not concurrent users, drive external identity configuration needs.
3. **P07–P08:** agreed currency, accounting basis, invoice/period settings and opening balances before live commercial use. Synthetic local data is sufficient for implementation.
4. **P11:** authorised provider sender, opt-in/templates and test recipient before real WhatsApp delivery. Fake local delivery is explicit.
5. **P13–P14:** successful recovery, current membership checks and environment separation before launch.

## Phase completion record

Use the [evidence template](../quality/evidence-template.md). Record build/test commands that actually exist after scaffolding, results, fixture identity, environment, acceptance IDs and any blocked cases. The final release requires all cases in acceptance-cases.json, even if individual phases rerun overlapping scenarios.

Keep [operational inputs](operational-inputs.md) current. Missing credentials should disable the affected integration and be reported; they should not stop independent implementation or trigger repeated feature-discovery questions.

## Progressive verification

Acceptance cases describe finished-product outcomes. Early phases validate the subset their delivered layer can actually prove, such as policy predicates against synthetic resources in P01. Record that subset as foundation evidence, and keep the overall acceptance case unpassed until later real routes/screens/integrations exercise it. Do not block all development waiting for a screen from a later phase, and do not label a policy stub as an end-to-end pass. P14 reruns the complete catalogue against the integrated application.
