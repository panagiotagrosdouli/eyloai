import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const out = await mkdtemp(path.join(tmpdir(), "eylo-company-pages-"));
const env = {
  ...process.env,
  EYLO_GITHUB_PAGES: "true",
  VITE_SUPABASE_URL: "https://eylo-landing-fixture.supabase.co",
  VITE_SUPABASE_ANON_KEY: "company-browser-public-fixture",
};
const origin = `http://127.0.0.1:${port}`,
  base = origin + "/eyloai/";
let browser, server;
async function screenshot(page, name) {
  const dir = process.env.EYLO_E2E_ARTIFACT_DIR;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.screenshot({
    path: path.join(dir, name + ".png"),
    fullPage: true,
  });
}
try {
  const build = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "build",
      "--outDir",
      out,
      "--emptyOutDir",
    ],
    { env, stdio: "pipe" },
  );
  let output = "";
  build.stdout.on("data", (chunk) => (output += chunk));
  build.stderr.on("data", (chunk) => (output += chunk));
  const [code] = await once(build, "exit");
  assert.equal(code, 0, output.slice(-3000));
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--outDir",
      out,
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { env, stdio: "ignore" },
  );
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "production Pages preview starts");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  // Font connectivity must not be required for navigation or rendering.
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await context.route("**/api/capabilities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ contact: false }),
    }),
  );
  const page = await context.newPage(),
    errors = [],
    badAssets = [];
  let authRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      response.url().startsWith(origin) &&
      /\/(assets|brand)\//.test(response.url())
    )
      badAssets.push(response.url());
  });
  page.on("request", (request) => {
    if (request.url().includes("/auth/v1/")) authRequests++;
  });
  await page.goto(base);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  assert.match(
    await page.getByRole("heading", { level: 1 }).innerText(),
    /A better way to\s*explore research/,
  );
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    "https://panagiotagrosdouli.github.io/eyloai/",
  );
  for (const heading of [
    "Less scattered.",
    "Your questions.",
    "Different starting points.",
    "Built around evidence.",
  ])
    assert.ok(
      (await page.getByRole("heading").filter({ hasText: heading }).count()) >
        0,
    );
  for (const link of await page.locator('a[href^="#"]').all()) {
    const href = await link.getAttribute("href");
    assert.equal(
      await page.locator(href).count(),
      1,
      href + " has a destination",
    );
  }
  const discover = page.getByRole("tab", { name: "Discover", exact: true });
  await discover.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "Workspace", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page
    .getByRole("tabpanel")
    .filter({ hasText: "Keep the thread." })
    .waitFor({ state: "visible" });
  await page.keyboard.press("End");
  assert.equal(
    await page
      .getByRole("tab", { name: "EYRA", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  await page
    .getByRole("tabpanel")
    .filter({ hasText: "Think it through." })
    .waitFor({ state: "visible" });
  await page.keyboard.press("Home");
  assert.equal(await discover.getAttribute("aria-selected"), "true");
  const question = page
    .locator("summary")
    .filter({ hasText: "Can I explore before creating an account?" });
  await question.focus();
  await page.keyboard.press("Enter");
  assert.equal(await question.evaluate((el) => el.parentElement.open), true);
  await page.keyboard.press("Enter");
  assert.equal(await question.evaluate((el) => el.parentElement.open), false);
  assert.equal(authRequests, 0, "public company landing never calls Auth");
  await screenshot(page, "company-landing-desktop");
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "no root overflow at " + width,
    );
    const menu = page.locator('button[aria-controls="company-mobile-nav"]');
    await menu.click();
    assert.equal(await menu.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(
      await page.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Open menu",
    );
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation", exact: true })
      .getByRole("link", { name: "Meet EYRA", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .getAttribute("aria-expanded"),
      "false",
    );
    assert.equal(new URL(page.url()).hash, "#eyra");
    for (const tab of ["Workspace", "EYRA", "Discover"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "preview " + tab + " fits " + width,
      );
    }
    if (width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await screenshot(page, "company-landing-mobile");
    }
  }
  await page.goto(base);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Skip to content",
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "main-content",
  );
  await page
    .getByRole("navigation", { name: "The company", exact: true })
    .getByRole("link", { name: "What we do", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "From questions to clarity.", exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/eyloai/company/what-we-do");
  await page.goto(base);
  await page
    .getByRole("navigation", { name: "Let’s connect", exact: true })
    .getByRole("link", { name: "Contact EYLO", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Get in touch.", exact: true })
    .waitFor();
  assert.ok(
    (
      await page
        .getByRole("img", { name: "EYLO", exact: true })
        .getAttribute("src")
    ).startsWith("/eyloai/brand/"),
  );
  await page.goto(base);
  await page
    .getByRole("link", { name: "Create your workspace", exact: true })
    .click();
  await page
    .getByRole("heading", {
      name: "Create your private workspace",
      exact: true,
    })
    .waitFor();
  assert.equal(new URL(page.url()).pathname, "/eyloai/register");
  await page.goto(base);
  await page.getByRole("link", { name: "Enter EYLO AI", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/eyloai/discover");
  assert.deepEqual(badAssets, [], "all brand/build assets load under /eyloai/");
  assert.deepEqual(errors, [], "no uncaught browser errors");
  console.log(
    "PASS: production GitHub Pages company landing, responsive320/390/768/1440 layouts, keyboard tabs/menu/FAQ/skip link, source anchors, real company/contact/register/discovery routes and base-aware brand assets. No Auth submission or contact message.",
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
