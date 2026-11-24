# Phase evidence template

Copy this structure into a phase evidence file under docs/evidence/ after implementing the phase. Do not create a success record before running the checks.

## Identity

- Phase / requirement IDs:
- Commit / branch:
- Date and environment:
- Runtime/adapter/tool versions:
- Fixture set:

## Changed behaviour

State what now works and the actor/data boundary involved. List important changed paths and the associated screen/workflow specifications.

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| Example: AC-017 | Exact command after scripts exist | PASS / FAIL / BLOCKED | Log/screenshot path or output summary |

Include meaningful failures and fixes. Identify real provider/runtime checks separately from simulated adapters. Redact tokens, identities and private data.

## Remaining work

Record unresolved acceptance IDs, operational prerequisites, known limitations and the next exact action. A blocked required case prevents marking its release gate complete; it does not require stopping independent work.

## Recovery impact

List migrations, retained-data changes, rollback/forward-fix considerations and any external side effects. Record the actual target environment rather than using “deployed” without a destination.
