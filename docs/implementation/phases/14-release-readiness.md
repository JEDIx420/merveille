# P14 — Integrated verification, staging and launch readiness

**Status:** not started. **Dependencies:** P12, P13.

## Outcome

Validate the complete product and leave a concrete release candidate.

## Read before implementation

- [acceptance.md](../../../docs/quality/acceptance.md)
- [testing.md](../../../docs/quality/testing.md)
- [release-checklist.md](../../../docs/quality/release-checklist.md)
- [deployment.md](../../../docs/operations/deployment.md)
- [operational-inputs.md](../../../docs/implementation/operational-inputs.md)

## Implementation order

1. Run all acceptance suites against realistic synthetic data, plus role-specific end-to-end paths and current Worker builds.

2. Inspect every screen's loading/empty/error/forbidden/archived states on desktop and mobile; fix broken or decorative controls.

3. Review private response caching, upload safety, access removal, data inference, concurrent money/release commands and notification retry cases.

4. Use staging with isolated resources for Access, file, Queue/Cron, webhook and restore checks; record external blockers distinctly.

5. Reconcile opening data/import assumptions and the production financial/access/provider settings with the designated owner/admin.

6. Prepare a release summary containing actual URLs, version pins, migration plan, rollback/restore evidence, unresolved risks and the exact authorised deployment action.

7. Deploy only when the current session authorises the target environment; verify post-deploy health and core role flows without messaging real clients unless explicitly authorised.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `tests/e2e/`
- `tests/authorization/`
- `docs/evidence/`
- `verified CI/local scripts`
- `release notes and operational runbooks`

## Acceptance cases

Run AC-061, AC-062, AC-063, AC-065, AC-067, AC-068, AC-069 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Every required case has reproducible evidence or an explicit unresolved release blocker. Production is never declared ready from mock integrations, document checks or a successful frontend build alone.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
