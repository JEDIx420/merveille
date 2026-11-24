# Design system

Status: implementation specification and design defaults, not an already-built component library. **Merveille Designs** is the confirmed company name. Keep the display name, support contact and original logo paths in the shared brand configuration; components must not invent alternate company names or marks.

## Visual direction

Use the existing gold-on-charcoal identity with warm neutral content surfaces, restrained emphasis and generous alignment. Architectural quality comes from proportion, typography and clear hierarchy. A charcoal navigation rail grounds the complete square logo; readable paper-coloured work areas keep project information central. Avoid glossy gradients, decorative dashboards and large fictional building photographs. Client evidence must always remain distinguishable from illustrative/demo content.

The original artwork is catalogued in the [brand asset manifest](../../assets/brand/README.md). Its sampled charcoal and gold inform the interface defaults; the supporting colours and typography are product design proposals, not an official Merveille Designs brand guideline. Preserve the source artwork exactly, including its embedded tagline. Do not redraw lettering, extract a new monogram, remove the background or create a companion logo.

On desktop, display the complete square logo at approximately 144–160 px wide with equal height and `object-fit: contain`. On mobile, use the published square profile image at approximately 40 px beside the readable company name. The small image is an identity cue; adjacent text supplies readable identification. Use that profile PNG as the favicon until an approved favicon asset is supplied.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F5F2EB` | Main warm page background |
| `surface` | `#FFFEFA` | Forms, tables and raised content |
| `ink` | `#212528` | Primary text and primary button fill |
| `muted-text` | `#5D6264` | Supporting text and dates |
| `gold` | `#F9C65A` | Brand emphasis on charcoal; decorative accents on light surfaces |
| `gold-text` | `#765719` | Small accent text on light content surfaces |
| `selection` | `#EEE5CD` | Selected rows and quiet emphasis on light surfaces |
| `divider` | `#C9CDCF` | Decorative separators only |
| `control-border` | `#747B7E` | Required input/control boundaries |
| `success` | `#356247` | Released, resolved, received |
| `success-bg` | `#E8F2E9` | Success badge fill |
| `warning` | `#885F15` | Due soon, awaiting action |
| `warning-bg` | `#FFF2D6` | Warning badge fill |
| `danger` | `#A73B32` | Overdue, rejected, destructive actions |
| `danger-bg` | `#FBEDEB` | Error badge fill |

CSS tokens use the `--merveille-` prefix (`muted-text` maps to `--merveille-muted`) in [brand.css](../../assets/brand/brand.css). The corresponding brand configuration keys include `gold`, `goldText` and `selection`.

Calculated foreground/background contrast examples: ink/canvas **13.81:1**; muted-text/canvas **5.53:1**; ink/selection **12.30:1**; surface/ink **15.30:1**; gold/ink **9.75:1**; gold-text/canvas **5.97:1**. Gold/canvas is only **1.42:1**: do not use gold for text, essential icons or sole control boundaries on light surfaces. Use `gold-text` for small accent text there. Control-border/surface is **4.27:1** and control-border/canvas **3.85:1**. The pale divider remains decorative, not a sufficient standalone input boundary. Recalculate component combinations and interaction states in implementation; a palette table is not an accessibility audit.

Use text plus shape/icon for status. Never communicate rejection, payment or release only through colour.

## Typography

Proposed display family: Source Serif 4, with Georgia and serif fallback. Proposed interface family: Inter, with system-ui and sans-serif fallback. Self-host only files with an appropriate licence recorded in the asset manifest; a system stack is a valid initial implementation. Do not make authenticated screens depend on third-party font requests. Typography choices apply to interface text only; display the original logo artwork without rebuilding its lettering.

| Role | Desktop | Mobile | Usage |
|---|---|---|---|
| Page display | 36/42 px, regular serif | 28/34 px | One page heading |
| Section heading | 22/30 px, medium serif | 20/28 px | Major groups |
| Body | 16/24 px, sans | 16/24 px | Instructions and prose |
| Dense table | 14/20 px, sans | 15/22 px | Short structured data |
| Label/meta | 13/18 px, medium sans | 13/18 px | Labels, timestamps |
| Financial amount | 20–28 px, tabular numerals | 20–24 px | Meaningful totals |

Avoid all-caps paragraphs. Limit long prose to approximately 70 characters per line. Currency columns and dates use tabular numerals and right-aligned amounts. Display rupee amounts using the configured locale; never calculate money using formatted text.

## Space and layout

Base spacing scale: 4, 8, 12, 16, 24, 32, 48 and 64 px. Desktop navigation is approximately 232 px wide. Main content max-width is 1440 px with 32 px gutters; forms usually use a readable 720 px column. Mobile gutters are 16 px. Dense drawers are replaced by full-width pages/sheets where required on phones.

Use 8 px field/button corners, 12 px cards and modest shadows only for overlays. Avoid turning every line of information into its own floating card. Prefer a well-spaced table or grouped list for operational data.

## Components

- **Page header:** breadcrumb when needed, one title, one contextual sentence and at most one visually primary action.
- **Primary button:** ink fill, surface text, 44 px preferred touch height. Destructive actions use explicit verbs and a separate confirmation.
- **Secondary actions:** text or restrained outline; rare actions in a labelled menu. Do not hide the primary next action inside a menu.
- **Tabs:** for project sections; maintain route state, keyboard focus and selected state. A “More” menu may contain less-used tabs on small screens.
- **Tables:** sticky heading for long lists, readable row density, server-side pagination/filtering and explicit empty results. On mobile, convert to labelled summaries except when the comparison requires an accessible horizontally scrollable table.
- **Status badges:** consistent semantic labels; do not truncate important states such as “Awaiting manager release.”
- **Avatars:** initials are sufficient. Do not require profile photographs.
- **Charts:** useful only when comparing time or workload. Provide an accessible data table and meaningful period labels. No decorative gauge scores or arbitrary percentages.
- **Timeline:** describe approved/public events separately from internal activity. Every row has event time and actor when permitted.

## Accessibility and motion

Target WCAG 2.2 AA and test meaningful flows with keyboard and screen-reader semantics. Ordinary text needs at least 4.5:1 contrast and large text at least 3:1. Use visible focus, labelled inputs, error summaries and programmatic descriptions. Adopt 44×44 px as this product’s preferred touch target; it is a usability default, stronger than the 24×24 px minimum target-size criterion with its exceptions.

Transitions should normally finish in 120–180 ms. Respect reduced-motion preferences. No autoplay site videos, parallax, animated counters or persistent motion behind forms. Dialogs trap focus while open and restore it to the invoking control.

## Sources and checks

Accessibility facts verified 2026-11-24 against [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Contrast figures above were calculated from the listed sRGB colours; they are not a claim that the future application passes all WCAG requirements.
