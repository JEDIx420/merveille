# Open source voice entry

Stage **N03** adds voice entry to the existing Merveille interface under the [free-tier baseline](01-scope-and-free-tier-baseline.md). Start with short lead capture, follow-up notes and task notes. Reuse the component for other agreed text inputs after the first flows pass. The target is useful, polished dictation without routine typing, not a universal assistant or autonomous business operator. Follow the stage order in [README.md](README.md) and verification requirements in [06](06-verification-and-rollout.md).

## Interaction and saved data

The normal path is **capture → transcribe → clean and extract → review → save**. Show recording, processing, review and failure states clearly. Provide stop, cancel, retry, speak-a-correction and optional typing. A recording or model response never creates a business record automatically.

Keep the lead preview to the same six visible items as normal entry: name, contact, requirement, stage, owner, and next action with date. Default owner to the current permitted user and stage to New. Missing facts remain `null`; an initial useful lead may lack phone, budget or a follow-up date. Do not add fields merely because the extractor can produce them.

Example: “Add Anoop. Interiors for a three-bedroom apartment in Kowdiar. Joseph referred him. Remind me tomorrow at eleven to call.” The preview shows the supplied requirement and referral, the current owner and the resolved next-action date. It does not invent a phone number. A spoken correction updates the draft and visibly identifies changed values.

Ground relative dates in **Asia/Kolkata** using the captured request time. Display the absolute calendar date and time before saving. Ask a short choice for unclear names, “next Friday,” morning/evening ambiguity or conflicting instructions. An absent time remains absent unless the user accepts a clearly shown reminder default. Never reinterpret a reminder as an agreed client appointment.

## Model choice and licence boundary

