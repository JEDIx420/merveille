# P00 — Runtime foundation and compatibility

**Status:** not started. **Dependencies:** none.

## Outcome

Prove the chosen Next.js-style runtime works on Workers before business modules are built.

## Read before implementation

- [overview.md](../../../docs/architecture/overview.md)
- [environments.md](../../../docs/operations/environments.md)
- [design-system.md](../../../docs/design/design-system.md)
- [README.md](../../../examples/cloudflare/README.md)
- [skills-and-tools.md](../skills-and-tools.md)

## Implementation order

1. Inspect this non-empty repository and follow the skill/tool bootstrap. Record the reviewed skill sources, pinned versions and available toolchain. Preserve the documentation and authentic company assets while scaffolding; if a generator requires an empty destination, use a temporary sibling folder and integrate only the required application files.

2. Verify current official framework support and the Wrangler-compatible installation path. Evaluate vinext first and record exact package/Node/Wrangler versions in an ADR. If using its migration skill, create the compatible Next scaffold first: that skill requires an existing Next dependency. Current generic skill defaults may use cf; preserve the user's explicit Wrangler choice. Use the documented OpenNext alternative only for an evidenced blocker; do not combine adapters.

3. Set up TypeScript, package scripts, a lockfile, local bindings, generated environment types and a minimal accessible branded shell.

4. Exercise App Router SSR, a mutation, headers/cookies, prepared D1 query/batch and streamed R2 read/write in workerd.

5. Create a test-only synthetic principal mechanism that cannot be enabled in deployed configurations; auth implementation follows in P01.

6. Capture command output and the compatibility decision. Do not create paid production resources as part of a local spike.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `package.json and lockfile`
- `src/app/layout.tsx and baseline pages`
- `src/shared/config.ts`
- `verified framework configuration and local Wrangler configuration`
- `tests/runtime/`
- `docs/architecture/decisions/0001-runtime.md`

## Acceptance cases

Run AC-064 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

A clean checkout reproduces a local Workers build/preview, one D1 operation and one private R2 operation with pinned versions. Existing handoff files remain intact.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
