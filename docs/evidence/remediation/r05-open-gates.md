# R05 remaining gates — 25 November 2026

This is the current gate review, not a release approval. Earlier session entries retain historical results. Cloudflare email-code login supersedes Google-only setup; no Google Console action is needed for the team.

| Gate | Actual status | Remaining action/input |
|---|---|---|
| Initial real login and identity binding | Hosted passed | None for initial ADMIN; no extra roles implied |
| Dedicated policy synchronization | Hosted passed | None for current credential; scoped to one policy in platform secrets |
| Last-admin and ADMIN/OWNER boundaries | Hosted passed; concurrent second-admin protection locally passed | Real second-admin delegation requires another authorized tester |
| Route/phone/keyboard and failure UI | 112 earlier fixture-browser checks passed | Team must verify actual role workflows on their devices |
| Atomic money, release and restore logic | 106 tests and 10 actual local workerd checks passed | These do not substitute for hosted multi-person business UAT |
| Cron and Queue | Hosted schedule, portal suppression/replay, isolated retry/DLQ/pull/ack passed | Real provider delivery remains separate |
| Backup transport | Hosted private SQL/file round trip and empty-business quarantine passed | Populated remote business recovery still open; no production records to be used |
| Restore interrupted during object copying | Fixed and locally verified in unit and actual workerd tests | Destination quarantine and consumed bootstrap now commit before copy; partial restore stays closed |
| Continuous backup operations | Not operational | Dedicated least-privilege backup management credential, scheduled export/copy, stale-success monitoring, retention decision and actual repeated-run evidence; invitation-policy token cannot do this |
| Real notifications/webhooks | Disabled/unverified | Provider business/sender/template configuration, secret, verified consent/contact and explicitly authorized test recipient/send; no messages sent |
| Team accounts and roles | Awaiting private input | Exact mailbox, global ADMIN/OWNER if intended, each project role and explicit finance/contractual grants; second admin must be deliberately authorized |
| Real business acceptance | Not run | Staff → consultant → manager → client drawing flow; staff/manager invoice → admin receipt; client/representative boundaries; open-session revocation; archive/file access |
| Company transfer | Separate future installation | Company Cloudflare account, chosen hostname, sister's private exact mailbox, fresh resources/credentials/bootstrap; repository cloning transfers none of these |

No further expansion of real account permissions is authorized merely to complete the matrix. Existing initial ADMIN has no project grants; adding MANAGER/OWNER to that account would require explicit direction. The team should receive copied private invitation links and browser tasks, not terminal instructions. Use the [real-account handoff](../../operations/real-account-handoff.md).
