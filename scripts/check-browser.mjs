import { chromium } from "playwright";
import fs from "node:fs";
const out = new URL("../docs/evidence/remediation/ui", import.meta.url)
  .pathname;
const base = process.env.BASE_URL || "http://localhost:3021";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const actions = [];
const project = {
  id: "prj_review",
  name: "Courtyard House",
  code: "MD-026",
  stage: "DESIGN_DEVELOPMENT",
  status: "ACTIVE",
  revision: 1,
  is_archived: 0,
  site_location: "Fictional site",
  quote_accepted_at: 1,
  advance_confirmed_at: 1,
};
const principal = {
  id: "review_manager",
  name: "Review manager",
  email: "review@example.invalid",
  roles: [],
  role: "MANAGER",
  orgId: "org_review",
  projectMemberships: [
    {
      projectId: project.id,
      projectRole: "MANAGER",
      roles: ["MANAGER"],
      financeAccess: true,
      financeAuthor: true,
      invoiceIssue: true,
    },
  ],
};
const waiting = [
  {
    id: "one",
    entityType: "TASK",
    entityId: "task_review",
    projectId: project.id,
    projectName: project.name,
    title: "Coordinate structural set",
    description: "Confirm the revised lintel details.",
    requiredAction: "Open task",
    isOverdue: true,
    dueDate: "2026-11-23",
    link: "/projects/prj_review/tasks",
    urgency: "HIGH",
  },
  {
    id: "two",
    entityType: "DRAWING_RELEASE",
    entityId: "drawing_review",
    projectId: project.id,
    projectName: project.name,
    title: "Ground floor plan · revision C",
    description: "Consultant review complete.",
    requiredAction: "Release drawing",
    isOverdue: false,
    dueDate: null,
    link: "/projects/prj_review/drawings",
    urgency: "NORMAL",
  },
  {
    id: "three",
    entityType: "TASK",
    entityId: "task_future",
    projectId: project.id,
    projectName: project.name,
    title: "Review finish samples",
    description: "Site visit preparation.",
    requiredAction: "Open task",
    isOverdue: false,
    dueDate: "2026-11-28",
    link: "/projects/prj_review/tasks",
    urgency: "NORMAL",
  },
];
let mode = "manager",
  fail = false,
  interrupt = false,
  failSettlementOnce = false;
