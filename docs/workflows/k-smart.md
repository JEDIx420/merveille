# Manual K-SMART sanction and completion records

**Requirements:** REQ-KSM-001–004, REQ-UPD-002/003, REQ-FIL-002/004.

**Confirmed boundary:** Staff manually track sanction and completion using documents/screenshots. There is no integration, scraping, automated verification or inferred statutory sequence.

## Meaning of a record

Marvel stores **what staff recorded about an external process**, when they checked it and the evidence they attached. It does not certify the authenticity or legal effect of a permit, determine whether building work is authorized or infer that one government step always follows another.

Keep sanction and completion as separate milestone records. Do not encode them as a mandatory legal chain. A project may carry more than one application/reference if the firm's actual process requires it.

## Fields

- Project and milestone type: sanction or completion.
- Application/reference text, if supplied.
- External status text exactly as staff understood/observed it; do not claim that a local status label is the official service vocabulary.
- External document/decision date and **last checked date** as separate fields.
- Staff recorder, source description and optional reference link.
- Documents/screenshots, staff notes and follow-up date/person.
- Internal tracking status, manager review and client-sharing status.

Suggested **internal tracking** labels are Not started, In progress, Awaiting response, Follow-up needed and Recorded complete. These are local organizational labels, not asserted official statuses.

## Transitions

| From → to | Actor/action | Guards | Effects and audit |
|---|---|---|---|
| None → INTERNAL_DRAFT | Assigned staff creates milestone | Project scope; milestone type identified | Record blank/known fields without implying external completion; `permit_record_created`. |
| INTERNAL_DRAFT → RECORDED | Staff saves observation/evidence | Observed status/date/source; evidence uploaded when claiming observed sanction/completion | Create dated observation snapshot; `permit_observation_recorded`. |
| RECORDED → NEEDS_FOLLOW_UP | Staff/manager flags issue | Reason and responsible person/date | Create follow-up action; `permit_follow_up_requested`. |
| RECORDED/NEEDS_FOLLOW_UP → RECORDED | Staff records new observation | New last-checked date and evidence/source; prior observation retained | Append history; resolve/update follow-up; `permit_observation_updated`. |
| RECORDED → SUBMITTED_FOR_SHARING | Staff requests client update | Select outward-facing fields/files | Manager review item; `permit_sharing_submitted`. |
| SUBMITTED_FOR_SHARING → SHARED | Manager publishes selected observation | Exact snapshot reviewed; audience/files permitted | Publish staff-recorded update with last-checked date; `permit_observation_shared`. |
| SUBMITTED_FOR_SHARING → RECORDED | Manager returns | Reason | Keep internal; `permit_sharing_returned`. |
| SHARED → CORRECTED/RETRACTED | Manager corrects or retracts | Reason and replacement evidence if available | Preserve prior published snapshot; notify affected audience if material; `permit_sharing_corrected`. |

Observation status and sharing status may be separate fields rather than one overloaded enum. The transition table expresses behavior, not a required database representation.

## Safeguards

- Display “Recorded by [staff] · Last checked [date]” on shared information.
- A newer unreviewed internal observation does not silently replace the client-visible reviewed observation.
- A screenshot may contain personal details. Share only approved evidence; do not automatically publish every uploaded source file.
- A reference link does not imply Marvel can log in to or query that service.
- An overdue follow-up means staff should check the record; it does not mean an external application was rejected or expired.
- Internal project stages, payment triggers and K-SMART records remain distinct. If the firm later wants an operational dependency, define it explicitly without presenting it as a statutory rule.

## Review evidence

Show manual entry, two historical observations, separate sanction/completion records, manager-approved sharing, private evidence remaining hidden, a visible last-checked date and a correction. No UI should claim live government verification or automatic permit synchronization.
