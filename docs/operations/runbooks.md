# Operational runbooks

These procedures are for the implemented system. They do not claim monitoring, jobs or dashboards already exist.

## Daily health view

Expose a small admin operations panel with last successful scheduled scan, oldest pending outbox event, failed/unknown WhatsApp deliveries, failed identity provisioning, stale backups, pending/expired uploads and application error trends. Show actionable state and an appropriate retry action, not raw tokens or private payload dumps.

Use structured logs with correlation ID, operation, entity ID, environment, sanitized error code and timing. Restrict access to logs. Application audit events are distinct from diagnostic logs and follow the relevant visibility rules. Owner performance and admin payroll must not appear in broad operational traces.

## A user cannot sign in

Verify invitation status, normalized email, Access allowlist provisioning, intended login method and active D1 membership. Confirm the user is using the correct environment/hostname. Check sender/email delivery guidance without requesting their PIN or password. Expire/reissue an invitation when appropriate; preserve audit. Never make the user admin as a login workaround.

## A removed person still has a page open

Confirm D1 membership is inactive, revoke any app context/session and reconcile Access policy removal. Attempt a fresh data/file request as that identity and ensure denial. The UI should react to forbidden responses and clear sensitive displayed state. An already downloaded file is outside the app's control; do not claim it has been erased.

## A drawing appears wrong or outdated

Check the current released version pointer, consultant approval's version ID, manager release event and the user's project access. An uploaded replacement in review does not replace the released version. If release was incorrect, use an auditable withdrawal/replacement policy with manager authority; do not overwrite old bytes or rewrite review history. Notify affected authorized users through the approved channel only when instructed by the operational workflow.

## Invoice or payment discrepancy

Read the issued snapshot, adjustment records, confirmed receipts and allocations. Check duplicate command keys, numbering and ledger source IDs. Correct through authorized credit/reversal/allocation commands with a reason. Do not edit a SQL amount directly as a routine repair. If a bug corrupts records, prepare a tested repair plan and affected-record preview before an authorized production correction.

## A WhatsApp reminder failed

Check opt-in, verified destination, template/sender state, token expiry, provider response and current recipient access. Retry only transient failures; an ambiguous accepted-but-unrecorded send requires reconciliation to avoid duplicates. Portal notification remains available. Do not send a replacement message manually to an unverified or newly guessed number.

## Queue backlog or missed schedule

Inspect last successful scan and oldest outbox age, pause only the affected consumer if necessary, correct the failure and replay stable event IDs. Recheck live domain state on replay so completed tasks or paid invoices are not reminded. Validate deduplication before draining a backlog. Keep internal incident notes separate from client-facing updates.

## Upload stuck or preview broken

Inspect upload session, file size/type, accepted parts, expiry and R2 object status. Permit authorized retry/resume or abort. Do not make the bucket public to fix a CORS or download issue. For unsupported CAD/video formats, offer an authorized original download or a separate PDF preview; never label missing preview as a lost original until object integrity is checked.

## Backup stale or missing object

Escalate to ADMIN, preserve the current manifest and determine whether the database export, file copy, checksum or inventory step failed. Retry idempotently and perform a sample restore. Missing backup coverage is an operational incident even if the app is currently working. See [backup and recovery](backup-and-recovery.md).

## Secret exposure

Revoke/rotate the affected credential at its provider, redeploy the correct environment/Worker binding, inspect access logs and audit for misuse, and remove the exposed secret from current files/logs where possible. Git history or external copies may require further remediation; deleting one visible line does not revoke a token. Preserve evidence without reposting the secret.

## Limits, storage growth and costs

Monitor Worker error/CPU trends, D1 size/query cost, R2 original/backup growth, upload failure rate, queue retries, Access registered identities and WhatsApp delivery usage. Provider prices/limits change; verify the chosen account plan instead of putting a fixed monthly cost in the code. An admin-configured budget alert should precede emergency service shutdown. Archive should not imply free storage or automatic media deletion.

## Support access

Support/admin troubleshooting should use scoped metadata and explicit permission. Do not add an undocumented “impersonate any client” endpoint or global bypass. If supervised support access is later required, define scope, duration, reason, user visibility and audit before implementing it.
