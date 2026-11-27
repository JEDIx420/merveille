# Merveille Designs

<img src="assets/brand/merveille-designs-logo.png" alt="Merveille Designs existing company logo" width="80">

An architectural practice workspace for projects, clients and the people delivering them.

This branch contains the existing Next.js/OpenNext application on Cloudflare and its specifications. The next upgrade simplifies everyday work around the client's Asana examples, adds a small leads tracker and voice entry, and prepares WhatsApp updates for staff to send manually. **Cloudflare Free only; billing remains outside the portal.**

## Implementation handoff

Start with [NEXT_AGENT.md](NEXT_AGENT.md), then [START_HERE.md](START_HERE.md), [AGENTS.md](AGENTS.md) and the [detailed next-phase plan](docs/next-phase/README.md). The application lives on `implement/merveille-portal`; preserve it rather than scaffolding from planning-only main.

| Document | Purpose |
| --- | --- |
| [Next-phase plan](docs/next-phase/README.md) and [manifest](docs/next-phase/manifest.json) | Active N00–N05 implementation order |
| [Scope and free-tier baseline](docs/next-phase/01-scope-and-free-tier-baseline.md) | Constraints, preservation, billing transition and feasibility |
| [Simple workspace](docs/next-phase/02-simple-workspace.md) | Home, Inbox, My Tasks, Projects and client visibility |
| [Leads and imports](docs/next-phase/03-leads-and-imports.md) | Minimal tracking, follow-ups, Excel and Asana migration |
| [Open-source voice](docs/next-phase/04-open-source-voice.md) | Free transcription, formatting and device pilot |
| [Reminders and manual WhatsApp](docs/next-phase/05-reminders-and-manual-whatsapp.md) | In-portal automation and human-sent messages |
| [Verification and rollout](docs/next-phase/06-verification-and-rollout.md) | Runtime, access, recovery and real-team acceptance |
| [Task state](task.md) | Actual checkpoint and prior evidence |

This handoff changes documentation only. Next-phase application implementation has not started, and the plan is not a production-readiness claim.

## Preserve the existing foundation

Keep Next.js App Router/OpenNext, Workers, D1, private R2 and Wrangler, subject to actual Free-plan runtime/capacity gates. Extend the existing separate jobs Worker and notification records. Do not assume the account's plan or workload fits without verification, or enable paid services to clear a gate.

Keep invited Cloudflare email-code accounts, separate ADMIN/OWNER/project roles and browser-based administration. No role switching, impersonation or deployed demo identities. Preserve the original compact logo and Dark/Light/System appearance.

Drawings retain staff preparation, designated consultant approval of the immutable version and manager release. Clients never approve drawings. Manager publication controls client updates. Materials, additional work, snags, manual permits, project onboarding and authorized archive access remain available. Internal information stays private.

Billing is handled elsewhere. Historical financial records and restricted access survive; activation/additional-work gates transition to version-bound external commercial clearance without bypassing accepted scope or manager authority.

Voice uses the planned free Workers AI route for open-source transcription and bounded formatting, with a browser-local option assessed under the documented budget/device constraints. WhatsApp offers Copy update / Open WhatsApp Web: staff select the group and press Send. API delivery remains disabled; opening a share window is not proof of sending.

## Evidence and older specifications

The [documentation index](docs/README.md) links workflows, screens, architecture and quality records. [Remediation](docs/remediation/manifest.json) and the [original roadmap](docs/implementation/roadmap.md) remain evidence/reference, not active execution. Preserve applicable real-account, backup and recovery gaps; automated WhatsApp/provider tests are outside this phase.

Earlier planning assumed around 30 projects and 10–15 concurrent users with phone/desktop access and drawings/photos/videos. These are workload inputs to validate against Free allowances, not proven capacity. The company needs its own installation; cloning this repository does not move staging infrastructure.

## Documentation verification

Run `node scripts/check-handoff.mjs` from the repository root. It checks documentation links, manifests, historical requirement/acceptance mappings and original brand integrity. It does not test the application or prove Free-plan feasibility. Application checks belong to the implementing agent and real-team acceptance record.

No private client records, personal addresses, drawings, payroll or credentials belong in this public repository.
