# SCR-10 — Project quotation, schedule, invoices and receipts

**Route:** `/projects/:projectId/finance` with quotation/invoice detail subroutes. **Requirements:** REQ-FIN, REQ-PRJ, REQ-CHG. **Workflow:** [invoices and accounting](../workflows/invoices-and-accounting.md).

## Purpose and permission

Show the agreed financial relationship clearly. MAIN_CLIENT and CLIENT_REP with an explicit financial-read grant view their project's quotation, issued invoices, payment schedule and confirmed receipts. A representative invitation alone does not confer financial access. CONSULTANT deliberately has access to the assigned project's client quotation/payment history; they do not gain internal salary, profit or private discussion access. Internal mutation rights are separate: staff prepares/issues approved invoices, manager approves invoices and alone changes schedules, ADMIN confirms receipts.

## Information and fields

Start with next payment due, due amount, confirmed paid-to-date and outstanding balance, clearly labelled. Follow with schedule rows, current quotation and issued invoices/receipts. Schedule: description, trigger (date or stage), due rule, amount, confirmed allocation and status. Invoice: number, issue date, line items, tax/discount fields only as configured, due date and immutable issued document. Receipt: received date, amount, reference, confirmation status and allocations.

**Primary action:** internal staff “Prepare invoice,” manager “Approve invoice” in a review context, ADMIN “Record payment received,” MAIN_CLIENT “Accept quotation” when required. Ordinary external view has “View payment schedule,” not an online payment button.

## Interaction and service contract

Read server-calculated amounts and authorised financial records. Write drafts, invoice approval/issue, manager schedule revision and admin receipt confirmation/allocation. Money is parsed into integer minor units; UI formatted strings are never authoritative calculations. Partial payments and advances must show their allocation rather than marking an entire invoice paid by association.

Display an explicit before/after summary for schedule revisions. Corrections to issued financial records use the documented void/credit/reversal process; no silent in-place rewrite. Do not turn an uploaded bank screenshot into a verified receipt. Quote/extra-work acceptance refers to the precise estimate version.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Empty schedule means not prepared, not nothing owed. Mobile uses labelled amount rows and expandable invoice details. Archived external views permit downloads/history only. An authorised ADMIN can still append a receipt or approved settlement against an existing obligation without reopening the project, with the normal audit/correction approvals intact. This exception does not permit a new invoice, extra work or schedule revision. Server conflicts return fresh totals before any approval is repeated.

## Acceptance criteria

- “Invoiced,” “Received” and “Outstanding” are independently correct and never added into one sales number.
- Client/consultant requests cannot confirm receipts or change schedules.
- Manager approval applies to the issued invoice version.
- Partial allocation cannot exceed available receipt or outstanding amounts under the accounting rules.
- Salary/profit fields are absent even from raw external responses and exported project documents.
- An existing archived receivable can be settled by ADMIN; ordinary archived invoice creation and schedule changes remain denied.
