# Start here — build Marvel

This is the implementation agent's entry point. The repository is a planning handoff, not a partially working app. Follow the sequence below; carry work forward through the phase manifest instead of inventing a new scope.

## 1. Understand the contract

Read these files, in order:

1. [Repository instructions](AGENTS.md).
2. [Product brief](docs/product/brief.md).
3. [Requirements and decision history](docs/product/requirements.md).
4. [Role and information permissions](docs/product/roles-and-permissions.md).
5. [Architecture](docs/architecture/overview.md).
6. [Design system](docs/design/design-system.md).
7. [Implementation roadmap](docs/implementation/roadmap.md).
8. [Current task state](task.md).

Then read the selected phase's prerequisite documents and screen/workflow specifications. Do not load every page into context at once. The indexes are intentionally small; detailed behaviour lives in individual files.

## 2. Select the next ready phase

[manifest.json](docs/implementation/manifest.json) is the machine-readable dependency order. [Phase files](docs/implementation/roadmap.md) contain implementation steps, target areas, acceptance checks and evidence requirements.

- Start at **P00** on a fresh checkout.
- A phase is ready when all dependencies have verified evidence.
- Complete a vertical slice: authorised server behaviour, persistence, accessible UI, error states and meaningful tests.
- Only then mark the phase complete in [task.md](task.md) and add its evidence record.
- Continue automatically to the next ready phase while work is authorised. Ask only when a genuinely missing decision or access blocks the next step.

The manifest defines phase dependencies, not permission to deploy production or send live messages. Use the current user's authorisation and the [operational inputs](docs/implementation/operational-inputs.md).

## 3. Preserve these final decisions

- Drawing content: team preparation/review, consultant approval, **manager release**. No client drawing-approval step.
- Main client remains the final contractual decision-maker for quotations and additional work. Representatives have separate identities and cannot impersonate that authority.
- Manager approval precedes publication of ordinary updates.
- Invoice working interpretation: staff draft, manager approval, staff issue. Manager alone changes schedules; admin confirms receipt.
- Work activation requires accepted quotation and confirmed advance. Extra work also needs its agreed estimate/payment and manager approval.
- Consultants intentionally see the assigned project's client quotation and payment history, never internal discussions, payroll or profit.
- Salaries/profit require ADMIN capability; individual staff performance requires OWNER capability. Do not collapse those distinctions.
- K-SMART is manual status/document capture. The app does not determine government permission to build.
- Online-only. WhatsApp plus portal reminders. No checkout, offline queue, handover-pack generator or unrequested AI chat feature.
- Archived permitted records stay available to authorised clients and consultants.

## 4. First implementation action

Run the handoff checker, inspect the actual checkout and begin [P00](docs/implementation/phases/00-foundation.md). Validate the runtime in workerd with real local D1/R2 bindings before committing to framework versions. Record the adapter choice and pinned versions in an ADR.

The infrastructure examples are **examples**, not deploy-ready files. Do not copy fictitious account IDs into production or claim a service exists because a configuration skeleton names it.

## 5. Resume correctly

Before stopping, update task.md with completed steps, outstanding acceptance IDs, blockers, commands run and the next exact action. Use [the evidence template](docs/quality/evidence-template.md).

On resumption, inspect the actual code and test evidence before trusting a checked box. If evidence is missing or stale, reopen that task. Keep the product's confirmed decisions unless the user changes them.

## 6. Definition of completion

All phases verified; all required acceptance cases mapped to executable evidence; all role-specific screens usable; critical permission and money paths tested; real staging integration checks completed; recovery exercised; production prerequisites documented; release reviewed against [the release checklist](docs/quality/release-checklist.md).

Do not describe the product as complete while it still relies on mock handlers, fake payment confirmation, public document URLs, skipped permission checks or unverified production integrations.
