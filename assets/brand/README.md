# Merveille Designs brand package

**Merveille Designs is the confirmed company name.** Use its existing artwork from the company's [Refrens profile](https://www.refrens.com/merveille-designs), checked 24 November 2026. This is the published gold monogram and wordmark on a charcoal square, including its embedded tagline. No replacement identity is required.

## Files

| Asset | Purpose |
| --- | --- |
| [merveille-designs-logo.png](merveille-designs-logo.png) | Original published company artwork, 683 × 683 RGB, opaque charcoal background |
| [merveille-designs-profile.png](merveille-designs-profile.png) | Existing public Refrens profile rendition, 140 × 140 RGB, for compact identity/favicons |
| [brand.json](brand.json) | Product identity, asset inventory and design-token values |
| [brand.css](brand.css) | Portable CSS tokens |
| [sources.json](sources.json) | Profile/source URLs, retrieval date, image dimensions and SHA-256 integrity hashes |

Both PNG files are unchanged downloads of the published assets. They have not been cropped, recoloured, traced, sharpened, regenerated or given an artificial transparent background. The earlier provisional artwork has been removed from the active repository tree. No vector master is supplied or claimed.

## Usage

Use the full square logo on the sign-in screen and desktop navigation with enough space for its wordmark to read clearly. Use `object-fit: contain` and preserve the square aspect ratio. On mobile, show the published profile rendition alongside a readable Merveille Designs text label; the tiny embedded lettering must not be the only accessible company identity.

The charcoal background is part of the source image. Do not remove it, crop the monogram out, replace the embedded typography or invent a companion symbol. Use the existing profile image as the initial favicon; request a company-supplied approved compact/vector master if a later production context needs one. The current images are sufficient to implement the portal.

The charcoal `#212528` and gold `#F9C65A` tokens are sampled approximations of the artwork. Warm neutral surfaces and the rest of the tokens are proposed portal interface choices. Gold works well on charcoal; use the darker `goldText`/`--merveille-gold-text` token for small accent text on light surfaces. Status must also have a text/icon cue. Detailed contrast and interaction rules live in [the design system](../../docs/design/design-system.md).

The wordmark is supplied as existing artwork; no font binary is required to display it. Proposed interface fonts must be self-hosted with their licence recorded before shipping. Preserve company attribution and provenance; the presence of these company assets in a public repository does not grant a general-purpose licence to reuse the identity elsewhere.

The [static design specimen](../../docs/design/visual-direction.html) shows an illustrative application of the brand. Its data is synthetic and its controls are not an implemented application.

Run `node scripts/check-handoff.mjs` from the repository root to verify the asset inventory and unchanged file hashes alongside the rest of the handoff.
