# SCR-01 — Sign-in and invitation acceptance

**Routes:** `/login` (branded gateway where applicable), `/invite/accept`; verification is hosted by Cloudflare Access under the architecture default. **Requirements:** REQ-IAM, REQ-OPS. **Workflow:** [access lifecycle](../workflows/archive-and-access.md).

## Purpose and permission

Give each person their own identity and return them to permitted work. Access is invitation-based; spouses, business partners and client representatives do not share the main client's session. ADMIN controls invitation and membership grants. Authentication does not itself grant project access.

## Layout and fields

A quiet two-panel desktop composition: brand mark and short product purpose, then a compact sign-in panel. On mobile show only the functional panel and small wordmark. The architecture default is Cloudflare Access hosted email verification for invited identities. Merveille Designs may show a branded continue/help gateway; Access owns the email/verification UI. Do not build a competing password or custom OTP form inside Merveille Designs. If Access redirects before the application renders, that is the expected authentication boundary. Invitation acceptance identifies the invited address, intended role and project scope only after validating the token/session.

**Primary action:** “Continue” or the precise configured provider action; invitation flow uses “Accept invitation.” No social-provider buttons that are not configured. Do not offer public account creation.

## Interactions and service contract

Read configured Access entry points, the server-verified identity/session and validated D1 invitation. Access handles authentication; application mutations accept a valid invitation and perform the documented session/logout operation. Invitation acceptance also checks that Access provisioning is ready, so a pending allowlist change is not represented as a usable invitation. Accepting an invitation is single-use and must not permit changing its target address or role. Resolve a safe return path server-side; cross-origin return URLs are rejected.

A signed-in person with no project membership gets a helpful no-access screen rather than an empty owner dashboard. Session expiry during a form requires reauthentication before any mutation; never resubmit a financial approval automatically.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Verification feedback does not disclose whether an arbitrary address belongs to a user. Invalid, expired, already-used and revoked invitations show safe explanations and a contact-admin path. Keep keyboard focus inside the sign-in step; verification inputs must support paste and accessible labels. No private content appears behind the sign-in overlay.

## Acceptance criteria

- Two representatives have independent sessions and attribution.
- Expired/revoked invitations cannot create memberships; replay is harmless.
- A user cannot change roles by editing invitation URL/form fields.
- After sign-in, an unauthorised deep link remains denied.
- Keyboard, mobile and recovery/error states are demonstrated without real credentials in screenshots.
