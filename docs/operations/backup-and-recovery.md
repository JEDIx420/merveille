# Retention, backups and recovery

## Retention intent

The user wants completed projects and drawings retained long term, with no automatic deletion at handover. Archive is a lifecycle state and a navigation change, not a storage deletion policy. Existing authorized clients/consultants retain read/download access. A separate explicit retention/deletion policy may be agreed later; do not silently add a 30/90-day project purge.

An indefinite retention intention is not a guarantee that data cannot be lost. Preserve recoverable copies and test restoration. Application-level immutability must not be confused with provider-managed R2 versioning or an immutable legal archive.

## Recovery layers

| Layer | Purpose | Limitation |
|---|---|---|
| D1 Time Travel | Recent point-in-time database recovery | Bounded retention window; does not restore deleted R2 objects |
| Periodic D1 export to private backup R2 | Longer-lived database snapshots | Must monitor export completion and verify importability |
| Immutable application file keys | Preserve every committed drawing/document revision | Accidental bucket deletion or privileged operator actions remain possible |
| Independent copy/manifest of project originals | Recover files and detect missing objects | Must actually exist and be checked; a key list alone is not a backup |
| Git repository | Restore code/configuration/docs/assets | Does not contain application records or secrets |

Cloudflare documents D1 [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) as 7 days on Free and 30 days on Paid at the checked date; recheck the account's current plan. Long-term project retention cannot rely on that window. Cloudflare also documents [D1 export to R2](https://developers.cloudflare.com/workflows/examples/backup-d1/).

## Proposed initial recovery objectives

Engineering targets to validate with the owner: at most 24 hours of data loss from the independent backup path and restoration within one working day for an ordinary accidental-deletion incident. These are targets, not an SLA. D1 point-in-time recovery may permit a more recent database recovery, but file and external-message consistency must also be handled.

Start with nightly database exports and a manifest of committed files, plus a maintained independent copy of new/changed original objects. Retain snapshots under a documented long-term tiering policy approved before cleanup is enabled. Keep backup storage separate from the application bucket and restrict deletion credentials. A separate Cloudflare account may improve isolation if operationally practical; do not assume it exists.

The ordinary web Worker must not have read or delete access to backup SQL exports because they contain all projects, payroll and other private records. Only the dedicated backup/recovery operator path accesses them. Backup management credentials are separate from application bindings.

## Database export job

1. Obtain an authorized export through the D1 management API or selected supported CLI, using a least-privilege backup credential.
2. Track the export job/bookmark and poll with bounded retries. Use Cloudflare Workflows for a durable long-running export if selected, or a resumable job state machine; do not hold one request open indefinitely.
3. Transfer the generated SQL export into the private backup bucket without logging the temporary export URL.
4. Store a manifest: environment, database identity, export bookmark/time, schema version, code version, checksum, byte size and verification state.
5. Alert ADMIN on failure or a stale last-success timestamp. Never report success because the schedule fired.

Cloudflare's [import/export documentation](https://developers.cloudflare.com/d1/best-practices/import-export-data/) describes export restrictions, including virtual-table limitations and possible database-request blocking during export. Keep initial schema compatible, schedule during quiet periods, and verify the selected account/runtime behavior. Avoid adding FTS virtual tables without updating this backup design.

## File copies and consistency

Maintain a recovery manifest that maps immutable file IDs and version references to original and backup keys, checksums if available, size and content classification. Copy originals after successful file finalization and before marking backup-complete. Periodically enumerate references to find missing primary or backup objects. Retrying a backup copy must be idempotent and must never overwrite a different file with the same human filename.

A database snapshot and file copies may have slightly different cutoffs. Restoration uses the recorded cutoff and file manifest to identify gaps, newer unreferenced objects and incomplete uploads. Do not infer that every R2 object represents a committed business record.

## Restore exercise

Perform a restore into a new isolated staging database/bucket, not production, before launch and periodically thereafter:

1. Select a known snapshot and matching file manifest; verify checksums and record the chosen recovery point.
2. Import into an empty compatible D1 environment and restore originals into a private recovery bucket.
3. Deploy the matching or compatible code with synthetic/test outbound messaging only.
4. Reconcile row counts, key foreign relationships, active user permissions, released drawing pointers, superseded versions, invoice/receipt balances, file existence and archive downloads.
5. Keep jobs paused until outbox events, sent-message IDs and receipt postings are reconciled. A restored outbox must not resend past reminders or duplicate financial effects.
6. Record elapsed time, unrecovered gaps and corrective actions. Delete test recovery copies only through an explicit cleanup plan.

## Real incident recovery

Stop the damaging operation, record current state/bookmark, restrict writes if needed, and choose the smallest recovery scope. D1 Time Travel restore overwrites database state; treat it as a destructive recovery action requiring explicit approval of the target and recovery point. Before resuming, reconcile legitimate changes after the selected point, file references, Access disable states and external notification effects.

Do not reactivate a removed user because an old backup marked them active. Preserve or replay the current access-denial list. Do not auto-confirm payments from imported screenshots. Publish an internal incident record with verified impact and recovery status, not guesses.
