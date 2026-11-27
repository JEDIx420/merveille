# Merveille next phase — implementation work order

Latest accepted amendment: [simple project workspace](../design/simple-workspace.md). It supersedes voice entry and conflicting daily navigation requirements below. Voice is retired, not a pending activation gate. Preserve the specialist/history workflows behind secondary navigation.

**Confirmed direction: 27 November 2026. Application implementation has not started under this plan.**

Upgrade the existing Merveille Designs portal so daily work feels as familiar and simple as the client's Asana setup. Add a small leads tracker, reviewed Excel import, useful dictation, automatic in-app reminders and prepared WhatsApp messages that staff send themselves. Operate within Cloudflare's free allowances; introduce no paid plans, inference APIs or messaging services.

This is the detailed prompt for whichever implementation agent Jay chooses. Follow it through implementation, verification and an accurate handoff; do not return another proposal in place of doing the authorized work. The current deliverable is this repository plan, not a claim that these features have already shipped.

## Authority and reading order

Follow the latest user instructions and [AGENTS.md](../../AGENTS.md). This folder supersedes conflicting execution instructions in the old R00–R05 remediation plan and P00–P14 original plan. Those documents and their evidence remain useful history. Preserve unchanged business rules. In particular, simplifying the screens does not relax permissions or drawing-release authority.

1. Inspect the current branch, working tree, [task.md](../../task.md) and [NEXT_AGENT.md](../../NEXT_AGENT.md). The application lives on `implement/merveille-portal`; the default branch is not a fresh implementation starting point.
2. Read this work order and [manifest.json](manifest.json).
3. Read [01 — Scope and free-tier baseline](01-scope-and-free-tier-baseline.md) before choosing services or changing deployment configuration.
4. Read [02 — Simple workspace](02-simple-workspace.md), [03 — Leads and imports](03-leads-and-imports.md), [04 — Open-source voice](04-open-source-voice.md) and [05 — Reminders and manual WhatsApp](05-reminders-and-manual-whatsapp.md).
5. Use [06 — Verification and rollout](06-verification-and-rollout.md) for acceptance and release evidence. Recheck volatile vendor limits against [official sources](sources.md).
6. Load the relevant existing domain, permission, runtime and operational contracts as needed. Do not reread or rebuild every historical phase.

## Implementer prompt

You are extending a working application. Inspect the code before changing it. Retain Next.js App Router, TypeScript, OpenNext, Cloudflare Workers, D1, private R2, the jobs Worker, existing data, applied migrations, brand artwork and useful verification. Reuse domain commands and access policies. Keep pinned dependencies unless a concrete compatibility or security requirement justifies a documented change.

Implement the six stages below in order, completing coherent, usable flows. Work autonomously on reversible implementation and necessary verification already covered by the task. Record assumptions and resolve routine design choices from these contracts; do not stop after each stage to ask whether to continue. When one hosted input is missing, continue independent work and report that specific unverified dependency.

The free-tier requirement is a constraint, not an invitation to replace a paid API with an unbudgeted service. Prove the existing dynamic runtime fits Free CPU limits. Budget storage, backups, identities, database work and AI across the actual account. Keep safe operational headroom. Fail closed or pause the affected optional feature before exhausting its allowance. Never silently upgrade, buy credits, create a trial-dependent design or switch to a paid fallback. R2's metered allowance is a documented exception to any claim of a provider-guaranteed zero bill; follow the explicit storage gate in document 01.

Build the simple interface described in document 02 and retain the deeper workflows behind contextual screens. Reuse enquiries as the lead foundation; avoid a second disconnected CRM. Voice means speak, review and save: transcription and formatting assist entry but cannot grant access, publish drawings, approve decisions or send messages. WhatsApp means prepare approved text, copy it, and let the human choose the chat and send. Keep external WhatsApp dispatch disabled, including background enqueueing.

For each stage, add safe migrations if needed, implement server enforcement and accessible UI, exercise meaningful acceptance cases, and update the manifest and evidence. Preserve unrelated user work. Commit coherent changes on the implementation branch or a safely based feature branch; never force-push. Deployment, messages, billing activation and destructive operations require actual session authorization, not permission inferred from this document.

