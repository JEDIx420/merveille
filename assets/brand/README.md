# Merveille Designs brand package

**Merveille Designs is the confirmed company name.** Use its existing artwork from the company's [Refrens profile](https://www.refrens.com/merveille-designs), checked 24 November 2026. This is the published gold monogram and wordmark on a charcoal square, including its embedded tagline. No replacement identity is required.

## Files

| Asset | Purpose |
| --- | --- |
| [merveille-designs-logo.png](merveille-designs-logo.png) | Original published company artwork, 683 × 683 RGB, opaque charcoal background |
| [merveille-designs-profile.png](merveille-designs-profile.png) | Existing public Refrens profile rendition, 140 × 140 RGB, for compact identity/favicons |
| [brand.json](brand.json) | Confirmed identity/asset inventory and legacy interface token values awaiting remediation |
| [brand.css](brand.css) | Legacy runtime tokens; the active neutral target is documented separately |
| [sources.json](sources.json) | Profile/source URLs, retrieval date, image dimensions and SHA-256 integrity hashes |

Both PNG files are unchanged downloads of the published assets. They have not been cropped, recoloured, traced, sharpened, regenerated or given an artificial transparent background. The earlier provisional artwork has been removed from the active repository tree. No vector master is supplied or claimed.

## Usage

Use the unchanged full square artwork as a compact 40–48px mark in the top identity row, beside a readable Merveille Designs text label. Use `object-fit: contain` and preserve the square aspect ratio. The tiny embedded lettering must not be the only accessible company identity; no large branded rail is required.

The charcoal background is part of the source image. Do not remove it, crop the monogram out, replace the embedded typography or invent a companion symbol. Use the existing profile image as the initial favicon; request a company-supplied approved compact/vector master if a later production context needs one. The current images are sufficient to implement the portal.

The logo artwork stays unchanged. Its gold/charcoal colors do not dictate the interface. The user superseded the original warm/gold interpretation with [white/cool-gray/graphite styling](../../docs/remediation/03-premium-interface.md). Existing brand.css and brand.json token values describe the legacy implementation until the coding agent migrates consumers; they are not the redesign target. Keep identity metadata and asset integrity while replacing obsolete UI tokens. Status must also have a text/icon cue.

The wordmark is supplied as existing artwork; no font binary is required to display it. Proposed interface fonts must be self-hosted with their licence recorded before shipping. Preserve company attribution and provenance; the presence of these company assets in a public repository does not grant a general-purpose licence to reuse the identity elsewhere.

The [static design specimen](../../docs/design/visual-direction.html) is a superseded historical design, not the new interface target or an implemented application.

Run `node scripts/check-handoff.mjs` from the repository root to verify the asset inventory and unchanged file hashes alongside the rest of the handoff.
