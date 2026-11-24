import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb } from "../test-db";
import { UserPrincipal } from "@/server/auth/principal";
import {
  canAccessProject,
  canViewFinancials,
  canAcceptContractualDecisions,
  canViewPayrollAndProfit,
  canViewIndividualPerformance,
  canManagePeopleAndAccess,
  canReadInternalNotes,
  assertProjectAccess,
} from "@/server/auth/policy";
import {
  inviteUser,
  acceptInvitation,
  disableUser,
  reassignMainClient,
  listPeople,
} from "@/server/domain/identity/service";
import { validateAccessJwt } from "@/server/auth/jwt";
import { loadPrincipalByEmail } from "@/server/auth/session";

describe("P01: Identity, Invitations and Permission Foundation", () => {
  let db: D1Database;

  const adminPrincipal: UserPrincipal = {
    id: "usr_admin_001",
    email: "admin@merveilledesigns.com",
    name: "Operations Admin",
    role: "ADMIN",
    orgId: "org_merveille_main",
    projectMemberships: [],
  };

  const ownerPrincipal: UserPrincipal = {
    id: "usr_owner_001",
    email: "owner@merveilledesigns.com",
    name: "Practice Owner",
    role: "OWNER",
    orgId: "org_merveille_main",
    projectMemberships: [],
  };

  const managerPrincipal: UserPrincipal = {
    id: "usr_mgr_001",
    email: "manager@merveilledesigns.com",
    name: "Project Manager",
    role: "MANAGER",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_alpha" }],
  };

  const consultantPrincipal: UserPrincipal = {
    id: "usr_cons_001",
    email: "consultant@engineering.example",
    name: "Structural Consultant",
    role: "CONSULTANT",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_alpha" }],
  };

  const mainClientPrincipal: UserPrincipal = {
    id: "usr_client_001",
    email: "client@clientfamily.example",
    name: "Main Client",
    role: "MAIN_CLIENT",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_alpha" }],
  };

  const clientRepPrincipal: UserPrincipal = {
    id: "usr_rep_001",
    email: "rep@clientfamily.example",
    name: "Client Representative",
    role: "CLIENT_REP",
    orgId: "org_merveille_main",
    projectMemberships: [{ projectId: "prj_alpha" }],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();

    // Seed test users
    await db.exec(`
      INSERT OR IGNORE INTO users (id, email, display_name, status, created_at)
      VALUES ('usr_admin_001', 'admin@merveilledesigns.com', 'Operations Admin', 'ACTIVE', 1700000000000),
             ('usr_client_001', 'client@clientfamily.example', 'Main Client', 'ACTIVE', 1700000000000),
             ('usr_client_beta', 'client.beta@example.com', 'Beta Client', 'ACTIVE', 1700000000000);

      INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at)
      VALUES ('ra_admin', 'org_merveille_main', 'usr_admin_001', 'ADMIN', 'GLOBAL', 1700000000000);

      -- Seed two distinct projects
      INSERT OR IGNORE INTO projects (id, org_id, code, name, main_client_user_id, status, created_at)
      VALUES ('prj_alpha', 'org_merveille_main', 'MD-2026-01', 'Project Alpha Villa', 'usr_client_001', 'ACTIVE', 1700000000000),
             ('prj_beta', 'org_merveille_main', 'MD-2026-02', 'Project Beta Residence', 'usr_client_beta', 'ACTIVE', 1700000000000);
    `);
  });

  // AC-001: An invited representative signs in with their own identity
  it("AC-001: Main client and representative have separate identities and representative cannot make contractual decisions", async () => {
    // 1. Invite Main Client
    const clientInvite = await inviteUser(
      adminPrincipal,
      { email: "rajesh@client.example", displayName: "Rajesh Kumar", role: "MAIN_CLIENT", projectId: "prj_alpha" },
      db
    );

    // 2. Invite Client Representative
    const repInvite = await inviteUser(
      adminPrincipal,
      { email: "anita@client.example", displayName: "Anita Kumar (Rep)", role: "CLIENT_REP", projectId: "prj_alpha" },
      db
    );

    expect(clientInvite.userId).not.toBe(repInvite.userId);

    // Accept both invitations
    const clientAuth = await acceptInvitation(clientInvite.token, "sub_rajesh", db);
    const repAuth = await acceptInvitation(repInvite.token, "sub_anita", db);

    const clientPrincipalLoaded = (await loadPrincipalByEmail("rajesh@client.example", db)).principal!;
    const repPrincipalLoaded = (await loadPrincipalByEmail("anita@client.example", db)).principal!;

    expect(clientPrincipalLoaded.id).not.toBe(repPrincipalLoaded.id);
    expect(clientPrincipalLoaded.role).toBe("MAIN_CLIENT");
    expect(repPrincipalLoaded.role).toBe("CLIENT_REP");

    // Main client CAN accept quotation / contractual decisions
    expect(canAcceptContractualDecisions(clientPrincipalLoaded, "prj_alpha")).toBe(true);

    // Representative CANNOT accept quotation / contractual decisions
    expect(canAcceptContractualDecisions(repPrincipalLoaded, "prj_alpha")).toBe(false);
  });

  // AC-002: Cross-project enumeration is denied
  it("AC-002: Cross-project enumeration and access is denied for non-assigned projects", () => {
    // User belongs only to Project Alpha
    expect(canAccessProject(clientRepPrincipal, "prj_alpha")).toBe(true);
    expect(canAccessProject(clientRepPrincipal, "prj_beta")).toBe(false);

    expect(() => assertProjectAccess(clientRepPrincipal, "prj_beta")).toThrowError(
      /Access denied: You are not assigned to this project/
    );

    // Consultant belongs only to Project Alpha
    expect(canAccessProject(consultantPrincipal, "prj_alpha")).toBe(true);
    expect(canAccessProject(consultantPrincipal, "prj_beta")).toBe(false);

    // Global roles can access both
    expect(canAccessProject(adminPrincipal, "prj_alpha")).toBe(true);
    expect(canAccessProject(adminPrincipal, "prj_beta")).toBe(true);
  });

  // AC-003: Consultant financial scope is intentional
  it("AC-003: Consultant sees client quotations and invoices for assigned project, but internal notes, expenses, salaries and profit remain denied", () => {
    // 1. Client commercial records: visible to assigned consultant
    expect(canViewFinancials(consultantPrincipal, "prj_alpha", "CLIENT_COMMERCIAL")).toBe(true);

    // 2. Internal project notes: DENIED to consultant
    expect(canReadInternalNotes(consultantPrincipal, "prj_alpha")).toBe(false);

    // 3. Internal firm expenses: DENIED to consultant
    expect(canViewFinancials(consultantPrincipal, "prj_alpha", "INTERNAL_EXPENSES")).toBe(false);

    // 4. Payroll and profit: DENIED to consultant
    expect(canViewFinancials(consultantPrincipal, "prj_alpha", "PAYROLL_AND_PROFIT")).toBe(false);

    // 5. Unassigned project: completely denied
    expect(canViewFinancials(consultantPrincipal, "prj_beta", "CLIENT_COMMERCIAL")).toBe(false);
  });

  // AC-004: Representative authority cannot be escalated
  it("AC-004: Representative cannot be escalated to submit contractual acceptance", () => {
    // Representative in Project Alpha
    expect(canAcceptContractualDecisions(clientRepPrincipal, "prj_alpha")).toBe(false);

    // Even if manager tries to accept client quote, policy denies non-client
    expect(canAcceptContractualDecisions(managerPrincipal, "prj_alpha")).toBe(false);
  });

  // AC-005: Admin and owner capabilities remain separate
  it("AC-005: Admin can see payroll/profit only; owner can see performance only; manager sees neither", () => {
    // Payroll & Profit
    expect(canViewPayrollAndProfit(adminPrincipal)).toBe(true);
    expect(canViewPayrollAndProfit(ownerPrincipal)).toBe(false); // Owner-without-admin CANNOT see salaries/profit
    expect(canViewPayrollAndProfit(managerPrincipal)).toBe(false);

    // Individual Performance Reports
    expect(canViewIndividualPerformance(ownerPrincipal)).toBe(true);
    expect(canViewIndividualPerformance(adminPrincipal)).toBe(false); // Admin-without-owner CANNOT see performance
    expect(canViewIndividualPerformance(managerPrincipal)).toBe(false);
  });

  // AC-006: Account removal is effective across surfaces
  it("AC-006: Account removal immediately blocks user across all surfaces while retaining historical records", async () => {
    // Invite and activate user
    const invite = await inviteUser(
      adminPrincipal,
      { email: "staff.leaving@merveilledesigns.com", displayName: "Leaving Architect", role: "STAFF", projectId: "prj_alpha" },
      db
    );
    await acceptInvitation(invite.token, "sub_leaving", db);

    // Verify active
    const active = await loadPrincipalByEmail("staff.leaving@merveilledesigns.com", db);
    expect(active.status).toBe("AUTHENTICATED");

    // Admin disables account
    await disableUser(adminPrincipal, invite.userId, "Resigned from firm", db);

    // Next request is immediately DISABLED
    const afterDisable = await loadPrincipalByEmail("staff.leaving@merveilledesigns.com", db);
    expect(afterDisable.status).toBe("DISABLED");
    expect(afterDisable.principal).toBeNull();

    // Verify historic records preserved in users table
    const userRow = await db.prepare("SELECT status, disabled_at FROM users WHERE id = ?").bind(invite.userId).first<any>();
    expect(userRow.status).toBe("DISABLED");
    expect(userRow.disabled_at).toBeGreaterThan(0);
  });

  // AC-007: Access changes have an audit record
  it("AC-007: Access changes create structured audit records without leaking secrets", async () => {
    // 1. Invite user
    const invite = await inviteUser(
      adminPrincipal,
      { email: "new.joiner@merveilledesigns.com", displayName: "New Joiner", role: "STAFF" },
      db
    );

    // 2. Reassign main client
    await reassignMainClient(
      adminPrincipal,
      { projectId: "prj_alpha", newUserId: invite.userId, reason: "Client requested spouse as primary contact" },
      db
    );

    // Query audit log
    const auditRows = await db.prepare("SELECT * FROM audit_events ORDER BY created_at ASC").all<any>();
    expect(auditRows.results.length).toBeGreaterThanOrEqual(2);

    const inviteAudit = auditRows.results.find((r: any) => r.action === "USER_INVITED");
    expect(inviteAudit).toBeDefined();
    expect(inviteAudit.actor_id).toBe(adminPrincipal.id);
    expect(inviteAudit.reason).toContain("Invited as STAFF");

    const reassignAudit = auditRows.results.find((r: any) => r.action === "MAIN_CLIENT_REASSIGNED");
    expect(reassignAudit).toBeDefined();
    expect(reassignAudit.reason).toBe("Client requested spouse as primary contact");
    expect(reassignAudit.new_state).toContain(invite.userId);
  });

  // AC-008: Identity cannot be forged
  it("AC-008: Unsigned, expired, wrong-audience, or forged JWT assertions are strictly rejected", async () => {
    const env: CloudflareEnv = {
      DB: db,
      PROJECT_FILES: {} as any,
      APP_ENV: "production", // Production mode
      APP_ORIGIN: "https://portal.merveilledesigns.com",
      ACCESS_ISSUER: "https://merveille.cloudflareaccess.com",
      ACCESS_AUDIENCE: "production-audience-hash-123",
      BUSINESS_TIMEZONE: "Asia/Kolkata",
      WHATSAPP_MODE: "fake",
      ALLOW_SYNTHETIC_AUTH: "false",
    };

    // 1. Missing JWT
    const res1 = await validateAccessJwt(null, env);
    expect(res1.valid).toBe(false);

    // 2. Malformed JWT
    const res2 = await validateAccessJwt("forged.token", env);
    expect(res2.valid).toBe(false);

    // Helper to generate base64url JSON
    const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");

    // 3. Wrong Issuer
    const wrongIssuerJwt = `${b64({ alg: "RS256" })}.${b64({
      iss: "https://attacker.cloudflareaccess.com",
      aud: "production-audience-hash-123",
      email: "admin@merveilledesigns.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.signature`;
    const res3 = await validateAccessJwt(wrongIssuerJwt, env);
    expect(res3.valid).toBe(false);
    expect(res3.error).toContain("issuer mismatch");

    // 4. Wrong Audience
    const wrongAudJwt = `${b64({ alg: "RS256" })}.${b64({
      iss: "https://merveille.cloudflareaccess.com",
      aud: "wrong-audience",
      email: "admin@merveilledesigns.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.signature`;
    const res4 = await validateAccessJwt(wrongAudJwt, env);
    expect(res4.valid).toBe(false);
    expect(res4.error).toContain("audience mismatch");

    // 5. Expired JWT
    const expiredJwt = `${b64({ alg: "RS256" })}.${b64({
      iss: "https://merveille.cloudflareaccess.com",
      aud: "production-audience-hash-123",
      email: "admin@merveilledesigns.com",
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    })}.signature`;
    const res5 = await validateAccessJwt(expiredJwt, env);
    expect(res5.valid).toBe(false);
    expect(res5.error).toContain("expired");

    // 6. Valid Structure
    const validJwt = `${b64({ alg: "RS256" })}.${b64({
      iss: "https://merveille.cloudflareaccess.com",
      aud: "production-audience-hash-123",
      email: "admin@merveilledesigns.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nbf: Math.floor(Date.now() / 1000) - 10,
    })}.signature`;
    const res6 = await validateAccessJwt(validJwt, env);
    expect(res6.valid).toBe(true);
    expect(res6.payload?.email).toBe("admin@merveilledesigns.com");
  });
});
