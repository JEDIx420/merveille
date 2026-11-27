# Sources and provenance

Checked **27 November 2026** for this planning handoff. Reverify current availability, quotas and model status during N00/N03. A vendor's published allowance is not proof of the company's actual plan, enabled resources, usage or application performance. Internal ceilings and acceptance targets in this plan are engineering proposals.

## User and repository inputs

- Latest user direction: Cloudflare free tier only, open-source transcription, prepared manual WhatsApp messages, detailed implementation prompt/plan committed to the existing repo and a short agent kickoff.
- Earlier client reference: Asana Home/My Tasks, activity Inbox, List/Board/Calendar, project and person task views; billing handled outside this portal. The supplied document and screenshots are private inputs and are not copied into this repository.
- Application baseline inspected: `7b8966f0921bedb58f9429546a0729fd78dcb2ae` on `implement/merveille-portal`. See [the current shell](../../src/components/shells.tsx), [tasks](../../src/server/domain/tasks/service.ts), [enquiries](../../src/server/domain/enquiries/service.ts), [notifications](../../src/server/notifications/service.ts), [jobs](../../workers/jobs/index.ts), [web Wrangler configuration](../../wrangler.jsonc) and [jobs configuration](../../workers/jobs/wrangler.jsonc).
- Existing [permission matrix](../product/roles-and-permissions.md), [appearance amendment](../design/appearance-and-celebrations.md) and [remediation evidence](../evidence/remediation/session.md) describe preserved behavior/history. Conflicts are resolved by this phase's work order and latest user instructions.

## Cloudflare primary documentation

| Source | What to verify |
|---|---|
| [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) | Free request/CPU/memory limits, Cron limits, static asset file size and request constraints |
| [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) | Free versus paid runtime behavior and included usage |
| [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) | Read/write/storage allocation, index accounting, exhaustion behavior |
| [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) | Free database size, total storage, query limits and Time Travel window |
| [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/) | Free operations, retention and operation counting |
| [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) | Duplicate delivery and ordering assumptions |
| [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) | Daily free neurons, reset, model-specific rates and paid-model exceptions |
| [Whisper large v3 turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) | Current model ID, input/output schema and hosted availability |
| [GPT OSS 20B](https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/) | Formatter candidate, supported parameters and output/usage behavior |
| [November model retirements](https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/) | Retired endpoints returning 410 from 20 November; do not use stale model examples |
| [R2 pricing](https://developers.cloudflare.com/r2/pricing/) | Standard free allowance, operation categories, storage billing and Infrequent Access exclusion |
| [R2 setup](https://developers.cloudflare.com/r2/get-started/) | Subscription and account activation requirements |
| [Spending controls](https://developers.cloudflare.com/billing/manage/spend-management/) | Product coverage and limitations; do not assume R2 has a hard zero-spend cap |
| [Cloudflare plans](https://www.cloudflare.com/plans/) | Zero Trust Free seat allowance |
| [Access seat management](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/) | Occupied-seat lifetime, admission, revocation versus removal |
| [Zero Trust setup](https://developers.cloudflare.com/cloudflare-one/setup/) | Actual company-account setup prerequisites |

## Model, runtime and browser documentation

| Source | What to verify |
|---|---|
| [Official Whisper repository](https://github.com/openai/whisper) | Model/code licence and multilingual limitations |
| [Official GPT OSS 20B model card](https://huggingface.co/openai/gpt-oss-20b) | Apache 2.0 model licence and supported use |
| [Transformers.js documentation](https://huggingface.co/docs/transformers.js/en/index) | Optional local ONNX inference, supported models, runtime and licence |
| [Transformers.js WebGPU](https://huggingface.co/docs/transformers.js/main/guides/webgpu) | Device support and quantized local-inference options |
| [whisper.cpp WASM example](https://github.com/ggml-org/whisper.cpp/tree/master/examples/whisper.wasm) | Alternative GGML/WASM assets and performance limitations; not interchangeable with ONNX |
| [Clipboard writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) | HTTPS, permission failures and success meaning |
| [Clipboard security behavior](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) | User activation and browser differences |
| [Window opening](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) | Named browsing contexts and same-origin restrictions |
| [Native sharing](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) | Availability, activation, cancellation and promise semantics |
| [Web Share specification](https://www.w3.org/TR/web-share/) | Target privacy and why share success is not message delivery |
| [WhatsApp click-to-chat](https://faq.whatsapp.com/5913398998672934) | Phone/text link behavior; no documented arbitrary project-group targeting contract |

No source here authorizes paid activation, external messages or access changes. Retain the current session's authorization boundary.
