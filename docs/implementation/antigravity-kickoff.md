# Antigravity kickoff — Merveille Designs

Open an empty project folder in Antigravity, then copy the prompt below. The prompt assumes no application code is present locally and obtains the complete specification from GitHub.

## Copyable prompt

Build the complete Merveille Designs architectural operations and client portal. You are starting in an empty folder on my laptop. Use this repository as the authoritative project specification:
https://github.com/JEDIx420/merveille

**1. Establish the workspace.** Inspect the current folder, operating system and available Git/Node/package-manager tools. If the folder is empty, run `git clone https://github.com/JEDIx420/merveille.git .`. If the correct checkout already exists, inspect its status and resume it. Preserve unrelated files and local changes. Create or resume the feature branch `implement/merveille-portal`.

**2. Read the plan before scaffolding.** Start with `AGENTS.md`, `START_HERE.md`, `task.md`, `implementation_plan.md` and `docs/implementation/manifest.json`. Follow their links to the confirmed requirements, permissions, architecture, design system and deployment guide. Load each phase's detailed screen/workflow files when needed. Run `node scripts/check-handoff.mjs`. Preserve the handoff documents and assets; generate a scaffold in a temporary sibling directory if its generator requires an empty destination, then integrate it intentionally.

**3. Set up and use the relevant skills.** Follow `docs/implementation/skills-and-tools.md` and its source record. Read the repository's `.agents/skills/build-merveille/SKILL.md`. Inspect, pin and install these selected upstream skills for Antigravity at project scope:

- `cloudflare/skills`: `wrangler` and `workers-best-practices`.
- `anthropics/skills`: `frontend-design`.
- `vercel-labs/agent-skills`: `web-design-guidelines`.
- `microsoft/playwright-cli`: `playwright-cli`.

Use the guide's discovery and installation commands with reviewed source commits and a pinned Skills CLI version. Preserve licence notices and commit the skill lockfile. Install only the selected skills; leave global tools and IDE permissions unchanged. The `migrate-to-vinext` skill from `cloudflare/vinext` is conditional: use it only after a compatible Next scaffold exists and its source has been reviewed. If an optional skill is unavailable, use official documentation and keep working.

**4. Preserve the agreed architecture and identity.** All application compute, data, files and jobs belong on Cloudflare, managed through Wrangler. Keep Wrangler even when a downloaded skill defaults to the newer cf CLI. Complete P00's actual workerd compatibility spike, pin compatible dependencies and record the runtime decision; use the documented OpenNext fallback only for an evidenced blocker. Build the premium, restrained, responsive interface specified in `docs/design`. Use the existing Merveille Designs logo and tokens in `assets/brand`, preserving the artwork exactly.

**5. Execute the whole plan.** Work through P00–P14 in dependency order, continuing after each verified phase. For every phase, read its requirements, implement the server behaviour, persistence, permissions and usable UI, then run its meaningful acceptance checks. Exercise desktop and phone layouts in a real browser. Make every visible control work. Preserve consultant drawing approval followed by manager final release, private internal records, financial gates and archived-project access exactly as specified.

Record actual commands, results and acceptance IDs. Foundation evidence satisfies only its stated phase gate; keep full end-to-end cases pending until genuinely tested. Update `task.md`, phase evidence, `implementation_plan.md` and `walkthrough.md`. Make focused commits and push the feature branch when GitHub authentication is available. Preserve existing work and branch history.

**6. Handle blockers without losing momentum.** Continue routine authorised implementation without asking after every phase. Complete independent local work when credentials or provider setup block an integration; document the precise input required and keep that integration explicitly disabled or blocked. Use synthetic data and fake WhatsApp delivery locally. Obtain the necessary authorisation before production provisioning, destructive changes or messages to real recipients. Never report a mock, skipped test or planned deployment as working.

**7. Finish and hand over.** Continue until the repository's implementation and release gates are satisfied, or all remaining work depends on clearly documented unavailable inputs. Before a session/context limit, save the branch/commit, current phase, completed checks, blockers and exact next action so the next session resumes directly. Finish with the real implemented scope, test results, launch commands, deployment state and any remaining operational steps. Begin now by inspecting the folder and obtaining the repository.
