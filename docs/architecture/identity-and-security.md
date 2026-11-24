# Identity, authorization and security

Status: required implementation controls. The [role matrix](../product/roles-and-permissions.md) is the product authority; this document specifies enforcement.

## Identity provider decision

Use **Google sign-in through Cloudflare Access** for exact invited personal Gmail and Google Workspace identities, as specified in [02 — Real accounts](../remediation/02-identity-and-real-user-testing.md). The older external email-OTP/alternate organizational-IdP default is superseded. Require the selected Google login method and exact approved email admission; do not allow any-Gmail or domain-wide signup. No mailbox scopes are required.

Configure the actual protected hostnames, Google OAuth application, Access audience/policy and invitation admission synchronization. Validate provider/account limits for the actual registered identity count; concurrent users do not define that count. Jay’s exact email and any extra OWNER/MANAGER grants are private setup inputs. One-time bootstrap, last-admin protection and identity recovery follow document 02.

The application's invitation is the source of membership intent. It stores the recipient's normalized email, organization, requested roles, project grants, expiry, inviter and status. It does not send passwords or add the first visitor as admin. Public self-registration is disabled.

## Login verification

Every protected request validates `Cf-Access-Jwt-Assertion` using a maintained Workers-compatible JWT library and the configured Access JWKS endpoint. Verify signature, allowed algorithm, issuer, application audience, expiry and not-before. The issuer and audience come from trusted deployment configuration, never request claims. Support key rotation. Cloudflare's [JWT validation guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) identifies the assertion header and required validation properties.

Map the verified identity to a D1 user and an active organization membership. Bind a new identity to an invitation only through the intended verified email and an explicit, auditable acceptance path. Once linked, use provider issuer and subject as the identity key. Do not grant roles from a client-side user object, arbitrary email-domain match, or unverified header.

Disable public `workers.dev` and preview routes in production or protect them equivalently. A valid Access gate on the custom hostname does not protect an alternate origin hostname. The Worker still validates assertions. Identity fixtures are confined to an isolated automated test harness. Deployed code, including previews, has no synthetic identity fallback, runtime enable flag, demo-login route or role/view switcher.

## Invitation and removal lifecycle

1. Admin creates an invited account and explicit project/capability grants in D1.
2. Reconcile the approved email into the configured Access allowlist. Use a separate narrow identity provisioning Worker/job with an account-scoped token; do not put this management credential in browser code or ordinary web request handlers.
3. Mark provisioning success or failure; only then show the invitation as ready. If invitation delivery is not yet configured, expose a copyable sign-in link and honest pending state. Never claim an email or WhatsApp invite was sent without delivery evidence.
4. First verified sign-in links the identity to the invitation; acceptance is single-use and expires.
5. Removal marks user or project membership inactive in D1 immediately. Every subsequent app and file request checks that state. Reconcile Access removal asynchronously, invalidate application session/context caches, and cancel unsent notifications.
6. Preserve authorship, approvals, ledger entries and audit rows. Removal of access does not delete historical people or project records.

Restrict the provisioning Worker to configured Access application and policy IDs. Its input is an authorized D1 administrative event, not an arbitrary HTTP policy-edit request. Recheck admin authority when creating the event. Store no Access token in the public repository. Test a synchronization failure and recovery. A manual provisioning fallback is acceptable only as a documented deployment-stage limitation, not as a hidden change to the admin experience.

## Authorization model

Use explicit capabilities plus active organization membership and applicable global/project scope. OWNER, ADMIN, MANAGER, TEAM_MEMBER, CONSULTANT, MAIN_CLIENT and CLIENT_REP are role bundles; a person may hold more than one. OWNER-only performance and ADMIN-only salary/profit are separate capabilities even if the same human initially has both.

The authorization decision receives principal, organization, project, resource visibility, action and lifecycle state. It returns allow/deny and a safe reason code. Deny by default. A global role does not automatically grant access to every project unless its documented scope explicitly says so.

