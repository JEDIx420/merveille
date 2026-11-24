# Requirements and decision provenance

The latest [product amendment](../remediation/01-product-amendment.md) and [current work order](../remediation/README.md) extend this baseline. Stable requirement IDs remain in use; old visual/demo/start-from-zero instructions are superseded.

## How to read this document

Stable requirement IDs are the shared vocabulary for design, implementation and acceptance. Keep an ID when wording improves; mark a requirement superseded when a real decision changes it. Never silently change a confirmed rule to make implementation easier.

The sources here are the architecture firm's discovery discussion and subsequent clarifications carried into this handoff on **24 November 2026**. This is a structured requirements record, not a verbatim transcript.

| Label | Meaning |
|---|---|
| **C — confirmed** | Explicitly supplied or subsequently confirmed by the user. |
| **W — accepted working interpretation** | A practical reading of ambiguous discovery that the handoff is instructed to use, with the ambiguity preserved. |
| **D — engineering default** | A proposed implementable policy that fills a gap. Keep it configurable where practical and do not describe it as a client promise. |
| **O — operational input** | Information the firm must supply before affected production behavior is enabled. |

The provenance column may include more than one label where a confirmed outcome requires a proposed operating policy.

## Decision register

| ID | Decision | Provenance | Consequence |
|---|---|---|---|
| DEC-001 | Company and portal identity is Merveille Designs; repository is `JEDIx420/merveille`. | C: explicit company-name correction | Use the existing Refrens logo; legal invoice details remain separately configured. |
| DEC-002 | Approximately 30 projects and 10–15 concurrent users; phone and desktop use; photographs, documents, drawings and videos. | C: discovery answers | Establish a realistic baseline without hard-coding user/project caps. |
| DEC-003 | Multiple projects per client; separate representative accounts; administrator controls access. | C: discovery answers | Use per-project membership and a named main-client authority. |
| DEC-004 | Consultants may see the assigned project's **client quotation and payment history**. | C: explicit correction | Do not substitute a consultant's own fee view or hide these project records by assumption. |
| DEC-005 | Relevant consultant approves a drawing; **manager controls final release**; no client drawing approval. | C: latest explicit confirmation | Latest clarification resolves earlier conflicting statements. |
| DEC-006 | Ordinary client updates require manager approval; internal-only notes/updates are supported. | C: clarification | Separate internal records, submitted updates and published audience-specific updates. |
| DEC-007 | Enquiry, requirements/site feasibility, study/quote, acceptance/advance and activation are distinct steps. | C: discovery answers | Preserve a pre-project intake state and explicit activation gate. |
| DEC-008 | Team creates tasks; managers assign/deadline them; staff completes; manager may reopen. | C: discovery answers | Record ownership, deadline history, completion and reopening separately. |
| DEC-009 | Extra work requires estimate agreement, required payment and manager approval. | C: discovery answers; main-client/admin authority clarified in handoff | Gates must be enforced, not merely displayed. |
| DEC-010 | Portal maintains full accounts; referenced accounting website is context, not an integration requirement. | C: clarification | Accounting scope includes expenses, consultant fees, salaries and profit. |
| DEC-011 | Staff draft → manager approves → staff issues invoices. | W: accepted working interpretation supplied for this handoff | Build this workflow and retain the provenance note. It must not be mistaken for team members issuing unapproved invoices. |
| DEC-012 | Only manager changes schedules; only admin confirms receipt; no in-portal payment collection. | C: clarification | Keep scheduling, invoicing and settlement capabilities separate. |
| DEC-013 | Salaries/profit are ADMIN-only; individual performance is OWNER-only. | C: final handoff distinction | One person may hold both capabilities; neither implies the other. |
| DEC-014 | K-SMART sanction/completion tracking is manual with documents/screenshots. | C: clarification | No portal integration or assumed external status synchronization. |
| DEC-015 | Records retained indefinitely; clients and consultants may view/download permitted archived records. | C: clarification | Archive is not deletion or automatic revocation of all client access. |
| DEC-016 | Online only. | C: later clarification supersedes earlier offline request | Do not build or imply offline capture/sync. |
| DEC-017 | In-portal and WhatsApp reminders; unresolved overdue escalation to admin. | C: clarification | Delivery and escalation need separate observable records. |
| DEC-018 | Waiting-on-you and snags included; generated handover pack excluded. | C: discovery answers | Deliver focused actions and site issue closure without a handover-pack generator. |
| DEC-019 | Client can see appropriate company updates. | C: original request; D: controlled optional announcement module | Announcements need explicit audience and publication controls. |
| DEC-020 | Preserve the existing Merveille Designs gold/charcoal logo from its public Refrens profile; no generated replacement identity. | C: explicit brand correction, verified source | Source files, hashes and usage rules are recorded in assets/brand. |
| DEC-021 | Improve the existing implementation as the foundation; no fresh build. | C: latest remediation request | R00–R05 supersedes P00-first execution; preserve app/data/history. |
| DEC-022 | Premium consistent UI; reject olive/green theme; compact existing logo at the top is sufficient branding. | C: latest request; D: exact neutral tokens/type | White/cool-gray/graphite target in docs/remediation/03; old warm/gold specimen is superseded. |
| DEC-023 | Real individual Gmail/Google access; no view/role switcher or deployed demo login. | C: latest request; D: Google via existing Access boundary | Verify invited identities; no impersonation, open-domain signup or mailbox scopes. |
| DEC-024 | Jay is the initial admin and can add another admin; admins assign team roles/project access. | C: latest request; O: exact email and optional grants | One-time protected bootstrap, multiple admins and audited invitation/access lifecycle; no guessed identity. |
| DEC-025 | Approximately three real people test with administrator-assigned access. | C: latest request | Browser-only team UAT through their own accounts; not a permanent account limit; developer regression checks remain. |
| DEC-026 | Put detailed update instructions and a short continuous-execution kickoff in the repository. | C: latest request | NEXT_AGENT.md and docs/remediation are the active entry; maintain honest checkpoints/evidence. |

