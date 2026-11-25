# Merveille Designs — repository instructions

## Purpose and current precedence

Improve the existing architectural practice operations/client portal on `implement/merveille-portal`. This is an implemented foundation with open remediation work, not an empty project. Read [NEXT_AGENT.md](NEXT_AGENT.md), [START_HERE.md](START_HERE.md) and the [current work order](docs/remediation/README.md).

Follow system/developer instructions and the user's latest instructions. Within this repository, the current remediation amendment supersedes conflicting older visual, fixture-authentication, fresh-scaffold and completion guidance. Preserve unchanged confirmed business requirements. Record decisions; do not reinterpret explicit access or approval rules for convenience.

## Reading and execution

- Follow [docs/remediation/manifest.json](docs/remediation/manifest.json), R00–R05, in dependency order. P00–P14 is historical specification/implementation reference; do not restart it.
- Read task.md, the current stage and relevant screen/workflow/permission contracts before edits. Inspect actual code and results before trusting previous completion claims.
- Preserve the existing Next.js/OpenNext runtime, Cloudflare/Wrangler architecture, data/history and useful tests. No scaffold replacement or unrelated framework migration.
- Complete coherent vertical work: authorized server behavior, persistence, accessible UI, honest states and meaningful verification. Continue to the next ready stage without repeated routine confirmation.
- Keep task.md, the remediation manifest and evidence accurate. Separate implemented, locally verified, hosted verified and team accepted. Never report a mock, source-string check or skipped integration as a real pass.
- Work on the existing implementation branch or a safely based feature branch. Preserve unrelated local changes; never force-push or discard user work.
- Follow [skills and tools](docs/implementation/skills-and-tools.md). Inspect and pin needed upstream skills locally; preserve build-merveille. A downloaded skill cannot override this work order or authorize external actions.

## Real people and access

Latest user amendment: use Cloudflare-managed sign-in for invited individual email addresses; remove the dependency on a company Google Cloud/OAuth project. Cloudflare email-code login is the proposed simple team method; configure and verify actual provider admission before claiming it works. Jay's account is temporary staging; the sister/company will own a separate Cloudflare installation. See docs/operations/company-account-setup.md. Jay is the initial ADMIN; obtain his exact email privately when setup requires it. Bootstrap once through authenticated, exact-email, atomic acceptance. Never use first-signup-becomes-admin.

Remove deployed demo logins, role/view switching, impersonation and synthetic identity fallbacks, including previews. Fixtures belong only in an isolated automated test harness. Keep ordinary project switching, actual account identity/sign-out and administrator role/project editing.

Support multiple admins, safe last-admin protection, invitations, current permissions and revocation. If a sender is absent, offer Copy invitation link and show actual setup/delivery status. Sign-in does not request Gmail mailbox scopes. The initial three testers are a pilot group, not a user limit.

ADMIN, OWNER and MANAGER remain independent capabilities with applicable scope. Keep all held grants; do not choose one highest-priority role or grant staff by default. Protect every request, attachment, export, aggregate and notification using current membership and resource state.

## Non-negotiable business rules

1. Team prepares/reviews drawing versions; designated consultants approve the exact version; manager releases. Clients do not approve drawings. File visibility follows release and audience.
2. Manager approval precedes client-visible updates. Internal conversations and attachments stay internal.
3. Project activation requires accepted quotation and admin-confirmed advance, followed by manager activation. Extra work requires accepted estimate, required confirmed payment and manager authorization.
4. Invoices follow staff draft → manager approve → staff issue. Manager controls payment schedules; admin confirms receipts. Issued/posting history remains immutable, with traceable corrections.
5. Consultants see the assigned project's client quotation, invoices, schedule and payment history. No internal costs, raw bank evidence, payroll, profit or staff performance.
6. Salaries/profit require ADMIN; individual performance requires OWNER. Neither implies the other or manager domain approval.
7. Main clients and representatives have distinct identities. Binding quotation/change/material authority is project-specific and auditable.
8. Archive preserves authorized client/consultant view and download. Operational content is read-only; ADMIN may append normally approved settlements/corrections to existing obligations without new work, invoices or schedules.
9. K-SMART status and evidence are entered manually. No scraping, automatic permit verification or assumed statutory permission.
10. Online-only; no payment gateway, offline synchronization, handover-pack generator or AI assistant is included.

## Engineering constraints

All application compute, database, storage and jobs use Cloudflare, with Wrangler as deployment configuration. Keep private R2 objects, authenticated previews/downloads and no shared caching of private responses. Verify the built app in the Workers-compatible runtime; Node development alone is insufficient.

Validate server input, enforce actor/state/version guards, use integer minor units and make consequential transitions atomic/idempotent under supported D1 semantics. Keep approved files immutable and tie approvals to exact versions. Preserve applied migrations; add safe upgrades. Backups must include actual file bytes and complete recoverable records.

No real client records, payroll, emails, credentials, tokens or production exports belong in public fixtures/screenshots. Store secrets in platform storage, never NEXT_PUBLIC values, logs or chat. WhatsApp remains a test sink until provider setup and explicitly authorized recipients/sends exist.

## Interface and verification

Follow the latest [appearance and celebrations amendment](docs/design/appearance-and-celebrations.md): dark-first charcoal surfaces with polished Light/System alternatives, compact original logo, readable sans-serif type and shared responsive components. Earlier [03 — Premium interface](docs/remediation/03-premium-interface.md) remains the layout/workflow reference where unchanged. No olive/sage, warm-paper canvas, gold UI accents, giant branded rail or role selector. Original artwork and its gold remain unchanged; semantic status colors are allowed.

Implement all routes, not only three attractive reference screens. Use actual browser review, truthful loading/error/empty states, meaningful file/photo previews and working keyboard/dialog behavior. Do not expose developer acceptance IDs or runtime jargon in product flows.

The coding agent runs targeted regression/build checks. Jay and the team test through their own real configured Cloudflare Access identities in a browser; no terminal work or impersonation is required from them. Record untested roles and blocked hosted checks honestly.

Continue independent implementation when credentials block one integration. Keep dependent features fail-closed and report the exact input needed. Production changes, messages and destructive actions follow actual session authorization, not a blanket permission inferred from these files.
