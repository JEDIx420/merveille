# Antigravity skill sources and review record

Checked 24 November 2026. This is a source and applicability review for the [implementation setup](../implementation/skills-and-tools.md), not an assertion that external skill bundles or dependencies have received an exhaustive security audit. No external skill or global tool was installed during preparation of this handoff.

## Installation mechanism

| Maintainer source | Verified detail |
| --- | --- |
| [Vercel Labs Skills CLI README](https://github.com/vercel-labs/skills/blob/main/README.md) | Current Node requirement, project installation, lockfile and update behaviour |
| [Skills CLI commands](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) | `--list`, selected `--skill`, `--agent`, `--copy`, project scope and `owner/repo@ref` syntax |
| [Supported agents](https://github.com/vercel-labs/skills/blob/main/docs/agents.md) | `antigravity` and `antigravity-cli` map to `.agents/skills/` for project installation |
| [Google Antigravity rules](https://antigravity.google/docs/rules) and [workflow migration](https://antigravity.google/docs/migration/workflows-to-skills) | Repository instructions and modern local skill conventions; product-specific discovery may depend on the installed IDE version |

Use an exact reviewed CLI version and exact source commits during implementation. Commit the generated `skills-lock.json` and retain licence attribution. Listing a skill does not mean its instructions or scripts have been reviewed. Avoid broad installation or automatic updates from moving branches.

## Selected skill instructions inspected

The actual linked `SKILL.md` files were read, rather than relying only on marketplace descriptions. This review covers their stated behaviour and the references noted below. Complete local bundles, optional executables and dependency trees were not installed or exhaustively inspected. **Bundle-level verdict: INCOMPLETE until P00 inspects the pinned snapshots.** The table identifies where each skill is useful and what must remain constrained.

| Skill and maintainer source | Observed behaviour and project application |
| --- | --- |
| [Cloudflare: wrangler](https://github.com/cloudflare/skills/blob/main/skills/wrangler/SKILL.md) | Uses installed CLI versions, generated types and current official documentation; describes local/remote targets, secrets, migrations and deployment effects. Explicitly applies when the user requests Wrangler. Command examples do not authorize a production deployment or a destructive data operation. |
| [Cloudflare: workers-best-practices](https://github.com/cloudflare/skills/blob/main/skills/workers-best-practices/SKILL.md) | Runtime/configuration review with references for streaming, request-local state, bindings, compatibility and observability. Its [runtime patterns](https://github.com/cloudflare/skills/blob/main/skills/workers-best-practices/references/runtime-patterns.md) were also sampled. Validate version-sensitive claims against the pinned project target; do not add unneeded Cloudflare products from examples. |
| [Anthropic: frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | Design and implementation guidance in the main instruction file. Its aesthetic prompts are subordinate to the actual brand and screen brief. Preserve the source logo; do not invent a replacement, add decorative complexity or treat example assumptions as client requirements. Inspect the bundle's licence before copying. |
| [Vercel Labs: web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) | Reviews UI code against bundled `references/command.md`. The inspected revision explicitly uses a bundled snapshot rather than fetching mutable rules at review time. Its provenance identifies upstream commit `434b7f91364665f2f733b310ec54809bf8f37937`; inspect the installed bundle and keep that provenance. |
| [Microsoft: playwright-cli](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md) | Browser interaction, screenshots, test generation, storage state and script execution. Its declared command permissions are not user consent for actions. Use isolated local/staging sessions, synthetic data and project-scoped files; preserve real account sessions. The installed CLI/package and referenced command files still need review. |

These scope notes do not establish malicious behaviour. They distinguish useful documented capabilities from authority to act on production accounts. If a pinned snapshot materially changes these instructions, review that change before loading it into Antigravity's skill path.

## Conditional vinext migration skill

[Cloudflare's migrate-to-vinext SKILL.md](https://github.com/cloudflare/vinext/blob/main/.agents/skills/migrate-to-vinext/SKILL.md) requires an existing Next application and checks for `next` in `package.json`. It is not the bootstrap step for a directory without an application. Its automation can change dependencies and configuration, so inspect the applicable commands before use.

The inspected instructions default to `cf` and `cloudflare.config.ts` for some Cloudflare initialization flows and document `--legacy-wrangler-cloudflare-init` for a Wrangler path. The client's explicit Wrangler decision governs this project. P00 must verify the compatible path using installed command help; an external migration skill cannot override that decision. See the [vinext README](https://github.com/cloudflare/vinext/blob/main/README.md) and the repository's [runtime sources](cloudflare-sources.md). The optional skill's bundle review remains incomplete until its pinned snapshot and invoked helpers are inspected.

## Playwright dependency and execution references

Microsoft's [Playwright CLI README](https://github.com/microsoft/playwright-cli/blob/main/README.md) documents both the separate `@playwright/cli` package and a local `npx playwright cli` path for Playwright 1.59 or newer. Prefer the already pinned project installation when supported. The main CLI skill includes broad browser operations; choose only the operations needed for the current local/staging acceptance case.

The [official skills documentation source](https://github.com/microsoft/playwright.dev/blob/main/agent-cli/skills.mdx) also documents `playwright-cli install --skills=agents`. The implementation guide instead uses one consistent selected-skills installation method for Antigravity. Installing the Markdown skill does not itself install Playwright or its browser binaries; P00 must set up the runtime dependencies through the chosen package manager and record the actual versions.

## Evidence to add at implementation time

Record source repository, full reviewed commit, skill name, inspected bundled files, licence, chosen CLI/runtime versions and the resulting lockfile in P00 evidence. Note any omitted references or scripts before relying on them. This makes the download reproducible without pretending a moving upstream branch has been permanently approved.