## Engineering default register

| ID | Default | Reason and change boundary |
|---|---|---|
| DEF-001 | Deny access unless a capability and applicable project/section scope both permit it. | A role label alone is insufficient. Restrictive sections apply to lists, exports, search, files and derived data. |
| DEF-002 | One active main-client decision contact per project; authority changes are recorded. | Avoid conflicting binding decisions. A later joint-signature requirement needs a deliberate workflow change. |
| DEF-003 | All designated required consultants must approve the exact submitted drawing version before release. | “Consultant approval” does not mean every consultant attached to a project. Reviewers are assigned per drawing/version. |
| DEF-004 | Approved/released documents and issued commercial records are immutable snapshots. | Revisions create new records and invalidate only the approvals attached to the changed scope. |
| DEF-005 | Client representatives receive collaboration access by default; financial access is explicitly granted per project. | The brief confirms contribution rights but does not give every representative financial authority. |
| DEF-006 | Archived operational content is read-only; new project work requires reopening. Admin may append settlement and normally authorized corrections for existing financial obligations. | Preserve original records while allowing outstanding money to be settled; no new work, invoice or schedule change through this exception. |
| DEF-007 | Archive preserves existing explicit project assignments as read-only; only an administrator's separate access change revokes or expands membership. | Archive is a presentation/lifecycle change, not an automatic staff-access removal. Client/consultant archive access follows DEC-015. |
| DEF-008 | Staff may submit non-payroll expense records; manager reviews; admin posts/confirms payment. | Finishes the accounting workflow without exposing payroll or permitting unreviewed financial posting. |
| DEF-009 | Invoicing is an explicit action, not an automatic side effect of completing a project stage. | Stage completion may make an item eligible for billing; schedules and invoices remain distinct. |
| DEF-010 | Payment trigger policy is stored per schedule item; conflicting date/stage conditions must be configured explicitly. | Never infer whether a date overrides an incomplete stage. |
| DEF-011 | Internal notes are visible to authorized internal project staff, not clients or consultants. | Private finance notes additionally inherit finance restrictions. |
| DEF-012 | WhatsApp messages contain minimal action context and a sign-in link, not sensitive amounts, drawings, payroll or private notes. | Respect audience boundaries after a message leaves the application. |
| DEF-013 | The current released drawing remains current while a replacement is being reviewed. | Rejection of a new draft must not erase the working approved version. A safety withdrawal is a separate manager action. |
| DEF-014 | Monetary amounts are integer minor units with explicit currency; posted financial events use balanced entries and explicit reversals. | Preserve exact balances and reviewable corrections. Currency/precision and accounting policy remain operational inputs. |
| DEF-015 | Material/reference suggestions do not authorize procurement or spending. | A main-client selection is distinct from extra-cost acceptance and work approval. |
| DEF-016 | No public project files or anonymous project links. | Logged-in authorization is checked when a file is accessed; invitation and notification links do not themselves confer access. |

