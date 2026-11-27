# Scope and free tier baseline

Stage **N00** establishes the implementation baseline for the upgrade described in [README.md](README.md). The latest user direction, recorded on **27 November 2026**, requires free-tier Cloudflare operation, open-source transcription and staff-completed WhatsApp sharing. These constraints supersede earlier proposals for paid speech APIs, Workers Paid or automated WhatsApp delivery. This file specifies future implementation work; writing it does not establish account configuration or production readiness.

## Preserve and extend the existing application

Retain Next.js/OpenNext, pinned Wrangler configuration, D1, private R2, Cloudflare-managed email-code identity and existing command/permission boundaries. Inspect [web configuration](../../wrangler.jsonc), [jobs configuration](../../workers/jobs/wrangler.jsonc), [jobs handler](../../workers/jobs/index.ts) and [remaining remediation gates](../evidence/remediation/r05-open-gates.md). The jobs Worker already defines a 15-minute Cron, Queue, retry policy and dead-letter queue. Extend working behavior; do not scaffold another application or recreate the jobs foundation.

Implement the stages in dependency order:

- **N01** simplifies Home, Inbox, My Tasks and Projects around the supplied Asana examples, preserving useful workflow and access behavior.
- **N02** adds a small lead tracker, spreadsheet import and a canonical next action with reminders.
- **N03** adds reviewed voice drafts through the [open-source voice specification](04-open-source-voice.md).
- **N04** extends internal reminders and prepares published updates for manual WhatsApp Web sharing. Keep provider dispatch disabled; do not onboard Meta, buy templates or automate a logged-in WhatsApp session.
- **N05** verifies the complete upgrade through [verification and rollout](06-verification-and-rollout.md).

Billing stays in the client's other software. Preserve restricted financial history and replace dependencies on in-portal accounting through the explicitly defined external-clearance transition, not by silently bypassing acceptance or manager authorization. Preserve exact-version consultant drawing approval, manager release, private internal discussion, representative authority, archive access, individual identities and browser-based administration. Clients never approve drawings. The portal remains online-only; voice entry is not a general-purpose AI assistant.

## Free means no automatic paid fallback

Do not enable Workers Paid, prepaid AI Gateway credits, paid speech/model providers, WhatsApp providers or paid infrastructure. Never upgrade to resolve a failed test. A quota failure must stop or defer the affected work with an honest state. No provider call may silently fall back to a charged endpoint.

Record the actual account plans and subscriptions before hosted work. A Free domain plan does not prove that Workers, R2, Access or another account product is configured appropriately. A new metered subscription, billing profile or payment-method change requires actual session authorization; these documents do not supply it. Complete independent local implementation while a dependent operational gate remains blocked.

The company must use its own installation. Budget every resource in that account, including staging, production, previews, backups, logs, administrative tools, retries and unrelated applications. Do not assume another environment receives a separate free allocation. Retain existing staging until an authorized cutover; do not downgrade, delete or disconnect shared resources to make the numbers fit.

## Official allowances

Checked **2026-11-27**; recheck at N00 and record changes. These are provider limits, not measured application usage.

| Service | Published Free allowance or limit | Consequence |
| --- | --- | --- |
| Workers | 100,000 dynamic requests/day; 10 ms CPU per HTTP request and Cron invocation; 128 MB memory; 50 subrequests/request; 5 Cron triggers/account | Low traffic does not remove the per-invocation CPU limit. |
| Static assets | 20,000 files/version; 25 MiB maximum individual file | Large model weights need a deliberate distribution path. |
| D1 | 5 million rows read/day; 100,000 rows written/day; 500 MB/database; 5 GB/account; 10 databases; 7-day Time Travel | Reads include scanned rows; indexes add writes and storage. Exhaustion blocks queries or growth. |
| Queues | 10,000 operations/day; fixed 24-hour retention | Normal small delivery uses write, read and delete; retries and dead-letter handling add operations. |
| Workers AI | 10,000 neurons/day, resetting at 00:00 UTC | Free-plan exhaustion returns errors; no paid credits may be attached. |
| R2 Standard | 10 GB-month/month; 1 million Class A and 10 million Class B operations/month; free egress | This is an allowance in a metered subscription, not a guaranteed zero-overage product. |
| Access | 50 occupied user seats | Include employees, clients, representatives, consultants and other account applications. |

