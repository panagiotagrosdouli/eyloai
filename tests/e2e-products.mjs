import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { WORKBENCH_TOOLS } from "../src/lib/product-workbench.mjs";
import { WORKSPACE_EXPORT_TABLES } from "../src/lib/workspace-export.mjs";
import { PRODUCT_TOOLS } from "../src/lib/product-registry.mjs";
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const out = await mkdtemp(path.join(tmpdir(), "eylo-products-build-"));
const host = `http://127.0.0.1:${port}`,
  sb = "https://eylo-products-fixture.supabase.co";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "products@example.org",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const ownerB = "00000000-0000-4000-8000-000000000002";
const now = () => new Date().toISOString();
const tables = {
  projects: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      user_id: user.id,
      data: { title: "Product fixture project", plan_items: [] },
      updated_date: now(),
    },
  ],
  notes: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      user_id: user.id,
      data: {
        title: "Canonical fixture note",
        content: "Private offline memory canary supplied by user.",
        tags: [],
      },
      updated_date: now(),
    },
  ],
  profiles: [],
  notifications: [],
  time_entries: [],
  eyra_messages: [
    {
      id: randomUUID(),
      user_id: user.id,
      conversation_id: randomUUID(),
      content: "Saved EYRA source fixture",
      created_date: now(),
    },
  ],
  eylo_directory: [
    {
      user_id: ownerB,
      display_name: "Consenting fixture member",
      visible: true,
      about: "",
      created_date: now(),
      updated_date: now(),
    },
  ],
  eylo_teams: [],
  eylo_team_invites: [],
  eylo_team_members: [],
  eylo_connections: [],
  eylo_community_posts: [],
  eylo_peer_submissions: [],
  eylo_peer_reviews: [],
  eylo_feedback: [],
  eylo_api_tokens: [],
};
for (const table of WORKSPACE_EXPORT_TABLES) tables[table] ??= [];
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};
const json = (route, value, status = 200) =>
  route.fulfill({
    status,
    headers,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
let rpcResults = {},
  aiCalls = 0,
  recoveryCalls = 0;
let browser, server, page;
async function capture(name) {
  if (!process.env.EYLO_E2E_ARTIFACT_DIR) return;
  await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: path.join(process.env.EYLO_E2E_ARTIFACT_DIR, name + ".png"),
    fullPage: true,
  });
}
const build = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", out],
  {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: sb,
      VITE_SUPABASE_ANON_KEY: "products-public-fixture",
    },
    stdio: ["ignore", "ignore", "pipe"],
  },
);
let buildErrors = "";
build.stderr.on("data", (chunk) => {
  buildErrors += chunk;
});
const [exit] = await once(build, "exit");
if (exit !== 0)
  throw new Error(
    "Fixture production build failed: " + buildErrors.slice(-2000),
  );
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
  { stdio: "ignore" },
);
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(host)).ok) break;
    } catch {}
    if (i === 99) throw new Error("Preview server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
  const context = await browser.newContext({
    timezoneId: "America/Los_Angeles",
    viewport: { width: 390, height: 844 },
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) =>
    console.log("FIXTURE PAGE ERROR:", error.message),
  );
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(host + "/assets/"))
      console.log(
        "OFFLINE ASSET FAILURE:",
        req.url().slice(host.length),
        req.failure()?.errorText,
      );
  });
  await context.route("**/api/capabilities", (route) => {
    recoveryCalls++;
    return json(route, {
      ai: true,
      billing: false,
      contact: false,
      institution_analytics: false,
      scheduled_monitoring: false,
    });
  });
  await context.route("**/api/deployment-status", (route) =>
    json(route, { deployment_sha: "fixture", provenance_verified: false }),
  );
  await context.route("**/api/admin-operations", (route) =>
    json(route, { error: "Administrator permission required." }, 403),
  );
  await context.route("**/api/eyra", (route) => {
    aiCalls++;
    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: delta\ndata: {"type":"delta","delta":"Δοκιμαστική μετάφραση"}\n\nevent: done\ndata: {"type":"done","text":"Δοκιμαστική μετάφραση"}\n\n',
    });
  });
  await context.route(`${sb}/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname.includes("/auth/v1/token"))
      return json(route, {
        access_token: "product-fixture-access-token",
        refresh_token: "product-fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      });
    if (url.pathname.includes("/auth/v1/logout")) return json(route, {});
    if (url.pathname.includes("/auth/v1/user")) return json(route, user);
    if (url.pathname.includes("/rpc/")) {
      const rpc = url.pathname.split("/").at(-1),
        body = req.postDataJSON();
      if (rpc === "run_project_task_workflow") {
        if (!rpcResults[body.p_run_id])
          rpcResults[body.p_run_id] = {
            id: body.p_run_id,
            task_ids: [randomUUID(), randomUUID()],
          };
        return json(route, rpcResults[body.p_run_id]);
      }
      if (rpc === "materialize_workbench_record")
        return json(route, { id: body.p_result_id, tool: body.p_tool });
      if (rpc === "save_authored_tool_note") {
        if (!tables.notes.some((n) => n.id === body.p_id))
          tables.notes.push({
            id: body.p_id,
            user_id: user.id,
            data: {
              title: body.p_title,
              content: body.p_content,
              tags: ["translation"],
            },
            updated_date: now(),
          });
        return json(route, body.p_id);
      }
      throw new Error("Unknown fixture RPC " + rpc);
    }
    const table = url.pathname.split("/").at(-1);
    assert.ok(table in tables, "Unexpected fixture table " + table);
    const filters = [...url.searchParams].filter(
      ([, value]) => value.startsWith("eq.") || value === "is.null",
    );
    const matches = (row) =>
      filters.every(
        ([key, value]) =>
          String(
            key.startsWith("data->>") ? row.data?.[key.slice(7)] : row[key],
          ) === value.slice(3) ||
          (value === "is.null" && row[key] == null),
      );
    let rows = tables[table].filter(matches);
    if (req.method() === "POST") {
      const payload = req.postDataJSON();
      assert.equal(
        payload.user_id,
        user.id,
        "new rows use authenticated owner",
      );
      if (table === "eylo_api_tokens") {
        assert.match(payload.token_hash, /^[0-9a-f]{64}$/);
        assert.equal(JSON.stringify(payload).includes("eylo_pat_"), false);
      }
      const row = {
        id: randomUUID(),
        created_date: now(),
        updated_date: now(),
        ...(table === "eylo_connections" || table === "eylo_team_invites"
          ? { status: "pending" }
          : {}),
        ...(table === "eylo_feedback" ? { status: "submitted" } : {}),
        ...payload,
      };
      tables[table].push(row);
      rows = [row];
    } else if (req.method() === "PATCH") {
      rows.forEach((row) =>
        Object.assign(row, req.postDataJSON(), { updated_date: now() }),
      );
    } else if (req.method() === "DELETE")
      tables[table] = tables[table].filter((row) => !matches(row));
    const single = req
      .headers()
      .accept?.includes("application/vnd.pgrst.object+json");
    if (single && !rows.length)
      return json(route, { code: "PGRST116", message: "No matching row" }, 406);
    return json(
      route,
      single
        ? rows[0]
        : rows.slice(
            Number(url.searchParams.get("offset")) || 0,
            (Number(url.searchParams.get("offset")) || 0) +
              (Number(url.searchParams.get("limit")) || rows.length),
          ),
    );
  });
  await page.goto(host + "/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password").fill("Fixture-password-123");
  await page.getByRole("button", { name: "Continue with password" }).click();
  // Wait for the actual authenticated navigation; click completion does not
  // wait for asynchronous Supabase sign-in/session persistence.
  await page.waitForURL(url => url.pathname !== "/login");
  await page.goto(host + "/tools");
  await page
    .getByRole("heading", { name: "EYLO tools", exact: true })
    .waitFor();
  for (const product of PRODUCT_TOOLS)
    assert.equal(
      await page
        .locator(".eylo-page")
        .last()
        .getByRole("link", {
          name: new RegExp(
            "^" + product.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        })
        .count(),
      1,
      product.title + " discoverable",
    );
  await capture("tools-hub-mobile");
  await page.setViewportSize({ width: 1280, height: 900 });
  await capture("tools-hub-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  console.log(
    "PASS fixture: all22 product entries are discoverable in the authenticated tools hub.",
  );
  if (!process.env.EYLO_COLLAB_ONLY) {
    const values = {
      spaces: {},
      skills: {
        baseline: "1",
        current: "3",
        target: "4",
        practice: "Supplied practice sessions",
      },
      interview: {
        role: "Researcher",
        question: "Explain evidence",
        answer: "My recorded response",
        seconds: "25",
      },
      workflows: { steps: "Review sources\nWrite methods" },
      studio: {
        audience: "Research team",
        purpose: "Explain design",
        content: "User-authored studio text.",
      },
      methodology: {
        question: "What changed?",
        approach: "Describe supplied observations",
        limitations: "Small sample",
      },
      ethics: { retention: "Delete identifiers after the consented period" },
      conferences: {
        website: "https://example.org/conference-fixture",
        date: "2026-12-05",
        deadline: "2026-12-01",
        location: "Online",
        fee: "0.00",
      },
      forms: {
        definition: "Name | text | required\nCount | number | optional",
      },
    };
    for (const [tool, config] of Object.entries(WORKBENCH_TOOLS)) {
      await page.goto(
        `${host}/projects/${tables.projects[0].id}/workbench/${tool}`,
      );
      await page
        .getByRole("heading", { name: config.title, exact: true })
        .waitFor();
      await page
        .getByRole("button", {
          name: `New ${config.title} record`,
          exact: true,
        })
        .click();
      await page
        .getByLabel("Record title", { exact: true })
        .fill(`${config.title} authored fixture`);
      for (const [key, label, type] of config.fields) {
        if (type === "projects") {
          await page
            .getByRole("checkbox", {
              name: "Product fixture project",
              exact: true,
            })
            .check();
          continue;
        }
        if (values[tool][key] !== undefined)
          await page.getByLabel(label, { exact: true }).fill(values[tool][key]);
      }
      await page
        .getByRole("button", { name: "Apply record to draft", exact: true })
        .click();
      await page
        .getByRole("button", { name: `Save ${config.title}`, exact: true })
        .click();
      await page.getByText(`${config.title} saved.`, { exact: true }).waitFor();
      await page.reload();
      await page
        .getByRole("heading", {
          name: `${config.title} authored fixture`,
          exact: true,
        })
        .waitFor();
      assert.equal(
        tables.projects[0].data.product_workbench[tool].records.length,
        1,
      );
      if (["workflows", "studio", "conferences"].includes(tool)) {
        page.once("dialog", (dialog) => dialog.accept());
        await page
          .getByRole("button", {
            name:
              tool === "workflows"
                ? "Previewed tasks: confirm creation"
                : tool === "studio"
                  ? "Create Note from saved draft"
                  : "Add saved deadline to Calendar",
            exact: true,
          })
          .click();
        await page
          .getByText(
            "Records created in your workspace. Reload before another modification.",
            { exact: true },
          )
          .waitFor();
      }
      if (tool === "forms") {
        await page.getByRole("button", { name: "Fill private form" }).click();
        await page
          .getByLabel("Name *", { exact: true })
          .fill("Private form response");
        await page.getByLabel("Count", { exact: true }).fill("2");
        await page
          .getByRole("button", { name: "Apply private response to draft" })
          .click();
        await page
          .getByRole("button", { name: "Save Smart Forms", exact: true })
          .click();
        await page.getByText("Smart Forms saved.", { exact: true }).waitFor();
        assert.equal(
          tables.projects[0].data.product_workbench.forms.records[0].responses
            .length,
          1,
        );
        const csvEvent = page.waitForEvent("download");
        await page.getByRole("button", {name:"Export saved responses CSV"}).click();
        const csvDownload = await csvEvent, csvStream = await csvDownload.createReadStream();
        let csvText = ""; for await (const chunk of csvStream) csvText += chunk;
        assert.ok(csvDownload.suggestedFilename().endsWith("-responses.csv"));
        assert.ok(csvText.includes('"Private form response","2"'));

      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        config.title + " mobile overflow",
      );
      console.log(
        `PASS fixture: ${config.title} authoring, explicit save/reload and product-specific preview/action.`,
      );
    }
    await page.goto(`${host}/projects/${tables.projects[0].id}/spreadsheet`);
    await page.getByLabel("Cell A1", { exact: true }).fill("2");
    await page.getByLabel("Cell A2", { exact: true }).fill("3");
    await page.getByLabel("Cell B1", { exact: true }).fill("=SUM(A1:A2)");
    await page
      .getByRole("button", { name: "Save Spreadsheets", exact: true })
      .click();
    await page.getByText("Spreadsheets saved.", { exact: true }).waitFor();
    await page.reload();
    assert.equal(
      await page.getByLabel("Cell B1", { exact: true }).inputValue(),
      "=SUM(A1:A2)",
    );
    await page.getByRole("button", { name: "Show evaluated values" }).click();
    await page.getByRole("cell", { name: "5", exact: true }).waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Spreadsheet root overflow",
    );
    await capture("spreadsheet-mobile");
    console.log(
      "PASS fixture: Spreadsheet real cell editing, saved formula, reload and evaluated aggregate.",
    );
    await page.goto(host + "/tools/memory");
    await page.getByRole("button", { name: "Load my saved sources" }).click();
    await page
      .getByText("Loaded up to1,000 recent records per source.", {
        exact: true,
      })
      .waitFor();
    await page.getByLabel("Search remembered content").fill("offline memory");
    await page
      .getByRole("heading", { name: "Canonical fixture note", exact: true })
      .waitFor();
    assert.equal(aiCalls, 0);
    console.log(
      "PASS fixture: Memory retrieves canonical source text and attribution without a model or memory table.",
    );
    await page.goto(host + "/tools/translate");
    await page.getByLabel("Text to translate").fill("Supplied source text");
    await page
      .getByRole("button", { name: "Translate with EYRA", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Translation output" })
      .filter({ hasText: "Δοκιμαστική μετάφραση" })
      .waitFor();
    await page
      .getByRole("button", { name: "Save reviewed translation to Notes" })
      .waitFor({ state: "visible" });
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Save reviewed translation to Notes" })
      .click();
    await page
      .getByText("Reviewed translation saved to Notes.", { exact: true })
      .waitFor();
    assert.equal(
      tables.notes.filter((n) => n.data.title === "Translation to Greek")
        .length,
      1,
    );
    console.log(
      "PASS fixture: authenticated EYRA translation stream fixture and explicit canonical Note save. No real provider request.",
    );
    await page.getByLabel("Text to translate").fill("Supplied source with citation [1]");
    await page.getByRole("button", {name:"Translate with EYRA",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Translation reference check failed"}).waitFor();
    assert.equal(await page.getByRole("button", {name:"Save reviewed translation to Notes"}).isDisabled(),true);
    assert.equal(tables.notes.filter(n=>n.data.title === "Translation to Greek").length,1);
    console.log("PASS fixture: a translation that drops a supplied citation fails closed before canonical Note saving.");
    const viewerMonth = await page.evaluate(() => `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`);
    const firstDate = viewerMonth + "-01";
    const endDate = viewerMonth + "-02";
    const deadline = {id:randomUUID(),user_id:user.id,updated_date:now(),data:{title:"Floating conference deadline",description:"Supplied official deadline",all_day:true,start_at:firstDate+"T00:00:00.000Z",end_at:endDate+"T00:00:00.000Z",reminder_at:null,recurrence:"none",project_id:null}};
    tables.calendar_events.push(deadline);
    await page.goto(host+"/calendar?focus="+deadline.id);
    await page.waitForFunction(expected => document.querySelector('input[type="date"]')?.value === expected, firstDate);
    assert.equal(await page.getByLabel("All-day event",{exact:true}).isChecked(),true);
    assert.equal(await page.getByLabel("Starts",{exact:true}).inputValue(),firstDate);
    assert.equal(await page.getByRole("button",{name:"1, 1 events",exact:true}).count(),1);
    await page.getByLabel("Title",{exact:true}).fill("Reviewed floating deadline");
    await page.getByRole("button",{name:"Save event",exact:true}).click();
    await page.getByText("Event saved.",{exact:true}).waitFor();
    assert.equal(deadline.data.all_day,true);
    assert.equal(deadline.data.start_at,firstDate+"T00:00:00.000Z");
    assert.equal(deadline.data.end_at,endDate+"T00:00:00.000Z");
    await capture("calendar-all-day-mobile");
    console.log("PASS fixture: conference all-day date at UTC month boundary stays on day1 and survives Calendar editing in America/Los_Angeles.");
    await page.goto(host + "/tools/self-healing");
    await page
      .getByRole("button", {
        name: "Run diagnostics and bounded recovery retries",
      })
      .click();
    await page
      .getByText("responding · 1 attempt(s)", { exact: true })
      .first()
      .waitFor();
    assert.ok(recoveryCalls > 0);
    console.log(
      "PASS fixture: read-only recovery diagnostics use actual JSON checks and report results.",
    );
    await page.goto(host + "/tools/admin");
    await page
      .getByRole("button", { name: "Load authorized operations view" })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Administrator permission required." })
      .waitFor();
    console.log(
      "PASS fixture: Admin Operations denies an unauthorized account.",
    );
    await page.goto(host + "/tools/business");
    await page
      .getByRole("button", { name: "Load source-bound operating report" })
      .click();
    await page
      .getByRole("heading", { name: "Product fixture project", exact: true })
      .waitFor();
    await page
      .getByText("No research budget recorded", { exact: true })
      .waitFor();
    console.log(
      "PASS fixture: Business Intelligence reports actual loaded sources and missing budget explicitly.",
    );
    await page.goto(host + "/tools/developer");
    await page.getByLabel("Token name").fill("Fixture scope");
    await page
      .getByRole("checkbox", { name: "Product fixture project" })
      .check();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Create scoped token" }).click();
    await page.getByLabel("One-time token").waitFor();
    assert.match(
      await page.getByLabel("One-time token").inputValue(),
      /^eylo_pat_[0-9a-f]{64}$/,
    );
    assert.equal(tables.eylo_api_tokens.length, 1);
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Revoke token", exact: true })
      .click();
    await page.getByText("Token revoked.", { exact: true }).waitFor();
    assert.ok(tables.eylo_api_tokens[0].revoked_at);
    console.log(
      "PASS fixture: Developer token issue stores only digest/scopes and revocation persists.",
    );
  }
  await page.goto(host + "/collaboration/connect");
  await page.getByLabel("Display name").fill("Opt-in fixture name");
  await page.getByLabel("Public bio").fill("Deliberate published bio");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publish directory profile" }).click();
  await page
    .getByText("Directory profile published.", { exact: true })
    .waitFor();
  await page.getByLabel("Member", { exact: true }).selectOption(ownerB);
  await page.getByRole("button", { name: "Request connection" }).click();
  await page.getByText("Connection request saved.", { exact: true }).waitFor();
  tables.eylo_connections[0].status = "accepted";
  console.log(
    "PASS fixture: Connect opt-in directory and explicit connection request persistence.",
  );
  await page.goto(host + "/collaboration/teams");
  await page.getByLabel("Team name").fill("Fixture team");
  await page.getByRole("button", { name: "Create team", exact: true }).click();
  await page
    .getByText("Team created. Its owner manages invitations and roles.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel("Team", { exact: true })
    .selectOption(tables.eylo_teams[0].id);
  await page.getByLabel("Member", { exact: true }).selectOption(ownerB);
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  await page
    .getByText("Invitation saved. No email was sent.", { exact: true })
    .waitFor();
  console.log(
    "PASS fixture: Teams creation/invitation UI; actual consent/role/revocation SQL checked separately.",
  );
  await page.goto(host + "/collaboration/community");
  await page
    .getByLabel("Community post")
    .fill("Deliberately shared fixture post");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await page.getByText("Post published.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Community post").fill("Fixture reply");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publish post", exact: true }).click();
  await page.getByText("Fixture reply", { exact: true }).waitFor();
  assert.ok(tables.eylo_community_posts[1].parent_id);
  console.log(
    "PASS fixture: Community deliberate publication and threaded reply persistence.",
  );
  await page.goto(host + "/collaboration/feedback");
  await page
    .getByLabel("Feedback", { exact: true })
    .fill("Fixture feedback tracking");
  await page
    .getByRole("button", { name: "Submit feedback", exact: true })
    .click();
  await page
    .getByText("Feedback saved to the EYLO queue.", { exact: true })
    .waitFor();
  assert.equal(tables.eylo_feedback[0].status, "submitted");
  console.log("PASS fixture: Feedback saved receipt and status tracking.");
  await page.goto(host + "/collaboration/peer-review");
  await page.getByLabel("Member", { exact: true }).selectOption(ownerB);
  await page.getByLabel("Submission title").fill("Shared fixture manuscript");
  await page
    .getByLabel("Shared manuscript snapshot")
    .fill("Only this deliberate snapshot is shared.");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Share review snapshot", exact: true })
    .click();
  await page.getByText("Review snapshot shared.", { exact: true }).waitFor();
  assert.equal(tables.eylo_peer_submissions[0].reviewer_id, ownerB);
  await capture("peer-review-mobile");
  console.log(
    "PASS fixture: Peer Review explicit snapshot sharing to an accepted connection; real draft privacy SQL checked separately.",
  );
  await page.goto(host + "/offline");
  await page
    .getByLabel("Offline passphrase")
    .fill("Fixture offline passphrase");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Prepare encrypted snapshot while online" })
    .click();
  await page
    .getByText(
      "Encrypted snapshot and static Offline shell prepared. Test an offline reload before relying on it.",
      { exact: true },
    )
    .waitFor();
  const ciphertext = await page.evaluate(
    () =>
      Object.entries(localStorage).find(([key]) =>
        key.startsWith("eylo:offline:v1:"),
      )?.[1],
  );
  assert.ok(ciphertext);
  assert.equal(ciphertext.includes("Private offline memory canary"), false);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Offline", exact: true }).waitFor();
  await page
    .getByLabel("Stored account snapshot")
    .selectOption("eylo:offline:v1:" + user.id);
  await page
    .getByLabel("Offline passphrase")
    .fill("Fixture offline passphrase");
  await page
    .getByRole("button", { name: "Unlock locally", exact: true })
    .click();
  await page
    .getByText("Private offline memory canary supplied by user.", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("button", { name: "Lock snapshot", exact: true })
    .click();
  assert.equal(
    await page
      .getByText("Private offline memory canary supplied by user.", {
        exact: true,
      })
      .count(),
    0,
  );
  await context.setOffline(false);
  console.log(
    "PASS fixture: production static shell survives offline reload; encrypted snapshot unlock/lock works with no plaintext-at-rest.",
  );
  if (process.env.EYLO_E2E_ARTIFACT_DIR) {
    await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(
        process.env.EYLO_E2E_ARTIFACT_DIR,
        "products-offline-mobile.png",
      ),
      fullPage: true,
    });
  }
  console.log(
    process.env.EYLO_COLLAB_ONLY
      ? "PASS: focused collaboration/offline fixture retest only."
      : "PASS: all22 product workflows exercised with synthetic Auth/PostgREST/AI transport; hosted staging and real providers remain unverified.",
  );
} catch (error) {
  if (page) {
    console.log(
      "FIXTURE FAILURE VIEW:",
      (await page.locator("body").innerText()).slice(-7000),
    );
    console.log(
      "ROOT WIDTH:",
      await page.evaluate(() => ({
        inner: innerWidth,
        html: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        table: document.querySelector("table")?.parentElement
          ? {
              client: document.querySelector("table").parentElement.clientWidth,
              scroll: document.querySelector("table").parentElement.scrollWidth,
              overflow: getComputedStyle(
                document.querySelector("table").parentElement,
              ).overflowX,
            }
          : null,
      })),
    );
    console.log(
      "OVERFLOW ELEMENTS:",
      await page.evaluate(() =>
        Array.from(document.querySelectorAll("body *"))
          .map((node) => ({
            tag: node.tagName,
            cls: node.className,
            left: node.getBoundingClientRect().left,
            right: node.getBoundingClientRect().right,
            width: node.getBoundingClientRect().width,
          }))
          .filter((row) => row.right > innerWidth + 1 && row.width > 0)
          .slice(0, 12),
      ),
    );
    console.log(
      "STATIC CACHE:",
      await page.evaluate(async () => {
        const cache = await caches.open("eylo-offline-shell-v1");
        return (await cache.keys()).map(
          (request) => new URL(request.url).pathname,
        );
      }),
    );
  }
  throw error;
} finally {
  if (browser) await browser.close();
  server?.kill("SIGTERM");
}
