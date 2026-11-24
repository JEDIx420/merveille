# SCR-13 — Materials, selections and client references

**Route:** `/projects/:projectId/selections`. **Requirements:** REQ-MAT, REQ-FIL, REQ-CHG. **Workflow:** [materials and references](../workflows/materials-and-references.md).

## Purpose and permission

Let clients contribute reference images and make material decisions without turning those actions into drawing approval or an unapproved purchase. MAIN_CLIENT and authorised CLIENT_REP can upload references and express preferences. Final client acceptance for decisions that affect contractual scope/cost belongs to MAIN_CLIENT. Internal staff curate the available choices and track decisions.

## Layout and fields

Two clear sections: Reference library and Material selections. Reference cards contain image/file, caption, uploader and date. Selection rows show space/category, option description, thumbnail, specification/link, decision deadline, selected option and whether there is a cost/time impact. Keep client-facing notes separate from internal sourcing/pricing notes.

**Primary action:** client “Add reference” or “Choose material” in a decision context; internal staff “Request selection.” A representative's preference is labelled as a suggestion until the relevant main-client acceptance is recorded. Do not require main-client approval for every harmless uploaded inspiration image.

## Interaction and service contract

Read allowed references, selection options and decisions. Write reference upload/description, preference/suggestion and main-client acceptance where required. Tie decisions to an option/version; editing a selected specification does not silently preserve the prior acceptance. If a choice changes price or schedule, route to a change estimate and show the effect before work begins.

Links and uploaded files are untrusted content. External URLs should open safely; a URL does not authorise server-side fetching of arbitrary resources. No reference automatically becomes an approved drawing or instruction to site staff.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Distinguish no choices requested from a decision overdue. Use accessible list alternatives to an image-only grid. Mobile supports connected uploads and full-readable material details. An unavailable image retains its description and permitted download fallback. Archive mode is view/download only.

## Acceptance criteria

- Reference upload never changes drawing/release state.
- A representative cannot impersonate main-client contractual acceptance.
- Cost-impacting selections cannot bypass the change-estimate/payment gate.
- The chosen specification/version and decision-maker are retained.
- Internal supplier/pricing discussions remain absent from client projections.
