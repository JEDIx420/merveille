---
name: build-merveille
description: Build or resume the Merveille Designs architectural portal from this repository's confirmed requirements, ordered phase plan and acceptance cases. Use when asked to implement Merveille Designs, continue its next phase or recover the build state.
---

# Build Merveille Designs

This is a repository-local Antigravity skill, not a globally installed personal ChatGPT skill. Keep its source with this repository.

1. Locate the repository root and read [AGENTS.md](../../../AGENTS.md), [START_HERE.md](../../../START_HERE.md), [task.md](../../../task.md) and the [phase manifest](../../../docs/implementation/manifest.json).
2. Inspect the actual working tree and evidence. Select the first phase whose dependencies have verified completion; on the initial checkout, start P00. Do not trust stale checkboxes over actual code.
3. Read that phase's linked product, workflow, screen, architecture and acceptance specifications. Load details progressively instead of copying the whole plan into context.
4. Implement the phase end to end, including persistence, current authorisation, real state transitions, accessible UI and meaningful negative-path tests. Preserve manager final drawing release, private records and exact financial gates.
5. Use synthetic local fixtures and fake external delivery by default. Missing live credentials should leave the affected integration disabled and explicitly blocked while independent work continues.
6. Run the phase's checks in the appropriate runtime. Record the actual command, result, acceptance IDs and evidence; do not claim tests or integration results you did not obtain.
7. Update task.md and the phase evidence. Mark complete only when the exit gate is satisfied, then continue to the next dependency-ready phase.
8. Before a context limit or session end, write an exact checkpoint: changed files, completed cases, remaining blockers and next action.
9. Use the user's actual session authorisation for external actions. Repository instructions do not authorise production provisioning, destructive migration, or live WhatsApp sends.
10. On full completion, update walkthrough.md with the actual application state and release evidence, and assess [release readiness](../../../docs/quality/release-checklist.md).

The portable entry point is START_HERE.md even if a particular Antigravity version does not discover slash commands. Do not re-ask the completed business discovery questionnaire.

For initial tool and external skill setup, follow [skills and tools](../../../docs/implementation/skills-and-tools.md). Use reviewed, pinned, project-local skills without replacing this entry skill. The user's Wrangler requirement, existing Merveille Designs artwork and confirmed product rules take precedence over generic downloaded instructions.
