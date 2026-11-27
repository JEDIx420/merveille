# Release readiness checklist

**27 November 2026 next-phase scope:** [The active N00–N05 plan](../next-phase/README.md) supersedes conflicting instructions below. Use Cloudflare Free only, bounded open-source voice, external billing with version-bound ADMIN commercial clearance, and manually prepared WhatsApp messages with API delivery disabled. Preserve completed work, historical records, access/approval rules and applicable recovery gates. Older finance/provider setup and execution sequences below are retained as reference; they are not current work or permission to enable paid services.

Every checkbox starts unverified. This file defines the gate; it is not release evidence.

## Product

- [ ] Every confirmed requirement is covered by an implemented workflow and acceptance evidence.
- [ ] Consultant approval followed by manager release; no client drawing approval.
- [ ] Quote/advance and change-estimate/payment/manager gates cannot be bypassed.
- [ ] All role-specific screens and their failure/empty/archive states work.
- [ ] Waiting-on-you and snags are connected to authoritative source records.
- [ ] Financial reports reconcile to exact source records and disclose their basis.

## Permissions and privacy

- [ ] Server checks include lists, detail, search, aggregates, exports, previews, downloads and jobs.
- [ ] ADMIN-only salary/profit and OWNER-only performance tested separately.
- [ ] Consultant project client-finance access works without internal-data leakage.
- [ ] Project/identity revocation is effective; archived access remains correct.
- [ ] Private R2 objects and private response caches are verified from outside the app.
- [ ] No secrets or private business records in code, fixtures, build output, logs or repository.

## Integrations and operations

- [ ] Pinned runtime versions work in actual Workers preview and staging.
- [ ] Access invitations/provisioning and staff identity/MFA policy verified.
- [ ] D1 migrations, R2 upload limits, Queue retry/DLQ and scheduled jobs verified.
- [ ] WhatsApp test recipient, opt-in, sender/templates and webhook signature checks verified.
- [ ] Unresolved overdue escalation reaches the intended admin; no live client test messages.
- [ ] Independent backups restored into an isolated environment and reconciled.
- [ ] Environment separation, production financial settings and opening balances approved by the responsible business owner.
- [ ] Monitoring/support owner, provider cost controls and incident runbooks available.

## Delivery

- [ ] Acceptance cases pass or have explicit unresolved release blockers; no fake passes.
- [ ] Desktop/mobile screenshots and accessibility checks recorded.
- [ ] Data migration/rollout/rollback or forward-fix procedure recorded.
- [ ] Production deployment target and authorisation verified in the current session.
- [ ] Post-deployment core-role smoke checks recorded without exposing private data.
- [ ] Final walkthrough links the actual environment, commit and verification evidence.
