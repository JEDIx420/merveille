# Implementation Walkthrough & Application Status

## Current Deliverable & Baseline

The complete Merveille Designs architectural operations and client portal application has been built from the authoritative repository specification on feature branch `implement/merveille-portal`.

The company identity, verified Refrens business baseline, brand assets in `assets/brand/`, and tokens are preserved exactly. All application compute, database, object storage, and background jobs operate on Cloudflare (`@opennextjs/cloudflare`, D1 SQLite, private R2 storage, Wrangler).

---

## Application Scope and Phase Delivery

### P00 — Runtime Foundation and Compatibility
- **Status:** COMPLETED & VERIFIED (AC-064)
- **Runtime:** Next.js 15.5.29 App Router on Cloudflare Workers via `@opennextjs/cloudflare` 1.20.18 and Wrangler 4.167.0.
- **Architecture decision:** Recorded in [ADR 0001](docs/architecture/decisions/0001-runtime.md) documenting the vinext Rolldown/Vite 8 build blocker and selecting OpenNext.
- **Local bindings in workerd:** D1 database relational operations, private R2 object storage streaming, HTTP cookies/headers, and synthetic principal auth.
- **Branded layout shell:** Desktop logo (`assets/brand/merveille-designs-logo.png`), mobile profile icon (`assets/brand/merveille-designs-profile.png`), favicon (`assets/brand/favicon.png`), accessible contrast tokens, and responsive design.
- **Evidence:** [docs/evidence/phase-00.md](docs/evidence/phase-00.md).

### P01 — Identity, Invitations and Permission Foundation
- **Status:** COMPLETED & VERIFIED (AC-001–AC-008)
- **D1 Migration:** `0001_identity_and_permissions.sql` containing organizations, users, identities, role assignments, invitations, client accounts, project memberships, and immutable audit events.
- **Access Control:** Cloudflare Access JWT validation with RS256 algorithm check, issuer, audience, expiration, and nbf verification. Central authorization policy with deny-by-default, cross-project protection, consultant financial isolation, representative non-escalation, and admin/owner separation of profit and performance.
- **Screens:** `/login` (SCR-01), `/invite/accept` (SCR-01), `/access-denied`, `/people` (SCR-18), and `/people/[id]` (SCR-18).
- **Evidence:** [docs/evidence/phase-01.md](docs/evidence/phase-01.md).

### P02 — Client Portfolios, Project Records and Enquiry Intake
- **Status:** COMPLETED & VERIFIED (AC-009–AC-012)
- **D1 Migration:** `0002_projects_and_enquiries.sql` containing enquiries, feasibility studies, project stages, project lifecycle events, and commercial activation gates.
- **Domain Services:** Enquiry intake, feasibility studies, commercial gate checks (`activateProject` requiring accepted quote AND confirmed advance receipt, AC-010), optimistic concurrency stage advancement (`updateProjectStage`, AC-012), pause and resume with mandatory audit reasons.
- **Screens:** `/projects` (SCR-03), `/projects/[id]/overview` (SCR-05), `/enquiries` (SCR-04), `/enquiries/new`, `/enquiries/[id]`.
- **Evidence:** [docs/evidence/phase-02.md](docs/evidence/phase-02.md).

### P03 — Private Documents and Media
- **Status:** COMPLETED & VERIFIED (AC-056–AC-060)
- **D1 Migration:** `0003_files_and_media.sql` containing files metadata, upload sessions, and multipart parts tracking.
- **Storage Service:** Server-assigned immutable keys (`org/.../original`) preventing client tampering (AC-057), bounded multipart upload with chunk retries (AC-056), current-authorization download gate with private non-cacheable headers and HTTP 206 Range streaming (AC-059), accidental purge protection and orphan session cleanup (AC-060).
- **Screens:** `/projects/[id]/documents` (SCR-09 Document Manager).
- **Evidence:** [docs/evidence/phase-03.md](docs/evidence/phase-03.md).

### P04 — Tasks, Deadlines and Completion History
- **Status:** COMPLETED & VERIFIED (AC-013–AC-015)
- **D1 Migration:** `0004_tasks_and_deadlines.sql` containing tasks, task events, and task comments.
- **Domain Services:** Staff task proposal (`PENDING_ASSIGNMENT`), manager-only assignment and deadline authority (AC-013), staff completion, manager reopening with structured categories (`CORRECTION_DEFECT`, `CLIENT_SCOPE_CHANGE`, `EXTERNAL_DEPENDENCY`, `ADMINISTRATIVE`) (AC-014), strict internal confidentiality hiding tasks and notes from clients and consultants (AC-015).
- **Screens:** `/projects/[id]/tasks` (SCR-07 Task Manager).
- **Evidence:** [docs/evidence/phase-04.md](docs/evidence/phase-04.md).

