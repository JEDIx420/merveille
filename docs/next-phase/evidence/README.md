# Next-phase evidence

This folder records actual results for [N00–N05](../manifest.json). At plan creation, every implementation and acceptance state is **not-started**. [The initial handoff check](handoff-2026-11-27.md) covers documentation only; documentation validation is not application verification.

For each meaningful checkpoint, create a concise dated Markdown or JSON record with:

- Source commit/branch, tested environment and relevant configuration (no secrets).
- Stage and NAC acceptance IDs from [verification](../06-verification-and-rollout.md).
- Change summary and exact commands/manual journeys, observed results and limitations.
- Applicable CPU/quota, device/model, import, authorization or recovery measurements.
- Evidence links, unresolved blocker, exact next action and required external input.

Use synthetic public fixtures. Keep client data, emails, raw dictations, production backups and credentials out of Git. Do not mark a hosted or team result passed because a mock or local harness succeeded.

Link new records from the appropriate manifest stage. Preserve historical evidence in its existing location; do not relabel old test runs as new-scope passes. Record the initial documentation-only check separately from application stages.
