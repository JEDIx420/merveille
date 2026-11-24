# Real accounts, administration and acceptance testing

**Current amendment:** The user now permits Cloudflare-managed sign-in with individual invited email identities; Google Cloud/OAuth is not required for the eventual company installation. The same exact-email invitation, signed Access JWT, immutable issuer/subject binding, independent capabilities and revocation rules below still apply. See [company account setup](../operations/company-account-setup.md). Provider changes must not silently relink identities by email.

## Outcome and scope

Merveille Designs must work with each person's own Google account. Jay is the initial administrator; he can invite another administrator, teammates, consultants and client contacts. Three people form the initial testing group, not a user limit. Keep Cloudflare Access, Workers, Wrangler, D1 and private R2; application permissions remain in D1.

Remove demo logins, persona buttons, role selectors, “view as” controls and synthetic authentication from deployed code, including previews. Account menus show the actual person and sign-out. Administrators still manage other people's permissions; users still switch between their assigned projects. Neither action impersonates another identity.

This document specifies remediation work. It does not claim Google, Cloudflare Access, invitations or real-account testing are already configured.

## 1. Repair the authentication boundary first

At the audited implementation revision, [`session.ts`](../../src/server/auth/session.ts) permits synthetic fallback through `ALLOW_SYNTHETIC_AUTH`, collapses multiple roles into one and invents an organisation when membership is missing. [`jwt.ts`](../../src/server/auth/jwt.ts) decodes tokens without cryptographic signature verification. Replace these behaviours before inviting testers. Audit the effective top-level and named environments in [`wrangler.jsonc`](../../wrangler.jsonc); a safe named production block does not secure a different deployment target.

Use Google's personal-account-compatible identity provider through Cloudflare Access. Support invited Gmail and Google Workspace accounts. “Gmail access” means identity and email address: request no inbox, contacts, mail-reading or mail-sending scopes. Use the identity scopes required by the provider, with basic profile only where needed. [Google setup][google-access] and [identity claims][google-oidc] explain the provider boundary.

Configure the Access application to require the selected Google login method and include exact approved/invited email addresses. Do not allow everyone, every Google account, `gmail.com`, or an entire business domain. Review all effective policies for bypasses. Access admission alone never grants project access. [Access policy semantics][access-policies] are the configuration reference.

For incoming requests, use Cloudflare's authenticated `ctx.access` only if the actual Next/OpenNext deployment exposes it with the required identity. Static Assets routing and Service Bindings have documented limitations. Otherwise verify `Cf-Access-Jwt-Assertion` with a maintained JWT library and the configured Access JWKS endpoint. Require the expected issuer and application audience, an allowed algorithm, valid signature, nonempty human subject/email, valid expiry and applicable time claims. Reject missing configuration, service-token identities and malformed assertions. Obtain keys only from the configured trusted issuer, supporting rotation. Decoding a JWT or checking that a header exists is insufficient. Follow [validation][jwt-validation] and [Workers integration][workers-access].

Protect every deployed hostname, preview and alternate ingress, or disable it. Keep private files behind authenticated handlers. Validate state-changing requests against the actual canonical origin and the framework's CSRF protections; reject unsupported cross-origin writes. GET requests must not mutate access. Restrict post-login destinations to safe local paths. Reconcile `APP_ORIGIN` with the real deployment before using it in validation or invitation URLs.

## 2. Bind identities deliberately

Create an external-identity mapping with unique `(issuer, subject)` linked to the application's immutable user ID. The verified Access email is used for invitation matching; it is not the primary identity key. Cloudflare documents its email as provider-verified, while its `sub` identifies the Access user and can change after removal/re-addition. It is **not Google's raw `sub`**. [Access token claims][access-token] and [Google claims][google-oidc] distinguish these identities.

At initial acceptance, require the configured Google authentication path and exact invited email after documented casing/whitespace normalization. Never remove Gmail dots, strip `+tags`, infer aliases or trust browser profile fields. Do not require an invented `email_verified` claim in an Access token; establish verification through the documented provider chain. Persist the verified Access issuer/subject. If a binding changes, stop automatic linking and require an audited administrator recovery action with renewed identity verification. Never silently attach a new subject to an existing privileged account by email alone.

Migrate existing legitimate users through controlled linking. Identify seeded demo users separately; preserve referenced history without turning their fabricated emails into real invitations. Never overwrite an existing binding or grant capabilities during migration without an explicit reviewed mapping.

## 3. Bootstrap Jay once

