# Design system

Status: implementation specification and design defaults, not an already-built component library. Working title: **Marvel**. Keep name, support contact, firm name and logo paths in one configuration module so renaming does not require rewriting business logic.

## Visual direction

Use warm paper surfaces, deep green-black text, restrained bronze accents and generous alignment. Architectural quality comes from proportion, typography and clear hierarchy. Avoid superhero references, red-box comic wordmarks, glossy gradients, decorative dashboards and large fictional building photographs. Client evidence must always remain distinguishable from illustrative/demo content.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F5F2EB` | Main warm page background |
| `surface` | `#FFFEFA` | Forms, tables and raised content |
| `ink` | `#202822` | Primary text and primary button fill |
| `muted-text` | `#5D665D` | Supporting text and dates |
| `bronze` | `#8A6B45` | Brand accents, large headings, decorative rules |
| `bronze-text` | `#795C39` | Small accent text on paper |
| `sage` | `#E2E8DC` | Selected navigation and quiet emphasis |
| `divider` | `#C9CEC4` | Decorative separators only |
| `control-border` | `#737E72` | Required input/control boundaries |
| `success` | `#356247` | Released, resolved, received |
| `success-bg` | `#E8F2E9` | Success badge fill |
| `warning` | `#885F15` | Due soon, awaiting action |
| `warning-bg` | `#FFF2D6` | Warning badge fill |
| `danger` | `#A73B32` | Overdue, rejected, destructive actions |
| `danger-bg` | `#FBEDEB` | Error badge fill |

Calculated foreground/background contrast examples: ink/paper 13.53:1; muted-text/paper 5.33:1; ink/sage 12.11:1; surface/ink 14.99:1; surface/bronze 4.87:1. Bronze/paper is approximately 4.40:1, so **do not use the brand bronze for ordinary small text on paper**. The pale divider is decorative, not a sufficient standalone input boundary. Recalculate component combinations and interaction states in implementation; a palette table is not an accessibility audit.

Use text plus shape/icon for status. Never communicate rejection, payment or release only through colour.

## Typography

Proposed display family: Source Serif 4, with Georgia and serif fallback. Proposed interface family: Inter, with system-ui and sans-serif fallback. Self-host only files with an appropriate licence recorded in the asset manifest; a system stack is a valid initial implementation. Do not make authenticated screens depend on third-party font requests. Logo artwork can use outlined lettering independently.

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
