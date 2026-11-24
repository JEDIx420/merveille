# Technical source register

Checked: **24 November 2026**. These are primary-provider references for engineering decisions. Recheck before pinning versions or enabling production services. The portal's business rules come from the recorded user decisions, not provider documentation.

| Topic | Primary source | How used |
|---|---|---|
| New Next.js deployment direction | [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) | vinext is the documented new-app path; compatibility spike required |
| Adapter maturity and gaps | [vinext project README](https://github.com/cloudflare/vinext) | Active development and required-feature compatibility verification |
| OpenNext alternative | [Cloudflare OpenNext guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/) | Supported fallback when an evidenced compatibility gap prevents chosen baseline |
| Tool auto-configuration behavior | [Automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/) | Commands can choose different adapters; do not depend blindly on detection |
| Infrastructure configuration | [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) | JSONC, bindings, secrets separation, Vite environment caveat |
| Environment boundaries | [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) | Explicit per-environment variables/bindings |
| Identity proxy | [Access web applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/) | Protected hostname and identity boundary |
| External user login | [Access one-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/) | Approved-email OTP and invitation provisioning |
| Identity verification | [Validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) | Assertion header, issuer/audience/time validation and key rotation |
| D1 transaction API | [D1Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/) | Batch atomicity and explicit consistency behavior |
| Request limits | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | Bounded chunked/streamed uploads and runtime limits |
| Multipart uploads | [R2 multipart Worker guide](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/) | R2 binding upload sessions and part operations |
| Direct upload alternative | [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) | Scoped bearer operation URLs and expiry limitations |
| Browser upload origins | [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) | Explicit origins/methods/headers for direct S3 option |
| Retry semantics | [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) | At-least-once processing and idempotency |
| Scheduler | [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) | UTC scheduling with application business timezone |
| Recent database recovery | [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) | Bounded recovery window; not indefinite retention |
| Database exports | [D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/) | Precision/export constraints and restore procedure |
| Long-term export pattern | [Export D1 to R2](https://developers.cloudflare.com/workflows/examples/backup-d1/) | Resumable export job/Workflow option |
| WhatsApp delivery | [Meta WhatsApp overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/) | Sender API, templates and configuration prerequisites |
| Message templates | [Meta template API](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-hsm/) | Approved template setup and variable structure |
| Messaging consent | [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy) | Opt-in/opt-out and current channel requirements |
| Callback validation | [Meta webhook setup](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/) | Raw-payload SHA-256 signature verification and deduplication |

## Known documentation drift

At review, Cloudflare's new-app Next.js guide recommended vinext while automatic-configuration pages described different adapter choices for different commands. Therefore the project requires an explicit chosen adapter and tested version matrix rather than blindly copying one “deploy” snippet. The recommendation is a starting point; maturity and required-feature compatibility must be established in Phase 0.

No provider pricing, guaranteed uptime, unlimited retention, automatic malware scanning, unbreakable access control, or statutory accounting compliance is asserted by this handoff.
