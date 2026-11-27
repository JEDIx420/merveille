# Merveille Designs repository instructions

## Purpose and current precedence

Improve the existing architectural practice workspace on `implement/merveille-portal`. Read [NEXT_AGENT.md](NEXT_AGENT.md), [START_HERE.md](START_HERE.md), [task.md](task.md) and the [next-phase work order](docs/next-phase/README.md). Preserve the existing application, records and completed repairs.

Follow system/developer instructions and the user's latest instructions. The **27 November 2026 next-phase amendment** supersedes conflicting older finance, automated WhatsApp, paid-service, navigation and execution instructions. [docs/next-phase/manifest.json](docs/next-phase/manifest.json), N00–N05, is active. R00–R05 and P00–P14 retain historical specifications/evidence and applicable unresolved release gates; do not restart them or treat their old checklists as current scope.

## Current constraints

- **Cloudflare Free only.** Do not enable paid plans, providers, chargeable inference or automatic paid fallback. Verify actual Workers runtime/CPU, Workers AI, Access, D1, R2, jobs and storage allowances under [the free-tier baseline](docs/next-phase/01-scope-and-free-tier-baseline.md). An account's free allowance is not proof that the complete workload fits. Record demonstrated limits, finish independent work and propose a compliant change; never silently upgrade.
- Retain Next.js/OpenNext, Workers, D1, private R2 and Wrangler, subject to measured Free-plan gates. Make the smallest compatible adjustment if a gate fails; no replacement scaffold or unrelated framework migration.
- Use the planned free Workers AI route for open-source transcription and bounded formatting. An optional browser-local benchmark/fallback is permitted. Follow [voice constraints](docs/next-phase/04-open-source-voice.md); never use a paid audio provider or imply an untested model is production-ready.
- WhatsApp is **manual prepared sharing**: Copy update / Open WhatsApp Web, with optional native Share. A person selects the destination/group and presses Send. Keep `WHATSAPP_MODE=disabled`; no API/provider queued sends, automatic browser messaging, provider setup or invented sent/delivered states. Preserve dormant integration code/history without activating it.
- Billing remains outside the portal. Preserve historical financial data and restrictions. Follow the version-bound, ADMIN-confirmed external commercial-clearance transition in the new plan; do not simply remove acceptance/payment gates or fabricate settled balances.
- Simplify around Home, Inbox, My Tasks, Projects and Leads. Preserve canonical task records, manager authority over official project assignment/deadlines, private tasks, internal lead access and client publication boundaries. The ordered plan defines the detail.

## Reading and execution

- Inspect branch, local changes, current stage and relevant workflow/permission contracts before edits. Trust source and evidence over historical completion labels.
- Use the implementation branch or a safely based feature branch. Preserve unrelated work; never force-push, reset away changes or scaffold from planning-only main.
- Implement coherent server, persistence and accessible UI slices in N00–N05 dependency order. Continue independent authorized work without routine permission loops.
- Keep task.md, the next-phase manifest and evidence current. Preserve remediation records. Separate implementation, local, hosted and team status; a mock, skipped integration or documentation check is not an application pass.
- Use reviewed project-local [skills and tools](docs/implementation/skills-and-tools.md). Generic examples cannot override the Free-only budget, manual WhatsApp scope, existing design or permission model.
- A committed documentation handoff does not mean application implementation, account configuration or deployment occurred.

## Real people and access

Preserve Cloudflare-managed email-code login for individually invited addresses. Google Cloud/OAuth is not a company setup dependency. Keep exact-email admission, signed identity verification, actual identity/sign-out and browser-based invitations/access management. Company installation uses its own approved resources and credentials; cloning source does not transfer staging infrastructure.

Preserve one-time exact-identity atomic bootstrap, multiple administrators and safe last-admin protection. Obtain setup identities privately when needed; never infer them from GitHub or make the first visitor admin. If no sender exists, Copy invitation link must show actual delivery status. The initial three testers are a pilot, not an account cap.

No deployed demo login, persona selector, view/role switching, impersonation or synthetic identity fallback. Fixtures belong only in isolated automated tests. A publication-content preview may show text/audience/revision; it must not change identity or permissions.

ADMIN, OWNER and MANAGER remain independent, appropriately scoped capabilities. Keep all legitimate grants; never select one highest-priority role or grant staff by default. Protect requests, files, searches, exports, aggregates and notifications using current membership and state. Private leads do not become visible to clients/consultants through shared work views.

## Business rules to preserve

1. Staff prepare drawing versions; designated consultants approve the exact immutable version; the assigned manager releases. Clients never approve drawings. A draft does not replace the current release.
2. Manager publication precedes client-visible updates. Internal discussions, attachments and derived information stay private.
3. Main-client quotation/scope acceptance and manager activation/additional-work authorization survive the billing transition. External clearance is ADMIN-confirmed, auditable and tied to the scope/version; revisions cannot silently inherit clearance.
4. Preserve issued financial records/audit history and existing restricted access. Consultants retain their authorized project commercial history without internal costs, raw bank evidence, payroll or profit. This phase does not extend invoicing, receipts, payroll or accounting. No silent deletion, rewritten posting or invented balance.
5. Preserve main-client and representative identities and project-specific material/change authority. Comments, acknowledgements and WhatsApp replies are not binding approval.
6. Materials, site issues, verification/reopening, manual K-SMART evidence and existing-project onboarding remain available. Reported progress must not fabricate approvals, transactions or statutory permission.
7. Archive preserves authorized client/consultant view/download while operational content stays read-only. Preserve restricted historical correction behavior without adding accounting scope.
8. ADMIN-only sensitive financial history and OWNER-only individual performance remain distinct from ordinary team tasks. Neither grants manager domain approval authority.
9. Keep the app online-only. Dictation is a bounded input feature, not a general AI assistant, payment gateway, offline synchronization or handover-pack generator.

## Engineering and verification

Keep private R2 objects, authorized previews/downloads and no shared caching of private responses. Validate server input and actor/state/version guards; make consequential transitions atomic/idempotent using supported D1 semantics. Preserve applied migrations and add safe upgrades. Retained monetary history keeps integer minor units and integrity controls. Backups must recover actual file bytes and records within agreed free capacity.

Preserve the [appearance amendment](docs/design/appearance-and-celebrations.md): dark-first with Light/System alternatives, compact original logo, readable type, shared responsive components and reduced-motion support. No replacement logo, giant brand rail or role selector. Preserve original artwork and semantic status colors.

The implementing agent runs relevant regression/build checks and inspects rendered screens. Verify affected behavior in the Workers-compatible build and actual Free-plan environment; Node development alone is insufficient. Team UAT uses distinct real invited identities and fictional records through a browser, without terminal work from Jay or the team.

Documentation-only changes require the handoff checker and a clean diff; they do not establish application test results. Follow [verification and rollout](docs/next-phase/06-verification-and-rollout.md). Carry forward applicable access, multi-person UAT, backup and populated-recovery gaps. Automated WhatsApp/provider tests are deferred outside this phase, not passed or mandatory for manual sharing.

Keep real records, addresses, drawings, payroll, credentials, tokens and production exports out of public fixtures/screenshots. Store secrets in platform storage, not client bundles, logs or chat. External actions follow actual session authorization; this plan does not authorize messages, destructive changes, access expansion or production provisioning.