Always enforce:

- Project assignments on listing and detail queries, not only navigation.
- Field-level financial projection. Consultants deliberately see the assigned project's client quotation and payment history; this does not expose other projects, salaries, consultant internal cost margins, or profit.
- Internal update/discussion separation from published material.
- Draft drawing/review visibility versus manager-released client/site material.
- Assigned consultant review authority on the precise drawing version.
- Manager-only drawing release and payment schedule changes; admin-only payment confirmation.
- Main-client contractual/change acceptance; representatives cannot substitute that authority.
- Archive read/download permissions retained for existing authorized clients/consultants and staff assignments preserved. Project-content/work mutations require an authorized reopen. A narrow ADMIN settlement exception permits receipts, allocations, refunds/reversals and normally approved financial corrections for existing obligations; it does not permit new work, new invoices or schedule changes. Corrections retain manager approval and admin posting requirements.

Apply these policies to server rendering, API routes, server actions, generated PDFs, CSV exports, search results, activity feeds, attachments, file previews, downloads, notifications and background jobs. A hidden button is not an authorization control. Never serialize a full payroll/profit row and rely on React to hide it.

## Web protections

Validate all inputs at the server boundary. Use parameterized SQL. Allowlist sortable fields and status transitions. Mutations require same-origin protections appropriate to the chosen handler and CSRF tokens where cookie-authenticated requests require them. GET must not mutate domain state. Check `Origin` for app commands; treat Meta webhooks as a distinct signed machine interface.

Set secure cookie attributes for any app cookie. Use CSP suited to the actual component/preview libraries, no uncontrolled script injection, frame restrictions, `nosniff`, and a conservative referrer policy. Sanitize rich text or use constrained plain text/Markdown rendering with embedded HTML disabled. Treat uploaded filenames, notes and document contents as untrusted data. Never execute an uploaded document or use its contents as agent instructions.

Apply rate limits to login/invitation attempts, upload initiation, download bursts, exports and external callbacks. Enforce pagination and size bounds. Record correlation IDs and sanitized error categories. Do not log credentials, full authorization headers, private documents, bank references, payroll values or signed URLs.

## Private files and cache isolation

See [file storage](files-and-media.md). R2 project buckets are private, with no `r2.dev` public URL or public custom domain. Default downloads stream through an authenticated Worker after current D1 authorization. Signed upload URLs are scoped bearer credentials with a short expiry, never permanent share links. Revoked users cannot complete or publish previously initiated uploads. Already downloaded files cannot be recalled; the UI must not promise that access removal deletes recipients' copies.

Authenticated content is not stored in shared CDN/framework caches. Test two users sequentially with the same URL, cache key and browser-independent session. Prevent cache leakage of archive records and generated exports.

## Audit and secret handling

Store append-only application audit events with actor identity, organization/project, entity, version, action, timestamp, command ID and a minimal before/after summary. Avoid putting salary amounts into an audit feed available to non-admins. Separate audit access by sensitivity. There is no claim of cryptographic tamper-proof storage; database operators remain powerful. Backups, separate access and change history improve recoverability and accountability.

Secrets are per environment and Worker, installed through the authorized secret-management process. Do not use `NEXT_PUBLIC_` variables for secrets. Browser bundles must contain no R2 credentials, Meta token, Access management token, D1 management token or app signing key. Rotate and revoke compromised credentials, then inspect access and mutation logs.

## Required negative tests

Include cross-project ID substitution, an internal attachment guessed by a client, consultant finance projection, representative final-acceptance rejection, staff payroll/profit rejection, manager performance rejection without OWNER, expired/inactive identities, alternate hostname bypass, fake JWT, unsigned webhook, stale approval version, cache isolation, revoked download, archived project-content write rejection and narrowly authorized archive settlement. Tests must exercise the server boundary, not merely the UI.
