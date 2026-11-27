# N02 — Small leads tracker and safe spreadsheet import

Follow [the current work order](README.md) and [free-tier limits](01-scope-and-free-tier-baseline.md). Extend [the existing enquiry service](../../src/server/domain/enquiries/service.ts), routes and feasibility records. Do not create a disconnected sales application.

## Daily experience

Use **Leads** as the simple user-facing label. Provide list and board views plus Follow-ups due and Overdue filters. The normal record has six visible groups:

| Group | Behavior |
|---|---|
| Name | Person/company display name; required for initial save |
| Contact | Phone and/or email; optional until actually needed |
| Requirement | Short note, ideally dictated; required with name for initial save |
| Stage | New, Contacted, Discussion/site visit, Proposal, Won, Lost; On hold is an optional paused state |
| Owner | Defaults to the current authorized internal user; reassignment is permission checked |
| Next action | Short action with optional date/time; no invented date when none was supplied |

Initial creation should need only name and requirement, with useful defaults already selected. Site location, source, budget, labels and historical information belong in optional details or imported metadata. Do not require twenty fields or generate fake contact details to satisfy the old schema. A contact is not automatically a portal user and consumes no Access seat until separately invited.

Retain feasibility information and existing enquiry stages. Implement an explicit mapping from legacy stages to the simplified pipeline and preserve the original stage in history. Do not label an unconverted enquiry as an active project. Lost/declined keeps the existing reason and permits a deliberate, audited reopening. A plain follow-up completion records what happened and optionally schedules the next action.

Use a compact activity history: note, call/meeting outcome, stage change, owner change and completed follow-up. Voice in N03 should fill the same validated form. Keep ordinary typing and paste available for accessibility, poor audio or quota exhaustion.

## Permission and conversion contract

Lead read/write access belongs only to explicitly authorized internal users. Reuse ADMIN/OWNER/intake capabilities and establish clear owner/assigned-team scope; do not grant every manager every lead merely from the label. Clients, representatives and consultants cannot discover leads through lists, counts, search, notifications, exports or guessed URLs. Validate the proposed owner against current organization membership and intake eligibility.

Marking **Won** records sales intent. Only the authorized administrator conversion/setup flow creates or links the project, chooses the real main client and manager, and preserves lead/feasibility history. Conversion is atomic and idempotent; repeated clicks cannot make duplicate projects. It does not activate the project, send an invitation, fabricate acceptance, or confirm commercial clearance. Actual activation follows [document 02](02-simple-workspace.md). Linking an existing project must be explicit and permission checked.

The current `enquiries` schema requires contact email and site location. Plan a safe migration or compatible extension so unknown values are genuinely absent; do not use fake emails, guessed addresses or silent placeholder identities. Preserve old IDs, linked projects, feasibility records and audit trails. Keep applied migration files unchanged.

## Import: upload → map → preview → confirm

Support `.xlsx` and `.csv` first. Detect legacy `.xls` and either parse it with a reviewed, compatible open-source dependency or show a precise instruction to save as `.xlsx`; record that limitation honestly. No external spreadsheet conversion API, cloud drive connection, macros or paid parser is required. Select the sheet and header row when a workbook contains more than one table.

1. **Upload and inspect.** Suggest a starting pilot cap of 5 MB and 2,000 data rows per import. Measure and adjust downward if actual Free runtime or device limits demand it. Parse in a browser Web Worker, keep the UI responsive and expose cancel/progress. Check file signatures, compressed/expanded size and row/cell limits; extension alone is insufficient.
2. **Suggest a mapping.** Match familiar headings such as Name, Client, Phone, Requirement, Status, Owner and Follow-up. Show the mapping for review. Only Name plus a requirement/note mapping is needed for normal creation; let the user provide a reviewed batch default note rather than silently inventing one. Preserve unmapped original columns in restricted import metadata, without making them new required form fields.
3. **Preview every decision.** Show rows that will be created, exact-source rows already imported, possible duplicates, invalid rows and proposed updates. Unknown owners stay unresolved or use a specifically selected default. Unknown stages require a chosen mapping. Do not silently create accounts or guess the main client from a name.
4. **Confirm and process.** Save an import batch, source checksum and row provenance. Send small bounded batches to the server; 50 rows is a starting upper bound, not proof of 10 ms compatibility. Revalidate all types, references, permissions and quota reservations server-side. Persist progress/idempotency keys so refresh or a retry resumes instead of duplicating records. Do not keep the entire workbook in a Worker request.
5. **Summarize.** Return created, skipped, rejected, updated and review-needed totals with a downloadable error report and source-row references. No row may disappear without a recorded outcome. Historical imports generate no reminder storm, invitations, client publication or WhatsApp work.

