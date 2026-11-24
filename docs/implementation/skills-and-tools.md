# Skills and tools for the implementation agent

Checked 24 November 2026. Start with [START_HERE.md](../../START_HERE.md) and [AGENTS.md](../../AGENTS.md). Skills help execute this specification; they do not replace its product decisions, brand assets, permission model or deployment boundaries. The repository's own entry skill is `.agents/skills/build-merveille/SKILL.md`.

## From an empty folder on the laptop

Inspect the current directory, including hidden entries, before cloning. If it is genuinely empty, run:

```bash
git clone --branch implement/merveille-portal https://github.com/JEDIx420/merveille.git .
node scripts/check-handoff.mjs
```

If the folder already contains the checkout, inspect `git status` and its remote, then resume the existing implementation branch. If it contains unrelated work, preserve that work and use a new `merveille` subdirectory. Never erase a folder, reset a branch or overwrite local changes to make these instructions fit. The application already exists. Do not scaffold it again or create a same-named branch from the planning-only main branch. Follow [the current remediation work order](../remediation/README.md).

Verify Git, Node and the package manager already installed on the laptop. The currently documented Skills CLI requires Node 22.20 or later. Use the existing runtime/lockfile and a compatible Node version; inspect the recorded runtime ADR and package engines before changing versions. Use project-local dependencies and the repository's chosen package manager. Do not change the user's global tools or IDE permissions as a shortcut.

## Curated skill set

First inspect any already installed, pinned project-local skills. Reuse valid reviewed installations; install only missing or necessary skills after inspecting their source. There is no need to install an entire marketplace, update every tool or download every skill in a collection.

| Source repository | Exact skill name | Use in this project |
| --- | --- | --- |
| `cloudflare/skills` | `wrangler` | Current remediation: local bindings, generated types, environments, Wrangler configuration and controlled deployment commands |
| `cloudflare/skills` | `workers-best-practices` | Workers runtime behaviour, private file streaming, D1/R2 bindings, background jobs, secrets and runtime tests |
| `anthropics/skills` | `frontend-design` | Implement the current neutral premium interface, shared components and complete responsive workflows |
| `vercel-labs/agent-skills` | `web-design-guidelines` | Review implemented components for keyboard access, focus, forms, responsive layout and interaction quality |
| `microsoft/playwright-cli` | `playwright-cli` | Inspect actual local/staging screens, exercise role-specific journeys and collect browser evidence |

The maintainer-owned sources, inspected instructions and remaining review scope are listed in [the source record](../references/antigravity-skill-sources.md). The original planning handoff did not install these external skills. Inspect the implementation checkout rather than assuming they are now present or absent.

### Discover, inspect, then install a pinned selection

The maintained [Skills CLI command documentation](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) supports discovery without skill installation:

```bash
npx skills add cloudflare/skills --list
npx skills add anthropics/skills --list
npx skills add vercel-labs/agent-skills --list
npx skills add microsoft/playwright-cli --list
```

Read each selected `SKILL.md` and its bundled references, scripts and agent configuration before activating it. Obtain source snapshots outside the project's skill-discovery directory for that inspection. Select an exact CLI version and full source commit for each reviewed repository; do not claim that a review of today's main branch covers a later download. Record those versions and the inspected files in the current remediation stage evidence.

The commands below are templates using variables that the agent must first populate with those reviewed versions/commits. The CLI supports `owner/repo@ref`, a selected `--skill`, and the `antigravity` agent target. Project scope is the default; `--copy` gives the repository concrete files. Preserve `.agents/skills/build-merveille` and the upstream licence notices.

```bash
npx "skills@$SKILLS_CLI_VERSION" add "cloudflare/skills@$CLOUDFLARE_SKILLS_SHA" --skill wrangler workers-best-practices --agent antigravity --copy --yes
npx "skills@$SKILLS_CLI_VERSION" add "anthropics/skills@$ANTHROPIC_SKILLS_SHA" --skill frontend-design --agent antigravity --copy --yes
npx "skills@$SKILLS_CLI_VERSION" add "vercel-labs/agent-skills@$VERCEL_SKILLS_SHA" --skill web-design-guidelines --agent antigravity --copy --yes
npx "skills@$SKILLS_CLI_VERSION" add "microsoft/playwright-cli@$PLAYWRIGHT_SKILLS_SHA" --skill playwright-cli --agent antigravity --copy --yes
npx "skills@$SKILLS_CLI_VERSION" list
```

