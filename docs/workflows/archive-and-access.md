# Archive, membership and access lifecycle

**Requirements:** REQ-IAM-001–008, REQ-ARC-001–005, REQ-FIL-004/005.

**Confirmed:** Records are retained indefinitely; authorized clients and consultants retain view/download access to permitted archived project records. Administrator manages access.

**Engineering default:** Archive preserves existing explicit staff assignments as read-only. It does not automatically remove people or grant new access.

## Distinct lifecycles

Treat these independently:

1. **Project lifecycle:** active, paused, completed, cancelled or archived.
2. **Identity lifecycle:** invited, active, suspended or deactivated.
3. **Membership lifecycle:** pending invitation, active, expired or revoked, with explicit project/document/section scope.
4. **Resource lifecycle:** draft, published/released/issued, superseded or withdrawn, with its own audience.

An archived project does not revive a suspended account. An active account does not create access to every project. A consultant whose assignment is revoked cannot use archive access to regain it. A published file does not become public.

## Access transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → INVITED | Administrator invites named person | Authorized role/project scopes selected; no accidental privileged elevation | Create expiring invitation with selected grants; `person_invited`. |
| INVITED → ACTIVE | Intended person accepts verified invitation | Invitation valid, unrevoked and matches intended identity | Establish individual identity/membership; `invitation_accepted`. |
| INVITED → EXPIRED/REVOKED | Expiry or administrator action | Current invitation state | Prevent acceptance; preserve invite history; `invitation_expired` / `invitation_revoked`. |
| ACTIVE membership → revised ACTIVE | Administrator changes scope/role | Explicit capability selection; restrictions evaluated | Update access, invalidate obsolete actions and notify appropriately; `membership_changed`. |
| ACTIVE membership → REVOKED/EXPIRED | Administrator revokes or configured end date occurs | Reason/end rule | Prevent future scoped reads/writes/downloads/notifications; `membership_revoked`. |
| ACTIVE identity → SUSPENDED | Administrator suspends person | Reason | Block all sessions/actions for that identity; retain authorship/history; `identity_suspended`. |
| SUSPENDED → ACTIVE | Administrator restores | Identity verified; every intended membership reviewed | Restore only explicitly reviewed scopes; `identity_restored`. |
| Main-client A → main-client B | Administrator transfers project authority | New contact active; explicit authority decision | Preserve historic acceptances under A; route new decisions to B; `main_client_authority_changed`. |

`OWNER` alone cannot perform access administration; the person needs `ADMIN`. Granting admin/owner-sensitive capabilities follows a protected, visible and audited elevation path. Do not let an ordinary membership edit imply either capability.

Invitation acceptance must not recreate revoked grants from a stale invitation. Reinviting a former person creates a new deliberate grant, not an automatic restoration of all prior projects.

## Archive transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| COMPLETED/CANCELLED → ARCHIVED | Assigned manager archives | Review open tasks, drawings, snags, permits, changes and financial balances; record disposition/reason | Remove from active lists; operational records become read-only; retain current memberships; `project_archived`. |
| Other lifecycle → ARCHIVED by explicit exception | Manager requests/records exceptional archive | Clear reason; unresolved work and obligations disclosed rather than auto-closed | Preserve prior lifecycle for possible reopening; administrator can review exceptions; `project_archive_exception`. |
| ARCHIVED → previous/reopened lifecycle | Assigned manager reopens | Reason; current client/team/consultant scopes reviewed; dates/reminders checked | Resume only explicitly intended work; `project_reopened`. |
| ARCHIVED membership → revised/revoked membership | Administrator changes access | Same authority checks as active project | Archive itself does not prevent revocation; `archive_access_changed`. |

Administrator/owner needs the manager capability for the operational archive/reopen decision; administrator remains responsible for access administration. Do not embed a hidden owner/admin approval substitute.

The archive review must not fabricate completion. Open snags remain open, a missing permit record remains unrecorded, and an unpaid invoice remains unpaid. Retain the review's disclosed outstanding items.

## Financial settlement after archive

An archived project's operational documents are read-only. As an explicit engineering default, an administrator may still confirm receipts and append allocation, refund, credit or reversal events **for existing financial obligations** through the finance workflow without reopening construction work. Normal correction approvals still apply: the administrator posts only already-authorized linked adjustments; invoice credits follow manager approval and receipt reversals follow the administrator receipt rules. This does not edit the original invoice or authorize new project work.

Do not issue a new invoice, change the payment schedule, add tasks or release a new drawing through this settlement exception. Reopen the project and use the appropriate commercial/workflow gates for new work. If the firm later requires all settlement to occur only after reopening, record that policy change explicitly.

Outstanding financial reminders continue while a collectible obligation remains due, according to policy. Operational task/review reminders for archived work pause unless the archive review explicitly preserves a follow-up. Show the reason so an archived task does not appear silently forgotten.

## Retention and downloads

- Retain source files, versions, approvals, issued financial snapshots, comments and audit records indefinitely under the present brief.
- Client/consultant archive views expose only records they were or are explicitly authorized to see. Draft drawings and internal discussions do not become visible because the project is old.
- Keep current and superseded released drawings clearly labeled. Archival availability is not a statement that an old version is suitable for current work.
- Existing staff project memberships continue as read-only unless the administrator separately revokes them.
- Every fresh download checks current identity, membership, audience and resource state. Old notification URLs do not confer access.
- A person may retain a file they previously downloaded or an external message they already received. The app must not promise remote recall of those copies.

There is no automatic purge job in the current scope. Any exceptional deletion/redaction request needs a separately reviewed policy that reconciles the business retention brief with applicable obligations; do not create an unreviewed bulk-delete shortcut.

## Review evidence

Demonstrate archive removing a project from active lists without deleting it or revoking staff, client/consultant permitted downloads, hidden drafts, revoked archived membership, suspended identity blocking stale links, authority transfer preserving earlier acceptances, financial settlement without new work and controlled reopening.
