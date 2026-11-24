# Merveille Designs — product brief

## Purpose

Merveille Designs is the confirmed company identity for this architecture practice's shared project portal. It gives clients a reliable view of their project and payments, gives the delivery team one place to coordinate work and drawings, and gives the owner a prioritized view of delays, decisions and business activity.

This repository is a build handoff, not evidence that the application has been implemented. Begin at [START_HERE](../../START_HERE.md), then use the [requirements](requirements.md), [permissions](roles-and-permissions.md), [workflow index](../workflows/README.md), [architecture](../architecture/overview.md) and [implementation roadmap](../implementation/roadmap.md) together.

The initial planning envelope is approximately **30 projects and 10–15 concurrent users**. These are sizing inputs, not contractual limits. Users work on phones and desktops. Files include photographs, documents, large drawings/CAD files and video. The app is **online only**; no offline capture or synchronization is in scope.

## Outcomes by audience

| Audience | The portal should help them do |
|---|---|
| Main client | Move between their projects; see published progress, the current released drawing, quotations, invoices and payment schedules; contribute references; make authorized commercial and material decisions. |
| Client representative | Use a separate login; follow permitted project information; comment and contribute references or material suggestions. Binding decisions remain with the main client. |
| Team member | Work only on assigned projects; create and update tasks; prepare drawings, site updates and invoices; record permitted site evidence and issues. |
| Manager | Assign work and deadlines; review delivery; control final drawing release; publish client updates; approve invoice issue and control payment schedules. |
| Consultant | Work within assigned project/document scopes; review drawings; see permitted site updates and, intentionally, the project's client quotation and payment history. |
| Administrator | Manage access, operational configuration and accounts; confirm receipts; see salaries and profit; handle unresolved overdue escalation. |
| Owner | See business priorities and individual performance. Owner and administrator can be the same person, but their sensitive permissions remain separate. |

## Confirmed product boundaries

- Enquiry → requirements and site feasibility → study and quotation → quotation acceptance and advance → active project.
- A client can have multiple projects. A spouse, partner or other representative receives a separate account rather than sharing credentials.
- Team members create tasks. Managers assign work and deadlines. Team members mark tasks complete; managers can reopen them.
- A drawing requires the relevant consultant's approval and then **the manager's final release**. Client approval is not a drawing gate.
- Team updates can remain internal. Client-visible project updates require manager publication.
- Additional work requires a documented estimate, the main client's acceptance, administrator-confirmed required payment and manager approval before work begins.
- The portal maintains accounts, including income, expenses and consultant fees. Salary and profit information is administrator-only. Individual performance reporting is owner-only.
- Staff draft invoices, managers approve them and staff issue the approved invoice. This is an **accepted working interpretation** of discovery, recorded explicitly rather than presented as an unambiguous original statement. Payment schedule changes are manager-only; receipt confirmation is administrator-only.
- K-SMART permit sanction and completion are tracked manually through statuses and uploaded evidence. No K-SMART integration is included.
- Clients and consultants keep view/download access to their authorized archived projects. Records are retained indefinitely under the current product brief.
- Reminders appear in the portal and through WhatsApp. Unresolved overdue items escalate to the administrator.
- “Waiting on you” and site snag tracking are included. A generated handover pack is excluded.

## Additional company communications

The original brief included company updates on a client's profile. Provide **controlled company announcements**, with an explicit audience and manager approval. This is a supported capability, not a requirement to publish a public newsfeed or show every announcement to every client. Start with announcements disabled or empty until an administrator configures their audience. See [updates and announcements](../workflows/updates-and-announcements.md).

## Information principles

