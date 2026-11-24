# SCR-04 — Enquiry, requirements and feasibility

**Routes:** `/enquiries`, `/enquiries/new`, `/enquiries/:enquiryId`. **Requirements:** REQ-PRJ, REQ-FIN, REQ-FIL. **Workflow:** [enquiry to activation](../workflows/enquiry-to-activation.md).

## Purpose and permission

Capture the relationship before a project is active: enquiry, client requirements, site feasibility, feasibility study, quotation, acceptance and advance. Internal access follows assigned responsibilities. Prospective-client access is deliberate, not automatic merely because an email was entered. MAIN_CLIENT is the contractual decision-maker once invited; CLIENT_REP may contribute requirements/references.

## Layout and fields

Use a clear stage header and a grouped form: contact/client party, site/location, scope/requirements, constraints, site visit findings, feasibility result, study attachments and notes. Separate internal notes from the externally shareable feasibility study. Show quotation version and its acceptance/advance status as linked records.

**Primary action changes by stage:** “Save enquiry,” “Complete feasibility,” “Prepare quotation,” “Send for acceptance,” or “Activate project,” each shown only to the appropriate actor. Do not show every future-stage action simultaneously.

## Interaction and service contract

Read enquiry, client/representative relationships, feasibility attachments, applicable quotation and verified advance allocations. Write scoped enquiry edits, feasibility findings, study submission and requested stage transitions. Payment confirmation belongs to ADMIN; quotation acceptance belongs to MAIN_CLIENT; activation checks both records server-side.

Activation cannot be triggered by a pasted bank reference, manually ticked “Paid” checkbox or unconfirmed screenshot. If the quotation changes after acceptance, show its revision and follow the documented acceptance rules. Preserve the enquiry history after conversion rather than creating an unrelated duplicate client/project.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). A blocked activation names the missing prerequisite without granting a bypass. Pending document upload cannot become a completed feasibility study. Mobile supports camera/file input while connected, with visible upload progress. Do not imply offline capture. A declined or paused enquiry remains traceable with a reason.

## Acceptance criteria

- An accepted quotation alone cannot activate work without confirmed advance.
- A verified advance against the wrong quotation/project cannot satisfy the gate.
- Internal notes never appear in the client feasibility view.
- Activation is idempotent and preserves the enquiry-to-project relationship.
- Main-client and representative authorities remain distinct throughout the process.
