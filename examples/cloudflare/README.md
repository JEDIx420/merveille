# Cloudflare configuration examples

These files are **documentation scaffolds, not runnable or deployable configuration**. They contain deliberate placeholder IDs and nonexistent entry paths. No resources have been provisioned. Do not rename one to `wrangler.jsonc` and deploy it without completing the runtime spike and environment setup.

## Files

- [web.wrangler.example.jsonc](web.wrangler.example.jsonc): intended web bindings and isolated environments.
- [jobs.wrangler.example.jsonc](jobs.wrangler.example.jsonc): queue/scheduled background boundary and disabled outbound messaging.
- [bindings.example.ts](bindings.example.ts): intended binding contracts; generate actual types from the validated Wrangler config when the application exists.

## Implementing the real configuration

1. Complete [architecture compatibility verification](../../docs/architecture/overview.md) and pin the runtime/adapter/CLI versions.
2. Generate the actual vinext/Workers scaffold. Retain its verified entry/assets/build integration; do not copy an OpenNext output path by habit.
3. Create explicit environment resources only when provisioning is authorised; replace IDs and names from actual provider results.
4. Repeat every non-inheritable binding and variable in each selected environment. Confirm the Vite build environment matches the intended deploy environment.
5. Configure protected web hostnames and disable alternate unprotected worker/preview hostnames.
6. Install each secret into only the Worker/environment that needs it. No secret value belongs in these files or `NEXT_PUBLIC_` variables.
7. Generate binding types and verify local Workerd, staging migrations, queue retries and authenticated file access.
8. Enable reminder schedules and live WhatsApp only after operational setup and explicitly authorised test sends have passed.

The identity provisioning and backup management paths need separate least-privilege credentials/configuration if automated. The general web Worker receives neither an Access policy-edit token nor a D1 export token. A webhook route must be narrowly exposed and verify Meta signatures; it is not protected by the browser's Access cookie.

See [environment setup](../../docs/operations/environments.md), [deployment](../../docs/operations/deployment.md) and [source register](../../docs/references/cloudflare-sources.md). The exact commands should be recorded by the builder once generated; this handoff does not pretend those npm scripts already exist.
