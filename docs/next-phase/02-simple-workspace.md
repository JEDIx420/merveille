# N01 — A simpler workspace with the same authority

Implement under [the current work order](README.md) after the [free-tier baseline](01-scope-and-free-tier-baseline.md). This is a proposed product contract; it does not describe features already implemented.

## Reference and objective

The supplied Asana screenshots show Home/My Tasks with Upcoming, Overdue and Completed; an activity Inbox; task List, Board and Calendar views; assignee/due-date/project/collaborator information; project discovery; and a person's task view. The client's reference also says billing belongs in other software. Use that observed workflow, without copying private names, screenshots or client records into this public repository. Some screenshots show a trial tier; do not infer that every visible Asana feature is free or required.

Aim for one obvious place to see what needs doing, one task record viewed in different ways, and a clear project workspace. Keep deeper architectural workflows available when relevant. Avoid adding a configurable dashboard, a custom workflow designer or more primary navigation for every feature.

## Navigation and screen contract

| Audience | Primary destinations | Within a project |
|---|---|---|
| Internal staff | Today, My Tasks, Projects, Leads if permitted, Inbox | Overview, Tasks, Drawings, Updates; More contains Materials, Changes, Site Issues, Permits, Documents and permitted settings/history |
| Consultant | Assigned projects, Reviews, Inbox | Assigned review revisions, released drawings, published updates and other explicitly permitted records |
| Client/representative | My projects, Updates/Inbox | Overview, Drawings, Updates; Decisions, Site Issues and Documents when granted |

People, personal settings, administration and archive should be reachable contextually, not duplicate daily work queues. Keep an appropriate responsive mobile menu. An internal person holding several roles keeps every legitimate capability; do not introduce role switching or impersonation.

**Today** shows due/overdue work, items awaiting the person's own action and a short recent-activity list. Managers see review/release bottlenecks and unassigned work in their scope. Counts and titles must use the same permission filters as the target lists. No empty KPI wall or financial cards by default.

**My Tasks** defaults to a readable list with title, project, status, due date and assignee. Offer Upcoming, Overdue and Completed filters, with Today easy to find. Board and Calendar are alternate views of the same tasks and query contracts. Calendar is a task-date view, not a Google Calendar integration. Group/filter by project, assignee and status without turning setup into another form.

**Team tasks** is a permitted filter/view for coordination. Do not treat a colleague's task list as an OWNER-only performance scorecard, and do not expose private personal tasks or projects outside the viewer's scope. Performance analytics retain the existing OWNER boundary.

**Projects** has search, active/archived filters and a concise list/card choice if it materially helps. Open the project's overview directly. Show stage, responsible manager and next required action. Retain New enquiry versus Existing project onboarding and the administrator-controlled conversion/setup path.

**Inbox** uses the canonical notification records from N04. Show useful title, source, due context and a deep link, with unread/read control. Do not introduce a second task database or a single shared read flag for all users.

## Task interaction and data

Start from [the existing task service](../../src/server/domain/tasks/service.ts). Preserve its status history, proposed versus official due date, manager assignment authority, completion, reopening reasons, evidence, archive rules and optimistic concurrency.

- Quick add opens a compact inline form or drawer. A title is the only typed requirement; infer the current project from context and make any required project choice obvious. Other details expand on demand. Project task drafts/proposals remain proposals until the existing authorized manager action establishes assignment/deadline.
- Reuse one details drawer/page for description, comments, attachments, collaborators and existing completion/reopen history. Keep a stable deep link. A collaborator is an explicit project-authorized participant; adding them cannot grant project access.
- Support a compact checklist/subtask section inside task details, matching the observed collapsed subtasks. A checklist item has a label and completion state; a real subtask with its own owner/date uses the canonical task model with an explicit parent reference. Keep the first interface to one visible nesting level. Parent/child scope must agree, project assignment/deadline authority still applies, and completing a parent cannot silently complete unfinished children. Do not introduce an arbitrary hierarchy engine.
- Personal tasks, if needed to reproduce the supplied My Tasks/private import workflow, must have an explicit personal scope and owner. Do not invent a dummy project or quietly turn them into team-visible project tasks. Keep self-managed personal dates separate from official project-deadline authority. If the schema needs extension, use an additive upgrade and preserve current project tasks as internal project scope.
- Enforce scope on writes as well as reads: a project task retains a valid project; a personal task requires its owner and is private to that owner, who manages its dates and lifecycle. The manager assignment/deadline/reopen rules apply to project tasks. Moving personal work into a project is an explicit reviewed transition using authorized project commands, with a visibility warning and no silent promotion of personal deadlines to official dates. Ordinary colleague, manager or administrator views cannot inspect personal content just because they can inspect project work.
- Existing statuses stay truthful. Friendly board headings may map to current statuses, but Pending assignment, Blocked and Cancelled cannot be silently flattened into Done. Dragging a card invokes the same authorized command and concurrency guard as other controls; it cannot bypass required reasons, evidence or manager-only reopening.
- Preserve section/group labels and source task identifiers on migration. Use explicit task visibility. Private imported tasks stay private or are held for review; never broaden access merely because the importer can see the source file.
- Provide a keyboard alternative to drag/drop. Keep target dates and owner changes visible after saving. On a conflict, preserve the user's draft and reload the current revision rather than overwriting a colleague's edit.