Jay's exact Google email is an **operational input**. Obtain it privately during setup; do not infer it from GitHub, profile details, commit authors or test fixtures. Do not put it in this public repository.

Provide an operator-run, one-time setup command using the intended Wrangler environment. It creates an expiring bootstrap invitation for that exact address and a persisted singleton bootstrap record. Google authentication and exact email matching must still precede activation. Atomically consume the bootstrap record, bind the identity, activate organisation membership and grant `ADMIN`, using supported D1 atomic operations and uniqueness constraints. Concurrent acceptance must produce exactly one initial administrator. Existing successful bootstrap state cannot be reset by an environment toggle or another login.

Never implement “first person to sign in becomes admin.” Initial `ADMIN` does not imply `OWNER` or project `MANAGER`; grant those separately if Jay explicitly requires them. Disable the setup path after success and remove its temporary secret. Keep bootstrap events in the audit log without tokens.

Protect the last active administrator from suspension, organisation removal or capability revocation, including simultaneous requests. Count active, accepted administrators, not pending invitations. Document an operator recovery procedure using authenticated infrastructure access, identity re-verification and an audited repair; do not add a public recovery password or login bypass. Test recovery in staging.

## 4. Invitations and access changes

Implement the lifecycle through the existing identity service, people APIs, People screens and invitation-accept page:

1. **Prepare:** an active administrator enters the exact email, visible name, capability grants and specific projects. Default to no project access. Show `ADMIN`/`OWNER` elevation separately from ordinary project assignment; require an explicit confirmation and verified recent authentication for elevation.
2. **Create:** persist an invitation with organisation, inviter, proposed grants, expiry and status. Generate a cryptographically random token of at least 256 bits, store only its digest, and use a configurable 72-hour expiry as an engineering default. Never log tokens or include them in analytics/referrers.
3. **Provision edge admission:** synchronize the exact email into the app's dedicated Access allowlist using a narrowly scoped server credential. Use retryable work and reconciliation because D1 and Access changes are not one transaction. Until confirmed, show “Awaiting access setup.” An operator may complete the explicit allowlist step during setup; do not claim self-service onboarding complete until this dependency works. Remove unused pending admissions after expiry/revocation without removing another valid grant.
4. **Share:** display “Copy invitation link” when automatic delivery is unconfigured. Creating a database record or Access rule does not send email. A configured sender must report actual delivery state separately. Do not invent a mail service, mailbox integration or additional backend. Invitation delivery is an operational setup item; no real messages are authorized by this document.
5. **Accept:** require Google login, matching verified email, current invitation status and valid token. Show a clear wrong-account state with sign-out/account-change guidance. The token alone grants nothing. Revalidate the inviter's current authority and the stored proposed grants before an atomic, single-use acceptance. Create or deliberately update the existing user's memberships; do not duplicate identities or silently expand grants on repeated acceptance.
6. **Expire/revoke/reissue:** show distinct states. Reissue rotates the token and invalidates earlier links. Repeated submission is safe and auditable. Rate-limit acceptance and invitation creation without exposing whether arbitrary addresses belong to the firm.

An uninvited Google account receives a neutral access-denied state with support guidance, not automatic registration. A valid but unaccepted invitation permits only the acceptance flow. A disabled user cannot reactivate through an old invitation. Membership changes for existing users are explicit administrator actions.

Disable access in D1 first, revoke application sessions where applicable, then revoke Access sessions/update admission through retryable operations. Failure to synchronize the edge must not preserve application privileges. Recheck current account, organisation and scoped membership for every request, consequential write, download, export and notification dispatch; do not rely on stale role claims or long-lived permission caches. Previously downloaded files cannot be recalled.

## 5. Preserve capability and privacy rules

Implement a set of capabilities plus current project/record scope, not a highest-priority role. Follow the existing [permissions matrix](../product/roles-and-permissions.md):

| Authority | Required boundary |
|---|---|
| `ADMIN` | People/access, receipt confirmation, salaries and profit; no implied individual-performance or manager-release authority. |
| `OWNER` | Individual performance; no implied payroll/profit access or account administration. |
| `MANAGER` | Assigned-project control, invoice approval, schedule changes, update publication and final drawing release. |
| `TEAM_MEMBER` | Assigned work and explicitly granted finance actions; no authority acquired from a UI label or a `STAFF` fallback. |
| `CONSULTANT` | Assigned drawing review and approved commercial visibility: client quotation/payment history, excluding internal discussions and sensitive evidence. |
| `MAIN_CLIENT` / `CLIENT_REP` | Separate project-specific identities; only the designated main client accepts binding quotations/changes/material decisions. Neither approves drawings. |

