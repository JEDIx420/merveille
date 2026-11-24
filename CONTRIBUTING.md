# Contributing to Marvel

Begin with [START_HERE.md](START_HERE.md) and [AGENTS.md](AGENTS.md). The repository contains a specification before it contains an application.

## Changes

Implement one coherent phase or vertical slice per branch. Preserve specification files while scaffolding the application into this non-empty repository. Use meaningful commits and explain the problem, changed behaviour and verification in pull requests.

For a business-rule change, update the requirement/decision record, affected workflow and screen, acceptance case and implementation evidence together. If a user explicitly changes a requirement, their latest instruction wins.

## Validation

Run `node scripts/check-handoff.mjs` after documentation changes. After Phase 00, add and use the actual package scripts recorded there. Exercise local runtime/database behaviour; a typecheck alone does not establish that Workers bindings or access controls work.

Use only synthetic fixtures and test recipients. Capture screenshots for desktop and mobile using a seeded environment. No client data, payroll, private keys or production document samples belong in this public repository.

## Review

Explain new external dependencies, schema migrations and any limits in the implementation. Keep production secrets out of commits and provision via the owner's authorised environment. Do not alter repository visibility, billing or external communication settings as an incidental implementation step.
