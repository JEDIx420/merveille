# Roles, authority and permissions

The [27 November next-phase work order](../next-phase/README.md) is current: invited Cloudflare email-code sign-in, Free-account admission limits, bounded voice entry, manual WhatsApp sharing and billing handled externally. Preserve the capability and scope rules below; [the external-commercial transition](../next-phase/02-simple-workspace.md) replaces new in-portal billing while retaining restricted historical access and version-bound authorization. The earlier [real-account contract](../remediation/02-identity-and-real-user-testing.md) remains background for exact-email bootstrap, multiple admins, invitation/edge admission and real-person UAT. No role/view switcher or deployed synthetic identities are allowed.

## Model

Roles are named capability bundles. A person may hold multiple bundles, but project membership and record sensitivity still constrain every action. A person who is a manager on Project A and a client representative on Project B does not carry Project A's authority into Project B.

Use these stable role names: `ADMIN`, `OWNER`, `MANAGER`, `TEAM_MEMBER`, `CONSULTANT`, `MAIN_CLIENT`, `CLIENT_REP`. UI labels may be friendlier without changing policy.

The core rule is **capability + current scope + permitted record state**. Apply it to detail pages, lists, counts, search, previews, downloads, exports, background jobs and notification links. A hidden button is not enforcement.

See [requirements](requirements.md) for provenance. This matrix includes engineering defaults where the discovery did not specify every action. Keep explicit grants reviewable rather than scattering role-name checks throughout the product.

## Scope legend

- **All operational**: across the firm, excluding separately restricted salary/profit or individual-performance information.
- **Assigned**: within active project/section/document assignments only.
- **Client-facing**: released drawings, published updates and deliberately shared records; never unpublished drafts or internal notes.
- **Grant**: available only through an explicit capability/section assignment.
- **No**: the role bundle provides no access; another explicitly granted role may change this.

`ADMIN` and `OWNER` are global capabilities; `MANAGER`, `TEAM_MEMBER`, `CONSULTANT`, `MAIN_CLIENT` and `CLIENT_REP` are normally project-scoped. Global administration does not automatically confer a manager's domain approval. A person administering access must also have the relevant manager capability to release drawings or approve invoices.

## Workspace and account access

| Capability | ADMIN | OWNER | MANAGER | TEAM_MEMBER | CONSULTANT | MAIN_CLIENT | CLIENT_REP |
|---|---|---|---|---|---|---|---|
| Operational portfolio | All operational | All operational | Assigned | Assigned | Assigned | Assigned | Assigned |
| Invite/suspend accounts; project access grants | Yes | No unless ADMIN | No by default | No | No | No | No |
| Assign main-client decision authority | Yes, audited | No unless ADMIN | Request only | No | No | No self-transfer | No |
| Read internal project notes | All operational | All operational | Assigned | Assigned | No | No | No |
| Create/edit internal project notes | With project scope | With project scope | Assigned | Assigned | No | No | No |
| Read published project updates | All operational | All operational | Assigned | Assigned | Assigned audience | Assigned audience | Assigned audience |
| Read archived client-facing project files | Permitted global scope | Permitted global scope | Assigned | Assigned archive scope | Assigned archive scope | Assigned archive scope | Assigned archive scope |
| Manage controlled company announcements | Configure/audience | No unless ADMIN or delegated MANAGER | Publish if delegated | Draft if delegated | Read if audience | Read if audience | Read if audience |

Granting restricted `ADMIN`/`OWNER` capabilities requires a separately visible and audited elevation path. Ordinary project membership management must not accidentally grant them. Initial privileged accounts and delegation policy are production setup inputs; do not create an unreviewed self-elevation path.

## Delivery and approval

| Capability | ADMIN | OWNER | MANAGER | TEAM_MEMBER | CONSULTANT | MAIN_CLIENT | CLIENT_REP |
|---|---|---|---|---|---|---|---|
| Create enquiry/project draft | Yes | Yes | Assigned/intake grant | Intake grant | No | No | No |
| Accept quotation | No substitute | No substitute | No substitute | No | No | Assigned authority | No |
| Activate/pause/complete project | Manager grant | Manager grant | Assigned | No | No | No | No |
| Create internal task | Project grant | Project grant | Assigned | Assigned | No by default | No | No |
| Assign task/change deadline/reopen | Manager grant | Manager grant | Assigned | No | No | No | No |
| Update/complete assigned task | Assignee grant | Assignee grant | Assigned | Own assignments | No by default | No | No |
| Upload/edit drawing draft | Project author grant | Project author grant | Assigned | Assigned | Review attachment only | No | No |
| Submit drawing for review | Author/manager grant | Author/manager grant | Assigned | Assigned author | No | No | No |
| Give required consultant approval | Consultant grant | Consultant grant | No substitute | No | Assigned reviewer | No | No |
| Finally release/withdraw drawing | Manager grant | Manager grant | Assigned | No | No | No | No |
| Read drawing review versions | Permitted operational scope | Permitted operational scope | Assigned | Assigned | Assigned drawing scope | No | No |
| Read/download released drawing | Permitted operational scope | Permitted operational scope | Assigned | Assigned | Assigned | Assigned | Assigned |
| Draft project update | Project grant | Project grant | Assigned | Assigned | No by default | No | No |
| Publish/retract project update | Manager grant | Manager grant | Assigned | No | No | No | No |
| Record manual K-SMART evidence | Project grant | Project grant | Assigned | Assigned | No by default | No | No |
| Make binding material selection | No substitute | No substitute | Record/request only | Record/request only | Advise only | Assigned authority | No |
| Add material reference/comment | Assigned grant | Assigned grant | Assigned | Assigned | Shared selection scope | Assigned | Assigned |
| Accept change estimate | No substitute | No substitute | No substitute | No | No | Assigned authority | No |
| Authorize paid/accepted extra work | Manager grant | Manager grant | Assigned | No | No | No | No |
| Report snag | Assigned grant | Assigned grant | Assigned | Assigned | Assigned shared scope | Assigned | Assigned |
| Assign/verify/reopen snag | Manager grant | Manager grant | Assigned | Resolve own work only | Comment/evidence | Comment/evidence | Comment/evidence |