## Preserve what the spreadsheet actually says

- Keep phone numbers as strings; preserve leading zeroes and `+` prefixes. Use formatted cell text and explicit review when Excel stored a number ambiguously. Never turn a phone into scientific notation or assume every number has an Indian country code.
- Resolve Excel 1900/1904 date systems from workbook metadata. Require a visible date interpretation for ambiguous text such as `11/12/2026`. The default business zone is `Asia/Kolkata`; show the resolved date/time before committing. A date-only follow-up is distinct from a timed appointment.
- Do not execute formulas or macros. Flag formula-derived values and use cached values only with clear preview where supported; missing cached values remain unresolved. Neutralize formula injection when exporting CSV while preserving the original value in the audit source.
- Do not merge on name alone. Stable source IDs are preferred. Normalized email/phone can suggest candidates, but conflicts, shared contacts and multiple commissions require review. An exact reimport of the same source/row must be idempotent; a changed row is a proposed update, not permission to overwrite current notes.
- Preserve the original upload only within its allocated private R2 budget and retention policy. Count its bytes before commit. If the source cannot be retained under the agreed budget, block the affected import or use an explicit documented no-original retention mode that still preserves checksum, mapping and row provenance. Do not quietly discard the source or create a public upload URL.

## Reversibility and history

Store batch ID, source row/sheet, original identifiers, mapping version, creator/time and the resulting record IDs. Imported extras inherit lead access controls. Export the user's leads with original references and optional extra columns so information is not trapped in the simplified UI.

Offer **Undo import** for records created by that batch only if they remain untouched and have no linked project or dependent business activity. Use revision checks and audit the undo. Never delete later edits, completed follow-ups, externally linked projects or shared contact history. For a deliberate reviewed update, retain before/after values and reverse only if the current revision still matches the imported result; otherwise report the conflict for manual resolution. An import is a series of durable bounded commits with honest partial results, not a pretend all-or-nothing operation across thousands of rows.

## Related Asana migration

Provide a reviewed CSV import path for the supplied Asana task/project exports using the same preview/provenance infrastructure, after the core lead importer works. Map task title, source ID, parent-task/subtask relationship, project/section, assignee, due date, status and available visibility information to the canonical task contract in document 02. Resolve parent references by stable source ID after preview; missing parents, cycles and conflicting parent/child visibility require review instead of flattened or broadened access. Unknown project/assignee/visibility remains pending review. The task owner and original deadline are historical facts, not newly approved manager commands.

Do not promise that a CSV carries every Asana comment, attachment, permission or activity event. Inventory the actual export and handle absent files/comments as explicit separate migration items. No Asana API connection is necessary for the initial path. Preserve personal/private records or quarantine them for the importing owner; importing them into a shared project is never the default. Live reminders start only after a reviewed activation date, not from historical import timestamps.

## Meaningful acceptance

Use synthetic workbooks, not client data committed to the repository. Cover multiple sheets, blanks, merged headers, long notes, leading-zero phones, Unicode names, Excel serial dates, ambiguous dates, cached and missing formula values, malformed/oversized archives, unknown users and stages, duplicate contacts, repeated imports and interrupted batches. Verify permission checks even when the browser sends a forged normalized row.

Prove that a user can create a minimal lead, add a follow-up, filter today's work, review an Excel import, correct rejected rows, resume safely, export the retained data and undo untouched imports. Prove that later edits survive undo and that a won lead cannot bypass project setup or activation. Use N04 for reminder timing and N03 for dictation; these stages must use the same records and commands.
