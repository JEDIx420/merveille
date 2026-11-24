# P01 — Identity, invitations and permission foundation

**Status:** not started. **Dependencies:** P00.

## Outcome

Build the trust boundary before adding business data.

## Read before implementation

- [roles-and-permissions.md](../../../docs/product/roles-and-permissions.md)
- [identity-and-security.md](../../../docs/architecture/identity-and-security.md)
- [data-model.md](../../../docs/architecture/data-model.md)
- [01-sign-in.md](../../../docs/screens/01-sign-in.md)
- [18-people-access.md](../../../docs/screens/18-people-access.md)

## Implementation order

1. Create organisations, users, invitations, explicit capability bundles, base project scopes, memberships and audit tables using migrations.

2. Implement Access JWT validation and principal construction; restrict audience/issuer and reject fabricated identity headers.

3. Implement invitation/provisioning states, expiry, revoke and account disable. Separate privileged Access reconciliation from public web handlers.

4. Implement deny-by-default policies shared by route handlers, server actions, downloads, exports and jobs. Keep OWNER and ADMIN independent.

5. Deliver sign-in/access-pending/denied screens and the admin people/access view.

6. Test access using two unrelated synthetic projects and all roles, including combined and separated OWNER/ADMIN capabilities.

## Target code areas

These are planned paths; they do not exist merely because they are listed. The Phase 00 scaffold may refine filenames while preserving the boundaries.

- `src/server/auth/`
- `src/server/db/`
- `src/server/domain/identity/`
- `src/app/(auth)/`
- `src/app/(portal)/people/`
- `workers/identity/`
- `migrations/`
- `tests/authorization/`

## Acceptance cases

Run AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008 from [the acceptance catalogue](../../quality/acceptance.md). Add targeted regression coverage for any defect discovered while satisfying these cases. Test the actual domain boundary and persistence; do not replace checks with screenshot-only evidence.

P01 proves these access policies using synthetic resources at the shared authorization layer. Later feature phases must repeat them on real endpoints/files/exports, and P14 supplies integrated evidence. Keep the complete case status unpassed until that later evidence exists.

## Exit gate

Forged identity and cross-project reads fail; invitations, revocation and capability separation work in local/runtime tests. Live Access smoke is recorded separately when configured.

## Evidence and continuation

Update [task.md](../../../task.md), add the phase evidence using [the template](../../quality/evidence-template.md), and record any ADR/default change. State exactly which integrations were real, simulated or blocked. Do not mark a blocked acceptance gate complete. Continue to the next dependency-ready phase in [the roadmap](../roadmap.md).
