# SCR-20 — Notifications, WhatsApp preferences and escalation

**Routes:** `/notifications`, `/settings/notifications`; ADMIN delivery/escalation controls within authorised settings. **Requirements:** REQ-NOT, REQ-IAM, REQ-DAS. **Workflow:** [notifications](../workflows/notifications.md).

## Purpose and permission

Deliver payment-due, overdue-drawing and overdue-task reminders through the portal and WhatsApp. If an overdue item remains unresolved under the configured policy, notify ADMIN. People see their own messages; ADMIN operational views must not expose private performance/salary content without the corresponding capability.

## Layout and fields

Notification list: type, project or safe context, short action text, created time, read state and source link. Preferences show verified destination/phone in masked form, WhatsApp consent/status and allowed delivery preferences. Admin settings show reminder cadence, timezone, unresolved-overdue escalation rule, template/configuration readiness and failed delivery counts. These timings are configurable engineering defaults, not already-confirmed client requirements.

**Primary action:** “Open item” or “Save preferences.” “Mark read” changes read state only. Admin retry applies to a failed delivery with a clear recipient/context; there is no bulk send-to-everyone action in initial scope.

## Interaction and service contract

Read permission-filtered notifications, own preferences and authorised delivery status. Write read state/preferences and admin policy changes. WhatsApp delivery uses an approved configured provider/template process; the interface must not imply messages can be sent before setup is complete. Local/demo environments use a non-sending adapter and obvious delivery simulation labels.

Generate notifications from source events, deduplicate repeats and recheck item state/access before delivery. A settled payment or completed/reopened task must produce the appropriate current-state behaviour. Archive suppresses ordinary project-work reminders but does not erase overdue existing financial obligations or their authorised reminders/escalations. Delivery accepted, delivered and read are different states. Provider failures do not undo the underlying business action or erase the in-portal reminder.

WhatsApp text contains minimal sensitive content and links to sign-in-protected records. Do not attach private drawings, salary information or performance results automatically.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). No notifications is distinct from a delivery outage. Unconfigured WhatsApp shows setup-required to admins and truthful channel availability to users. Stale source links show the current permitted result. Mobile controls remain readable; notification counts are not the only indication of urgency.

## Acceptance criteria

- Portal reminders work even when WhatsApp delivery fails.
- Repeated jobs cannot send duplicate reminders for the same occurrence.
- Unresolved overdue escalation reaches the configured ADMIN audience, not everyone.
- Revoked recipients and resolved records are rechecked before delivery.
- Marking a reminder read never completes its task, invoice or drawing review.