Missing or inactive organisation membership fails closed. Project roles do not follow a person into another project. Where implementation currently uses `STAFF`, migrate or explicitly map it to documented `TEAM_MEMBER` capabilities. Preserve authorized archive read/download access while making suspension and revocation take precedence. Lists, search, counts, reports and files must enforce the same rules as detail pages.

## 6. People and Access interface

Use one calm people table: name/email, status, capability summary, assigned projects and last activity. One primary “Invite person” action opens a focused form. Row details provide scoped role/project editing, invitation renewal/revocation and account suspension. Show Pending setup, Invited, Active, Expired, Revoked and Disabled accurately; do not label a copied link “Email sent.”

Display access-change consequences and last-admin protection inline. Record actor, target, before/after grants, project scope, timestamp and reason for privileged changes. Keep this audit accessible to authorized administrators. Show current-account identity in the shell, with no “Preview role,” “Test user,” impersonation action or identity cookie editor. Permission errors preserve safe navigation and disclose no hidden project details.

## 7. Acceptance with three real people

Jay supplies the real tester identities privately and invites them through the product. Use separate browser profiles owned by those people and clearly labelled test projects/data. Three testers can cover multiple passes through genuine, audited permission changes; never build a persona switcher to accelerate testing.

| Pass | Real-account checks |
|---|---|
| Initial administration | Jay accepts bootstrap, signs out/in, invites B and C. Unknown email, wrong Google account, expired/replayed invitation and second bootstrap fail. |
| Internal collaboration | Give B explicit `TEAM_MEMBER` and project `MANAGER` grants where needed. Confirm assigned work, manager publication/release and independent capability combinations. |
| External access | Give C consultant access to Project A and no Project B membership. Check exact drawing review, client quotation/history, internal-note exclusion and direct-link denial for B. |
| Client authority | In a separate test pass, remove C's consultant grants and assign main-client authority on A, representative access on B. Verify contractual boundaries, published drawings and finance grants. |
| Revocation and archive | Remove a project grant or suspend C while signed in. Existing tabs, API requests, file links and queued reminders stop future unauthorized access. Restore deliberately; confirm archive access remains scoped. |
| Second administrator | Jay explicitly elevates B; B signs in with their own account and performs access administration. Verify last-admin protection and that `ADMIN` alone reveals no owner-performance view. |

Use additional real testers if simultaneous business roles are needed. Automated policy tests may use isolated fixtures in the test harness; they must never create deployed login routes, fallback credentials, seeded privileged sessions or a runtime flag that enables synthetic identity. Keep WhatsApp delivery in the existing sink until an actual recipient and test send are explicitly authorized.

Record actual staging evidence for forged/missing/expired assertions, wrong issuer/audience, bootstrap and invitation races, multi-capability access, current-membership revocation and alternate-host protection. Capture desktop/mobile login and People screens without personal emails or tokens in public artifacts. No checked box may substitute for a real Google/Access integration run.

## 8. Operational prerequisites and completion

Before declaring real-account onboarding ready, record:

- Private initial-admin/tester emails and separately approved capability grants.
- Cloudflare account/team, protected hostnames, Access application audience and exact-email policy; server credential and reconciliation ownership for invitation admission.
- Google OAuth web-client credentials, consent-screen audience/publication or test-user setup, and working personal Gmail/Workspace sign-in. Register the actual Access team origin and callback `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`; store secrets only in appropriate platform storage. [Setup reference][google-access].
- Correct environment bindings/origins, bootstrap execution record, recovery owner, and invitation delivery mode.

If provider credentials are unavailable, finish independent implementation and automated verification, leave authentication fail-closed, and report the exact blocked integration check. Never restore demo access to conceal an incomplete setup.

## Official references

Checked **24 November 2026**. Recheck provider instructions before operational configuration; the design decisions above remain the project contract.

- [Cloudflare: Google identity provider][google-access]
- [Cloudflare: Access policy rules][access-policies]
- [Cloudflare: JWT validation][jwt-validation]
- [Cloudflare: Access in Workers and context limitations][workers-access]
- [Cloudflare: application token identity fields][access-token]
- [Google: OpenID Connect identity and scopes][google-oidc]

[google-access]: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/
[access-policies]: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
[jwt-validation]: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
[workers-access]: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
[access-token]: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/
[google-oidc]: https://developers.google.com/identity/openid-connect/openid-connect
