# Design system — current target

The authoritative implementation contract is [03 — Premium interface](../remediation/03-premium-interface.md). It supersedes the old warm neutral/gold/serif defaults. This file is a concise index; use the exact token/type/layout tables in that contract rather than maintaining a competing palette.

## Identity and palette

Use the confirmed **Merveille Designs** name and unchanged original artwork in [assets/brand](../../assets/brand/README.md). Display a 40–48px square logo with readable company text in a 64–72px identity/header row. Preserve the image's aspect ratio/background/tagline with `object-fit: contain`.

Use white surfaces, cool-gray canvas, graphite text/buttons and restrained blue links/focus. Gold remains inside the logo; olive/sage, warm paper and gold UI accents are superseded. Small semantic success/warning/error treatments are allowed with text/icon cues. No new logo or illustration is required.

## Shared implementation

Use one semantic `--ui-*` token source and CSS Modules with reusable shell, header, button, field, select, badge, table/list, dialog, drawer, file-preview and feedback components. Remove undefined variables and ineffective utility classes as routes migrate. Legacy brand.css/json interface values describe the existing implementation, not the active target; update their consumers deliberately during remediation while preserving identity metadata and PNG hashes.

Self-host and actually load the licensed Inter weights used in the app; `system-ui, sans-serif` is the fallback. Typography, 4px-based spacing, 44px controls, restrained corners and aligned tables must be consistent. Do not rely on third-party font requests or decorative dashboard tiles.

## Shells and navigation

Separate authentication from the signed-in shell. Use a light desktop sidebar, compact mobile header/drawer and stable project header/navigation. The root/Overview link reaches a useful authorized overview, not runtime diagnostics. Current project switching and account sign-out remain available. Persona/demo/view-as controls do not.

Navigation and queries follow current capabilities/project scope. ADMIN, OWNER and MANAGER are separate. Clients see released/published project information; consultants review assigned versions and see their permitted client commercial records.

## Interaction quality

Use a single clear primary action where appropriate, accessible forms/dialogs, truthful loading/error/empty states and recoverable upload behavior. Photo/drawing previews make evidence readable; unsupported CAD shows metadata and a genuine authorized download. Do not autoplay videos or present fictional data as live progress.

Check actual contrast, visible focus, associated labels, keyboard operation, 320px reflow and 200% text zoom. Respect reduced motion. Validate the real rendered Workers-compatible app; never infer responsive quality from CSS substrings.

See [interaction patterns](interaction-patterns.md), [navigation](navigation-and-content.md) and [delivery gates](../remediation/05-delivery-and-acceptance.md) for workflow/evidence requirements.