## Requirements

### Project and intake — REQ-PRJ

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-PRJ-001 | Track enquiries separately from active projects; record requirements, site feasibility, study and quotation history. An enquiry may be declined or lost without producing an active project. | C DEC-007 |
| REQ-PRJ-002 | Activate work only after the accepted quotation and required administrator-confirmed advance are present, followed by manager activation. No zero-advance bypass is included in this scope. | C DEC-007; D |
| REQ-PRJ-003 | Support multiple projects for a client account and multiple separately invited contacts per project, with one active main client by default. | C DEC-003; D DEF-002 |
| REQ-PRJ-004 | Project stages and progress are explicit, manager-controlled records. Stage completion can support billing eligibility and updates but must not silently issue invoices or certify an external permit. | C DEC-007; D DEF-009 |
| REQ-PRJ-005 | Capture project ownership, assigned team, relevant consultants, planned dates, status and client-visible identity. Do not expose the complete firm portfolio to ordinary members. | C DEC-003; D DEF-001 |
| REQ-PRJ-006 | Support active, paused, completed, cancelled and archived project treatment, with a reason and actor for lifecycle changes. Archive follows a separate retention/access workflow. | C DEC-015; D |
| REQ-PRJ-007 | Show each user's permitted project list and switcher, with meaningful next actions and no unauthorized project names, counts or activity. | C DEC-003; D DEF-001 |

### Identity and access — REQ-IAM

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-IAM-001 | Administrator can invite named Google-account users, assign permitted role bundles and project/section membership, suspend access and revoke invitations. Bootstrap Jay once from a privately supplied exact identity; support multiple admins. OWNER alone does not grant access administration. | C DEC-003/023/024; D DEF-001 and remediation identity contract |
| REQ-IAM-002 | Every user has an individual verified invited Google identity. No deployed demo login, persona/view switcher or impersonation. Representatives never impersonate the main client; consultants never inherit the internal team role. | C DEC-003/004/023 |
| REQ-IAM-003 | Enforce project isolation on every resource and derived result, including identifiers provided directly in requests. | D DEF-001 |
| REQ-IAM-004 | Consultants see assigned drawing/site scopes and the assigned project's client quotation, invoices, schedule and payment history; exclude internal notes, expenses, payroll, profit and staff performance. | C DEC-004; D: client-facing financial presentation |
| REQ-IAM-005 | Main client controls quotation acceptance, change acceptance and binding material decisions. Representatives can comment and provide references; financial access is an explicit additional grant. | C handoff; D DEF-002/005 |
| REQ-IAM-006 | Administrator salary/profit capability and owner individual-performance capability are independent; restrictions extend to aggregates and exports. | C DEC-013 |
| REQ-IAM-007 | Revocation prevents new reads, writes, downloads and notifications; invitation expiry and project reassignment must not bypass this. Existing exported/downloaded copies cannot be recalled. | C access control; D DEF-001/016 |
| REQ-IAM-008 | Record access grants, changes, elevated-capability grants, account suspension and main-client authority changes in the audit history. | D DEF-001/002 |