On completion, report what changed, commits/branch, exact checks and results, available preview/deployment, free-tier measurements, remaining blockers and the next concrete action. Separate implemented, locally verified, hosted verified and team accepted. Do not call the upgrade production-ready while a required gate is blocked.

## Ordered delivery

| Stage | Deliverable | Exit evidence |
|---|---|---|
| N00 | Audit the existing application; preserve feature/permission inventory; implement measurable free-tier controls and any necessary bounded runtime adjustments | Current baseline, quota ledger, CPU/account capacity evidence or precise hosted blocker; migration/recovery strategy |
| N01 | Simplify navigation, canonical task views, project/client/reviewer screens and the external-billing transition | Working role-specific journeys; exact-version approval/release and access regression evidence |
| N02 | Simple leads, follow-ups, Excel/CSV preview/import and safe lead-to-project handoff | Synthetic workbook results, duplicate/retry/rollback evidence, authorization checks |
| N03 | Short open-source dictation, cleanup, structured suggestions and review/save | Actual supported-device/model results, bounded usage and failure behavior |
| N04 | Fixed reminder presets, dependable in-app Inbox and manual WhatsApp preparation | Deduplication/stale-event/retry checks; clipboard fallback; no external dispatch |
| N05 | Integrated verification, incremental migration, recovery, company-account readiness and staff pilot | Evidence record, valid release gates, exact remaining inputs; no fabricated completion |

N01 and N02 establish the flows that N03 and N04 enrich. Local implementation can advance while an independent account/device check is unavailable. A blocked free-tier or authorization gate still blocks activation of the dependent feature; it is not waived by later progress.

## Scope decisions already made

- **Keep costs at the free tier.** No Workers Paid, paid AI provider, paid automation service, paid grid library, Cloudflare Stream/Images purchase or new managed backend.
- **Asana familiarity, within Merveille's workflows.** Prioritize list-based work, My Tasks, Inbox, clear project navigation, board/calendar alternatives and small forms. This is not a requirement to clone every feature in Asana's catalogue.
- **Keep the current appearance.** Retain Dark/Light/System, compact original branding, readable shared controls and reduced-motion behavior. Simplification concerns navigation and daily actions, not another theme replacement.
- **Billing is handled externally.** The client's supplied reference document explicitly excludes billing. Preserve accepted quotations, binding decisions, existing financial history and authorization gates using the version-bound external-clearance contract in document 02.
- **Manual WhatsApp now.** No Meta setup, number migration, group API, WhatsApp Web driver or provider delivery integration is needed for this phase.
- **Open-source speech with bounded hosting.** Start with a currently available free Workers AI route; browser-local inference is an optional benchmarked fallback, not a promise of unlimited mobile transcription.
- **No broad AI assistant.** No document chat, autonomous approvals, meeting bot, always-on listening, CRM enrichment or unrestricted voice commands.

## Baseline and historical gates

The source baseline inspected for this handoff is `7b8966f0921bedb58f9429546a0729fd78dcb2ae`. Later code must be audited afresh rather than reset to that commit. Known starting points include [the shell](../../src/components/shells.tsx), [task service](../../src/server/domain/tasks/service.ts), [enquiry service](../../src/server/domain/enquiries/service.ts), [notification service](../../src/server/notifications/service.ts), [jobs Worker](../../workers/jobs/index.ts), [web configuration](../../wrangler.jsonc) and [jobs configuration](../../workers/jobs/wrangler.jsonc).

Historical local/hosted test counts are not verification of this new scope. Carry forward the relevant open gates: real multi-role team UAT, populated remote recovery, scheduled backups with stale-success monitoring, and the separate company Cloudflare installation. Previous real WhatsApp-provider/webhook gates are **deferred outside this phase**, not passed and not a prerequisite for manual copying. Google-only setup and paid transcription proposals are superseded.

At each checkpoint update [task.md](../../task.md), the new [manifest](manifest.json), and concise evidence under [evidence/](evidence/README.md). Keep previous manifests and records intact. The next stage is N00.