const page = await browser.newPage();
async function visit(url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  } catch (e) {
    if (!String(e.message).includes("ERR_ABORTED")) throw e;
    await page.waitForTimeout(250);
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  await page.waitForFunction(
    () =>
      document.querySelector("#main-content") || document.querySelector("h1"),
    {},
    { timeout: 10000 },
  );
  await page.evaluate(() => document.fonts.ready);
}
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  if (route.request().method() === "POST") {
    const payload = route.request().postDataJSON();
    actions.push({ path: url.pathname, payload });
    if (payload.action === "REPORT" && failSettlementOnce) {
      failSettlementOnce = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "The payment could not be recorded. Try again.",
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        invitationUrl:
          "/invite/accept#token=browser-test-only-not-a-real-token",
      }),
    });
  }
  if (interrupt && url.pathname.endsWith("/tasks"))
    return route.abort("internetdisconnected");
  if (fail && url.pathname === "/api/dashboard/overview")
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "The workspace is temporarily unavailable. Try again.",
      }),
    });
  let d = {
    ok: true,
    projects: [project],
    people: [
      {
        id: "review_manager",
        name: "Fictional team member",
        email: "person@example.invalid",
        status: "ACTIVE",
        roles: [],
        projects: [
          {
            project_id: project.id,
            project_role: "MANAGER",
            finance_access: 1,
            finance_author: 1,
            invoice_issue: 1,
          },
        ],
        createdAt: 1795521600000,
        accessHistory: [
          {
            id: "audit_fixture",
            action: "GRANTS_UPDATED",
            actor_name: "Fictional administrator",
            reason: "Assigned to the fictional review project",
            created_at: 1795521600000,
            new_state: JSON.stringify({
              roles: [],
              projects: [
                {
                  projectId: project.id,
                  roles: ["MANAGER"],
                  financeAccess: true,
                },
              ],
            }),
          },
        ],
      },
    ],
    invitations: [],
    items: [],
    files: [],
    drawings: [],
    tasks: [],
    snags: [],
    changes: [],
    updates: [],
    milestones: [],
    quotations: [],
    schedules: [],
    invoices: [],
    receipts: [],
    references: [],
    selections: [],
    announcements: [],
    notifications: [],
    expenses: [],
    consultantBills: [],
    payroll: [],
    periods: [],
    participants: [],
    deliveryMode: "unavailable",
    preferences: { whatsapp_enabled: 0 },
  };
  if (url.pathname === "/api/session" && mode === "signed-out")
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Sign in required" }),
    });
  if (url.pathname === "/api/session")
    d = {
      principal: ["admin", "archive-admin"].includes(mode)
        ? {
            ...principal,
            roles: ["ADMIN"],
            role: "ADMIN",
            name: "Review administrator",
            authenticatedAt: Date.now(),
          }
        : mode === "client"
          ? {
              ...principal,
              role: "MAIN_CLIENT",
              name: "Review client",
              projectMemberships: [
                {
                  projectId: project.id,
                  projectRole: "MAIN_CLIENT",
                  roles: ["MAIN_CLIENT"],
                  contractualAuthority: true,
                },
              ],
            }
          : principal,
    };
  if (url.pathname === "/api/dashboard/overview")
    d = {
      principal,
      waitingItems: waiting,
      activeProjects: [project],
      firmFinance: null,
    };
  if (url.pathname === "/api/dashboard/waiting") d = { items: waiting };
  if (url.pathname === "/api/projects/prj_review")
    d = {
      project:
        mode === "archive-admin"
          ? { ...project, is_archived: 1, status: "ARCHIVED" }
          : project,
      stages: [],
      members: [],
      events: [],
    };
  if (mode === "archive-admin" && url.pathname.endsWith("/finance/invoices"))
    d = {
      invoices: [
        {
          id: "invoice_existing",
          invoice_number: "MD-TEST-01",
          status: "ISSUED",
          outstanding_minor: 250000,
          allocated_minor: 0,
          total_minor: 250000,
          current_version_number: 1,
          versions: [],
        },
      ],
    };
  if (url.pathname.endsWith("/client-overview"))
    d = {
      project: {
        ...project,
        currentStageName: "Design development",
        nextMilestone: {
          name: "Finish sample review",
          targetDate: "2026-11-28",
        },
      },
      publishedUpdates: [
        {
          id: "update_review",
          title: "The next level of detail",
          body: "The structural layout is coordinated. We are refining the courtyard openings and reviewing finish samples before the next site meeting.",
          publishedAt: 1795521600000,
        },
      ],
      releasedDrawings: [
        {
          id: "drawing_review",
          drawingNumber: "A-101",
          title: "Ground floor plan",
          versionNumber: "C",
          fileId: "file_review",
          releasedAt: 1795521600000,
        },
      ],
      billingSummary: {
        totalInvoicedMinor: 25000000,
        totalPaidMinor: 15000000,
        outstandingBalanceMinor: 10000000,
        nextDueInvoice: {
          invoiceNumber: "MD-2026-026",
          balanceMinor: 10000000,
          dueDate: "2026-12-01",
        },
      },
      pendingDecisions: {
        quotations: [],
        changeRequests: [],
        materialSelections: [],
      },
    };
  if (url.pathname.endsWith("/drawings"))
    d = {
      drawings: [
        {
          id: "drawing_review",
          drawing_number: "A-101",
          title: "Ground floor plan",
          discipline: "ARCHITECTURAL",
          current_version_label: "B",
          current_released_version_id: "version_old",
          released_at: 1795521600000,
          is_withdrawn: 0,
        },
      ],
    };
  if (url.pathname === "/api/drawings/drawing_review")
    d = {
      drawing: {
        id: "drawing_review",
        drawing_number: "A-101",
        title: "Ground floor plan",
        current_released_version_id: "version_old",
      },
      versions: [
        {
          id: "version_review",
          version_label: "C",
          status: "CONSULTANT_APPROVED",
          file_id: "file_review",
          file_name: "Ground-floor-plan.svg",
          mime_type: "image/svg+xml",
          created_at: 1795521600000,
          author_name: "Design team",
          submission_note:
            "Courtyard openings coordinated with the structural set.",
          reviews: [
            {
              id: "review_1",
              consultant_name: "Structural reviewer",
              consultant_user_id: "review_consultant",
              status: "APPROVED",
              decision_reason: "Coordinated lintel and column positions.",
            },
          ],
        },
      ],
    };
  if (url.pathname.startsWith("/api/files/"))
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="760" height="620" viewBox="0 0 760 620"><rect width="760" height="620" fill="#fff"/><g stroke="#344054" fill="none" stroke-width="3"><path d="M80 80h600v460H80z M80 230h230v310 M450 80v320h230 M310 400h370 M310 230h140 M310 80v100 M80 400h230"/><rect x="335" y="255" width="90" height="115" stroke-width="1" stroke-dasharray="4 4"/></g><g fill="#667085" font-size="13" font-family="sans-serif"><text x="155" y="160">LIVING</text><text x="500" y="240">BEDROOM</text><text x="340" y="310">COURTYARD</text><text x="140" y="485">KITCHEN</text><text x="480" y="485">DINING</text><text x="80" y="585">A-101 · Ground floor plan · Review fixture</text></g></svg>',
    });
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(d),
  });
});
const results = [];
for (const size of process.env.BROWSER_SCOPE === "actions"
  ? []
  : [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
  await page.setViewportSize(size);
  for (const path of [
    "/overview",
    "/projects",
    "/waiting",
    "/archive",
    "/enquiries",
    "/enquiries/new",
    "/enquiries/prj_review",
    "/finance",
    "/performance",
    "/notifications",
    "/people",
    "/people/review_manager",
    "/projects/prj_review/overview",
    "/projects/prj_review/tasks",
    "/projects/prj_review/drawings",
    "/projects/prj_review/documents",
    "/projects/prj_review/updates",
    "/projects/prj_review/permits",
    "/projects/prj_review/finance",
    "/projects/prj_review/selections",
    "/projects/prj_review/changes",
    "/projects/prj_review/snags",
    "/reviews",
    "/settings/notifications",
    "/projects/prj_review/materials",
    "/",
    "/access-denied",
    "/missing-route",
  ].filter(
    (path) =>
      !process.env.BROWSER_ROUTES ||
      process.env.BROWSER_ROUTES.split(",").includes(path),
  )) {
    await visit(base + path);
    await page.waitForTimeout(100);
    console.log(size.width, path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    const heading = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => null);
    results.push({
      path,
      width: size.width,
      overflow,
      heading,
      fontLoaded: await page.evaluate(() =>
        document.fonts.check("400 15px Inter"),
      ),
      controlsReadable: await page.evaluate(() =>
        Array.from(document.querySelectorAll("input,select,textarea"))
          .filter((el) => el.getClientRects().length)
          .every((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
      ),
    });
    if (path === "/overview")
      await page.screenshot({
        path: `${out}/overview-${size.width}.png`,
        fullPage: true,
      });
    if (path.endsWith("/drawings")) {
      await page.getByRole("button", { name: "Open drawing" }).click();
      await page.waitForTimeout(100);
      await page
        .locator("[class*=tableWrap]")
        .evaluateAll((nodes) => nodes.forEach((n) => (n.scrollLeft = 0)));
      await page.screenshot({
        path: `${out}/drawing-review-${size.width}.png`,
        fullPage: true,
      });
    }
  }
  mode = "client";
  await visit(base + "/projects/prj_review/overview");
  await page.waitForTimeout(100);
  await page.screenshot({
    path: `${out}/client-home-${size.width}.png`,
    fullPage: true,
  });
  mode = "signed-out";
  for (const authPath of ["/login", "/invite/accept", "/login?setup=pending"]) {
    await visit(base + authPath);
    await page.waitForTimeout(100);
    results.push({
      path: authPath,
      width: size.width,
      overflow: await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      heading: await page.locator("h1").first().textContent(),
    });
    if (authPath.includes("setup=pending")) {
      await page
        .getByRole("heading", {
          name: "Sign-in is being prepared",
          exact: true,
        })
        .waitFor();
      results.push({
        case: "setup pending has no sign-in loop",
        width: size.width,
        visible:
          (await page
            .getByRole("link", { name: "Continue with Google", exact: true })
            .count()) === 0,
      });
    }
    await page.screenshot({
      path: `${out}/${authPath === "/login" ? "login" : authPath.includes("setup=") ? "setup-pending" : "invitation"}-${size.width}.png`,
      fullPage: true,
    });
  }
  mode = "manager";
}
await page.setViewportSize({ width: 1440, height: 900 });
mode = "admin";
await visit(base + "/people/review_manager");
await page
  .getByRole("heading", { name: "Access history", exact: true })
  .waitFor();
await page
  .getByText("Assigned to the fictional review project", { exact: true })
  .waitFor();
results.push({
  case: "administrator access history",
  visible: await page
    .getByText("Assigned to the fictional review project", { exact: true })
    .isVisible(),
});
await page.screenshot({
  path: out + "/access-history-desktop.png",
  fullPage: true,
});
await visit(base + "/people");
await page.getByRole("button", { name: "Invite person", exact: true }).click();
await page
  .getByLabel("Full name", { exact: true })
  .fill("Fictional invited person");
await page
  .getByLabel("Exact Google email", { exact: true })
  .fill("newperson@example.invalid");
await page
  .getByLabel("Administrator — people, receipts, payroll and profit", {
    exact: true,
  })
  .check();
await page.getByLabel(/I confirm this elevated access/).check();
await page
  .getByRole("button", { name: "Create invitation", exact: true })
  .click();
await page.getByText("Invitation created", { exact: true }).waitFor();
const invitation = actions.find((a) => a.path === "/api/people");
results.push({
  case: "administrator invitation form",
  visible:
    !!invitation &&
    invitation.payload.email === "newperson@example.invalid" &&
    invitation.payload.roles.includes("ADMIN") &&
    invitation.payload.projects.length === 0 &&
    invitation.payload.confirmElevation === true,
});
mode = "archive-admin";
await visit(base + "/projects/prj_review/finance");
await page.getByRole("button", { name: /Receipts & Payments/ }).click();
await page.getByRole("button", { name: /Record settlement payment/ }).click();
await page
  .getByLabel("Existing outstanding invoice", { exact: true })
  .selectOption("invoice_existing");
await page.getByLabel("Date received", { exact: true }).fill("2026-11-24");
await page.getByLabel("Amount Paid (₹)", { exact: true }).fill("100.00");
await page
  .getByLabel("UTR / Bank Reference Note", { exact: true })
  .fill("FICTIONAL-TRANSFER-REFERENCE");
failSettlementOnce = true;
await page.getByRole("button", { name: "Submit Report", exact: true }).click();
await page
  .getByRole("dialog")
  .getByRole("alert")
  .getByText("The payment could not be recorded. Try again.", { exact: true })
  .waitFor();
results.push({
  case: "failed settlement stays visible and preserves input",
  visible:
    (await page.getByRole("dialog").getByRole("alert").isVisible()) &&
    (await page.getByLabel("Amount Paid (₹)", { exact: true }).inputValue()) ===
      "100.00",
});
await page.getByRole("button", { name: "Submit Report", exact: true }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
const settlement = actions.find((a) => a.payload.action === "REPORT");
const reportAttempts = actions.filter((a) => a.payload.action === "REPORT");
results.push({
  case: "settlement retry retains operation key",
  visible:
    reportAttempts.length === 2 &&
    reportAttempts[0].payload.idempotencyKey ===
      reportAttempts[1].payload.idempotencyKey,
});
results.push({
  case: "archived admin settlement form",
  visible:
    !!settlement &&
    settlement.payload.settlementInvoiceId === "invoice_existing" &&
    settlement.payload.amountMinor === 10000 &&
    settlement.payload.receivedDate === "2026-11-24" &&
    settlement.payload.paymentMethod === "NEFT" &&
    !!settlement.payload.idempotencyKey,
});
results.push({
  case: "archived authoring hidden",
  visible:
    (await page
      .getByRole("button", { name: "Prepare quotation", exact: true })
      .count()) === 0 &&
    (await page
      .getByRole("button", { name: "Create or revise schedule", exact: true })
      .count()) === 0,
});
mode = "manager";
await visit(base + "/projects/prj_review/drawings");
await page.getByRole("button", { name: "Open drawing", exact: true }).click();
await page
  .getByRole("button", { name: "Release to client", exact: true })
  .click();
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Confirm", exact: true })
  .click();
await page
  .getByText("Drawing revision released to the client.", { exact: true })
  .waitFor();
const release = actions.find((a) => a.payload.action === "RELEASE");
results.push({
  case: "exact drawing release form",
  visible:
    !!release &&
    release.path === "/api/drawings/versions/version_review" &&
    release.payload.expectedCurrentVersionId === "version_old",
});
await page.getByRole("button", { name: "Add drawing", exact: true }).click();
const modal = page.getByRole("dialog");
await modal.waitFor({ state: "visible" });
await page.getByLabel("Drawing number", { exact: true }).fill("A-102");
await page.keyboard.press("Tab");
results.push({
  case: "dialog keyboard focus",
  contained: await page.evaluate(
    () => !!document.activeElement?.closest("dialog"),
  ),
});
await page.keyboard.press("Escape");
await page
  .waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some(
        (button) =>
          button.textContent.trim() === "Add drawing" &&
          button === document.activeElement,
      ),
    {},
    { timeout: 2000 },
  )
  .catch(() => {});
results.push({
  case: "dialog escape",
  closed: (await modal.count()) === 0,
  focusReturned: await page
    .getByRole("button", { name: "Add drawing", exact: true })
    .evaluate((e) => e === document.activeElement),
});
await page.setViewportSize({ width: 390, height: 844 });
await page
  .getByRole("button", { name: "Open navigation", exact: true })
  .click();
await page.keyboard.press("Escape");
results.push({
  case: "mobile drawer escape",
  collapsed:
    (await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .getAttribute("aria-expanded")) === "false",
});
fail = true;
await visit(base + "/overview");
await page
  .getByRole("alert")
  .filter({ hasText: "Something needs attention" })
  .waitFor({ state: "visible" });
results.push({
  case: "failed overview",
  visible: await page
    .getByRole("alert")
    .filter({ hasText: "Something needs attention" })
    .isVisible(),
  falseZero: await page.getByText("₹0.00", { exact: true }).count(),
});
await page.screenshot({
  path: `${out}/overview-error-mobile.png`,
  fullPage: true,
});
fail = false;
interrupt = true;
await visit(base + "/projects/prj_review/tasks");
await page.getByText(/Failed to fetch/).waitFor({ state: "visible" });
results.push({
  case: "interrupted tasks",
  visible: (await page.getByText(/Failed to fetch/).count()) > 0,
});
fs.writeFileSync(
  out + "/browser-results.json",
  JSON.stringify(
    {
      environment:
        base +
        "; isolated browser-only API fixtures; no authentication bypass in app",
      results,
      errors,
      actions,
    },
    null,
    2,
  ),
);
await browser.close();
if (
  results.some(
    (r) =>
      r.overflow ||
      r.fontLoaded === false ||
      r.controlsReadable === false ||
      r.contained === false ||
      r.closed === false ||
      r.focusReturned === false ||
      r.collapsed === false ||
      r.visible === false ||
      r.falseZero > 0,
  ) ||
  errors.length
)
  process.exitCode = 1;
console.log(
  JSON.stringify({
    routes: results.length,
    overflow: results.filter((r) => r.overflow),
    errors,
  }),
);