### Tasks — REQ-TSK

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-TSK-001 | Authorized project staff create tasks with a description, project/stage context and evidence as appropriate. | C DEC-008 |
| REQ-TSK-002 | Manager assigns/reassigns responsible staff and sets/changes deadlines with a retained history and change reason. | C DEC-008; D: history |
| REQ-TSK-003 | Assignees update progress, record blockers and mark work complete; manager can reopen with an explanation. | C DEC-008 |
| REQ-TSK-004 | Distinguish pending, in-progress, blocked, completed and cancelled tasks. Overdue is calculated from an open task's deadline, not a manually selectable state. | C priorities; D |
| REQ-TSK-005 | Internal task commentary and attachments remain internal unless intentionally included in a separately approved client update. | C DEC-006; D DEF-011 |
| REQ-TSK-006 | Preserve original and revised deadlines, completion/reopen events and review evidence for owner-only performance reporting without exposing a leaderboard to ordinary staff. | C DEC-013; D |

### Drawings — REQ-DRW

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-DRW-001 | Maintain a logical drawing register with distinct immutable submitted versions, discipline, version label, files and author. | C DEC-005; D DEF-004 |
| REQ-DRW-002 | Assign the relevant required consultant reviewers to each submitted version; all designated required approvals must match that exact version. | C DEC-005; D DEF-003 |
| REQ-DRW-003 | Only a manager may release a version after the required consultant approvals; enforce the gate at the action boundary. | C DEC-005 |
| REQ-DRW-004 | No main-client or representative approval is required or accepted as a substitute for consultant approval/manager release. Client comments do not change the release state. | C DEC-005 |
| REQ-DRW-005 | Client-facing views identify one current released version per drawing; a newly uploaded draft does not replace it. | C current approved drawing request; D DEF-013 |
| REQ-DRW-006 | Replacement release supersedes the prior released version; rejection applies only to a declined submission. Preserve prior files and approval history. | D DEF-004/013 |
| REQ-DRW-007 | Consultants/managers can return a version with reasons; material revision creates a new version and new approvals. A withdrawn release requires a manager, reason and notification to affected users. | C manager release; D |
| REQ-DRW-008 | File previews, downloads, notification links and archive access obey the version's audience and release state. Drafts/internal review comments are not leaked to clients. | C DEC-003/015; D DEF-001 |

### Updates and announcements — REQ-UPD

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-UPD-001 | Staff create stage/progress/site/drawing update drafts with relevant evidence and submit them for manager review. | C DEC-006 |
| REQ-UPD-002 | Manager approves publication to an explicit authorized project audience; rejected submissions return with feedback. | C DEC-006; D: audience control |
| REQ-UPD-003 | Internal-only notes are supported and excluded from client/consultant feeds, search, exports and reminders. | C DEC-006; D DEF-011 |
| REQ-UPD-004 | Material edits to a published update require a new reviewed revision; keep publication/retraction history. | D DEF-004 |
| REQ-UPD-005 | Controlled company announcements are optional, manager-published, audience-scoped and distinct from project updates; never default to a public company feed. | C DEC-019; D |

### Manual K-SMART tracking — REQ-KSM

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-KSM-001 | Record permit sanction and completion as separate manual milestones with reference, observed status/date, recorder and notes. | C DEC-014 |
| REQ-KSM-002 | Attach supporting documents/screenshots, label when the external status was checked and preserve previous evidence. | C DEC-014; D: provenance |
| REQ-KSM-003 | Clearly label all values as staff-recorded; no API, scraping, automated status assertion or guaranteed freshness. | C DEC-014 |
| REQ-KSM-004 | Client/consultant-visible permit updates follow manager publication and record-level file permissions; sensitive source evidence can remain internal. | C DEC-006/014; D |

