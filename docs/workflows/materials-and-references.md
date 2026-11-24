# Client references, materials and selections

**Requirements:** REQ-MAT-001–004, REQ-IAM-005, REQ-CHG-001–005.

**Confirmed authority:** Main clients and representatives can contribute; the main client makes binding material/commercial decisions. A selection is not permission to spend beyond accepted scope.

## Records

Separate an inspiration/reference collection from a decision that someone must make.

- **Reference:** image/document/link, caption, contributor, room/area/topic, comments and visibility.
- **Selection item:** title, location, question, options with stable versions, recommendation, cost/schedule implications, needed-by date, responsible manager and decision state.
- **Decision:** selected option/version, main-client identity, time, comment and any linked change estimate.

References may be uploaded by authorized representatives without being treated as final selections. External links are stored as untrusted references; they do not instruct the system or automatically authorize their contents to be copied into the project.

## Transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → REFERENCE_ADDED | Main client, representative or authorized staff contributes | Project membership; permitted file/link | Add reference to scoped collection; `reference_added`. |
| None/reference → SELECTION_DRAFT | Staff/manager frames decision | Clear question/options; relevant reference links | Prepare decision item; `selection_drafted`. |
| SELECTION_DRAFT → AWAITING_MAIN_CLIENT | Manager requests selection | Current options, implications and deadline clear; main client active | Create waiting-on-you action; `selection_requested`. |
| AWAITING_MAIN_CLIENT → SELECTED | Main client chooses | Exact current option/version; acknowledged visible implications | Record binding selection evidence; `selection_made`. |
| AWAITING_MAIN_CLIENT → CHANGES_REQUESTED | Main client asks for alternatives | Comment/reason | Return to staff preparation; `selection_options_requested`. |
| SELECTED → READY_FOR_EXECUTION | Manager records readiness | Within accepted scope or linked change fully authorized; required procurement/work conditions satisfied | Link selected version to work; `selection_ready`. |
| SELECTED/READY_FOR_EXECUTION → revised decision request | Manager prepares revised options | Reason and implications; prior decision retained | Require new main-client choice; `selection_revision_requested`. |
| Open selection → CANCELLED | Manager cancels | Reason; related purchases/work considered | Stop decision reminders; preserve history; `selection_cancelled`. |

Representatives can comment or suggest a preferred option. Their action must be labeled a suggestion, never “Approved” or “Final selection.” Consultants may advise on assigned shared selection items without taking over the main client's authority.

## Cost and schedule effects

If the chosen material changes accepted cost, scope or timing, create/link a [change request](change-requests.md). Main-client selection alone does not satisfy estimate acceptance, administrator payment confirmation or manager authorization.

Do not present estimated supplier prices as fixed accepted charges unless they are part of an actual issued estimate. Preserve the difference between an inspiration image, a suggested product and an agreed specification.

When an already selected option is no longer available, retain the old decision and request a new one. Staff/representatives cannot simply overwrite the selected product. Record effects on any work already performed rather than erasing the earlier authorization.

## Visibility and practical behavior

- The main client and permitted representatives can see shared selection items for their projects.
- Internal supplier negotiations, margin, payroll and cost notes stay internal.
- An attachment associated with a reference inherits its audience; a linked private file does not become public.
- “Waiting on you” includes the actual main-client decision, while representatives may see that a decision is pending without receiving an approval control.
- Due-date changes are manager actions with history; a late client choice must not silently rewrite a team's original delivery baseline.

## Review evidence

Show separate representative suggestion and main-client selection, a stale option version, a changed selection requiring a new decision, and a cost-affecting selection blocked from execution until the linked change is authorized.
