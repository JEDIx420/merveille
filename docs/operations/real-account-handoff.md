# Real-account testing handoff

**Latest direction:** The user is moving toward Cloudflare-managed login without Google Cloud configuration, and a separate company-owned Cloudflare deployment. See [company account setup](company-account-setup.md). Staging still uses the previously verified Google method until the prepared native-login policy change is confirmed, saved and tested. The policy-scoped automation credential is prepared for review, not created/configured yet. Historical Google evidence below remains valid for that environment/version only.

The coding agent owns migration/build/regression commands. Jay and the pilot team use their own Google accounts in a browser. No persona selection or impersonation is supported.

## Current environment

Staging deployment is explicitly authorized for R05. The operator created an isolated APAC D1 database (`merveille-data-staging`) and private R2 bucket (`merveille-files-staging`), and applied all 21 migrations. The remote reconciliation view reports zero errors. Existing preview/production resources were not modified.

The protected staging origin is [merveille-web-staging.rhelo-bible.workers.dev](https://merveille-web-staging.rhelo-bible.workers.dev). Worker version `1da9cec8-e065-4e86-8c46-66e01db7be68` contains the hosted invitation-parser correction. Production and old preview are unchanged. Preview URLs remain disabled; no custom Worker routes exist; the file bucket has no public managed domain.

`wrangler whoami` confirms the same account as the signed-in dashboard, explicitly pinned in Wrangler configuration. The dashboard shows the existing Zero Trust team `plain-dream-04be.cloudflareaccess.com`. Earlier OAuth API empty lists did not reflect the dashboard inventory; organization API is 403. Do not infer absent infrastructure from those limited API responses.

Google project `learned-thunder-515717-r7` (Merveille Designs Staging) uses an External testing audience. The owner accepted Google's user-data policy. A dedicated Web OAuth client uses the actual team origin/callback; only email/profile/openid scopes are requested. Its secret is stored in the Cloudflare provider, not the repository or a local credential file. Google PKCE is enabled. The real provider test passed for Jay.

Access app `eb44e1d8-bd9c-437d-8bac-c5a8da71d60c` covers the staging Worker and its exact canonical hostname. Its dedicated policy `66d9b567-8837-42a0-b826-2115aacc5505` includes Jay's privately supplied exact email and requires Google provider `94487aea-8041-48ab-a17c-ec2aff33da29`. Only that provider is available; WARP authentication is off; no everyone, bypass or domain-wide rule was added. Existing unrelated apps/policies were unchanged. Actual issuer/audience are in the named staging configuration.

Jay's bootstrap was explicitly confirmed and accepted through the actual Google-authenticated browser. Hosted session: AUTHENTICATED, roles [ADMIN], zero project grants. One identity binding and one accepted invitation exist. OWNER remains independent: the hosted performance endpoint denied the ADMIN. People & access and sign-out/re-entry worked. Reusing the invitation was denied. Private setup/link data remain ignored and protected.

## Remaining pilot inputs and admission

Supply the other pilot members' exact sign-in emails and deliberate roles privately. The native-login policy amendment and a credential restricted to the single staging invitation policy are prepared in the browser, awaiting required action-time confirmation. Neither has been saved/issued. Existing Google sign-in remains working; the new One-time PIN provider is not yet attached to this app.

Automatic admission is implemented on invitation creation/reissue/revocation and suspension, plus a scheduled retry path and browser **Retry invitation access** action. It is not configured until the policy-only credential is installed in platform secrets and its real provider update is verified. No credential has been created. The implementation refuses a shared policy, preserves other MFA/session/approval and exclusion controls, serializes updates, and marks only the synchronized invitation snapshot ready. Provider failure does not undo a saved invitation or restore revoked application privileges.

After the approved Cloudflare-native method and policy credential are verified, routine invitations should be administered entirely through People & access. Email-code users do not need Google test-user registration. Each person accepts as themselves with the exact invited address. No invitation mail sender is configured; links are copied privately. Current staging still requires the old provider's admission until migration finishes; do not tell new users that email-code login is already live.

Second-admin delegation, other actual-role tests, revocation with an open session, real project-file transfers and full business UAT remain pending.

## Setup the operator must complete

1. Use the authorized isolated staging resources and canonical HTTPS hostname above. Keep the existing production records intact. Configure the named Wrangler environment with real resource IDs and the exact `APP_ORIGIN`; never deploy placeholder IDs or the local default to a hosted target.
2. Follow the latest [company account setup](company-account-setup.md). Cloudflare-managed email-code sign-in removes the Google Cloud dependency; native Cloudflare-account sign-in is a distinct alternative. Configure the selected provider deliberately, verify the actual login and retain signed Access JWT validation. The earlier verified Google setup remains historical evidence, not a required company setup step.
3. Protect **every** review ingress/hostname with the selected identity provider and exact invited emails; no domain-wide/everyone/bypass policies. Keep workers.dev/version URLs disabled unless explicitly protected. Configure issuer and audience. JWT verification fetches only that trusted issuer's JWKS and checks RS256 signature, human subject/email, issuer, audience and time claims.
4. Provision a dedicated exact-email Access policy for the app. Configure the optional narrowly scoped reconciliation credential in platform secret storage (`ACCESS_API_TOKEN`), plus account/app/policy/selected-IdP IDs. Scheduled reconciliation updates that dedicated policy, retains pending errors and never treats D1 writes as edge provisioning. An operator may instead confirm the exact-email admission manually; the invitation remains “Awaiting access setup” until confirmed. Application revocation is immediate even if edge synchronization fails. Operator session revocation remains part of the provider procedure.
5. Apply migrations 0012–0021 to a reviewed copy of existing data, then the authorized review environment. Existing duplicate journals/payroll periods or duplicate project snag references intentionally fail protection installation; inspect the read-only `financial_reconciliation_errors` view and reconcile with the responsible administrator. Do not delete or invent money to make migration succeed. Review the local upgrade/restore evidence before remote migration.
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

Hosted Native-provider onboarding, second-admin delegation, all distinct real-role passes, hosted Queue/provider delivery, remote restore remain **blocked/pending**, not passed. Local implementation and tests are evidence for their stated scope only.
