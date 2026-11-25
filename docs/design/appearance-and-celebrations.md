# Dark-first appearance and celebrations

Confirmed 25 November 2026. This amendment supersedes earlier light-only visual defaults; the original logo, workflows and role boundaries remain unchanged. References: [Linear's layered themes](https://linear.app/changelog/2024-03-20-new-linear-ui), [GitHub appearance](https://github.blog/changelog/2021-04-14-dark-and-dimmed-themes-are-now-generally-available/) and [Asana's occasional celebrations](https://asana.com/inside-asana/new-celebrations). All effects are original CSS/SVG/Canvas, without external assets, services or animation dependencies.

## Personal appearance

Dark is the first-visit default. Appearance in the desktop header, mobile header and authentication shell offers Dark, Light and System miniature previews. Signed-in preferences save per organization/user; a non-sensitive local cache applies before paint and synchronizes browser tabs. System follows the local device. Failed saves explain that the local choice could not sync; business actions do not depend on this service. External Cloudflare-hosted identity screens are outside the application theme. Original media/drawing/PDF pixels are never inverted; print remains light.

All application surfaces, controls, loading/error states, semantic statuses and shared/legacy route styles use semantic tokens. Base contrast measurements: dark body 15.66:1, dark muted 6.38:1, light muted 4.97:1, dark control borders 3.59:1 and light control borders 3.65:1. These do not replace full accessibility assessment of arbitrary uploaded content.

## Achievement catalogue

| Committed transition | Full internal effect | External users |
|---|---|---|
| Project created | Blueprint line reveal | Not shown for internal setup |
| Project activated | Two fireworks blooms | Quiet check |
| Task completed | Deterministic rotation: check, trail, small confetti | Internal tasks remain inaccessible |
| ADMIN confirms receipt | Rising sparkles | Quiet check, commercial permission required |
| Issued invoice becomes fully paid | Confetti ribbon | Quiet check, commercial permission required |
| Manager releases a drawing | Drawing-sheet reveal | Quiet check, current released version only |
| Quotation/additional estimate accepted | Approval seal | Quiet check, commercial permission required |

Reported payments, partial settlement and credit settlement do not produce a full-payment celebration. Reopened, withdrawn, reversed, archived or no-longer-permitted records are suppressed. Latest transitions supersede older unconsumed events for the same resource/kind. Existing project activation, drawing approval and money rules are untouched.

## Delivery and controls

Migration 0023 appends presentation events through database triggers in the same transaction as business state. It performs no historical backfill. Events contain resource references, not financial amounts or raw audit payloads. Separate per-user insert-select claims recheck current membership, capability, resource state and preferences, and prevent replay across tabs/devices. Preference and event APIs are authenticated, same-origin and private/no-store.

The client checks on relevant route visits, successful application responses, focus and dialog close; no live push or polling service is added. Remote events are limited to 24 hours and three per visit. Delivery is best-effort: an interrupted display may consume an optional effect but never alters the business result. Ordinary success text/history remains authoritative. No automatic event retention purge is enabled.

Only one effect plays at a time. Particle effects have a 30-second client cooldown; other wins use checks. Lazy Canvas stops within 2.1 seconds, uses fewer particles on phones and never captures pointer events. Native CSS/SVG feedback stays short. Hidden tabs cancel effects. The dismissal control stays present while keyboard-focused, independently of the particle lifetime.

Celebrations offers Full, Reduced and Off. OS reduced motion overrides Full, using static success treatment. Preview controls demonstrate all eight effects without producing business events, messages, assignments or payments. There is no sound. Backups exclude presentation events/claims so restoration cannot replay old celebrations.

## Operator and team review

Apply the additive migration before deploying the matching build. Review both themes and all routes on desktop/tablet/phone, then test saved preferences with actual accounts. Use fictional records for team milestone UAT. Never grant extra roles, manufacture receipts or release drawings merely to demonstrate an effect. Existing R05 acceptance and operational blockers remain separate.
