# Portfolio/control polish — 28 November 2026

Projects now has a stage Board, compact List and structured Cards. Task filters, grouping, density and saved views use consistent controls; mobile task entry has room for its full label. Automations is visible in primary internal navigation, project tabs and a scoped `/automations` hub. Existing permissions, stage authority, Dark/Light/System and reduced/off motion remain.

See [current polish evidence](docs/next-phase/evidence/studio-polish.md). The protected studio Preview shares staging data; original UAT and live execution/Gemini gates remain unchanged. Historical checkpoints follow.

# Studio workspace checkpoint — 28 November 2026

Source `8f257a5` on `codex/studio-workspace`: expressive dark/light studio task UI, accessible board interaction, templates/labels/private saved views, scoped search/drawing cards and bounded rule drafting/simulation. Protected Preview: https://studio-merveille-web-staging.rhelo-bible.workers.dev. Existing team UAT staging remains unchanged. The Preview shares staging records and private files; use fictional work.

170 tests, 16 workerd/D1 groups and 168 dedicated built-Worker browser checks passed; broader 264 screen records had no overflow/JS/contrast failures. Worker build/typecheck passed. Real-account preview login and side-effect-free simulation passed. Live automation effects, actual Gemini provider and team UAT remain separate open gates. No new real task, rule, approval, invitation or message was created for hosted demonstrations.

See [current evidence](docs/next-phase/evidence/studio-workspace.md) and [rollout handoff](docs/operations/studio-automation-rollout.md). Historical walkthrough below is preserved.

---

# Latest delivery — simple project workspace

27 November 2026, source `1461c4d`. Home/Inbox/My Tasks/Projects, shared task panel and List/Board/Calendar, personal favorites/preferences, project progress and drawing side panel implemented. Voice retired and AI binding removed. [Scope](docs/design/simple-workspace.md) and [actual verification](docs/next-phase/evidence/simple-workspace.md) supersede earlier voice-pilot steps. Team acceptance, measured Free workload and applicable recovery/company gates remain open.

# Merveille Designs — remediation walkthrough

**27 November 2026 next-phase scope:** The [new ordered plan](docs/next-phase/README.md) is active. Its application work has not started; this handoff changes documentation only. The walkthrough below preserves earlier implementation evidence and is not proof that the Free-only, open-source voice, external-billing or manual-WhatsApp upgrade is implemented. Follow [current task state](task.md) for the next action and retain applicable access/recovery gates.

The existing application was repaired in place on `implement/merveille-portal`, starting from `82921d6`. Next.js 15.5.29, React 19, OpenNext 1.20.18, Cloudflare Workers/D1/private R2 and Wrangler 4.167.0 remain the foundation. The original logo is unchanged.

This is local implementation evidence, not a declaration of production readiness. The old P00–P14 release claims are superseded. See the [current checkpoint](task.md), [remediation evidence](docs/evidence/remediation/session.md) and [real-account handoff](docs/operations/real-account-handoff.md).

## Current experience

White/cool-gray/graphite shared shells replace the previous giant branded rail and inconsistent palette. Self-hosted licensed Inter, compact original identity, project navigation, actual-account sign-out, shared controls and dialogs apply across the route inventory. Manager overview, client home and drawing review use actual service contracts. Phone tables scroll inside their containers; file previews retain authorization and explicit unsupported/error states.

There is no deployed fixture login, persona selector, role switcher or synthetic request fallback. The root reaches the actual overview. Retired diagnostics return 404 before accessing bindings.

## Identity and administration

Access assertions use cryptographic JWKS verification. App identities bind to issuer/subject and current D1 membership. ADMIN, OWNER, project MANAGER, staff, consultant and client grants remain independent. Main-client authority is project-specific and auditable. Finance author/issue flags require eligible project staff/manager roles.

The operator-only bootstrap creates one expiring digest-only invitation for the privately configured exact Google address; atomic acceptance grants initial ADMIN only. Multiple administrators, recent-auth elevation, last-accepted-admin protection, copied invitation links, explicit edge admission states, current grants and suspension are implemented. Missing Google/Access configuration stays fail-closed. Browser-only testing uses real accounts after setup; local fixture claims are confined to automated harnesses.

## Business repairs

Drawing reviews bind immutable versions. Manager release commits the new pointer, superseding, audit and outbox together. Documents/direct previews/downloads derive visibility from released/published parents. Internal drafts and another project's attachments are denied.

Financial commands enforce actor, current version/state, organization, positive safe money and atomic guards. Number sequences, ledger, audit and outbox commit together. Replay keys preserve committed outcomes; allocations cannot overspend. Activation requires actual accepted quotation and confirmed, balanced advance evidence. Additional work retains acceptance/payment/manager gates. Existing inconsistent financial history is surfaced for explicit reconciliation, never silently rewritten.

Tasks, deadlines, reopening, manager publication, manual permit evidence, materials, snags and archive access retain their workflows. Archived operational tables have database backstops. ADMIN settlement follows guarded financial commands without adding new work or invoices.

Reminders use durable outbox/Queue/scheduled processing, current eligibility, bounded retries and honest unavailable/unknown provider outcomes. The fake adapter exists only in test fixtures. Webhooks require signature verification and monotonic status reconciliation. Backups copy real bytes to independent storage, include recoverable records and quarantine restored access.

## Verification and limitations

Final exact command/results, screenshots and source commit are in the [session evidence](docs/evidence/remediation/session.md). Tests cover Node SQLite/domain logic, actual local D1/R2 workerd transactions/recovery/identity races, real unauthenticated HTTP boundaries and browser UI behavior at three sizes. The browser UI harness uses fictional API fixtures; it does not prove live Google sign-in or hosted end-to-end business transitions.

Protected staging is deployed with all 21 migrations. Cloudflare email-code login and policy-scoped invitation synchronization passed; no Google Cloud setup is required for team login. Actual Cron, Queue suppression/replay, isolated retry/DLQ and private backup transport/quarantine have hosted evidence. Real team role/business UAT, real messaging/webhook delivery and populated remote recovery remain open. No production migration or WhatsApp send was performed. See current session evidence for exact deployed versions and scope.


## Employee and ongoing-project setup — 25 November

Deployed on protected staging from `02600a8`. Use People & access → Add employee for explicit project roles/finance choices; clients and consultants have a separate invitation action. Projects → Add project now distinguishes New enquiry from Existing project. Existing-project onboarding records current context directly, then retains Setup pending until normal commercial checks and manager activation pass. Internal handover records never certify money or drawing approvals. See [actual verification](docs/evidence/remediation/onboarding/verification.md).

## Appearance and celebrations

Open Appearance in the header to choose Dark, Light or System, and Full, Reduced or Off celebrations. Expand Preview celebrations to try the eight effects without changing project or financial records. Confirmed task, project, payment, drawing and acceptance milestones use role-aware feedback; failed/pending operations do not celebrate. See [current behavior](docs/design/appearance-and-celebrations.md) and [verification limits](docs/evidence/remediation/appearance.json).