Primary references: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Cloudflare plans](https://www.cloudflare.com/plans/). The [source record](sources.md) preserves research context.

## Proposed internal ceilings

These conservative defaults are implementation proposals. Validate them against actual account occupancy, then configure and expose them to administrators. Decrease available budgets when other resources consume the same allowance; do not raise them above the verified free envelope.

| Resource | Initial operational ceiling |
| --- | --- |
| Dynamic requests | 50,000/account/day; reserve capacity for authentication, administration and recovery |
| D1 | 1 million reads and 20,000 writes/account/day; 400 MB/database, within the account total |
| Queue work | 5,000 estimated operations/account/day, including retry and dead-letter reserve |
| AI | 8,000 neurons/account/day for application AI; bounded attempts as specified in N03 |
| R2 | 4 GB primary plus 4 GB backup, at most 8 GB total; 250,000 Class A and 2 million Class B operations/month |
| Access | 45 occupied or reserved named identities; retain 5 seats for administration and recovery |

Use decimal GB for the proposed storage ceilings. Include original files, historical revisions, imports, staging objects, temporary uploads, multipart parts and backup-rotation overlap. Reserve storage before writes; reconcile reservations with actual objects. Do not delete history, reduce required recovery coverage or overwrite the last valid backup to remain under a cap. Pause new uploads/imports when headroom is insufficient.

Quotas need atomic admission where concurrent actions can overrun a budget, conservative retry accounting and stale-meter detection. Counter failure must fail closed for optional expensive work. Do not describe application counters as provider billing guarantees. Provider hard limits still apply, and operational headroom must protect core access and recovery.

## Three mandatory feasibility gates

### Workers CPU

Measure authenticated SSR, identity checks, mutations, file streaming, import batches and scheduled scans in the actual Workers-compatible build and authorized Free deployment. Record CPU distributions and failures under representative data and concurrency. Network waiting does not count as CPU; parsing, serialization and transforms do. Cloudflare notes that authentication and SSR workloads can exceed the Free allowance. Move suitable spreadsheet/audio work into browser Web Workers, bound payloads, index queries and reduce job batches. Essential routes that still exceed Free limits are unresolved gates, not grounds for a paid upgrade.

### Access seats

An authenticated person occupies a seat until removal or configured expiration; this is not concurrent usage. Revoking a session does not free the seat. Removing a seat alone does not prevent permitted reauthentication. Count accepted users and outstanding invitation reservations, block invitations beyond the ceiling and implement proper application/Access offboarding. Never substitute shared logins, bypass policies or service tokens for human identities. See [seat management](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/).

### R2 overage exposure

R2 requires a subscription and bills usage beyond its allowances. Current [spending controls](https://developers.cloudflare.com/billing/manage/spend-management/) cover Workers and Durable Objects, exclude R2 and explicitly do not guarantee a maximum invoice. Alerts are not caps. Verify the existing subscription, enforce storage/operation admission, and document that provider-enforced zero-overage R2 protection is unavailable. If the required guarantee is stricter than staying inside monitored allowances, leave production uploads blocked pending a resolved design. Do not hide this limitation or activate billing. See [R2 setup](https://developers.cloudflare.com/r2/get-started/).

## N00 completion and N05 proof

N00 evidence must identify the inspected commit, account/environment inventory without secrets, real quota occupancy, permission/workflow preservation map, CPU risks, proposed ceilings and exact unresolved dependencies. Local mocks do not prove Free account eligibility. N05 must demonstrate concurrent admission, quota exhaustion, retry bursts, backup overlap, voice accounting and safe recovery against the chosen budgets. Record local verification, hosted verification and team acceptance separately in [06](06-verification-and-rollout.md); a bounded estimate is not a measured pass.