1. **Membership is contextual.** Access to one project never creates access to another. A person's authority can differ between projects.
2. **Approval has a precise meaning.** A consultant's drawing approval, a manager's release, a client's acceptance of extra cost and an administrator's payment confirmation are different actions.
3. **The latest upload is not automatically the current drawing.** Only a manager-released version is shown as the current approved drawing for use.
4. **History remains explainable.** Keep old versions, approval evidence, commercial snapshots and recorded corrections. A previously released drawing becomes *superseded*, not *rejected*.
5. **Useful priorities precede charts.** Lead with delayed tasks, pending decisions and approaching deadlines; show amounts invoiced and received separately.
6. **No invisible financial assumptions.** Currency, tax treatment, rounding, accounting periods and profit definitions must be explicit before financial reporting is trusted.
7. **Sensitive information stays sensitive everywhere.** Restrict it in search, file downloads, notifications, counts, exports and dashboards as well as on its main screen.

## Business vocabulary

| Term | Meaning in Merveille Designs |
|---|---|
| Client account | The individual or organization commissioning work; it may own several projects and have several contacts. |
| Main client | The named project contact authorized to accept quotations, changes and binding material decisions. Exactly one active decision contact per project is the initial engineering default. |
| Client representative | Another authorized contact who can contribute without inheriting the main client's binding authority. |
| Project membership | The person's role, document/section scope and active or archived access for one project. |
| Drawing | A logical drawing/document with one or more separately identifiable versions. |
| Released drawing | The specific consultant-approved version the manager has authorized for use. |
| Published update | A manager-approved project update visible to its selected client/consultant audience. |
| Payment schedule | The agreed expected payment amounts and dates/stages. It is distinct from an invoice and from money received. |
| Invoice | A numbered, issued request for payment with an immutable issued snapshot. |
| Receipt | An administrator-confirmed record that money was received externally. No portal payment checkout is included. |
| Allocation | The portion of a receipt applied to an invoice or recorded advance. |
| Change request | Additional or changed work with its own scope, estimate, acceptance, payment gate and execution approval. |
| Snag | A discrete site issue with evidence, responsibility, a target date and verification. |
| Waiting on you | A personalized projection of authorized outstanding actions; it is not a second task database. |

## Release scope

The planned release is a coherent operational portal: identities and permissions; intake and activation; project workspaces; tasks; drawing review/release; updates; files; manual permits; commercial changes; project finance and controlled accounting; materials; snags; reminders; owner/admin dashboards; and archival access.

Deliver it in the order described by the [roadmap](../implementation/roadmap.md). Do not interpret “phased build” as permission to silently remove confirmed requirements. Each increment must say what is implemented, what is demonstrably working and what remains.

## Explicit exclusions

- Offline capture, offline editing and later synchronization.
- K-SMART automation, scraping or integration.
- Client approval as a mandatory drawing gate.
- Payments collected inside the portal.
- A generated project handover pack.
- Public access to client projects or unrestricted file-sharing links.
- CAD authoring, geometry manipulation, native CAD rendering or guaranteed previews for every uploaded format.
- Automatic tax filings, payroll compliance submissions or assumed jurisdiction-specific rates.
- An AI performance score, employee surveillance or inferred quality ratings.

## Success evidence

The build is ready for review when realistic sample projects can demonstrate the full lifecycles: a project activates after an accepted quote and confirmed advance; a drawing goes through consultant approval and manager release; an update publishes only after review; a change cannot start before its commercial gates; invoices, receipts and balances reconcile; overdue work appears for the correct decision-maker; and a former staff member loses access while permitted archived client access remains.

The permission matrix and workflow guards are acceptance criteria. A polished interface cannot compensate for a cross-project data leak, a bypassed approval, a mutable issued invoice or an inaccurate balance.

## Outstanding operational inputs

The engineering team can implement the configurable structures without blocking on every input. Before production use, the firm must supply its identities and initial role holders; project stages; quotation and invoice templates; currency and accounting policies; opening balances; payment gate rules; material decision policy; reminder timings and WhatsApp sender arrangements; and the actual brand assets. These inputs are indexed in the [decision register](requirements.md#operational-input-register).
