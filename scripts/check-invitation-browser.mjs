import { chromium } from "playwright";
import assert from "node:assert/strict";

// Local browser-only transport fixture; never represents Google or API acceptance.
const base = process.env.BASE_URL || "http://localhost:3022";
const browser = await chromium.launch({ headless: true });
try {
  const errors = [];
  const sent = [];
  for (const suffix of ["#token=fixture%2Btoken", "?token=fixture%2Btoken", "#fixture+token"]) {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/invite/accept", async (route) => {
      sent.push(route.request().postDataJSON());
      await route.fulfill({ contentType: "application/json", body: '{"ok":true}' });
    });
    await page.goto(`${base}/invite/accept${suffix}`);
    await page.getByRole("button", { name: "Accept invitation", exact: true }).click();
    await page.getByRole("heading", { name: "Welcome to your workspace" }).waitFor();
    assert.deepEqual(sent.at(-1), { token: "fixture+token" });
    const url = new URL(page.url());
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: 3, scope: "local invitation link parsing, URL cleanup and POST transport; fixture response only" }));
} finally {
  await browser.close();
}
