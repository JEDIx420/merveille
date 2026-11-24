# Skills and tools for the implementation agent

Checked 24 November 2026. Start with [START_HERE.md](../../START_HERE.md) and [AGENTS.md](../../AGENTS.md). Skills help execute this specification; they do not replace its product decisions, brand assets, permission model or deployment boundaries. The repository's own entry skill is `.agents/skills/build-merveille/SKILL.md`.

## From an empty folder on the laptop

Inspect the current directory, including hidden entries, before cloning. If it is genuinely empty, run:

```bash
git clone https://github.com/JEDIx420/merveille.git .
git switch -c implement/merveille-portal
node scripts/check-handoff.mjs
```

If the folder already contains the checkout, inspect `git status` and its remote, then resume the existing implementation branch. If it contains unrelated work, preserve that work and use a new `merveille` subdirectory. Never erase a folder, reset a branch or overwrite local changes to make these instructions fit. Do not scaffold a framework into the checkout until you have read the plan; its documentation and brand assets must survive scaffolding.

Verify Git, Node and the package manager already installed on the laptop. The currently documented Skills CLI requires Node 22.20 or later. Choose a Node release also supported by the runtime packages selected in P00, then record and pin the actual versions. Use project-local dependencies and the repository's chosen package manager. Do not change the user's global tools or IDE permissions as a shortcut.

## Curated skill set

Install the following selected skills after inspecting their current source. There is no need to install an entire marketplace or every skill in a collection.

| Source repository | Exact skill name | Use in this project |
| --- | --- | --- |
| `cloudflare/skills` | `wrangler` | P00 onward: local bindings, generated types, environments, Wrangler configuration and controlled deployment commands |
| `cloudflare/skills` | `workers-best-practices` | Workers runtime behaviour, private file streaming, D1/R2 bindings, background jobs, secrets and runtime tests |
| `anthropics/skills` | `frontend-design` | Implement the approved Merveille Designs identity and premium, restrained responsive interfaces |
| `vercel-labs/agent-skills` | `web-design-guidelines` | Review implemented components for keyboard access, focus, forms, responsive layout and interaction quality |
| `microsoft/playwright-cli` | `playwright-cli` | Inspect actual local/staging screens, exercise role-specific journeys and collect browser evidence |

The maintainer-owned sources, inspected instructions and remaining review scope are listed in [the source record](../references/antigravity-skill-sources.md). These external skills have **not** been installed by this planning handoff.

### Discover, inspect, then install a pinned selection

The maintained [Skills CLI command documentation](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) supports discovery without skill installation:

```bash
npx skills add cloudflare/skills --list
npx skills add anthropics/skills --list
npx skills add vercel-labs/agent-skills --list
npx skills add microsoft/playwright-cli --list
```

Read each selected `SKILL.md` and its bundled references, scripts and agent configuration before activating it. Obtain source snapshots outside the project's skill-discovery directory for that inspection. Select an exact CLI version and full source commit for each reviewed repository; do not claim that a review of today's main branch covers a later download. Record those versions and the inspected files in the P00 evidence.

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

P00 evaluates the currently recommended vinext runtime in workerd and records the actual compatibility result. Its beta status means that a browser-only development preview is insufficient. Exercise SSR, cookies/headers, a mutation and real local D1/R2 bindings. Use the documented OpenNext alternative only for an evidenced blocker, with a recorded ADR; do not mix adapters. Follow [P00](phases/00-foundation.md), [architecture](../architecture/overview.md) and the [Cloudflare source record](../references/cloudflare-sources.md).

Cloudflare also publishes a `migrate-to-vinext` skill in `cloudflare/vinext`. This is **conditional**, not part of the initial five-skill setup: its first check requires `next` in an existing `package.json`. Do not invoke it against the empty folder or treat a migration recipe as a fresh-app generator. If P00 produces a Next scaffold and migration is appropriate, review that skill and install only `migrate-to-vinext` from a pinned source commit.

The inspected vinext migration instructions distinguish a default `cf` configuration path from `--legacy-wrangler-cloudflare-init`. Verify the exact supported Wrangler path in the pinned runtime's help and official documentation before changing files. If the Wrangler-compatible setup fails the P00 gate, record the failure and evaluate the documented OpenNext fallback. Do not silently switch the user's infrastructure CLI.

## Browser tools and visual quality

Use the real Merveille Designs logo and the approved [design system](../design/design-system.md). A design skill's generic aesthetic advice cannot replace the established identity. Build the portal's actual task, drawing and finance workflows; do not turn it into a marketing landing page or add unrequested AI features.

Use project-local Playwright for repeatable acceptance tests. Microsoft's current CLI documentation also supports `npx playwright cli` with Playwright 1.59 or newer, so an additional global installation is unnecessary when the selected project version supports it:

```bash
npx --no-install playwright --version
npx --no-install playwright cli --help
```

If that interface is unavailable, keep the pinned Playwright test runner and Antigravity's available browser capability while checking the official CLI documentation. Do not install a global tool merely because an example starts with `npm install -g`.

Exercise synthetic users with separate roles and project memberships. Check desktop and phone layouts, keyboard navigation, loading/empty/error states, private downloads and forbidden actions. Keep authentication state, cookies and real customer data out of screenshots committed to Git. Browser inspection complements executable domain and permission tests; it cannot establish correct server authorization by itself.

## Continue through the entire implementation

Use the next dependency-ready phase in [manifest.json](manifest.json). For each phase, read its specified screen/workflow files, implement the complete server/persistence/UI behaviour, run its acceptance cases, record actual evidence and make a focused commit. Continue without requesting permission after every phase. Keep `task.md`, `implementation_plan.md` and `walkthrough.md` accurate enough for another session to resume.

Missing Cloudflare credentials, WhatsApp setup or a final operational value should block only dependent integration checks. Complete independent local work, maintain explicit `blocked` states and prepare exact setup instructions. Never replace a blocked real integration with a fabricated pass. Production deployment and live WhatsApp delivery follow the user's actual authorization and [operational inputs](operational-inputs.md); downloading a skill grants neither.

At a context limit, save the branch/commit, current phase, acceptance results, changed files, integration state and one exact next action. A prompt cannot guarantee an unlimited IDE session. The versioned checkpoint is how work continues without repeating discovery or losing decisions. Completion is the repository's verified release gate, not the first attractive dashboard.
