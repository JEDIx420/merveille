# Real-account testing handoff

The coding agent owns migration/build/regression commands. Jay and the pilot team use their own Google accounts in a browser. No persona selection or impersonation is supported.

## Current environment

The existing hosted URL is the previous, unremediated preview. This work has not changed its code, records, identities, or policy. It is **not** the review deployment for this remediation. Local Workers/browser evidence is recorded separately in the [remediation checkpoint](../evidence/remediation/session.md).

A read-only Cloudflare API inspection during this session returned zero Access applications and zero identity providers in the authenticated account. The organization endpoint returned 403. Existing Wrangler deployment authentication is present, but Google OAuth, the Access team/application/audience and review-host ingress protection are not configured or verified. No provider was silently substituted.

Jay's supplied exact Google email is held only in ignored, mode-0600 local setup data. No real identity/address or token is included in this document. Initial bootstrap grants ADMIN only; OWNER, project MANAGER and finance author/issue permissions require separate deliberate grants.

## Setup the operator must complete

1. Select and authorize an isolated review environment, canonical HTTPS hostname, D1 database and private R2 bucket. Keep the existing production records intact. Configure the named Wrangler environment with real resource IDs and the exact `APP_ORIGIN`; never deploy placeholder IDs or the local default to a hosted target.
2. Set up Google through Cloudflare Access using [Cloudflare's personal Google account instructions](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/). Gmail and Workspace addresses work. Use identity/profile scopes only; no Gmail/mailbox access. Store Google client secrets in the provider dashboard, not Git or chat. Register the actual team origin and callback `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`.
3. Protect **every** review ingress/hostname with the selected Google provider and exact invited emails; no domain-wide/everyone/bypass policies. Keep workers.dev/version URLs disabled unless explicitly protected. Configure issuer and audience. JWT verification fetches only that trusted issuer's JWKS and checks RS256 signature, human subject/email, issuer, audience and time claims.
4. Provision a dedicated exact-email Access policy for the app. Configure the optional narrowly scoped reconciliation credential in platform secret storage (`ACCESS_API_TOKEN`), plus account/app/policy/Google-IdP IDs. Scheduled reconciliation updates that dedicated policy, retains pending errors and never treats D1 writes as edge provisioning. An operator may instead confirm the exact-email admission manually; the invitation remains “Awaiting access setup” until confirmed. Application revocation is immediate even if edge synchronization fails. Operator session revocation remains part of the provider procedure.
5. Apply migrations 0012–0020 to a reviewed copy of existing data, then the authorized review environment. Existing duplicate journals/payroll periods or duplicate project snag references intentionally fail protection installation; inspect the read-only `financial_reconciliation_errors` view and reconcile with the responsible administrator. Do not delete or invent money to make migration succeed. Review the local upgrade/restore evidence before remote migration.
6. Prepare the private setup JSON with the exact email and approved review origin; set `accessAdmissionConfirmed:true` only after real admission is verified. Run `node scripts/bootstrap-admin.mjs staging .private/admin-setup.json` for the intended configured environment. This is an operator-only command, not a public endpoint. It writes a digest-only expiring singleton invitation atomically. The shareable link is written only to `.private/bootstrap-link.txt`. Do not send it in logs or commit it. Successful acceptance cannot be reset by deleting the temporary setup input.
7. Deploy the reviewed artifact only with target authorization, then validate actual Google admission, alternate ingress denial, invited identity matching, membership revocation and private file/cache behavior. A built bundle or the local fixture browser harness does not prove these hosted properties.

## Browser walkthrough for Jay and the pilot team

Use fictional project records, separate Google accounts and separate browser profiles. The pilot group is approximately three people, not an account limit.

| Pass | Browser tasks | Expected result |
|---|---|---|
| First administrator | Jay opens the private invitation, signs in with the exact invited Google account, accepts, signs out/in | One active ADMIN; unknown/wrong account, used/expired link and second bootstrap denied |
| Invite collaborators | People & access → Invite person; assign explicit project grants; complete access setup; copy and privately share links | Delivery says copied link, never “email sent”; each person accepts as themselves |
| Delegate administration | Explicitly grant a second ADMIN after recent Google sign-in and confirmation | Second admin manages people; ADMIN alone has no owner performance or manager release; last active accepted admin cannot be removed |
| Prepare and release | Staff uploads/submits a drawing; designated consultant reviews that exact revision; assigned manager releases | Client sees the release; a replacement draft does not replace it; direct unreleased file access fails |
| Commercial work | Staff with finance grant drafts; manager approves; staff with issue grant issues; ADMIN records/confirms outside payment and allocates | Amounts reconcile; no duplicate invoice/ledger; issued history immutable; no checkout |
| Client and representative | Separate accounts open the permitted project and its photos, drawings, permits, decisions and payments | No internal notes, bank evidence or staff data; representative finances only with explicit read grant; binding authority stays project-specific |
| Site work | Assigned staff records task/update/snag evidence; manager publishes update, verifies/reopens resolution | Published evidence is readable; private evidence stays private; overdue links lead to permitted work |
| Revocation/archive | Admin removes project grant/suspends while the account has an open tab; manager archives another project | Fresh reads/writes/downloads/reminders denied after revocation; authorized archived view/download retained; operational mutations denied |
| Phone and failure | Navigate, upload and review on phone; interrupt network and retry | Compact navigation, readable/scrollable tables, explicit error, preserved input, no false saved state |

Record actual identities and results privately. Record public evidence only with fictional business data and sanitized account labels. Three people can take successive passes through audited grant changes; incompatible simultaneous roles need an additional real tester. Untested roles remain outstanding.

## Integrations and recovery

WhatsApp is unavailable until configured templates, pinned Graph version, verified consent/contact and authorized test recipients exist. No real message was sent. Portal notification processing is separate from provider delivery. Queue/Cron deployment, retry/DLQ and signed real webhook delivery require hosted checks.

Configure separate protected `BACKUP_FILES` storage and an isolated restore destination. The local drill recovered actual object bytes, complete financial records and quarantined access. Real remote restore/retention permissions remain unverified. Reconcile current suspensions/grants, revoke old provider sessions and deliberately relink verified identities before reopening restored access. Recovery does not reactivate old invitations or bootstrap credentials.

For a reviewed active legacy account with no identity mapping, use the same protected recovery command with explicit `linkUnbound:true`, a fresh verified assertion and an exact existing user/email mapping. This creates only the audited identity link, preserves existing grants, rejects disabled accounts and cannot overwrite a binding. No ordinary login links by email alone.

For changed Access subjects, use `scripts/recover-identity.mjs` only with authenticated infrastructure access, a fresh verified Access assertion, the expected previous binding, exact email and a reason in a protected local file. It changes only the verified mapping and appends audit; it never grants roles or lifts suspension. Test the provider recovery flow in staging before relying on it.

## Release gate

Hosted Google onboarding, second-admin delegation, all distinct real-role passes, hosted Queue/provider delivery, remote restore and explicit deployment approval remain **blocked/pending**, not passed. Local implementation and tests are evidence for their stated scope only.