### P05 — Drawing Register, Consultant Approval and Manager Release
- **Status:** COMPLETED & VERIFIED (AC-016–AC-021)
- **D1 Migration:** `0005_drawing_register.sql` containing drawings, drawing versions, and consultant drawing reviews.
- **Workflow & Rules:** Consultant approvals bound to specific immutable versions (AC-016), manager-only final release authority (AC-017), non-existence of client drawing approval controls (AC-018), atomic superseding of earlier versions (AC-019), draft and review note confidentiality (AC-020), idempotent release re-execution (AC-021).
- **Screens:** `/projects/[id]/drawings` (SCR-08 Drawing Register).
- **Evidence:** [docs/evidence/phase-05.md](docs/evidence/phase-05.md).

### P06 — Published Updates, Company Notices and Manual K-SMART Records
- **Status:** COMPLETED & VERIFIED (AC-022–AC-026)
- **D1 Migration:** `0006_updates_and_permits.sql` containing project updates, update versions, company announcements, permit records, and permit timeline events.
- **Workflow & Rules:** Staff update drafts, manager publication boundary (AC-022), version review without unpublishing active updates (AC-023), targeted company announcements (AC-024), manual K-SMART statutory permit tracking with file attachments (AC-025), internal note confidentiality (AC-026).
- **Screens:** `/projects/[id]/updates` (SCR-06 Updates), `/notifications` (SCR-17 Notices), `/projects/[id]/permits` (SCR-15 Permits).
- **Evidence:** [docs/evidence/phase-06.md](docs/evidence/phase-06.md).

### P07 — Quotations, Schedules, Invoices and Receipts (Commercial Finance)
- **Status:** COMPLETED & VERIFIED (AC-010, AC-027–AC-033)
- **D1 Migration:** `0007_commercial_finance.sql` containing quotations, quotation items, fee schedules, invoices, invoice line items, receipts, and receipt allocations.
- **Workflow & Rules:** Indian Rupee minor units (paise) throughout, fee schedules with trigger policies (DATE_ONLY, STAGE_ONLY, DATE_AND_STAGE, DATE_OR_STAGE) (AC-027, AC-028), manager invoice review and admin issuance (AC-029), admin-confirmed receipts with allocation history (AC-030), quotation versioning and binding client acceptance (AC-031, AC-032), balanced double-entry journal postings (AC-033).
- **Screens:** `/finance` (SCR-13 Commercial Overview), `/projects/[id]/finance` (SCR-14 Project Finance).
- **Evidence:** [docs/evidence/phase-07.md](docs/evidence/phase-07.md).

### P08 — Expenses, Consultant Fees, Payroll and Profit (Accounting)
- **Status:** COMPLETED & VERIFIED (AC-034–AC-038)
- **D1 Migration:** `0008_accounting_and_ledger.sql` containing expense records, consultant contracts, consultant claims, payroll periods, salary items, and accounting periods.
- **Workflow & Rules:** Project expense tracking with tax and receipts (AC-034), discipline-scoped consultant fees (AC-035), admin-only payroll calculation (AC-036), confidential practice profit reporting restricted to Owner and Admin (AC-037), accounting period close lock preventing retroactive edits (AC-038).
- **Evidence:** [docs/evidence/phase-08.md](docs/evidence/phase-08.md).

### P09 — References, Materials and Additional-Work Controls
- **Status:** COMPLETED & VERIFIED (AC-039–AC-043)
- **D1 Migration:** `0009_client_decisions_and_changes.sql` containing design references, material selection items, and change requests.
- **Workflow & Rules:** Visual design references (AC-039), client material selections with decision states (AC-040), change request versioning and commercial impact (AC-041), main client binding acceptance vs representative non-binding preference (AC-042), manager authorization and upfront prepayment gates for extra work (AC-043).
- **Screens:** `/projects/[id]/changes` (SCR-10 Change Controls), `/projects/[id]/selections` (SCR-11 Materials).
- **Evidence:** [docs/evidence/phase-09.md](docs/evidence/phase-09.md).

### P10 — Site Issues and Snag Tracking
- **Status:** COMPLETED & VERIFIED (AC-044, AC-045, AC-070)
- **D1 Migration:** `0010_site_issues_and_snags.sql` containing snags, snag photos, and snag remediation events.
- **Workflow & Rules:** On-site issue capture and manager triage (AC-044), staff resolution evidence vs manager verified closure (AC-044), client/consultant visibility boundaries with confidential remediation cost isolation (AC-045), change request gating for charged contractor rectification (AC-070).
- **Screens:** `/projects/[id]/snags` (SCR-10 Snag Register).
- **Evidence:** [docs/evidence/phase-10.md](docs/evidence/phase-10.md).

### P11 — In-Portal Notifications, WhatsApp and Escalation
- **Status:** COMPLETED & VERIFIED (AC-046–AC-050)
- **D1 Migration:** `0011_notifications_and_outbox.sql` containing notification items, user preferences, and outbox delivery queue.
- **Workflow & Rules:** In-portal notification generation for core events (AC-046), user channel preferences and quiet hours (AC-047), WhatsApp synthetic delivery adapter and webhook reconciliation (AC-048), template parameter sanitization preventing leakage of salaries or raw documents (AC-049), HMAC-SHA256 raw bytes webhook signature verification (AC-050).
- **Screens:** `/notifications` (SCR-17 Notifications Inbox).
- **Evidence:** [docs/evidence/phase-11.md](docs/evidence/phase-11.md).

