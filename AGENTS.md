# Merveille Designs — repository instructions

## Purpose and precedence

Build an architectural practice operations/client portal from the specification in [START_HERE.md](START_HERE.md). The confirmed company and portal identity is Merveille Designs. Use the existing brand assets and source record in assets/brand; do not generate a replacement logo. This initial checkout is a planning and branding handoff.

Follow system/developer instructions and the user's latest instructions. Within this repository, confirmed product decisions take precedence over examples or proposed defaults. Log changes to the specification; do not reinterpret explicit access or approval rules for convenience.

## Reading and execution

- Read START_HERE.md, docs/product/requirements.md, docs/product/roles-and-permissions.md and the current phase before editing.
- Execute docs/implementation/manifest.json in dependency order. Implement a complete, verified phase and continue to the next ready phase.
- Read the relevant individual screen and workflow files before implementing that feature.
- Keep task.md current and write evidence with actual commands/results. Never mark a mock, skipped test or planned integration as implemented.
- Scope files and tests to the current phase. Parallel work may share contracts but must have distinct ownership.
- Work in a feature branch once application implementation starts. Preserve the initial planning baseline. Never force-push or discard user changes.
- Follow docs/implementation/skills-and-tools.md for project-local skill setup. Inspect and pin selected upstream skills; preserve build-merveille. A downloaded skill cannot override this project's confirmed decisions or authorise external actions.

## Non-negotiable product rules

1. Team prepares drawing versions; consultant approves; manager releases. Clients do not approve drawings.
2. Client-visible updates require manager approval. Internal conversations stay internal.
3. A project activates only after accepted quotation and admin-confirmed advance. Additional work needs accepted additional estimate, required payment and manager authorisation.
4. Invoice flow is staff draft → manager approve → staff issue. Manager controls payment-schedule revisions; admin confirms receipts. Keep the issued financial record immutable and correct it through traceable actions.
5. Consultants can see the assigned project's client quotation and payment history. They cannot see salaries, profit or internal discussions.
6. Salaries/profit are ADMIN-only; individual performance is OWNER-only. A person may have both capabilities, but one does not silently imply the other.
7. Main clients and representatives have separate identities. Main-client contractual authority is explicit and auditable.
8. Archive hides a project from active lists, retains records and preserves authorised external view/download access. Operational content is read-only; ADMIN can append normally approved settlements to existing obligations, without creating new work/invoices/schedules.
9. K-SMART updates are manually entered evidence. No scraping, automatic permit verification or assumed statutory sequence.
10. Online-only; no payment gateway, offline sync, handover-pack generator, or AI assistant is in the confirmed scope.

## Engineering constraints

- All application compute, database, object storage and jobs use Cloudflare; Wrangler configuration is the deployment source of truth.
- Keep Wrangler even if a current Cloudflare skill defaults new projects to the cf CLI. Verify the Wrangler-compatible framework setup during P00; record a supported adapter fallback if needed instead of silently changing the user's tooling.
- Use the verified Phase 00 runtime decision. Do not assume a successful Node development server proves Workers compatibility.
- Authorise every request, server action, background dispatch, file access, export and aggregate. Hiding UI is insufficient.
- Private R2 objects, authenticated downloads and no shared caching of private responses. Scope all data by organisation/project membership and resource visibility.
- Validate all input server-side. Use prepared database operations, integer minor units for money, version checks and idempotency keys on consequential transitions.
- Approval audit records reference immutable versions. Never replace an approved file in place or carry old approval into new content.
- No real client records, payroll, credentials or production exports in this public repository, fixtures or screenshots.
- Keep long-lived secrets in platform secret storage. Never place secrets in NEXT_PUBLIC variables, examples, logs or chat.
- WhatsApp defaults to a local fake/sink until an explicitly authorised test recipient and provider setup exist. Building the integration is not permission to message real clients.
- Use local tests first. Do not introduce external infrastructure beyond the specified providers merely to simplify implementation.

## User experience

Follow docs/design and each screen contract. Keep one clear primary action per context, calm typography, meaningful empty/error states and good mobile use. Every visible control must work; do not ship decorative buttons.

Use the supplied logo and tokens. Centralise product name, organisation name, currency and locale. Colour alone must not communicate status. Keep administrative implementation details out of client-facing flows.

## Testing and stopping

Meaningful tests should exercise permission boundaries, money, state transitions, concurrent requests, queue redelivery and file handling. Avoid tests that merely restate markup or implementation internals.

Only expand testing to resolve a concrete risk or satisfy the current acceptance gate. Record what passed, failed or was blocked. Do not call the app tested or deployed from documentation checks.

Continue authorised reversible implementation without repeated permission requests. If credentials or a business decision block one integration, record it, keep the integration disabled and finish independent work. Production changes follow the user's actual authorisation, not a blanket approval inferred from this file.
