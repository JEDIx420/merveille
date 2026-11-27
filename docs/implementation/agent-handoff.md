# Agent handoff and continuity

**27 November 2026 next-phase scope:** [The active N00–N05 plan](../next-phase/README.md) supersedes conflicting instructions below. Use Cloudflare Free only, bounded open-source voice, external billing with version-bound ADMIN commercial clearance, and manually prepared WhatsApp messages with API delivery disabled. Preserve completed work, historical records, access/approval rules and applicable recovery gates. Older finance/provider setup and execution sequences below are retained as reference; they are not current work or permission to enable paid services.

## Canonical entry points

Read [START_HERE.md](../../START_HERE.md). [AGENTS.md](../../AGENTS.md) contains repository-wide rules; [GEMINI.md](../../GEMINI.md) and [agent.md](../../agent.md) are short compatibility pointers. The active plan is [docs/remediation](../remediation/README.md), with R00–R05 dependencies. The [original roadmap](roadmap.md) is historical specification; the existing application must not be scaffolded again.

The repository-local build-merveille skill lives under .agents/skills/build-merveille and can be invoked by a compatible Antigravity installation. The root documents remain usable by any implementation agent. No personal skill installation, IDE account setting or global tool permission is changed by this repository.

For an empty project folder on the laptop, use the [complete kickoff prompt](antigravity-kickoff.md). Follow [skills and tools](skills-and-tools.md) for selected project-local skill installation and the explicit Wrangler constraint; [the source record](../references/antigravity-skill-sources.md) distinguishes inspected guidance from bundles the implementation agent must still review.

## Antigravity files

Antigravity's official [rules documentation](https://antigravity.google/docs/rules) describes AGENTS.md/GEMINI.md and modular rules. Its [migration guidance](https://antigravity.google/docs/migration/workflows-to-skills) recommends the standard repository-local skill structure in place of legacy workflow files. The brief starter skill links back to the versioned project plan rather than duplicating it.

task.md, implementation_plan.md and walkthrough.md are checked-in continuity documents. An agent may create its own IDE-native plan/walkthrough artifacts as useful, but should keep the repository's checkpoint accurate. These files do not claim to be installed in a private IDE artifact store.

## The execution loop

1. Inspect repository status, instructions and task state.
2. Select the next ready stage in docs/remediation/manifest.json; do not restart P00.
3. Read its required source specifications.
4. Implement complete server/domain/UI behaviour.
5. Verify the phase's named acceptance cases and the shared permission boundary.
6. Write actual evidence and update the checkpoint.
7. Continue until the entire agreed scope is implemented and release gates are met.

Do not stop after a polished static dashboard. Do not silently substitute mock storage, generic admin access, fake payment confirmation or automatic drawing publication.

## Handling uncertainty

Confirmed product decisions are fixed unless the user changes them. Engineering defaults are labelled in the requirements register and may be improved with a recorded reason. Operational inputs are requested only when necessary to enable real use; isolated automated tests may use fixtures. Hosted UAT uses real invited Google accounts, without demo logins or role/view switching. Ask privately for Jay’s exact email at bootstrap setup; do not infer it.

## Session checkpoint

At a pause or context limit record the current phase, branch/commit, changed files, tests run, blocked acceptance cases, integration state and one exact next action. On the next session re-read evidence and actual code before continuing. Avoid copying massive chat histories into the repository.

## User-facing reports

Explain what changed, why it matters, which tests actually ran and what remains blocked. Link useful files/screens. State deployed environments precisely. Do not describe generated plans/assets as an implemented app.
