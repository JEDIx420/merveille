# Testing strategy

## Scope and order

Test observable business rules and permission boundaries first. The acceptance catalogue is a specification; no application tests exist in this initial handoff.

1. Domain unit tests for money, due rules, release predicates, expected-revision checks and state transitions.
2. D1 integration tests for unique/FK constraints, atomic posting/release, allocation and outbox consistency.
3. Worker-runtime integration tests for identity assertions, bindings, streaming/Range, private caching and job redelivery.
4. Role-based end-to-end tests for representative project journeys on desktop and mobile.
5. Staging integration evidence for Access, WhatsApp test delivery, Cron/Queues and isolated recovery.

Use the selected runtime's supported local test tooling. Pin versions during P00. Do not fabricate package commands in the handoff; add real scripts with the scaffold and record their outputs. A generic Node test may exercise pure logic but cannot prove Workers runtime compatibility.

## Highest-risk boundaries

- Organisation/project identifiers changed directly in URLs, request bodies, object IDs, search and exports.
- Owner without admin versus admin without owner.
- Consultant financial visibility without internal notes or payroll/profit.
- Released versus draft drawing files, including thumbnails and Range responses.
- Changed invoice or drawing content after approval.
- Concurrent release, invoice numbering, receipt allocation and duplicate command delivery.
- No hidden salary/profit inference through totals and CSV exports.
- Queued notification after access revocation, resolution or stale approval version.
- Partial upload, misleading file type, unsupported preview, retained-file cleanup.
- Archived access for authorised clients/consultants and denial for disabled accounts.

## End-to-end journeys

1. Enquiry → feasibility → quote → main-client acceptance → admin-confirmed advance → manager activation.
2. Team drawing V1 → required consultant approval → manager release → client view → V2 revision/rejection → unchanged current V1.
3. Staff update → manager publication → client feed; separate private note remains inaccessible.
4. Invoice draft → manager approval → issue → partial receipt → final allocation/correction → reconciled report.
5. Representative suggests material → main client selects → extra-cost estimate accepted → payment confirmed → manager authorises work.
6. Snag reported → assigned → resolution evidence → manager verification/reopening.
7. Due item → portal/WhatsApp test reminder → unresolved escalation → resolution suppresses queued reminder.
8. Archive → client/consultant download → revoke user → same download blocked → isolated restore confirms retained records.

## Visual verification

Review 1440 px desktop, 768 px tablet and 390 px phone widths plus keyboard-only use. Validate long project names, long currency values, loading, no results, forbidden, stale approval, failed upload, network error and archived state. Use actual seeded screenshots; the visual specimen is an aesthetic reference, not a passing test.

## Proportionate checks

Prefer a few meaningful invariants over many tests that mirror functions or markup. Add regression cases for demonstrated bugs. Stop optional repetition once the concrete risk and required gate are covered.

## Evidence integrity

Mark all provider-dependent checks as real, simulated or blocked. A mock WhatsApp adapter is useful for tests and never proof of real delivery. Documentation/link validation proves only that the handoff is internally navigable.
