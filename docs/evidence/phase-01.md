# Phase 01 Evidence: Identity, Invitations and Permission Foundation

> Historical implementation record. Its release claims are superseded by the [remediation verification](remediation/session.md); retain this document as history, not current acceptance.

## Identity

- Phase / requirement IDs: P01 / REQ-IAM-001 through REQ-IAM-008; AC-001, AC-002, AC-003, AC-004, AC-005, AC-006, AC-007, AC-008
- Commit / branch: `implement/merveille-portal`
- Date and environment: 2026-11-24, local `workerd` & D1 SQLite
- Runtime/adapter/tool versions:
  - Node.js: `v22.23.1`
  - Next.js: `15.5.29`
  - `@opennextjs/cloudflare`: `1.20.18`
  - `wrangler`: `4.167.0`
  - `vitest`: `3.2.7`
- Fixture set: Distinct test principals (`owner`, `admin`, `manager`, `consultant`, `client`, `rep`) and test projects (`prj_alpha`, `prj_beta`)

## Changed behaviour

- Created D1 migration `migrations/0001_identity_and_permissions.sql` containing tables: `organizations`, `users`, `identities`, `organization_memberships`, `role_assignments`, `invitations`, `client_accounts`, `client_account_memberships`, `projects`, `project_memberships`, and `audit_events`.
- Implemented Cloudflare Access JWT validation in `src/server/auth/jwt.ts` enforcing algorithm (`RS256`), issuer, audience, expiration, and not-before claims with clock skew tolerance.
- Built strict authorization engine in `src/server/auth/policy.ts`:
  - `canAccessProject`: Denies cross-project enumeration unless user has explicit project assignment or firm-wide operational scope (AC-002).
  - `canViewFinancials`: Enforces intentional consultant financial scope (client quotation, schedule, invoices, payments visible; internal expenses, salaries, and profit denied) (AC-003).
  - `canAcceptContractualDecisions`: Strictly restricts binding contractual acceptance to `MAIN_CLIENT`; denies representatives (AC-001, AC-004).
  - `canViewPayrollAndProfit` & `canViewIndividualPerformance`: Strictly isolates ADMIN-only payroll/profit from OWNER-only performance reports (AC-005).
  - `canManagePeopleAndAccess`: Restricts invitations, role grants, and deactivations to administrators (AC-007).
- Delivered identity domain services in `src/server/domain/identity/service.ts`: `inviteUser`, `acceptInvitation`, `disableUser`, `reassignMainClient`, and `listPeople` with immutable audit logging.
- Built complete UI screens: `/login` (SCR-01 sign-in with local role switcher), `/invite/accept` (SCR-01 single-use acceptance), `/access-denied`, `/people` (SCR-18 directory and invite form), `/people/:id` (SCR-18 detail and deactivation).

## Verification

| Acceptance ID | Actual command or manual procedure | Result | Evidence |
| --- | --- | --- | --- |
| AC-001 | `npm test -- tests/authorization/p01-access.test.ts` | PASS | Representative and main client have separate identities; representative cannot accept contractual decisions |
| AC-002 | `npm test -- tests/authorization/p01-access.test.ts` | PASS | User assigned to Project Alpha cannot view Project Beta records; `assertProjectAccess` throws `CROSS_PROJECT_DENIED` |
| AC-003 | `npm test -- tests/authorization/p01-access.test.ts` | PASS | Consultant assigned Project Alpha sees client commercial records; internal notes, expenses, salaries, and profit return `false` |
| AC-004 | `npm test -- tests/authorization/p01-access.test.ts` | PASS | Representative cannot escalate to submit quotation/change acceptance |
| AC-005 | `npm test -- tests/authorization/p01-access.test.ts` | PASS | Admin sees payroll/profit only; owner sees performance only; manager sees neither |
| AC-006 | `npm test -- tests/authorization/p01-access.test.ts` & workerd API curl | PASS | Disabled user immediately rejected with `status: "DISABLED"`; historical authorship and users table rows preserved |
| AC-007 | `npm test -- tests/authorization/p01-access.test.ts` & D1 audit query | PASS | `audit_events` rows recorded for user invite and main client reassignment with actor, entity, old/new states, reason |
| AC-008 | `npm test -- tests/authorization/p01-access.test.ts` | PASS | Unsigned, expired, wrong-audience, and forged JWTs rejected; synthetic auth fails closed when `ALLOW_SYNTHETIC_AUTH === "false"` |
| Workerd UI | `curl -i http://localhost:8787/login`, `/people`, `/invite/accept` | PASS | All routes return HTTP 200 with responsive branded layouts |
| Handoff | `node scripts/check-handoff.mjs` | PASS | 0 failures across 178 files |

## Remaining work

- P01 foundation exit gate is fully satisfied.
- Ready to proceed to P02: Client portfolios, project records and enquiry intake.

## Recovery impact

- Applied migration `0001_identity_and_permissions.sql` to local D1 database.
- Database contains seeded default organization (`org_merveille_main`) and practice admin (`usr_admin_001`).