Commit the selected skill files, their licence files and the generated `skills-lock.json` with the implementation setup. Do not use `--global`, `--all` or unattended `skills update`. A future update is a deliberate reviewed change. The CLI currently maps Antigravity project skills to `.agents/skills/`; if the installed IDE does not discover them, explicitly read the selected `SKILL.md` files and continue. See [Antigravity conventions](../references/antigravity-sources.md).

If a skill cannot be downloaded, record the limitation, use the official documentation and continue independent implementation. A missing optional skill is not a reason to leave the application unbuilt.

## Keep the requested Cloudflare and Wrangler architecture

The user explicitly chose **Wrangler**. Current Cloudflare skills describe a newer `cf` CLI as a default for some new projects, but the Wrangler skill expressly applies when the user requests Wrangler. Keep a pinned local Wrangler dependency and the repository's documented environment separation. Do not introduce `cloudflare.config.ts`, change deployment tooling or move hosting/storage because a downloaded skill's generic quickstart does so.

The existing application selected Next.js/OpenNext in [ADR 0001](../architecture/decisions/0001-runtime.md). Keep that adapter and the pinned Wrangler workflow. Verify SSR, cookies/headers, mutations and local D1/R2 in the actual Workers-compatible build as affected by changes. The user's request is to improve the existing foundation; no vinext migration or repeated framework-selection spike is needed. If a real runtime incompatibility appears, document it and make the smallest supported fix before considering a new ADR.

Do not install or run a migration skill merely because a generic Cloudflare quickstart prefers a different framework or CLI. Frontend skills must follow [03 — Premium interface](../remediation/03-premium-interface.md): neutral palette, unchanged compact logo, shared CSS Modules/components and no role/view switcher.

## Browser tools and visual quality

Use the real Merveille Designs logo and the approved [design system](../design/design-system.md). A design skill's generic aesthetic advice cannot replace the established identity. Build the portal's actual task, drawing and finance workflows; do not turn it into a marketing landing page or add unrequested AI features.

Use project-local Playwright for repeatable acceptance tests. Microsoft's current CLI documentation also supports `npx playwright cli` with Playwright 1.59 or newer, so an additional global installation is unnecessary when the selected project version supports it:

```bash
npx --no-install playwright --version
npx --no-install playwright cli --help
```

If that interface is unavailable, keep the pinned Playwright test runner and Antigravity's available browser capability while checking the official CLI documentation. Do not install a global tool merely because an example starts with `npm install -g`.

Use isolated fixtures for developer regression tests only. Hosted UAT uses actual invited Google accounts with explicit capability/project grants; no deployed demo identities, persona switches or impersonation. Check desktop and phone layouts, keyboard navigation, loading/empty/error states, private downloads and forbidden actions. Keep authentication state, cookies and real customer data out of screenshots committed to Git. Browser inspection complements executable domain and permission tests; it cannot establish correct server authorization by itself.

## Continue through the entire implementation

Use the next dependency-ready stage in [the remediation manifest](../remediation/manifest.json), R00–R05. The original P00–P14 manifest is historical reference. For each stage, read its specified screen/workflow files, implement the complete server/persistence/UI behaviour, verify its actual acceptance gates, record evidence and make a focused commit. Continue without requesting permission after every phase. Keep `task.md`, `implementation_plan.md` and `walkthrough.md` accurate enough for another session to resume.

Missing Cloudflare credentials, WhatsApp setup or a final operational value should block only dependent integration checks. Complete independent local work, maintain explicit `blocked` states and prepare exact setup instructions. Never replace a blocked real integration with a fabricated pass. Production deployment and live WhatsApp delivery follow the user's actual authorization and [operational inputs](operational-inputs.md); downloading a skill grants neither.

At a context limit, save the branch/commit, current phase, acceptance results, changed files, integration state and one exact next action. A prompt cannot guarantee an unlimited IDE session. The versioned checkpoint is how work continues without repeating discovery or losing decisions. Completion is the repository's verified release gate, not the first attractive dashboard.
