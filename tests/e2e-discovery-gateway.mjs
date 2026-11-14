import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const out = await mkdtemp(path.join(tmpdir(), "eylo-gateway-browser-"));
const env = {
  ...process.env,
  EYLO_GITHUB_PAGES: "false",
  VITE_SUPABASE_URL: "https://eylo-gateway-fixture.supabase.co",
  VITE_SUPABASE_ANON_KEY: "gateway-browser-public-fixture",
};
let browser, server;
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
  assert.equal((await once(build, "exit"))[0], 0, output.slice(-3000));
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
  for (let i = 0; i < 80; i += 1) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "production root preview starts");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [],
    direct = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await page.route(
    /https:\/\/(api\.openalex\.org|export\.arxiv\.org|www\.ebi\.ac\.uk|api\.crossref\.org|api\.semanticscholar\.org)\//,
    (route) => {
      direct.push(route.request().url());
      return route.abort();
    },
  );
  let phase = "unavailable";
  await page.route("**/api/discovery?**", (route) => {
    const provider = new URL(route.request().url()).searchParams.get(
      "provider",
    );
    if (phase === "partial" && provider === "openalex_works")
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              id: "https://openalex.org/W999999999999",
              title: "Fixture: Sleep and learning",
              publication_year: 2025,
              cited_by_count: 0,
              type: "article",
              authorships: [],
              abstract_inverted_index: { Sleep: [0], learning: [1] },
            },
          ],
        }),
      });
    return route.fulfill({
      status: phase === "limited" ? 429 : 503,
      contentType: "application/json",
      body: JSON.stringify({
        code:
          phase === "limited"
            ? "DISCOVERY_RATE_LIMITED"
            : "DISCOVERY_RATE_LIMIT_UNAVAILABLE",
        error: "Private upstream information must not be displayed",
      }),
    });
  });
  await page.goto(origin + "/discover?q=sleep%20learning");
  await page
    .getByText(/EYLO’s research connection is temporarily unavailable/)
    .waitFor();
  assert.equal(
    await page
      .getByText(/The scholarly paper indexes are temporarily unavailable/)
      .count(),
    0,
  );
  assert.equal(await page.getByText(/Private upstream information/).count(), 0);
  if (process.env.EYLO_E2E_ARTIFACT_DIR) {
    await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(
        process.env.EYLO_E2E_ARTIFACT_DIR,
        "discovery-gateway-mobile.png",
      ),
      fullPage: true,
    });
  }
  phase = "partial";
  await page.reload();
  await page
    .getByRole("heading", { name: "Fixture: Sleep and learning", exact: true })
    .waitFor();
  await page.getByText(/through EYLO’s research connection/).waitFor();
  phase = "limited";
  await page.reload();
  await page
    .getByText(/EYLO’s search request limit has been reached/)
    .waitFor();
  assert.deepEqual(
    direct,
    [],
    "hosted failures never bypass the gateway to reach providers",
  );
  assert.deepEqual(errors, [], "gateway error states do not crash discovery");
  console.log(
    "PASS: actual root production bundle on mobile390 distinguishes EYLO gateway503, partial source results and shared429; raw errors stay private; no direct-provider fallback. HTTP transport is synthetic, not hosted/provider acceptance.",
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
