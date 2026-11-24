# Real-account testing handoff

The coding agent owns migration/build/regression commands. Jay and the pilot team use their own Google accounts in a browser. No persona selection or impersonation is supported.

## Current environment

Staging deployment is explicitly authorized for R05. The operator created an isolated APAC D1 database (`merveille-data-staging`) and private R2 bucket (`merveille-files-staging`), and applied all 20 migrations. The remote reconciliation view reports zero errors. Existing preview/production resources were not modified.

The proposed review origin is `https://merveille-web-staging.rhelo-bible.workers.dev`. Staging ingress and preview URLs stay disabled until Google/Access protection is configured and verified. This is not yet a usable team-testing URL. Issuer/audience are deliberately empty pending actual provider values.

Current Wrangler OAuth has Workers/D1/R2 capability but no Access management scope. Access apps and identity providers each return zero entries; organization lookup returns 403. This does not establish whether a Zero Trust organization already exists.

Jay's exact Google email is held only in ignored, mode-0600 local setup data. Initial bootstrap grants ADMIN only. No hosted bootstrap has run.

## Exact account-owner inputs

1. Finish Cloudflare Zero Trust onboarding if needed and supply the actual team domain.
2. Create a Google OAuth Web client using the team domain as JavaScript origin and `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback` as redirect. Use External audience and identity/profile scopes only. In Google Testing mode add the pilot accounts as test users. Add the client under Zero Trust → Integrations → Identity providers → Google and run Test. Keep its client secret in the dashboard; no secret is needed in chat.
3. Create a short-lived API token scoped only to the connected Cloudflare account, with **Access: Apps and Policies Write**, **Access: Organizations Read**, and **Access: Identity Providers Read** (the dashboard may label Write as Edit). Save its value as `apiToken` and the team URL as `teamDomain` in ignored `.private/access-setup.json` (already created mode 0600). Do not paste the token in chat. This permits the operator to create the dedicated exact-email Google app/policy; the narrower app-policy reconciliation token is stored as a platform secret only if configured.

After these inputs the coding operator handles app/policy creation, actual issuer/audience, protection verification, staging ingress activation, bootstrap and hosted checks. Jay then opens the private bootstrap link and invites colleagues through People & access. No tester email list is required in public documentation.

## Setup the operator must complete

1. Use the authorized isolated staging resources and proposed canonical HTTPS hostname above. Keep the existing production records intact. Configure the named Wrangler environment with real resource IDs and the exact `APP_ORIGIN`; never deploy placeholder IDs or the local default to a hosted target.
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

Hosted Google onboarding, second-admin delegation, all distinct real-role passes, hosted Queue/provider delivery, remote restore remain **blocked/pending**, not passed. Local implementation and tests are evidence for their stated scope only.
