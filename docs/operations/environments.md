# Environments, bindings and operational inputs

Status: setup specification. No Cloudflare resources, identity policies, WhatsApp accounts or secrets have been created by this handoff.

## Environment separation

Use local development, staging and production with separate D1 databases, private R2 buckets, queues, Access application audiences, sender modes and credentials. Staging contains synthetic/demo data unless a deliberate migration policy says otherwise. No frontend preview may inherit production secrets or database bindings.

Wrangler JSONC is the infrastructure source of truth. Its [environment documentation](https://developers.cloudflare.com/workers/wrangler/environments/) explains that bindings and variables must be specified per named environment rather than assumed to inherit. For the Cloudflare Vite/vinext path, verify the selected environment at **build time** as well as deploy time; Cloudflare's [Wrangler configuration guide](https://developers.cloudflare.com/workers/wrangler/configuration/) documents the Vite plugin distinction. Record the final commands only after the compatibility spike succeeds.

Use names such as `merveille-web-staging`, `merveille-jobs-staging`, `merveille-data-staging` and `merveille-files-staging`. The confirmed display name is Merveille Designs; keep it centralised with the existing logo asset paths. Naming examples are not provisioned resources.

## Binding inventory

| Binding/configuration | Web Worker | Jobs Worker | Identity provisioning | Purpose |
|---|---|---|---|---|
| `DB` | Yes | Yes | Narrow access as needed | D1 business records and permissions |
| `PROJECT_FILES` | Yes | Only if job needs files | No | Private original/preview objects |
| `JOB_QUEUE` | Producer optional | Producer and consumer | Separate queue or explicit event filter | Retryable work |
| `DEAD_LETTER_QUEUE` | No | Operational handling | No | Exhausted queue work |
| `BACKUP_BUCKET` | No | Dedicated backup job only | No | SQL exports and recoverability manifests |
| `ACCESS_ISSUER` / `ACCESS_AUDIENCE` | Yes | When verifying any app-triggered work | Configuration | Identity verification |
| `APP_ORIGIN` / `APP_ENV` | Yes | Yes | Yes | Origin policy and safe links |
| `BUSINESS_TIMEZONE` | Yes | Yes | No | Due dates and display |
| `WHATSAPP_MODE` | Readable feature state | `fake`, `test` or `live` | No | Prevent unintended sends |
| `META_ACCESS_TOKEN` | No | Secret | No | Authorized outbound API requests |
| `META_APP_SECRET` / `META_VERIFY_TOKEN` | No | Webhook boundary secret only | No | Callback validation/setup |
| `ACCESS_MANAGEMENT_TOKEN` | No | No by default | Secret | Narrow configured policy reconciliation |
| `D1_EXPORT_TOKEN` | No | Dedicated backup job only | No | Export management API |

Optional direct-S3 upload credentials belong only in the upload-signing backend and must be limited to the necessary private bucket/operations. The default chunked Worker upload path does not require browser-visible S3 credentials. A backup management token is not needed in the web process.

## Required owner inputs before live deployment

Record these in private deployment configuration, not public issue bodies:

1. Cloudflare account and zone, production/staging hostnames, billing owner and acceptable resource budget.
2. Initial ADMIN and OWNER verified emails, staff IdP decision, recovery contact and Access policy/seat suitability for all registered users.
3. Company display/legal invoice details, base currency, approved invoice format/number series, opening balances and accounting/reporting basis.
4. WhatsApp Business sender, approved templates, test numbers, recipient opt-in process and external messaging budget.
5. Operational retention/backup owner, export destination, recovery objectives and file-size expectations using actual sample files.

These are launch configuration gates. They do not prevent independent local implementation with isolated identity fixtures, synthetic financial records and fake WhatsApp delivery. Hosted staging/preview uses real invited Google accounts or remains fail-closed; there is no deployed fake identity or role-switching mode. See [the current identity contract](../remediation/02-identity-and-real-user-testing.md).

## Secret setup and isolation

Use the authorized Cloudflare secret flow such as `wrangler secret put` for the exact target environment and Worker after verifying the current CLI help. Keep secrets out of `wrangler.jsonc`, screenshots, committed `.dev.vars`, application logs and browser bundles. Provide `.dev.vars.example` with variable names and empty placeholders only when the runtime scaffold exists.

Separate least-privilege deploy credentials from account-owner credentials. The CI/build identity should not read project files or salary records. If Workers Builds or another approved build runner is selected later, configure its environment separately; do not assume local secret bindings also exist during static/build execution.

The user requested Cloudflare/Wrangler for hosting and data. Identity policy setup may require Cloudflare's management API or dashboard and should be recorded as configuration. WhatsApp sender registration requires Meta setup. Do not promise that a `wrangler deploy` command performs these external prerequisites.

## Configuration examples

Read [example notes](../../examples/cloudflare/README.md) before using the supplied example files. They intentionally have missing entry paths/placeholders and are **not deployable configurations**. The implementation agent must generate an actual scaffold, choose/pin versions, install dependencies, generate binding types and validate each environment's configuration before any deploy.

Do not invoke Wrangler against the examples expecting a safe dry run: cloud tooling can provision resources during setup/deploy. The handoff's validation only checks documentation consistency, not cloud provisioning.
