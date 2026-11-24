# Marvel

<img src="assets/brand/marvel-logo.png" alt="Marvel — architectural project portal" width="440">

**A calm, precise workspace for architectural projects, clients and the people delivering them.**

Working title: **Marvel**. Repository: **JEDIx420/merveille**. The product name is provisional; keep it configurable rather than scattering it through application code.

## Start here

**Building the app? Read [START_HERE.md](START_HERE.md).** It gives the exact reading order, the next implementation phase and the rules for recording progress.

This repository currently contains a **build specification, brand assets and agent handoff**. It does not contain a functioning application, deployed Cloudflare resources, live integrations or passing application tests. All implementation phases start as not started.

| Read | Purpose |
| --- | --- |
| [START_HERE.md](START_HERE.md) | Single entry point for the implementation agent |
| [AGENTS.md](AGENTS.md) | Canonical repository instructions |
| [Product brief](docs/product/brief.md) | Scope, users and business outcomes |
| [Requirements and decisions](docs/product/requirements.md) | Confirmed requirements, corrections and engineering defaults |
| [Roles and permissions](docs/product/roles-and-permissions.md) | Who can access and change each type of information |
| [Workflows](docs/workflows/README.md) | State transitions, actors, approval gates and exception paths |
| [Screen specifications](docs/screens/README.md) | Individual screen contracts, responsive states and acceptance checks |
| [Visual direction](docs/design/README.md) | Premium aesthetic, interaction rules and design tokens |
| [Architecture](docs/architecture/overview.md) | Cloudflare runtime, data, identity and integrations |
| [Build roadmap](docs/implementation/roadmap.md) | Ordered phases with dependencies and completion gates |
| [Acceptance catalogue](docs/quality/acceptance.md) | Observable scenarios the finished product must pass |
| [Current task state](task.md) | Honest, resumable implementation progress |

## What the product does

- Starts with enquiries, requirements, site feasibility and a quotation. Main work starts only after quotation acceptance and an admin-confirmed advance.
- Gives clients and their representatives separate access to multiple projects.
- Lets staff manage tasks, drawings, site updates, manual K-SMART records, materials, changes and snags.
- Requires consultant drawing approval **followed by manager release**. Clients do not approve drawings.
- Shows authorised consultants the project's **client quotation and payment history**, while keeping internal discussions private.
- Maintains quotations, invoices, schedules, receipts and expenses. Salaries and profit are admin-only; individual performance is owner-only.
- Provides WhatsApp and in-portal reminders, a “Waiting on you” list, and escalation of unresolved overdue items.
- Preserves completed projects in an archive with continuing authorised client/consultant view and download access.

Initial operating scale: approximately **30 projects and 10–15 simultaneous users**. The application is online-only and supports documents, drawings, photos and site videos.

## Technical direction

Use React, TypeScript and Next.js App Router conventions on **Cloudflare Workers**, with **D1**, private **R2**, **Queues**, scheduled jobs and **Wrangler** configuration. Identity uses the documented Cloudflare Access approach plus application-level permissions. WhatsApp delivery uses Meta's external messaging API; application compute and storage stay on Cloudflare.

Cloudflare's current Next.js guide recommends **vinext**, which it labels beta. Phase 00 must verify and pin a compatible runtime; OpenNext remains a documented alternative if the compatibility evidence warrants it. No adapter's production readiness is claimed by this planning handoff. See [architecture](docs/architecture/overview.md) and the [checked sources](docs/references/cloudflare-sources.md).

## Visual identity

The [brand package](assets/brand/README.md) includes an original transparent Marvel wordmark, geometric architectural app symbol, colour tokens and usage guidance. The design uses warm mineral surfaces, deep olive ink, restrained bronze and generous space. Screen hierarchy and predictable actions take priority over decorative dashboard widgets.

Open the [static visual specimen](docs/design/visual-direction.html) locally for an illustrative design direction; it is not an application.

## Continue with an agent

Paste this into the agent with this repository open:

> Read START_HERE.md and AGENTS.md. Implement Marvel in the order defined in docs/implementation/manifest.json and the phase files. Preserve the confirmed workflows and permission boundaries. Complete and verify each phase, update task.md and the evidence record, then continue to the next ready phase. Treat this repository as the specification; do not stop at mockups or mark unverified work complete.

Antigravity can also discover the repository-local **build-marvel** skill. [Agent setup](docs/implementation/agent-handoff.md) explains the portable entry points and the distinction between these checked-in files and IDE-generated artifacts.

## Verify this handoff

Run `node scripts/check-handoff.mjs` from the repository root. This checks document links, the phase manifest, acceptance references and brand metadata. It does **not** test a future application.

Requirements baseline recorded **24 November 2026**, from the project discovery conversation. This public repository must contain only synthetic examples, documentation and code—never actual client records, drawings, payroll or credentials.
