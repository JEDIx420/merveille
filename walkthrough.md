# Implementation Walkthrough & Application Status

## Current Deliverable & Baseline

The Merveille Designs operations and client portal application is being implemented from the authoritative repository specification on feature branch `implement/merveille-portal`.

The confirmed company identity, brand assets in `assets/brand/`, and tokens are preserved exactly.

## Application Status by Phase

- **P00 — Runtime foundation and compatibility:** **COMPLETED & VERIFIED (AC-064)**
  - Runtime: Next.js 15.5.29 App Router on Cloudflare Workers via `@opennextjs/cloudflare` 1.20.18 and Wrangler 4.167.0.
  - Architecture decision recorded in [ADR 0001](docs/architecture/decisions/0001-runtime.md) documenting the vinext Rolldown/Vite 8 build blocker and selecting OpenNext.
  - Local bindings verified in `workerd`: D1 database relational operations, private R2 object storage streaming, HTTP cookies/headers, and test-only synthetic principal auth.
  - Branded layout shell active with complete desktop logo and mobile profile branding, accessible contrast tokens, and responsive design.
  - Evidence: [docs/evidence/phase-00.md](docs/evidence/phase-00.md).
- **P01 — Identity, invitations and permission foundation:** **COMPLETED & VERIFIED (AC-001–AC-008)**
  - Applied D1 migration `0001_identity_and_permissions.sql` containing organizations, users, identities, role assignments, invitations, client accounts, project memberships, and immutable audit events.
  - Implemented Cloudflare Access JWT validation with RS256 algorithm check, issuer, audience, exp, and nbf verification.
  - Implemented central authorization policy with deny-by-default, cross-project protection, intentional consultant financial visibility, representative non-escalation, and admin/owner separation of profit and performance.
  - Built identity domain services (`inviteUser`, `acceptInvitation`, `disableUser`, `reassignMainClient`, `listPeople`).
  - Implemented `/login` (SCR-01), `/invite/accept` (SCR-01), `/access-denied`, `/people` (SCR-18), and `/people/:id` (SCR-18).
  - Evidence: [docs/evidence/phase-01.md](docs/evidence/phase-01.md).
- **P02 — Client portfolios, project records and enquiry intake:** **COMPLETED & VERIFIED (AC-009–AC-012)**
  - Applied D1 migration `0002_projects_and_enquiries.sql` containing enquiries, feasibility studies, project stages, project lifecycle events, and commercial activation gates.
  - Implemented enquiry intake domain services: `createEnquiry`, `recordFeasibilityStudy`, `closeEnquiry` (closes lost/declined without creating active project, AC-009), `convertEnquiryToProject` (with 6 baseline architectural stages), `listEnquiries`, and `getEnquiry`.
  - Implemented project lifecycle services: `listProjects` (multi-project client visibility and representative isolation, AC-011), `getProject`, `activateProject` (guarded manager command requiring accepted quote AND confirmed advance receipt, AC-010), `updateProjectStage` (optimistic concurrency and auto-advancement, AC-012), `pauseProject` and `resumeProject` with mandatory reason and audit logging.
  - Built UI screens: `/projects` (SCR-03 projects directory with stage filter and status badges), `/projects/:id/overview` (SCR-05 overview, commercial gate indicators, guarded activation, pause/resume modals, stage timeline), `/enquiries` (SCR-04 pipeline), `/enquiries/new` (intake form), `/enquiries/:id` (detail, feasibility study form, convert/close modals).
  - Evidence: [docs/evidence/phase-02.md](docs/evidence/phase-02.md).
- **P03 — Private documents and media:** Commencing next.
- **P03–P14:** Pending dependency order.

## Verification Commands

- Unit & integration tests: `npm test`
- Build Next.js & Worker: `npm run build && npm run build:worker`
- Local `workerd` preview: `npm run preview`
- Handoff link & requirement integrity: `node scripts/check-handoff.mjs`