If the same person legitimately holds two roles, the action must still record the role/capability used. A manager must not appear as a consultant or main client merely because the interface offers a convenient override.

## Commercial and financial access

| Capability | ADMIN | OWNER | MANAGER | TEAM_MEMBER | CONSULTANT | MAIN_CLIENT | CLIENT_REP |
|---|---|---|---|---|---|---|---|
| Read client quotation/payment schedule | All | All operational | Assigned | Assigned finance grant | **Assigned client quotation/schedule** | Assigned | Explicit finance grant |
| Read client-facing invoices/payment history | All | All operational | Assigned | Assigned finance grant | **Assigned project client history** | Assigned | Explicit finance grant |
| Prepare quotation/invoice drafts | Finance author grant | Finance author grant | Assigned | Assigned finance author | No | No | No |
| Approve invoice for issue | Manager grant | Manager grant | Assigned | No | No | No | No |
| Issue approved invoice snapshot | Issue grant | Issue grant | Assigned issue grant | Assigned issue grant | No | No | No |
| Change payment schedule | Manager grant | Manager grant | Assigned | No | No | No | No |
| Report/upload payment evidence | Yes | Assigned grant | Assigned | Assigned grant | No by default | Assigned | Explicit finance grant |
| Confirm/reverse external receipt | **Yes** | No unless ADMIN | No | No | No | No | No |
| Read raw bank/payment verification evidence | **Yes** | No unless ADMIN | No by default | No | No | Own submitted evidence only | Own submitted evidence, with grant |
| Submit non-payroll expense | Yes | Assigned grant | Assigned | Assigned expense grant | No | No | No |
| Review non-payroll expense | Yes/manager grant | Manager grant | Assigned | No | No | No | No |
| Post expense/confirm outgoing payment | **Yes** | No unless ADMIN | No | No | No | No | No |
| Read consultant fees and non-payroll costs | Yes | Operational finance grant | Assigned cost-review scope | Own submitted expense only | No by default | No | No |
| Read/write salaries and payroll evidence | **Yes** | **No unless ADMIN** | No | No | No | No | No |
| Read profit and salary-inclusive totals | **Yes** | **No unless ADMIN** | No | No | No | No | No |
| Read individual performance reports | **No unless OWNER** | **Yes** | No | No | No | No | No |

The bold consultant entries are deliberate confirmed access, not a mistake to “fix” by replacing them with the consultant's own fees. Consultant/client finance views are a restricted commercial presentation: quoted amounts, scheduled amounts, issued invoices, allocated receipts, credits and outstanding amounts. They exclude unrelated projects, bank reconciliation details, salaries, expenses and profit.

An `OWNER` without `ADMIN` may see invoiced/received sales and operational non-payroll figures, but not salary-inclusive expense totals or a derivable profit figure. An `ADMIN` without `OWNER` may see task activity for administration but not individual performance dashboards or scorecards. Ordinary task ownership and overdue states remain available where needed to do the work; they are not themselves a performance report.

## Main client versus representative

The main client is a project-level authority, not a global account administrator. They may accept a quotation, a new change estimate and a binding material decision. They cannot approve a drawing for release, verify a payment receipt or change an invoice.

A representative receives their own invitation and may participate in assigned project discussion, site issue reporting and material/reference submission. They cannot accept binding terms, overwrite a main-client decision or transfer their own authority. Their financial view is an explicit grant. A representative can be the main client on another project without conflict because authorization is project-specific.

Changing the main-client contact preserves historic decisions under the original identity. New requests go to the new contact. Do not rewrite prior acceptance evidence or imply that the new contact performed earlier actions.

## Internal versus shared content

Every attachment and comment belongs to a known parent and audience. Examples:

- A draft drawing and its review notes are internal/reviewer-scoped even if a previously released version is client-visible.
- A consultant's comment on a review does not publish it to the client.
- A project update may link to a released drawing; it must not broaden access to an attached internal draft.
- A salary document remains admin-only even if the salary cost is associated with a project.
- A client payment screenshot is verification evidence, not automatically part of the consultant-visible payment history.
- A site snag can have a shared description/evidence thread and a separate internal remediation thread.

## Archive and revocation

Archive preserves existing authorized client/consultant read/download access. It never expands permissions. Existing staff project assignments remain read-only unless the administrator separately changes them. Account suspension, removal from a project or revoked document scope takes precedence over archived access.

Previously downloaded files and delivered external messages cannot be recalled. The product must revoke future retrieval and delivery promptly without claiming that historical copies disappeared.

## Permission acceptance examples

1. Consultant A can read Project A's client quotation and released invoice history, but not Project B, internal task notes or any payroll report.
2. A staff member can upload drawing version 3 but cannot mark it current for the client. Consultant approval alone also cannot publish it; manager release is required.
3. A main client can accept an extra-work estimate but cannot confirm the bank transfer or bypass manager authorization.
4. An administrator without owner capability receives overdue escalations but cannot export individual performance scores.
5. An owner without administrator capability sees received sales but cannot derive salary-inclusive profit through report totals.
6. A former consultant with a suspended identity cannot use an old archive link to download files.
7. A representative can add an alternative tile reference without altering the main client's accepted material selection.

These examples are behavioral requirements, not a complete technical security test suite. The [architecture](../architecture/overview.md) and [roadmap](../implementation/roadmap.md) define implementation and validation sequencing.
