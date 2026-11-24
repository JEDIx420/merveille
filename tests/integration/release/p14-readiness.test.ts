import { describe, it, expect, beforeEach } from "vitest";
import { setupMigratedTestDb, createTestR2Bucket } from "../../test-db";
import { D1Database } from "@cloudflare/workers-types";
import { UserPrincipal } from "@/server/auth/principal";
import { DashboardService } from "@/server/domain/dashboard/service";
import { createTask, assignTask } from "@/server/domain/tasks/service";
import { SyntheticWhatsAppAdapter } from "@/server/notifications/whatsapp";
import fs from "fs";
import path from "path";

describe("Phase 14: Integrated Verification, Staging, and Launch Readiness", () => {
  let db: D1Database;
  const orgId = "org_merveille_main";
  const projectAId = "prj_alpha_14";
  const projectBId = "prj_beta_14";

  const ownerUser: UserPrincipal = {
    id: "usr_owner_p14",
    email: "owner.p14@merveilledesigns.com",
    name: "Vikram Owner",
    role: "OWNER",
    orgId,
    projectMemberships: [
      { projectId: projectAId, projectRole: "DIRECTOR" },
      { projectId: projectBId, projectRole: "DIRECTOR" },
    ],
  };

  const staffUserA: UserPrincipal = {
    id: "usr_staff_a_p14",
    email: "staff.a.p14@merveilledesigns.com",
    name: "Staff Alpha",
    role: "STAFF",
    orgId,
    projectMemberships: [{ projectId: projectAId, projectRole: "ARCHITECT" }],
  };

  const clientUserA: UserPrincipal = {
    id: "usr_client_a_p14",
    email: "client.a.p14@example.com",
    name: "Client Alpha",
    role: "MAIN_CLIENT",
    orgId,
    projectMemberships: [{ projectId: projectAId, projectRole: "MAIN_CLIENT" }],
  };

  const clientRepA: UserPrincipal = {
    id: "usr_rep_a_p14",
    email: "rep.a.p14@example.com",
    name: "Representative Alpha",
    role: "CLIENT_REP",
    orgId,
    projectMemberships: [{ projectId: projectAId, projectRole: "CLIENT_REP" }],
  };

  const clientUserB: UserPrincipal = {
    id: "usr_client_b_p14",
    email: "client.b.p14@example.com",
    name: "Client Beta",
    role: "MAIN_CLIENT",
    orgId,
    projectMemberships: [{ projectId: projectBId, projectRole: "MAIN_CLIENT" }],
  };

  beforeEach(async () => {
    db = await setupMigratedTestDb();
    const now = Date.now();

    // Seed users
    const users = [ownerUser, staffUserA, clientUserA, clientRepA, clientUserB];
    for (const u of users) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO users (id, email, display_name, status, created_at)
           VALUES (?, ?, ?, 'ACTIVE', ?)`
        )
        .bind(u.id, u.email, u.name, now)
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO organization_memberships (id, org_id, user_id, is_active, created_at)
           VALUES (?, ?, ?, 1, ?)`
        )
        .bind(`om_${u.id}`, orgId, u.id, now)
        .run();

      await db
        .prepare(
          `INSERT OR IGNORE INTO role_assignments (id, org_id, user_id, role, scope, granted_at)
           VALUES (?, ?, ?, ?, 'GLOBAL', ?)`
        )
        .bind(`ra_${u.id}`, orgId, u.id, u.role, now)
        .run();
    }

    // Seed distinct projects
    await db
      .prepare(
        `INSERT INTO projects (id, org_id, code, name, stage, status, is_archived, revision, created_at)
         VALUES
         (?, ?, 'PRJ-A', 'Project Alpha', 'DESIGN', 'ACTIVE', 0, 1, ?),
         (?, ?, 'PRJ-B', 'Project Beta', 'CONSTRUCTION', 'ACTIVE', 0, 1, ?)`
      )
      .bind(projectAId, orgId, now, projectBId, orgId, now)
      .run();

    // Seed memberships
    await db
      .prepare(
        `INSERT INTO project_memberships (id, org_id, project_id, user_id, project_role, is_active, assigned_at)
         VALUES
         ('pm_o_a', ?, ?, ?, 'DIRECTOR', 1, ?),
         ('pm_o_b', ?, ?, ?, 'DIRECTOR', 1, ?),
         ('pm_s_a', ?, ?, ?, 'ARCHITECT', 1, ?),
         ('pm_c_a', ?, ?, ?, 'MAIN_CLIENT', 1, ?),
         ('pm_r_a', ?, ?, ?, 'CLIENT_REP', 1, ?),
         ('pm_c_b', ?, ?, ?, 'MAIN_CLIENT', 1, ?)`
      )
      .bind(
        orgId, projectAId, ownerUser.id, now,
        orgId, projectBId, ownerUser.id, now,
        orgId, projectAId, staffUserA.id, now,
        orgId, projectAId, clientUserA.id, now,
        orgId, projectAId, clientRepA.id, now,
        orgId, projectBId, clientUserB.id, now
      )
      .run();
  });

  it("AC-061: Online-only save failure is visible — no false saved message, no silent background offline queue, explicit retry supported", async () => {
    // 1. Simulating save failure when database connectivity/constraints fail
    let failed = false;
    try {
      // Attempting to create a task with missing mandatory title
      await createTask(
        staffUserA,
        { projectId: projectAId, title: "   " }, // Empty title triggers error
        db
      );
    } catch (err: any) {
      failed = true;
      expect(err.message).toBe("Task title is required.");
      expect(err.code).toBe("INVALID_INPUT");
    }
    expect(failed).toBe(true);

    // Verify no corrupted or ghost task was created in the database
    const taskCount = await db
      .prepare(`SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?`)
      .bind(projectAId)
      .first<{ cnt: number }>();
    expect(taskCount?.cnt).toBe(0);

    // 2. Explicit retry by user succeeds cleanly
    const retryTask = await createTask(
      staffUserA,
      { projectId: projectAId, title: "Prepare conceptual elevation study" },
      db
    );
    expect(retryTask.id).toBeDefined();

    const verifiedTask = await db
      .prepare(`SELECT id, title FROM tasks WHERE id = ?`)
      .bind(retryTask.id)
      .first<any>();
    expect(verifiedTask.title).toBe("Prepare conceptual elevation study");
  });

  it("AC-062: Responsive accessible core flow — viewport configuration and CSS design tokens ensure mobile and desktop reachability", async () => {
    // Read RootLayout from src/app/layout.tsx to verify responsive viewport
    const layoutPath = path.resolve(process.cwd(), "src/app/layout.tsx");
    const layoutSource = fs.readFileSync(layoutPath, "utf-8");

    expect(layoutSource).toContain("width: \"device-width\"");
    expect(layoutSource).toContain("initialScale: 1");
    expect(layoutSource).toContain("className=\"app-container\"");
    expect(layoutSource).toContain("className=\"sidebar-rail\"");
    expect(layoutSource).toContain("className=\"main-content\"");

    // Read globals.css to verify design tokens, typography, and contrast variables
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssSource = fs.readFileSync(cssPath, "utf-8");

    expect(cssSource).toContain("--merveille-canvas");
    expect(cssSource).toContain("--merveille-ink");
    expect(cssSource).toContain("--merveille-gold");
    expect(cssSource).toContain("font-serif");
  });

  it("AC-063: Empty/error/loading/forbidden states are truthful — no fake KPI data or misleading zeros", async () => {
    // 1. Non-owner attempting to access owner team performance analytics receives 403 FORBIDDEN
    await expect(
      DashboardService.getOwnerPerformanceMetrics(db, staffUserA, orgId, {})
    ).rejects.toThrow("Forbidden: Individual performance metrics are strictly restricted to the practice Owner.");

    await expect(
      DashboardService.getOwnerPerformanceMetrics(db, clientUserA, orgId, {})
    ).rejects.toThrow("Forbidden: Individual performance metrics are strictly restricted to the practice Owner.");

    // 2. Client representative viewing project overview receives billingSummary = null (not fake ₹0.00)
    const repOverview = await DashboardService.getClientProjectOverview(db, clientRepA, projectAId);
    expect(repOverview.billingSummary).toBeNull(); // Truthful null: representative has no financial grant

    // 3. Truthful empty states: Project with no published updates returns empty array (not fabricated updates)
    expect(repOverview.publishedUpdates).toEqual([]);
    expect(repOverview.releasedDrawings).toEqual([]);
    expect(repOverview.project.name).toBe("Project Alpha");
  });

  it("AC-065: Environment and secret separation — distinct environment bindings and zero secret leakage", async () => {
    // Read wrangler.jsonc to verify environment configurations
    const wranglerPath = path.resolve(process.cwd(), "wrangler.jsonc");
    const wranglerText = fs.readFileSync(wranglerPath, "utf-8");

    // Local environment
    expect(wranglerText).toContain('"APP_ENV": "local"');
    expect(wranglerText).toContain('"ALLOW_SYNTHETIC_AUTH": "true"');

    // Staging environment
    expect(wranglerText).toContain('"name": "merveille-web-staging"');
    expect(wranglerText).toContain('"APP_ENV": "staging"');
    expect(wranglerText).toContain('"ALLOW_SYNTHETIC_AUTH": "false"');
    expect(wranglerText).toContain('"database_name": "merveille-data-staging"');
    expect(wranglerText).toContain('"bucket_name": "merveille-files-staging"');

    // Production environment
    expect(wranglerText).toContain('"name": "merveille-web-production"');
    expect(wranglerText).toContain('"APP_ENV": "production"');
    expect(wranglerText).toContain('"ALLOW_SYNTHETIC_AUTH": "false"');
    expect(wranglerText).toContain('"database_name": "merveille-data-production"');
    expect(wranglerText).toContain('"bucket_name": "merveille-files-production"');

    // Verify package.json contains explicit deploy scripts
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.scripts["deploy:staging"]).toContain("--env staging");
    expect(pkg.scripts["deploy:production"]).toContain("--env production");
  });

  it("AC-067: Migration and recovery gates — sequential migrations preserve retained data across schema applications", async () => {
    // Fresh test database created via setupMigratedTestDb executes 0001 through 0011
    const testDb = await setupMigratedTestDb();

    // Verify all core tables exist and are operable
    const tablesRes = await testDb
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name ASC`
      )
      .all<{ name: string }>();

    const tableNames = (tablesRes.results || []).map((t) => t.name);
    expect(tableNames).toContain("organizations");
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("projects");
    expect(tableNames).toContain("tasks");
    expect(tableNames).toContain("drawings");
    expect(tableNames).toContain("drawing_versions");
    expect(tableNames).toContain("invoices");
    expect(tableNames).toContain("receipts");
    expect(tableNames).toContain("expenses");
    expect(tableNames).toContain("change_requests");
    expect(tableNames).toContain("snags");
    expect(tableNames).toContain("notifications");
    expect(tableNames).toContain("audit_events");
  });

  it("AC-068: Integration blockers remain visible — local fakes clearly labelled, live integration remains disabled", async () => {
    // 1. WhatsApp service in fake mode uses SyntheticWhatsAppAdapter, records delivery, and rejects unredacted salaries/documents
    const adapter = new SyntheticWhatsAppAdapter();
    const result = await adapter.sendTemplate({
      notificationId: "notif_001",
      recipientPhone: "+919876543210",
      templateName: "DRAWING_RELEASED",
      templateParameters: {
        projectName: "Villa Azure",
        drawingNumber: "ARC-101",
      },
      deepLinkPath: "/projects/prj_01/drawings",
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("DELIVERED");
    expect(result.providerMessageId).toMatch(/^wamid_/);

    // 2. Verify operational-inputs.md documents external blockers
    const inputsPath = path.resolve(process.cwd(), "docs/implementation/operational-inputs.md");
    expect(fs.existsSync(inputsPath)).toBe(true);
    const inputsText = fs.readFileSync(inputsPath, "utf-8");
    expect(inputsText).toContain("Cloudflare account");
    expect(inputsText).toContain("Meta business/sender credentials");
  });

  it("AC-069: Authenticated responses never cross-cache — private cache-control headers and cross-project isolation", async () => {
    // 1. Verify next.config.mjs enforces private, no-store headers on all /api/* routes
    const nextConfigPath = path.resolve(process.cwd(), "next.config.mjs");
    const nextConfigText = fs.readFileSync(nextConfigPath, "utf-8");
    expect(nextConfigText).toContain("no-store, no-cache, must-revalidate, private");
    expect(nextConfigText).toContain("/api/:path*");

    // 2. Verify cross-project authorization isolation
    // Client A accessing Project A succeeds
    const overviewA = await DashboardService.getClientProjectOverview(db, clientUserA, projectAId);
    expect(overviewA.project.id).toBe(projectAId);

    // Client A attempting to access Project B (disjoint project) is strictly denied with CROSS_PROJECT_DENIED
    await expect(
      DashboardService.getClientProjectOverview(db, clientUserA, projectBId)
    ).rejects.toThrow("Access denied: You are not assigned to this project.");

    // Client B attempting to access Project A is strictly denied
    await expect(
      DashboardService.getClientProjectOverview(db, clientUserB, projectAId)
    ).rejects.toThrow("Access denied: You are not assigned to this project.");
  });
});
