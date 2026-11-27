# Move the portal to the company's Cloudflare account

**27 November 2026 next-phase scope:** [The active N00–N05 plan](../next-phase/README.md) supersedes conflicting instructions below. Use Cloudflare Free only, bounded open-source voice, external billing with version-bound ADMIN commercial clearance, and manually prepared WhatsApp messages with API delivery disabled. Preserve completed work, historical records, access/approval rules and applicable recovery gates. Older finance/provider setup and execution sequences below are retained as reference; they are not current work or permission to enable paid services.

## Ownership and daily use

Jay's account hosts development/staging only. The user will create a separate Cloudflare account owned by the sister/company, clone this repository, and perform the one-time infrastructure setup there. The sister's day-to-day work must use the portal in a browser: invite a person, assign explicit capabilities/projects, copy a private invitation link, and suspend or remove access. She should not need Wrangler, SQL, Google Cloud, or code for those operations.

The latest user instruction supersedes Google-only requirements: use Cloudflare-managed identity. Cloudflare's own identity provider requires a Cloudflare account; email-code login works with an ordinary invited mailbox. The intended simple team option is Cloudflare email codes, with exact-email admission. Staging now uses verified email-code login with the explicitly approved policy-scoped automation credential in platform secret storage. No broad domain/everyone policy is authorized. Infrastructure account membership must not silently grant portal ADMIN, OWNER, or project roles.

## One-time setup by the technical operator

1. Sign in to the company-owned Cloudflare account. Confirm `npx wrangler whoami` and the intended account ID. This repository's current account ID, database IDs, Access identifiers and bucket/queue names point to Jay's staging resources. Cloning code does **not** move them. Replace them deliberately before any company deployment; do not reuse Jay's API token, issuer, audience, bootstrap input or bindings.
2. Create a fresh Zero Trust team and the chosen Cloudflare-managed login method. For email codes, register One-time PIN; no Google OAuth project/client is necessary. Use a dedicated portal Access app and exact invited-email policy, with the selected login method required. Protect all Worker ingress; disable preview URLs.
3. Create the company environment's own D1, private project-file R2, private backup R2, notification Queue and dead-letter Queue. Set exact HTTPS origin, issuer, audience, Access account/app/policy/provider IDs, locale/timezone and disabled WhatsApp mode in named Wrangler environments. Jobs use that same company database and their own queues. Keep public R2 access off.
4. Apply all committed migrations to the new empty database, build for Workers and deploy only the selected named environment. The jobs Worker has no public routes and runs its configured schedule and queue consumer. Verify actual runtime behavior; a Node development server is insufficient.
5. Configure one policy-management credential in platform secret storage as `ACCESS_API_TOKEN` on the web/jobs Workers, using Cloudflare's **Specified Access Policies → Individual Access Policy Admin** scope for the dedicated invitation policy only. `ACCESS_IDP_ID` selects the permitted provider. This is one-time operator work: creating/reissuing/revoking invitations should reconcile admission automatically, with the scheduled worker retrying. Do not hand over a system that still depends on manual Access edits for routine invitations. Verify the provider update succeeds before declaring this handoff complete; local mocks do not prove token permissions or API compatibility.
6. Obtain the sister's exact sign-in email privately. Prepare a fresh protected bootstrap input with the company origin and verified admission; run `scripts/bootstrap-admin.mjs` for that environment once. She accepts as herself. Initial grant is ADMIN only. If she also needs OWNER or project MANAGER authority, make those separate explicit audited grants. Add a separately authorized backup administrator; never share a login.
7. Run the browser-only acceptance walkthrough and a private backup/restore drill before real company records. Keep restored identities/memberships quarantined until current access is reconciled. Confirm automatic invitation admission, wrong-account rejection, suspension, private downloads and permission boundaries on the company deployment.

## Existing staging records

A fresh company installation is the default. No transfer of Jay's staging users, identities, fictional projects or business records is implied. If historical records must move, agree the precise source/target and migration scope first, preserve IDs/history, perform an isolated rehearsal, reconcile financial totals/file bytes and re-establish identities explicitly. Never link by email alone or restore expired invitations as active.

## Browser instructions for the sister

- Open the portal and sign in with the exact invited email using its configured Cloudflare login.
- Under **People & access**, choose **Invite person**, enter their name/email, and assign only the capabilities and projects needed.
- When access is ready, copy the invitation link and share it privately. The portal does not claim to have emailed it.
- If access is still being prepared, use **Refresh invitation access**. Persistent errors go to the technical setup operator; they must not require her to edit Cloudflare policies or code.
- Use **Manage access** for role changes/suspension. ADMIN and OWNER remain separate. Keep a second authorized administrator for continuity.

Production infrastructure configuration, provider credentials and recovery remain operator responsibilities. They are distinct from routine company administration.
