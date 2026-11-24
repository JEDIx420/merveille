# SCR-11 — Firm accounting and protected salary/profit views

**Routes:** `/finance`, `/finance/expenses`, `/finance/consultants`, `/finance/salaries`, `/finance/profit`. **Requirements:** REQ-FIN, REQ-IAM. **Workflow:** [invoices and accounting](../workflows/invoices-and-accounting.md).

## Purpose and permission

Maintain the practice's operational accounts inside the portal. Standard finance access follows explicit capabilities and project scope. **Salaries and profit require ADMIN**, including aggregates, drill-downs, CSV/PDF exports, charts and dashboard summaries. OWNER is not an implicit salary/profit grant. No external participant can open firm-wide finance merely because they see one project's quotation.

## Layout and fields

The overview separates invoiced amounts, confirmed receipts, receivables, expenses and consultant obligations by period. Salary and profit cards/routes are completely absent for unauthorised people. Expenses include project/cost centre, supplier/category, date, amount, currency, evidence and confirmation state. Consultant obligations distinguish what the practice owes the consultant from the client-facing payment history available to that consultant.

Salary records include period, employee, amount/components necessary for the chosen accounting scope, payment status and supporting record; avoid unnecessary personal/bank details. Profit views state period and accounting basis, show included/excluded/unallocated costs and link to supporting entries. Do not claim statutory payroll, tax filing or legal compliance from an internal management screen.

**Primary action:** context-specific “Record expense,” “Record consultant payment,” or “Record salary” when authorised. Invoice and receipt approval actions use their own review context rather than one generic “Add transaction.”

## Interaction and service contract

Read capability-filtered ledger/projections; apply identical protection to export requests. Write only permitted entries and corrections, with audit history and idempotent confirmation. Totals come from the defined accounting model, not summed page rows. Date filters use the configured practice timezone and show the reporting basis.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). An unavailable amount says unavailable, not zero. Missing cost allocation produces a visible “Incomplete cost allocation” explanation before profit is interpreted. Mobile uses focused subpages rather than shrinking a financial workbook. Archived project records remain in historical reporting. ADMIN may append receipts and approved settlements against existing receivables/payables without reopening ordinary project editing. Existing correction approval rules still apply; settlement cannot create a new invoice, work obligation or revised payment schedule.

## Acceptance criteria

- ADMIN-only salary/profit protection holds in navigation, API, exports, totals and search.
- Consultant fees and client receipts cannot be confused or double-counted.
- Reversals preserve the original posted entry and audit reason.
- Reports reconcile to detail for the same filters and calculation basis.
- Export files contain only fields the requesting user can read.
- Archived settlement checks an existing obligation and retains required approval/audit evidence; a generic ledger form cannot bypass archive restrictions.
