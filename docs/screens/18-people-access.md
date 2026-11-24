# SCR-18 — People, invitations and project access

**Route:** `/people`, person detail `/people/:userId`, project access inside authorised project settings. **Requirements:** REQ-IAM, REQ-ARC. **Workflow:** [archive and access](../workflows/archive-and-access.md).

## Purpose and permission

Allow ADMIN to add people, manage their project memberships and remove access. Global role bundles and project grants are explicit. OWNER, ADMIN, MANAGER, TEAM_MEMBER, CONSULTANT, MAIN_CLIENT and CLIENT_REP are not interchangeable labels. Salary/profit and performance remain separately protected capabilities.

## Layout and fields

People table: name, identity/address, active/invited/disabled state, role bundles, project count and last relevant access-change date. Person detail shows membership per project, client representation relationship, drawing-review assignment where relevant and explicit financial-read grants. Invitation form includes address, intended roles, project assignments and expiry/review information defined by security policy.

**Primary action:** “Invite person.” On existing accounts use “Save access changes” with a clear before/after summary. Revocation is an explicit separate action. Do not use an all-or-nothing “Can access project” checkbox that implicitly grants financial/internal/admin data.

## Interaction and service contract

Read privileged people/membership records; write invitations, role grants, project grants, main-client authority changes, revocation and disabling. Only ADMIN may perform these mutations. Prevent unintentionally removing the final active administrative recovery path. Any main-client replacement retains authority history; a representative cannot elevate themself.

Disabling access invalidates relevant sessions/authorisation and prevents subsequent file download. Historical authored work, payment confirmations and approvals retain their attribution. Removing a consultant does not delete the drawing they previously approved. Invitations must not silently be sent through real external channels during local demo tests.

## States and mobile

Inherit [shared states](../design/interaction-patterns.md). Expired invitations can be intentionally reissued with a new token, not revived by editing a URL. Duplicate addresses are handled without duplicate identities. Mobile presents one person's grants in manageable sections. Archive membership remains visible and editable by ADMIN; existing staff memberships persist until separately changed. Ordinary project content is read-only, with only the documented ADMIN settlement exception for existing financial obligations.

## Acceptance criteria

- Non-ADMIN users cannot invite, grant access or elevate roles through direct requests.
- Separate client representatives have separate identities and configurable scope.
- Revocation affects current sessions, lists, files and archived-project access.
- Private financial/performance permissions are not inherited accidentally from MANAGER/OWNER/ADMIN labels.
- Historical records survive user deactivation with attribution intact.