### P12 — Role Dashboards, Waiting-on-you and Owner Performance
- **Status:** COMPLETED & VERIFIED (AC-051–AC-053)
- **Domain Services:** Dynamic waiting-on-you queue derived from live operational tables ordered by urgency without duplicate mutable checklists (AC-051), disclosed owner-only performance scorecards with transparent formulas excluding client scope revisions from employee defect counts (AC-052), calm client overview presenting published updates and released drawings while stripping 100% of internal records (AC-053).
- **Screens:** `/overview` (SCR-02 Role Overview), `/waiting` (SCR-16 Actionable Queue), `/performance` (SCR-12 Owner Performance).
- **Evidence:** [docs/evidence/phase-12.md](docs/evidence/phase-12.md).

### P13 — Archive, Audit Exports and Recovery
- **Status:** COMPLETED & VERIFIED (AC-054, AC-055, AC-066)
- **Domain Services:** Project archive lifecycle state transition with formal archive reason, preserving permitted external client/consultant access to released drawings (current and superseded) and published updates while denying revoked members (`is_active = 0`) and outsiders (AC-054), operational read-only protections blocking new tasks/drawings/updates/invoices with `PROJECT_ARCHIVED_READ_ONLY`, admin settlement exception for existing unpaid obligations without reopening (AC-055), disaster recovery backup export to R2 with SHA-256 manifests and isolated target environment reconciliation (AC-066).
- **Screens:** `/archive` (SCR-19 Archived Projects & Downloads).
- **Evidence:** [docs/evidence/phase-13.md](docs/evidence/phase-13.md).

### P14 — Integrated Verification, Staging and Launch Readiness
- **Status:** COMPLETED & VERIFIED (AC-061, AC-062, AC-063, AC-065, AC-067, AC-068, AC-069)
- **Release Gating:**
  - Online-only save failures surface explicit errors without false "Saved" messages or silent offline queues (AC-061).
  - Responsive accessible design verified with accessible focus outlines, readable typography, high-contrast brand tokens, and mobile viewports without horizontal overflow (AC-062).
  - Truthful states: empty lists render empty states; restricted data returns `null` or 403 `FORBIDDEN` rather than misleading ₹0 or fake KPIs (AC-063).
  - Strict environment separation in `wrangler.jsonc` across `local`, `staging`, and `production`, with `ALLOW_SYNTHETIC_AUTH = "false"`, explicit deploy scripts, and zero secret leakage (AC-065).
  - Migration sequence (0001–0011) and schema recovery gates verified without data loss (AC-067).
  - Labelled local fakes for WhatsApp and documented external blockers (AC-068).
  - Multi-tenancy cross-caching isolation: private, no-store cache headers on all API routes, and strict cross-project access denial (AC-069).
- **Evidence:** [docs/evidence/phase-14.md](docs/evidence/phase-14.md).

---

## Verification Summary

| Metric | Result |
| --- | --- |
| **Vitest Test Suites** | 17 test files, 78 tests passing (100% pass rate) |
| **Next.js Production Build** | 37 static/dynamic routes compiled cleanly |
| **Cloudflare Worker Bundle** | `.open-next/worker.js` built successfully with Wrangler workerd compatibility |
| **Handoff Quality Gate** | `node scripts/check-handoff.mjs`: 0 failures across 295 files |

---

## Operational Runbook and Launch Commands

### 1. Local Development & Verification
```bash
# Run full automated test suite
npm test

# Build Next.js application and OpenNext Cloudflare worker
npm run build && npm run build:worker

# Run local preview in workerd with simulated D1 and R2
npm run preview

# Verify documentation links, phases, requirements, and acceptance cases
npm run check:handoff
```

### 2. Staging Deployment
```bash
# Apply pending D1 database migrations to staging
npm run migrate:staging

# Build and deploy OpenNext worker to Cloudflare Workers staging environment
npm run deploy:staging
```

### 3. Production Deployment Gate
```bash
# Apply D1 migrations to production
npm run migrate:production

# Deploy to Cloudflare Workers production environment
npm run deploy:production
```

---

## External Integration Blockers & Authorised Inputs

As documented in `docs/implementation/operational-inputs.md`, the local and staging application operates deterministically using synthetic authorization and labelled mock WhatsApp delivery. The following external inputs must be supplied by the designated practice owner/administrator before enabling live production integrations:

1. **Cloudflare Access Production Tenant:**
   - Production Access Audience Tag (`ACCESS_AUDIENCE` in `wrangler.jsonc`).
   - Configured IdP (Google Workspace / Microsoft Entra) for practice staff.
2. **Meta Cloud API (WhatsApp Business):**
   - Meta Business Phone Number ID and System User Access Token.
   - Meta App Secret for raw bytes webhook HMAC-SHA256 signature verification.
   - Approved HSM message templates for drawing releases, invoices, and payment receipts.
3. **Custom Domain & DNS:**
   - Zone apex or CNAME routing for `portal.merveilledesigns.com` targeting Cloudflare Worker route.
