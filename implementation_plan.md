# Current implementation plan

Use [docs/remediation/manifest.json](docs/remediation/manifest.json) in R00–R05 dependency order. The old P00–P14 plan is historical reference.

Local containment, identity/capability repairs, shared neutral UI, business integrity, background jobs and independent recovery have been implemented. Final integrated browser/workerd verification and external onboarding gates are tracked in [task.md](task.md). See [session evidence](docs/evidence/remediation/session.md) for exact results.

Hosted Google/Access onboarding and real-person acceptance are distinct gates. The [operator and browser-only handoff](docs/operations/real-account-handoff.md) explains the remaining steps. No unconfigured provider or unrun team test may be described as passed.