Do not make a large CRM-style task form, nested project hierarchy or generic dependency engine a prerequisite. Existing deeper fields remain in details. New advanced Asana functionality beyond the supplied workflow is deferred unless the baseline finds it already used and essential.

## Preserve the architectural workflows

| Capability | Simpler presentation | Boundary that remains enforced |
|---|---|---|
| Drawings | Register, clear current released revision, version history, focused review/release actions | Assigned consultant approves the exact immutable revision; manager releases; clients never approve drawings |
| Updates | Short draft/publish flow with audience preview | Only authorized manager publication exposes content to clients |
| Materials | Clear pending choices, references and decision history | Main-client binding authority differs from representative comments |
| Changes/additional work | Request, accepted scope/estimate, clearance and manager authorization | A board move or dictated note cannot authorize work |
| Site issues/snags | Location, photos, assignee, resolution and verification in one detail view | Staff resolution and manager verification remain separate |
| Permits | Simple status and evidence | Manual K-SMART entry; no scraping or automatic statutory approval |
| Archive | Readable project history with permitted downloads | No new operational work; current revocation overrides old access |

Clients see released drawings, published updates and their actual pending decisions. Internal comments, tasks, salaries, profit, unapproved files and restricted aggregate counts stay private. A new draft does not replace the last released client drawing. Keep both authorized historical downloads and current version context.

## Billing outside the portal: safe transition

The new normal workspace must not require invoice, payroll, expense or ledger entry. Do not discard the old financial database, fabricate settled balances or remove gates by hiding screens. Implement an explicit external-commercial mode with a traceable transition:

1. Keep the accepted quotation or change-estimate version and its actual client acceptance evidence. The authorized main client still accepts binding scope; historical acceptance remains attached to the identity/version that performed it.
2. Add an ADMIN-recorded **external commercial clearance**, tied to that exact project quotation or change version. Store clearance type, external reference, recorded-by identity, timestamp and any restricted evidence. It states the required external condition was confirmed; it is not a synthetic receipt, ledger posting or invoice settlement.
   Correct or revoke clearance through an append-only ADMIN action with a reason and reference to the earlier event. Subsequent activation/authorization must reject revoked clearance. If work is already active, surface the exception to its manager for a deliberate decision; do not silently rewind completed work or rewrite the original authorization history.
3. Manager activation/extra-work authorization requires the accepted current version and valid matching clearance, using an atomic command and expected revision. A changed/superseded quotation invalidates the prior clearance for new authorization. ADMIN alone does not acquire manager authority.
4. Preserve existing valid activation, receipts and history. Inventory unclosed legacy obligations and explain their treatment; do not reinterpret them automatically. Keep authorized historical commercial views reachable through an unobtrusive history route, including the existing consultant/client scopes. Corrections to legacy records retain their old authorization and audit rules.
5. Disable new billing-specific entry points and new invoice/payment reminders in external mode. Enforce the cutover on the server: reject new invoice drafts/issues, payment schedules, payroll, expense and general ledger-entry commands. Enumerate the only legacy exceptions: normally authorized receipt allocation, credit, reversal or correction strictly attached to a pre-cutover obligation/posting, with existing ADMIN/manager guards and audit history. These exceptions cannot create new work, invoices or schedules. Quotation/change scope records and their client acceptance remain available for the clearance workflow. Do not delete audit/history or retrospectively change balances. Historical financial celebrations must not replay during migration.

Use additive migrations and a documented per-organization cutover. Rehearse on populated data before enabling the mode. The external accounting system is a record reference in this phase, not a new paid integration or synchronization project.

## Implementation and acceptance

Reuse [the shell](../../src/components/shells.tsx), existing components and current theme tokens. Preserve [Dark/Light/System and motion preferences](../design/appearance-and-celebrations.md). Keep old deep links working through authorized destinations. Clear loading, empty, error and permission-denied states matter as much as populated screenshots. Do not expose implementation IDs, quota jargon or acceptance labels in ordinary product flows.

Required checks: a staff member finds today's work and completes an authorized task; a manager assigns/reopens project tasks with valid reasons; a personal-task owner manages their lifecycle while colleagues/managers are denied read/write; a deliberate personal-to-project transition preserves authority; a consultant approves only the assigned revision; a client sees the correct released file and cannot inspect the draft; a representative cannot make a main-client decision; an unrelated user sees neither search hits nor counts; archived access and revoked access behave correctly; external-clearance version changes or revocation cannot bypass activation. Review desktop and phone layouts in both themes, keyboard focus and reduced-motion settings.

For the pilot, propose at least four of five staff completing the main daily journeys without guidance. Record actual timing and friction; this is an acceptance target, not a benchmark already achieved. Keep the screens simple enough that user feedback changes labels or placement rather than requiring another architecture rebuild.
