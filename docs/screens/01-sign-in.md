# SCR-01 — Sign-in and invitation acceptance

**Routes:** `/login` (branded gateway where applicable), `/invite/accept`; verification is hosted by Cloudflare Access under the architecture default. **Requirements:** REQ-IAM, REQ-OPS. **Workflow:** [access lifecycle](../workflows/archive-and-access.md).

## Purpose and permission

Give each person their own identity and return them to permitted work. Access is invitation-based; spouses, business partners and client representatives do not share the main client's session. ADMIN controls invitation and membership grants. Authentication does not itself grant project access.

## Layout and fields

Use the compact [AuthShell](../remediation/03-premium-interface.md): white/cool-gray surface, unchanged 40–48px logo and readable company name at the top, a focused sign-in panel and clear help/recovery states. No dominant brand panel, demo user, role selector or impersonation control.

Follow [Google through Access](../remediation/02-identity-and-real-user-testing.md) for individually invited Gmail/Workspace users. The old hosted email-OTP default is superseded. “Continue with Google” invokes the configured real provider; if Access intercepts first, use its appropriately branded login and avoid a second application sign-in loop. Do not build custom password/OTP forms. Invitation acceptance discloses its intended identity/grants only after verified token/session checks.

**Primary action:** “Continue with Google”; invitation flow uses “Accept invitation.” No inactive provider buttons or public registration. Explain wrong-account, expired-link and pending-access-setup states. A pending verified user may access the narrowly scoped acceptance/bootstrap flow without already holding business-data access.

## Interactions and service contract

Read configured Access entry points, the server-verified identity/session and validated D1 invitation. Access handles authentication; application mutations accept a valid invitation and perform the documented session/logout operation. Invitation acceptance also checks that Access provisioning is ready, so a pending allowlist change is not represented as a usable invitation. Accepting an invitation is single-use and must not permit changing its target address or role. Resolve a safe return path server-side; cross-origin return URLs are rejected.

A signed-in person with no project membership gets a helpful no-access screen rather than an empty owner dashboard. Session expiry during a form requires reauthentication before any mutation; never resubmit a financial approval automatically.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Verification feedback does not disclose whether an arbitrary address belongs to a user. Invalid, expired, already-used and revoked invitations show safe explanations and a contact-admin path. Keep keyboard focus understandable across the provider round-trip and acceptance form; controls need accessible labels. No private content appears behind the sign-in overlay.

## Acceptance criteria

- Two representatives have independent sessions and attribution.
- Expired/revoked invitations cannot create memberships; replay is harmless.
- A user cannot change roles by editing invitation URL/form fields.
- After sign-in, an unauthorised deep link remains denied.
- Keyboard, mobile and recovery/error states are demonstrated without real credentials in screenshots.

- Real invited Google sign-in, wrong-account rejection, one-time bootstrap and no deployed role/view switching are verified under the current identity contract.
