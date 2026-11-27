/** Isolated fictional browser harness. Never supplies an identity to a hosted deployment. */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.BASE_URL || "http://localhost:3021";
if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))
  throw new Error("Fixture identity harness requires localhost");
const out = "docs/next-phase/evidence/simple-ui";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const theme of ["dark", "light"]) {
    const context = await browser.newContext({ colorScheme: theme });
    await context.addInitScript(
      (theme) =>
        localStorage.setItem(
          "merveille-appearance",
          JSON.stringify({ theme, celebrations: "off" }),
        ),
      theme,
    );
    let mode = "LIST",
      favorites = [],
      conflict = false,
      task = {
        id: "simple_task",
        project_id: "simple_project",
        title: "Coordinate courtyard plan",
        description: "Coordinate openings with the structural drawing.",
        status: "TODO",
        priority: "MEDIUM",
        effective_due_date: new Date().toISOString().slice(0, 10),
        revision: 1,
        assignee_name: "Fictional designer",
      };
    let notes = [],
      checks = [],
      notifications = [
        {
          id: "notification",
          title: "Courtyard plan assigned",
          body_text: "A new task is ready for you.",
          target_url: "/projects/simple_project/tasks?taskId=simple_task",
          created_at: Date.now(),
          is_read: 0,
        },
      ];
    const p = {
      id: "simple_project",
      code: "MD-TEST",
      name: "Courtyard House",
      stage: "Design Development",
      status: "ACTIVE",
      is_archived: 0,
      manager_name: "Fictional manager",
      member_names: ["Fictional manager", "Fictional designer"],
      task_count: 2,
      completed_count: 1,
    };
    const principal = {
      id: "simple_person",
      name: "Fictional designer",
      email: "designer@example.invalid",
      orgId: "org_review",
      roles: ["ADMIN"],
      role: "MANAGER",
      intakeAccess: true,
      projectMemberships: [
        { projectId: p.id, projectRole: "MANAGER", roles: ["MANAGER"] },
      ],
    };
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", async (r) => {
      const u = new URL(r.request().url()),
        path = u.pathname,
        post = r.request().method() !== "GET";
      let b = {};
      try {
        b = r.request().postDataJSON() || {};
      } catch {}
      let d = { ok: true };
      const actions = {
        start: task.status === "TODO" || task.status === "BLOCKED",
        complete: ["TODO", "IN_PROGRESS", "BLOCKED"].includes(task.status),
        block: ["TODO", "IN_PROGRESS"].includes(task.status),
        reopen: task.status === "COMPLETED",
        assign: true,
        deadline: true,
        edit: true,
        cancel: true,
      };
      const item = {
        id: task.id,
        scope: "PROJECT",
        projectId: p.id,
        projectName: p.name,
        projectCode: p.code,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.effective_due_date,
        revision: task.revision,
        assigneeName: "Fictional designer",
        allowedActions: actions,
        link: `/projects/${p.id}/tasks?taskId=${task.id}`,
      };
      if (path === "/api/session") d = { principal };
      else if (path === "/api/preferences/appearance")
        d = { theme, celebrations: "off" };
      else if (path === "/api/celebrations") d = { events: [] };
      else if (path === "/api/projects") d = { projects: [p] };
      else if (path === `/api/projects/${p.id}`) d = { project: p, stages: [] };
      else if (path === "/api/workspace") {
        if (post) {
          mode = b.view || mode;
          favorites = b.favorites || favorites;
        }
        d = { view: mode, favorites };
      } else if (path === "/api/my-tasks") {
        d = {
          items: [item],
          teamMembers: [{ id: "colleague", name: "Fictional colleague" }],
          internalProjects: [p],
        };
      } else if (path.endsWith("/progress"))
        d = {
          total: 2,
          completed: 1,
          open: 1,
          overdue: 0,
          percent: 50,
          weeks: Array.from({ length: 8 }, (_, i) => ({
            date: `2026-10-${String(i + 1).padStart(2, "0")}`,
            count: i % 3,
          })),
          historyAvailable: true,
        };
      else if (path.endsWith("/participants"))
        d = {
          participants: [
            { id: principal.id, name: principal.name, roles: ["MANAGER"] },
          ],
        };
      else if (path.endsWith("/files")) d = { files: [] };
      else if (path.endsWith("/tasks") && path.startsWith("/api/projects/")) {
        if (post) {
          task = { ...task, id: "new_task", title: b.title, revision: 1 };
        }
        d = { tasks: [{ ...task, isOverdue: false, allowedActions: actions }] };
      } else if (path.startsWith("/api/tasks/")) {
        if (post) {
          if (conflict) {
            conflict = false;
            return r.fulfill({
              status: 409,
              contentType: "application/json",
              body: JSON.stringify({
                error: "Task changed. Reload before saving.",
              }),
            });
          }
          if (b.action === "ADD_COMMENT")
            notes.push({
              id: "note",
              author_name: "Fictional designer",
              comment_text: b.commentText,
              created_at: Date.now(),
            });
          else if (b.action === "ADD_CHECKLIST")
            checks.push({ id: "check", label: b.label, is_completed: 0 });
          else if (b.action === "TOGGLE_CHECKLIST")
            checks[0].is_completed = b.isCompleted ? 1 : 0;
          else {
            task.status =
              {
                COMPLETE: "COMPLETED",
                START: "IN_PROGRESS",
                BLOCK: "BLOCKED",
                REOPEN: "TODO",
              }[b.action] || task.status;
            task.revision++;
          }
        }
        d = {
          task,
          allowedActions: actions,
          checklists: checks,
          comments: notes,
          subtasks: [],
          events: [],
        };
      } else if (path === "/api/dashboard/waiting") d = { items: [] };
      else if (path === "/api/notifications") {
        if (post) notifications[0].is_read = 1;
        d = { notifications };
      } else if (path.includes("announcements")) d = { announcements: [] };
      else if (path.endsWith("/drawings")) d = { drawings: [] };
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify(d),
      });
    });
    async function buttonContrast(selector = "body") {
      return page.locator(selector).evaluate((root) => {
        const rgb = (value) => {
          const n = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
          return [n[0], n[1], n[2], n[3] ?? 1];
        };
        const blend = (top, bottom) =>
          top.slice(0, 3).map((n, i) => n * top[3] + bottom[i] * (1 - top[3]));
        const luminance = (c) =>
          c
            .map((n) => n / 255)
            .map((n) =>
              n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
            )
            .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
        const failures = [];
        for (const button of root.querySelectorAll("button")) {
          if (
            !button.getClientRects().length ||
            button.disabled ||
            button.getAttribute("aria-disabled") === "true" ||
            !/[A-Za-z0-9]/.test(button.innerText)
          )
            continue;
          const nodes = [];
          for (let n = button; n; n = n.parentElement) nodes.unshift(n);
          let bg = [255, 255, 255];
          for (const n of nodes)
            bg = blend(rgb(getComputedStyle(n).backgroundColor), bg);
          const fg = blend(rgb(getComputedStyle(button).color), bg),
            a = luminance(fg),
            b = luminance(bg),
            ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (ratio < 4.5)
            failures.push({
              text: button.innerText.trim().slice(0, 80),
              ratio: Number(ratio.toFixed(2)),
            });
        }
        return failures;
      });
    }

    const check = async (name, condition = true) => {
      assert.ok(condition, name);
      results.push({ theme, case: name, passed: true });
    };
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, heading] of [
        ["/overview", "Hello, Fictional"],
        ["/waiting", "My Tasks"],
        ["/projects", "Projects"],
        ["/notifications", "Inbox"],
        ["/projects/simple_project/tasks", "Tasks"],
        ["/projects/simple_project/progress", "Project progress"],
      ]) {
        await page.goto(base + path);
        await page
          .getByRole("heading", { name: heading, exact: true })
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        await check(
          `${path} at ${width} contains no page overflow`,
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await check(
          `${path} at ${width} has no voice controls`,
          (await page
            .getByRole("button", { name: /dictat|record voice/i })
            .count()) === 0,
        );
        await check(
          `${path} at ${width} has readable button text`,
          (await buttonContrast()).length === 0,
        );
        if (path === "/projects/simple_project/tasks") {
          await page.getByRole("tab", { name: "Board", exact: true }).click();
          await page
            .getByRole("button", { name: task.title, exact: true })
            .waitFor();
          await page.screenshot({
            path: `${out}/${theme}-board-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
          await page
            .getByRole("tab", { name: "Calendar", exact: true })
            .click();
          await page.getByLabel("Calendar range").waitFor();
          await check(
            `calendar has 42 day cells at ${width}`,
            (await page.locator('[class*="day_"]').count()) === 42,
          );
          await page.screenshot({
            path: `${out}/${theme}-calendar-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
          await page.getByRole("tab", { name: "List", exact: true }).click();
        }
        if (
          path === "/overview" ||
          path === "/projects" ||
          path === "/notifications" ||
          path.endsWith("/progress")
        )
          await page.screenshot({
            path: `${out}/${theme}-${path.replaceAll("/", "-")}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/projects/simple_project/tasks");
    await page.getByRole("button", { name: task.title, exact: true }).waitFor();
    await page.getByRole("tab", { name: "Board", exact: true }).click();
    await page
      .locator('article[draggable="true"]')
      .dragTo(page.getByRole("region", { name: "In progress", exact: true }));
    await page.getByRole("dialog").waitFor();
    await page
      .getByRole("button", { name: "Save change", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save change", exact: true })
      .waitFor({ state: "hidden" });
    await check(
      "drag-and-drop uses reviewed domain transition",
      task.status === "IN_PROGRESS",
    );
    await page.keyboard.press("Escape");
    await page.getByRole('tab',{name:'Board',exact:true}).focus();
    await page.keyboard.press('ArrowLeft');
    await check('view tabs support arrow-key navigation',await page.getByRole('tab',{name:'List',exact:true}).getAttribute('aria-selected')==='true');
    await page.keyboard.press('ArrowRight');
    await page.getByLabel(`Move ${task.title}`).selectOption("COMPLETED");
    await page.getByRole("dialog").waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});
    await check('task panel honors reduced motion',await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).animationName==='none'));
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page
      .getByLabel("Completion note", { exact: true })
      .fill("Coordinated with structural set.");
    await page
      .getByRole("button", { name: "Save change", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save change", exact: true })
      .waitFor({ state: "hidden" });
    await check(
      "board transition commits completion",
      task.status === "COMPLETED",
    );
    await page
      .getByLabel("New checklist item", { exact: true })
      .fill("Check sill dimensions");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add", exact: true })
      .first()
      .click();
    await page.getByText("Check sill dimensions", { exact: true }).waitFor();
    await check("checklist appears in shared panel");
    await page
      .getByLabel("Comment", { exact: true })
      .fill("Ready for the next review.");
    await page
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
    await page
      .getByText("Ready for the next review.", { exact: true })
      .waitFor();
    await check("comments persist after panel refresh");
    await page
      .getByLabel("Move to or update", { exact: true })
      .selectOption("REOPEN");
    await page
      .getByLabel("Reason", { exact: true })
      .fill("Need to coordinate north wall");
    conflict = true;
    await page
      .getByRole("button", { name: "Save change", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    await check(
      "conflict retains user draft",
      (await page.getByLabel("Reason", { exact: true }).inputValue()) ===
        "Need to coordinate north wall",
    );
    await page.screenshot({
      path: `${out}/${theme}-task-panel.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await check(
      "Escape dismisses panel",
      (await page.getByRole("dialog").count()) === 0,
    );
    await page.goto(base + "/waiting");
    await page
      .getByRole("heading", { name: "My Tasks", exact: true })
      .waitFor();
    await check(
      "board preference survives navigation",
      (await page
        .getByRole("tab", { name: "Board", exact: true })
        .getAttribute("aria-selected")) === "true",
    );
    await page.goto(base + "/projects");
    await page
      .getByRole("button", { name: "Favorite Courtyard House", exact: true })
      .click();
    await page.getByRole("navigation", { name: "Favorite projects" }).waitFor();
    await check("favorite appears in sidebar");
    await page.goto(base + "/notifications");
    await page.getByRole("button", { name: "Open item", exact: true }).count();
    await page.getByRole("link", { name: "Open item", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await check("Inbox opens same task panel");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Mark read", exact: true }).click();
    await page
      .getByRole("heading", { name: "You're up to date", exact: true })
      .waitFor();
    await check("mark read removes unread item");
    await page.goto(base + "/projects/simple_project/tasks");
    await page.getByText("More", { exact: true }).click();
    await page.getByRole("link", { name: "Permits", exact: true }).waitFor();
    await check("specialist routes retained under More");
    await check("no page JavaScript errors", errors.length === 0);
    await context.close();
  }
  await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ passed: results.length, failures: 0 }));
} finally {
  await browser.close();
}
