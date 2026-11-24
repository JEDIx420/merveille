# Antigravity handoff references

Checked 24 November 2026 against official Google documentation. These sources explain repository conventions; the product specification is original to this project.

| Source | What the handoff uses |
| --- | --- |
| [Rules](https://antigravity.google/docs/rules) | Root AGENTS.md/GEMINI.md plus modular rule files; rules require the documented activation frontmatter |
| [Workflow migration](https://antigravity.google/docs/migration/workflows-to-skills) | Repository-local .agents/skills/<name>/SKILL.md for a reusable build entry point |
| [IDE workflows](https://antigravity.google/docs/ide/workflows) | Legacy workflows are deprecated; this handoff relies on a portable START_HERE.md and a modern local skill |

The checked-in task.md, implementation_plan.md and walkthrough.md are ordinary versioned documents. They provide continuity but do not claim to populate an IDE's private artifact store or auto-approve any operation.

Discovery behaviour can change by Antigravity version/surface. If a slash command is not discovered, directly ask the agent to read START_HERE.md. The project remains usable without product-specific IDE machinery.
