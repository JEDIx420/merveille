# P11 — In-portal notifications, WhatsApp and escalation

**Status:** not started. **Dependencies:** P04, P05, P06, P07, P09, P10.

## Outcome

Deliver timely reminders without leaking data or creating duplicate actions.

## Read before implementation

- [background-notifications.md](../../../docs/architecture/background-notifications.md)
- [notifications.md](../../../docs/workflows/notifications.md)
- [20-notifications.md](../../../docs/screens/20-notifications.md)
- [environments.md](../../../docs/operations/environments.md)

## Implementation order

1. Implement transactional outbox, due/overdue scheduler, notification records, delivery attempts and stable dedupe keys.

2. Implement current-permission/state checks at dispatch; suppress resolved or revoked destinations.

3. Implement fake local sender, real Meta adapter, consent/template checks, signed webhook handling and status reconciliation.

4. Treat ambiguous provider timeouts carefully; do not promise exactly-once external delivery.

5. Implement WhatsApp plus portal channels, configurable quiet hours/cadence and unresolved-overdue escalation to admin.

6. Test a real provider only using an authorised test recipient. Record missing sender/template/consent inputs as blocked external readiness, not a reason to stop local functionality.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/notifications/`
- `workers/jobs/`
- `src/app/api/webhooks/`
- `src/features/notifications/`
- `tests/integration/notifications/`

## Acceptance cases

Run AC-046, AC-047, AC-048, AC-049, AC-050 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

## Exit gate

Portal reminders, retries and escalation pass with fake delivery; real provider smoke/webhook evidence is completed when authorised/configured and clearly tracked otherwise.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
