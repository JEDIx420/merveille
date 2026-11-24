# Screen specification index

These are implementation contracts for the future application, not claims that screens already exist. Read the [product requirements](../product/requirements.md), [roles and permissions](../product/roles-and-permissions.md), [design system](../design/design-system.md) and [shared interaction contract](../design/interaction-patterns.md) before implementing a screen.

Each file defines routes, actors, hierarchy, primary actions, fields, logical reads/writes, difficult states, mobile behaviour and acceptance criteria. The technical architecture chooses concrete endpoint/service names; preserve the domain guards in these screens and their linked workflows.

## Route and workflow map

`REQ-` prefixes below refer to requirement groups in the canonical product register. `:id` is a scoped resource identifier, never an authorisation mechanism.

| Screen | Route | Requirement groups | Owning workflow |
|---|---|---|---|
| [SCR-01 — Sign-in and invitation acceptance](01-sign-in.md) | `/login; /invite/accept` | REQ-IAM, REQ-OPS | [archive and access](../workflows/archive-and-access.md) |
| [SCR-02 — Overview and owner priorities](02-overview.md) | `/overview` | REQ-DAS, REQ-NOT, REQ-TSK | [waiting on you](../workflows/waiting-on-you.md) |
| [SCR-03 — Active projects](03-projects.md) | `/projects` | REQ-PRJ, REQ-IAM, REQ-ARC | [archive and access](../workflows/archive-and-access.md) |
| [SCR-04 — Enquiry and feasibility](04-enquiry-feasibility.md) | `/enquiries; /enquiries/:id` | REQ-PRJ, REQ-FIN, REQ-FIL | [enquiry to activation](../workflows/enquiry-to-activation.md) |
| [SCR-05 — Project overview](05-project-overview.md) | `/projects/:id/overview` | REQ-PRJ, REQ-DAS, REQ-UPD, REQ-KSM | [enquiry to activation](../workflows/enquiry-to-activation.md) |
| [SCR-06 — Tasks](06-tasks.md) | `/projects/:id/tasks` | REQ-TSK, REQ-DAS, REQ-NOT | [tasks](../workflows/tasks.md) |
| [SCR-07 — Drawing register and revisions](07-drawings.md) | `/projects/:id/drawings` | REQ-DRW, REQ-FIL, REQ-IAM | [drawings](../workflows/drawings.md) |
| [SCR-08 — Updates and publication](08-updates.md) | `/projects/:id/updates` | REQ-UPD, REQ-FIL | [updates and announcements](../workflows/updates-and-announcements.md) |
| [SCR-09 — K-SMART permit records](09-permits.md) | `/projects/:id/permits` | REQ-KSM, REQ-FIL, REQ-UPD | [k smart](../workflows/k-smart.md) |
| [SCR-10 — Project finance](10-project-finance.md) | `/projects/:id/finance` | REQ-FIN, REQ-PRJ, REQ-CHG | [invoices and accounting](../workflows/invoices-and-accounting.md) |
| [SCR-11 — Firm accounting](11-firm-finance.md) | `/finance; protected subroutes` | REQ-FIN, REQ-IAM | [invoices and accounting](../workflows/invoices-and-accounting.md) |
| [SCR-12 — Owner-only performance](12-performance.md) | `/performance` | REQ-DAS, REQ-TSK, REQ-IAM | [tasks](../workflows/tasks.md) |
| [SCR-13 — Materials and references](13-materials-references.md) | `/projects/:id/selections` | REQ-MAT, REQ-FIL, REQ-CHG | [materials and references](../workflows/materials-and-references.md) |
| [SCR-14 — Change requests](14-change-requests.md) | `/projects/:id/changes` | REQ-CHG, REQ-FIN, REQ-MAT | [change requests](../workflows/change-requests.md) |
| [SCR-15 — Consultant review / manager release](15-review-inbox.md) | `/reviews` | REQ-DRW, REQ-NOT, REQ-DAS | [drawings](../workflows/drawings.md) |
| [SCR-16 — Waiting on you](16-waiting-on-you.md) | `/waiting` | REQ-DAS, REQ-NOT, REQ-DRW, REQ-CHG | [waiting on you](../workflows/waiting-on-you.md) |
| [SCR-17 — Site issues / snags](17-site-issues.md) | `/projects/:id/snags` | REQ-SNG, REQ-FIL, REQ-NOT | [snags](../workflows/snags.md) |
| [SCR-18 — People and access](18-people-access.md) | `/people` | REQ-IAM, REQ-ARC | [archive and access](../workflows/archive-and-access.md) |
| [SCR-19 — Archive](19-archive.md) | `/archive` | REQ-ARC, REQ-IAM, REQ-FIL | [archive and access](../workflows/archive-and-access.md) |
| [SCR-20 — Notifications and preferences](20-notifications.md) | `/notifications; /settings/notifications` | REQ-NOT, REQ-IAM, REQ-DAS | [notifications](../workflows/notifications.md) |

## Implementation order

Follow the canonical [implementation roadmap](../implementation/roadmap.md), not numerical screen order alone. Identity and authorisation precede protected data. Build one working project/task flow before broadening into drawings, publication, finance and notifications. Every feature is complete only when its state transitions and denied-access cases work, not when its page renders.

## Shared acceptance boundary

- Use the same permission-aware project shell across internal, client and consultant views.
- Do not load forbidden data and hide it in CSS or JavaScript.
- Keep consultant drawing approval and manager release distinct; client drawing approval does not exist.
- Project financial access for CLIENT_REP is an explicit grant; a representative login alone does not imply it.
- Salary/profit: ADMIN only. Individual performance: OWNER only. Test those capabilities separately.
- K-SMART records are manually maintained, with approved supporting files and clear source dates.
- Online-only operation: no offline mode or promise of protected data being cached for later use.
- Archive preserves permitted view/download access and existing explicit staff assignments. ADMIN may append receipts/approved settlements against existing obligations; no new invoice, work or schedule is permitted by that exception. The handover-pack generator is excluded.
- Record screenshots and evidence using fictional fixtures; a visual specimen is not a functional implementation.

The final route implementation may include nested list/detail routes beyond this table, but every added route needs the same role, data and state contract. Record material route changes in the implementation decisions so the next agent can follow the handoff.
