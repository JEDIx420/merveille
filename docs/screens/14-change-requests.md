# SCR-14 — Change requests and additional work

**Route:** `/projects/:projectId/changes`, detail `/projects/:projectId/changes/:changeId`. **Requirements:** REQ-CHG, REQ-FIN, REQ-MAT. **Workflow:** [change requests](../workflows/change-requests.md).

## Purpose and permission

Record a requested change and make its cost/time implications explicit before additional work starts. Clients and representatives can request changes; MAIN_CLIENT provides final contractual acceptance. Staff prepare the additional estimate. ADMIN confirms required payment. MANAGER authorises execution.

## Layout and fields

Request: title, description, affected drawing/material/site area, references, requester and date. Estimate: version, scope, exclusions, amount, required advance/payment condition, effect on dates and validity if used. A clear readiness panel shows three independent conditions: accepted estimate, payment confirmed and manager authorisation. Link the resulting tasks and any revised drawing version.

**Primary action changes with actor/state:** “Request change,” “Prepare estimate,” “Accept estimate,” “Confirm payment received,” or “Authorise additional work.” Do not display a generic “Approved” badge that conceals which condition remains missing.

## Interaction and service contract

Read change request, immutable estimate revision, main-client acceptance, verified receipt allocations and manager decision. Write request/estimate, acceptance, financial confirmation through its protected flow and manager authorisation. Starting extra-work tasks is guarded by all required conditions on the server. A payment against another project or superseded estimate cannot satisfy the requirement silently.

A revised estimate invalidates acceptance/payment assumptions as defined in the workflow; clearly show how an existing receipt is carried/reallocated rather than losing its history. A request can be declined/withdrawn with reason. Preserve both the original scope and the agreed variation.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Show the specific blocker to execution. A concurrent estimate edit requires rereview of the new version. Mobile presents the request, estimate and readiness panel sequentially; the acceptance action appears after readable scope/cost details. Archived projects show historical variations without new work authorisation.

## Acceptance criteria

- No single approval or checked box bypasses the three readiness conditions.
- Main-client acceptance refers to the exact estimate version.
- Representatives may request changes but cannot provide final contractual acceptance.
- Additional work cannot start on a merely uploaded payment screenshot.
- Each resulting task can be traced to its authorised change.