### Additional work — REQ-CHG

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-CHG-001 | Capture requested scope, reason, estimate version, price/currency, schedule impact and required pre-work payment. | C DEC-009 |
| REQ-CHG-002 | Only the main client accepts a binding change estimate. Consultant/representative comments are not commercial acceptance. | C handoff; D DEF-002 |
| REQ-CHG-003 | Administrator confirms receipt/allocation of the required payment; a client-reported transfer alone does not satisfy the gate. | C DEC-009/012 |
| REQ-CHG-004 | Manager authorizes execution only after acceptance and required payment; task creation may prepare work but must not imply authorization to start. | C DEC-009 |
| REQ-CHG-005 | Scope/price/payment-gate revisions invalidate prior acceptance and manager authorization for the revised work; retain all versions, decline reasons and cancellation records. | D DEF-004 |

### Finance — REQ-FIN

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-FIN-001 | Portal maintains quotes, schedules, invoices, receipts/allocations, expenses, consultant fees, salaries and accounting reports; no unspecified external accounting sync. | C DEC-010 |
| REQ-FIN-002 | Store the agreed advance/installment schedule upfront, allowing explicit date/stage triggers; only manager changes the schedule and changes retain versions/reasons. | C DEC-012; D DEF-010 |
| REQ-FIN-003 | Staff prepare invoice drafts; manager approves the exact version; staff issue that approved snapshot. Any changed draft content invalidates approval. | W DEC-011; D DEF-004 |
| REQ-FIN-004 | Issued invoice contents and identifying number are immutable. Corrections use linked cancellation/credit/reversal records according to configured policy, with replacement issue if needed. | D DEF-004/014; O OPS-005 |
| REQ-FIN-005 | Only admin confirms external receipts; preserve amount, currency, date, reference, evidence and allocations. No checkout/payment collection exists. | C DEC-012 |
| REQ-FIN-006 | Distinguish scheduled amounts, invoiced amounts, paid amounts, allocated/unallocated receipts, credits and outstanding balances. Partial and excess receipts cannot silently distort invoice balances. | C discovery; D DEF-014 |
| REQ-FIN-007 | Consultant visibility intentionally includes assigned-project client quote/payment history and client-facing invoices/schedules; exclude raw bank evidence and internal accounting records by default. | C DEC-004; D DEF-001 |
| REQ-FIN-008 | Capture non-payroll expenses and consultant fees with evidence, category, project allocation and review/payment state; staff submission, manager review and admin posting is the default. | C DEC-010; D DEF-008 |
| REQ-FIN-009 | Salary entry, salary reports and profit views/exports are admin-only; non-admin totals must not include hidden salary/profit values or expose them through subtraction. | C DEC-013; D DEF-001 |
| REQ-FIN-010 | Store money as integer minor units with explicit currency and configured precision; prohibit accidental cross-currency aggregation and use deterministic documented rounding. | D DEF-014; O OPS-004 |
| REQ-FIN-011 | Use traceable balanced postings for confirmed accounting events; reverse rather than overwrite posted entries and support controlled period closure/opening balances. | C full accounts intent; D DEF-014; O OPS-005/006 |
| REQ-FIN-012 | Label accepted quotation value, invoiced sales and received cash separately; profit definitions must state revenue basis, included costs, period and allocation policy. | C discovery; D; O OPS-005 |
| REQ-FIN-013 | Financial dashboards and exports reproduce underlying records and permissions; report-generation time, filters and currency are visible. Record material financial corrections in the audit history. | C dashboards; D |