Primary transcription candidate: **`@cf/openai/whisper-large-v3-turbo` on Cloudflare Workers AI**, within the Free account allowance. The [Whisper project](https://github.com/openai/whisper) is MIT-licensed; Cloudflare documents this [hosted batch model](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) and its context prompt. Open source describes licensing. It does not make inference unlimited or keep audio on the device. This route sends audio to Cloudflare, not to OpenAI's external API.

Cleanup/extraction candidate: **`@cf/openai/gpt-oss-20b` on Workers AI**, an [Apache 2.0 model](https://huggingface.co/openai/gpt-oss-20b) with an [active Cloudflare model page](https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/). During the spike, prove actual Free-account availability, schema handling, usable output within a strict total generation cap and accounting for reasoning tokens. Use supported low-effort settings; do not assume an undocumented parameter works. Keep reasoning output out of the interface and logs. Reject truncated or malformed extraction rather than treating it as a partial successful write.

Use an explicit model allowlist and pinned application configuration. No Sarvam, paid transcription, external OpenAI API, prepaid credits or charged fallback is permitted. Recheck the active catalog: Cloudflare [retired several models on 20 November 2026](https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/), including Llama 3.2 1B/3B, Qwen3 30B A3B and whisper-tiny-en. Old tutorial code is not evidence of current availability.

## Meaning, extraction and authority

Cleanup may remove fillers, repetitions and false starts and add punctuation or short paragraphs. It must preserve negation, uncertainty, exact names, measurements, amounts, dates and explicit self-corrections. Do not turn “might approve” into “approved,” or a spoken estimate into a confirmed amount.

Supply only a small vocabulary relevant to the active project or lead. Do not send the user's entire client list or permit the model to select arbitrary projects. Treat both speech and model output as untrusted content. Validate an allowlisted schema, field lengths, enums, identities, record references and dates on the server. Parse amounts deterministically if needed; do not delegate arithmetic to cleanup.

The review screen displays extracted material fields, highlights ambiguous or corrected values, and requires Save. Edits to an existing record show the proposed changes and use the current record version. Missing or ambiguous required values block the relevant action. Conflicts leave the draft available for review.

Persist through existing authorized commands with actor/project checks and audit history. A lead's next action uses the canonical follow-up record, not a duplicate task. Voice cannot grant access, activate a project, approve a drawing or commercial decision, publish an update, or send a message. It can prepare text for the existing authorized workflow. Undo follows existing domain rules; it does not rewrite approved history.

## Capture and Workers constraints

Cap each attempt at **30 seconds**. Capture only after an explicit microphone action; no background listening. Use a browser Web Worker/appropriate audio processing boundary to decode and resample into a tightly specified mono PCM WAV format, initially 16 kHz and 16-bit. At 30 seconds the PCM body is approximately 960,000 bytes, before the small WAV header. Confirm actual model compatibility and mobile encoding behavior in the spike.

The server must validate the accepted WAV header, encoding, channel count, sample rate, declared data length and actual bytes, and derive duration from those values. Reject malformed, oversized or unsupported audio before inference. A client-provided duration is not sufficient. Avoid server FFmpeg, arbitrary container parsing and large audio transforms. Measure validation, transport conversion and response handling against Free's **10 ms CPU** limit; bound or move work if needed. Browser preprocessing does not remove server trust checks.

Default to no stored raw audio and no speech/transcript content in operational logs. Hold a recoverable draft in the foreground session, then discard audio on completion/cancel. Do not upload it to R2 for convenience. Explain cloud processing in the recording interface and inspect provider data handling before launch. Handle mic denial, interruptions, network loss, silence, timeout and provider errors without creating records or losing already reviewed text.

## Daily quota admission

Workers AI Free supplies 10,000 neurons/day; application AI must stop at the lower **8,000-neuron account budget**. Reserve a conservative maximum atomically before each attempt, across users and environments. Count retries and uncertain outcomes; fail closed if reservation or current account allocation cannot be established. Use an idempotent attempt ID so browser retries do not launch duplicate inference. Confirm actual usage against provider metrics. Never replenish a failed/unknown reservation by assuming inference was free.

Initial planning envelope: at most **100 attempts/day**, each no longer than 30 seconds, with at most 2,000 total formatter input tokens and 512 total generated tokens **including reasoning**. The [published neuron rates](https://developers.cloudflare.com/workers-ai/platform/pricing/) imply:

| Component at that envelope | Estimated neurons/day |
| --- | ---: |
| 50 audio minutes × 46.63 | 2,331.50 |
| 200,000 input tokens × 18,182 per million | 3,636.40 |
| 51,200 output tokens × 27,273 per million | 1,396.38 |
| Combined | 7,364.28 |

This is a calculation, not a proven upper bound until tokenization, model-added overhead, minimum charging behavior and completion accounting are verified. The 512-token example is not an immutable quality limit: if reasoning leaves too little room for usable structured output, rebalance to a verified larger per-attempt cap and fewer daily attempts within the unchanged 8,000-neuron budget. Recalculate the reservation before enabling that configuration. Reserve rounding/headroom, include every other account AI consumer, and reduce the admitted attempt count if measured usage exceeds the envelope. Do not trust client token counts. No conversation-history accumulation or unbounded automatic retry is allowed. If quota is exhausted, preserve the draft and offer typing or an already verified local route; explain the next reset without promising uninterrupted voice.

## Optional browser-local fallback

Benchmark a quantized multilingual Whisper model through [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) only if it materially helps real devices or quota recovery. It uses ONNX weights and WASM or [WebGPU](https://huggingface.co/docs/transformers.js/main/guides/webgpu). The [whisper.cpp WASM example](https://github.com/ggml-org/whisper.cpp/blob/master/examples/whisper.wasm/README.md) uses different GGML assets. These formats are not interchangeable. English-only `.en` weights do not satisfy Malayalam input.

Local inference needs model downloads, memory, browser support and battery/latency testing. Large weights can exceed the 25 MiB static-asset limit. Pin and licence-check any upstream model distribution, show first-download progress and cache deliberately. Do not add a GPU server, paid hosting, mandatory local-model download or a broad offline mode. Local fallback is optional scope, not a reason to delay a working primary route or claim equal quality.

## N03 acceptance

Use approximately 50 consented staff recordings covering Indian English, names, identifiers, digits, dates, negation, corrections and site noise. Test Malayalam/code-switching only when the team needs it; agree written output separately. Proposed target: at least 90% of routine notes need no more than a minor correction; report the actual no-typing completion rate independently. Record median and p95 stop-to-review latency on actual phones, browsers and networks, without inventing a provider SLA.

Require zero unconfirmed material changes saved in the exercised cases, valid permission/conflict behavior, successful cancellation and recovery, bounded quota reservations under concurrency, and no inference after a denied budget. Compare cloud and optional local routes only on identical samples. Link reproducible evidence, model settings, measured CPU/usage, failures and remaining gaps from N05. The team must be able to complete the ordinary voice flow without terminal commands.
