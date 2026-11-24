# Product amendment — existing foundation, premium interface, real people

**Later user amendment (24 November 2026):** Cloudflare-managed authentication replaces the Google-only constraint. Jay's account remains build/staging; the company will have its own Cloudflare account and deployment. Ordinary company administration must be browser-only, with automatic invitation admission after one-time operator setup. See [company account setup](../operations/company-account-setup.md). Keep earlier Google setup/evidence as history, not a continuing dependency.

Recorded **24 November 2026** from the user's latest correction. This document takes precedence over conflicting earlier presentation, demo-login and first-build instructions. It changes how the existing product is delivered and accessed; it does not remove the agreed business workflows.

## Confirmed direction

| User decision | Implementation consequence |
|---|---|
| Build on the foundation already produced | Retain the existing app, data model, migrations and useful services/tests. Inspect defects; repair in place. No new scaffold or unrelated framework migration. |
| Make styling consistent and premium; reject olive/green | Use document 03's white/cool-gray/graphite system, shared components and responsive shells. No olive/sage theme, warm-paper canvas or gold accent system. |
| The existing logo at the top is enough branding | Preserve the full original artwork and provenance. Display it compactly with readable Merveille Designs text. Do not generate another logo or enlarge the navigation into a brand panel. |
| Remove the view-switching experience | No persona selector, “view as,” impersonation, demo role login or deployed authentication fallback. The app shows the signed-in person's authorized work. |
| People will use Gmail to receive access | Implement genuine Google sign-in for individually invited personal Gmail and Google Workspace accounts. Gmail address ownership does not itself authorize access. No mailbox integration is requested. |
| Jay is initial admin and will add another admin | Bootstrap a privately configured exact Google identity once. Support multiple accepted admins and safe delegation. Never make the first arbitrary visitor admin. |
| Admins add teammates and give them different roles | Provide usable invitation, acceptance, role/project grant, suspension and revocation flows. Enforce permissions on the server, not only navigation. |
| Around three people will perform testing | Provide a simple browser walkthrough using their own accounts and fictional project records. Three is a pilot size, not an account cap or reason to merge roles. |
| Put the update and kickoff instructions in the repo | Maintain a short entry prompt plus detailed ordered files, actual checkpoints and evidence, so another Antigravity session can resume. |

The confirmed company name remains **Merveille Designs**. The casual reference to “Marvel” in the latest request is not an instruction to undo the earlier explicit company-name correction.

## Engineering choices and operational inputs

The user confirmed the visual direction and real-account administration. The exact token values, Inter typography, CSS Modules, compact logo dimensions, Google-through-Cloudflare-Access integration, 72-hour invitation default and recovery mechanics are implementation defaults specified in the following files. They may be refined for demonstrated compatibility or usability, with a recorded reason, while preserving the user's outcomes and privacy rules.

Jay's exact Google email, other tester addresses, separately requested OWNER/MANAGER grants, Google OAuth configuration, Cloudflare Access audience/policies and any invitation sender are **not supplied**. Ask privately when required for actual setup. Never guess identities from GitHub, commits or profile data. A copied invitation link is a valid initial delivery method when there is no configured sender; label it accurately. Creating an invitation does not mean email was sent.

ADMIN is access/accounting authority. It does not silently imply OWNER's individual-performance access or MANAGER's drawing/invoice approval. Jay and the second admin may hold additional explicitly granted capabilities. Permission editing is an administrator action; it is not a user-facing role-switching mode. Ordinary project switching and sign-out remain available.

Semantic green may label a received payment or successful release; it is not a theme color. The existing logo's gold pixels remain unchanged. No additional brand research or asset generation is needed to start.

## Business behavior that must survive

1. Clients may have multiple projects and separately invited spouses, partners or representatives. Main-client authority is specific to a project; representatives cannot impersonate it.
2. Team prepares/reviews drawings, assigned consultants approve the immutable version, and the **manager makes final release**. Clients do not approve drawings. A replacement draft does not replace the current released file.
3. The manager approves ordinary client-facing updates. Internal notes/discussions remain private, including their attachments, counts, exports and notification contents.
4. Consultants intentionally see their assigned project's client quotation, issued invoices, payment schedule and payment history. They do not receive internal costs, salary/profit, staff performance or raw payment evidence by default.
5. Enquiry, requirements, feasibility and quotation precede main-client acceptance, admin-confirmed advance and manager activation. Additional work needs accepted scope/estimate, the required confirmed payment and manager authorization.
6. Invoice flow remains staff draft → manager approval → staff issue. Manager controls schedule changes; admin confirms received money. Payment occurs outside the portal. Preserve issued records and correct them through traceable adjustments.
7. Accounts include project expenses, consultant fees, salaries and profit. Salaries/profit require ADMIN; individual performance requires OWNER. Display invoiced sales and received cash separately.
8. Tasks allow staff creation, manager assignment/deadlines, staff completion and manager reopening. Snags retain location, photos, assignment, resolution evidence and manager verification/reopening.
9. K-SMART sanction/completion records are manually entered status and supporting documents/screenshots. There is no automatic government website integration or portal certification of legal permission.
10. In-portal and WhatsApp reminders cover due/overdue work and payments; unresolved overdue items escalate to ADMIN. Delivery respects current access and actual resolution state.
11. Archive retains authorized client/consultant view and download access. Operational content is read-only. The existing engineering exception allows ADMIN to append normally approved settlement/correction events for existing obligations, without creating new work, invoices or schedules.
12. Long-term records include original files and audit/financial history. Backups and restoration must recover actual data and bytes; a manifest alone is insufficient.

The initial operating scale remains approximately 30 projects and 10–15 concurrent users. Desktop and phone use, large drawings, documents, photos and site videos remain supported. The app is online-only. Waiting-on-you and snag tracking remain in scope. Payment gateways, offline synchronization, a handover-pack generator and an AI chat assistant remain outside the agreed scope.

## Superseded material

The old `docs/design/visual-direction.html`, warm/gold token interpretation and large desktop logo are historical references. Existing runtime token files may still contain those values until remediation implements the new system; their presence does not override document 03.

P00–P14 remain useful business/architecture specifications and implementation history. Their previous “fully complete” labels do not establish readiness. Do not restart P00, keep a fixture login for testers or infer that all integrations only need credentials. The active sequence and verification rules are in [05 — Delivery and acceptance](05-delivery-and-acceptance.md).

## Implementation interpretations recorded during remediation

The [authority ADR](../architecture/decisions/0002-remediation-authority.md) records additive engineering interpretations: project conversion is ADMIN-only because it assigns project contacts/access and contractual authority; optional organization intake/company-publishing grants never imply scoped project approval; archived new receipts must name an existing invoice and use normal financial confirmation/allocation. These preserve the confirmed authority rules rather than introducing substitute actors. Provider and hosted acceptance remain separate gates.