### Client materials and references — REQ-MAT

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-MAT-001 | Main client and authorized representatives can upload/reference inspiration, material options and comments within assigned projects. | C discovery |
| REQ-MAT-002 | Staff organize suggestions into decision items with clear options, dependencies and dates. Main client makes the binding selection. | C main-client authority; D |
| REQ-MAT-003 | Selections affecting quoted scope, price or timeline must enter the change workflow before they authorize extra work. | C DEC-009; D DEF-015 |
| REQ-MAT-004 | Preserve selected option/version, decision-maker and later revisions; representatives cannot overwrite a main-client decision. | C authority; D DEF-004 |

### Site snags — REQ-SNG

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-SNG-001 | Capture a site issue with location/context, description, photographs, severity and reporter. | C DEC-018; D: field set |
| REQ-SNG-002 | Manager triages/assigns the issue and due date; responsible staff provide resolution evidence. | C DEC-018; D |
| REQ-SNG-003 | Manager verifies closure or reopens with reasons; preserve evidence rather than treating a staff completion click as verified closure. | D |
| REQ-SNG-004 | Client/consultant visibility is explicit and reviewed; internal remediation comments and private cost notes stay internal. | C DEC-006; D DEF-001 |

### Archive and lifecycle — REQ-ARC

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-ARC-001 | Archive records without automatic deletion; current brief retains records indefinitely. | C DEC-015 |
| REQ-ARC-002 | Authorized clients and consultants retain view/download access to the permitted archived project records and files, not draft/internal material. | C DEC-015; D DEF-001 |
| REQ-ARC-003 | Archived operational content is read-only; manager-controlled reopening records a reason and rechecks participants, open obligations and reminders. Admin may append settlement and normally authorized corrections for existing financial obligations, without new work, invoices or schedule changes. | D DEF-006 |
| REQ-ARC-004 | Staff departures and consultant scope expiry revoke access independently of project archive; archive must not reactivate a suspended identity. | C access control; D |
| REQ-ARC-005 | Archive displays unresolved financial obligations; archiving must not forgive balances or silently delete open commitments. | D |

### Notifications — REQ-NOT

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-NOT-001 | Support in-portal and WhatsApp notifications for due/overdue payments, approvals, drawings, tasks and relevant published updates. | C DEC-017 |
| REQ-NOT-002 | Recipient selection follows current project membership, authority and record visibility; recheck at delivery time. | D DEF-001 |
| REQ-NOT-003 | Unresolved overdue items escalate to the administrator according to configured timing; owner-only performance never travels through a general escalation message. | C DEC-017/013; O OPS-008 |
| REQ-NOT-004 | Retries, duplicate events and scheduling reruns must not produce repeated indistinguishable reminders; retain delivery/failure history. | D |
| REQ-NOT-005 | WhatsApp content is minimal, uses configured contact/sender settings and links back to an authenticated authorized view. | C WhatsApp channel; D DEF-012; O OPS-008 |
| REQ-NOT-006 | A read message is not an approval, completed task or confirmed payment. Cancel obsolete pending reminders when the underlying action resolves or access changes. | D |

### Dashboards and actions — REQ-DAS

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-DAS-001 | Owner/admin overview prioritizes delayed tasks, pending approvals and approaching deadlines, with authorized actions and clear dates. | C owner priorities |
| REQ-DAS-002 | Show invoiced and received values separately; salary/profit cards require admin capability and individual performance requires owner capability. | C DEC-013; D DEF-001 |
| REQ-DAS-003 | Waiting-on-you derives actionable items from each source workflow and directs the permitted decision-maker to the current version. | C DEC-018; D |
| REQ-DAS-004 | Owner-only performance uses observable deadline, quality/rework and site-progress evidence with disclosed definitions; do not invent automated quality scores. | C discovery/DEC-013; D |
| REQ-DAS-005 | Project views show published progress, current released drawings, next payment and relevant decisions without revealing internal task/finance detail. | C original request; D DEF-001 |

### Files — REQ-FIL

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-FIL-001 | Support photographs, documents, large drawings/CAD and videos within configurable size/type limits; distinguish downloadable originals from available previews. | C DEC-002; O OPS-009 |
| REQ-FIL-002 | Attachments inherit an explicit parent/audience/version scope; an upload is not automatically published or shared with every project member. | D DEF-001/004 |
| REQ-FIL-003 | Upload failures and unavailable previews show recoverable status; no silent claim that a failed upload or unrenderable file is ready. | D |
| REQ-FIL-004 | Access to originals, previews and thumbnails follows current authorization, including archive and revocation. No public project object URLs. | D DEF-001/016 |
| REQ-FIL-005 | Preserve originals needed for version/audit history. A file referenced by a released drawing, issued invoice or retained record cannot be silently replaced or purged. | C DEC-015; D DEF-004 |

### Operations — REQ-OPS

| ID | Requirement and acceptance boundary | Provenance |
|---|---|---|
| REQ-OPS-001 | Online-only phone/desktop experience communicates disconnection and preserves no implied offline queue; avoid showing unsaved work as saved. | C DEC-016; D |
| REQ-OPS-002 | Deployment and operation follow the Cloudflare/Wrangler architecture handoff; no secret or private live client dataset belongs in this repository. | C user technology instruction; D |
| REQ-OPS-003 | Record auditable business events for approvals, releases, money, access and corrections; do not put secrets or unnecessary private content into logs. | D |
| REQ-OPS-004 | Operational setup, backups/restoration, limits and support ownership must be documented before production use; use synthetic demonstration data until authorized live onboarding. | D; O OPS-001/009/010 |

## Operational input register

These are configuration/data decisions, not a reason to defer the whole build. Seed clearly labeled fictional defaults for demonstrations; do not use them as production financial or authority settings.

| ID | Input | Needed before |
|---|---|---|
| OPS-001 | Firm identity, legal display details, brand assets, initial admin/owner identities and role delegation. | Live invitations and branded commercial documents. |
| OPS-002 | Project/stage templates, feasibility checklist, manager responsibilities and named consultant disciplines. | Real project activation and drawing review. |
| OPS-003 | Quotation terms, acceptance evidence, required advance policy and extra-work payment thresholds. | Binding client acceptance/activation/change execution. |
| OPS-004 | Base currency/currency support, minor-unit precision, rounding, tax treatment and permitted line-item calculations. | Real invoice issue and balances. |
| OPS-005 | Chart of accounts, period policy, invoice numbering/correction rules, reporting basis, salary treatment and profit allocation policy. | Accounting postings and trusted reports. |
| OPS-006 | Opening balances, outstanding invoices, advances, existing projects and import reconciliation sign-off. | Migration/cutover. |
| OPS-007 | Whether date/stage triggers use date-only, stage-only, both or either; milestone confirmation and due-date grace rules. | Automated due/overdue calculation. |
| OPS-008 | Reminder timings, quiet hours/timezone, WhatsApp contact consent/preferences, sender/provider configuration and escalation destinations. | External message delivery. |
| OPS-009 | File size/type limits, storage budgets, video/preview policy and realistic sample formats. | Production file intake. |
| OPS-010 | Support contacts, restoration objectives, archive access exceptions and lawful handling of exceptional deletion requests. | Production operations. |
| OPS-011 | Owner-approved definitions of deadline performance, quality/rework evidence and site progress; who may record quality observations. | Individual performance reporting. |
| OPS-012 | Announcement audiences and delegated publisher policy; client-representative financial grants. | Company announcements and representative finance views. |

## Traceability rule

Every implemented feature should name its applicable requirement IDs in its acceptance evidence. A future agent must record any changed business rule here, update the related workflow and permission matrix, and explain the change in the handoff. The [roadmap](../implementation/roadmap.md) owns delivery sequencing; this document owns intended behavior.
