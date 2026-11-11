import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4173';
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  env: {
    ...process.env,
    VITE_SUPABASE_URL: 'https://eylo-auth-test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'eylo-browser-e2e-public-test-key',
  },
  stdio: 'ignore',
});

let browser;

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with status ${server.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Vite did not become ready within 30 seconds.');
}

try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });

  const desktop = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  let authRequestsBeforeLogin = 0;
  desktop.on('request', (request) => {
    if (request.url().includes('/auth/v1/')) authRequestsBeforeLogin += 1;
  });
  await desktop.goto(`${baseUrl}/login`);
  await desktop.getByRole('heading', { name: 'Continue your research' }).waitFor();
  assert.equal(await desktop.getByLabel('Email address').isVisible(), true);
  assert.equal(authRequestsBeforeLogin, 0, 'opening public login should not make authentication API requests');

  let loginCalls = 0;
  await desktop.route('https://eylo-auth-test.supabase.co/auth/v1/token?grant_type=password', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
        },
      });
      return;
    }
    loginCalls += 1;
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    });
  });
  await desktop.getByLabel('Email address').fill('researcher@example.org');
  await desktop.getByLabel('Password').fill('Wrong-password-1');
  await desktop.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await desktop.getByRole('alert').getByText('The email or password is incorrect.').waitFor();
  assert.equal(loginCalls, 1, 'rapid repeated submissions should send one login request');

  const guarded = await browser.newPage();
  await guarded.goto(`${baseUrl}/projects?tab=evidence`);
  await guarded.getByRole('heading', { name: 'Continue your research' }).waitFor();
  assert.match(new URL(guarded.url()).searchParams.get('from') || '', /^\/projects\?tab=evidence$/);

  const recovery = await browser.newPage();
  let recoveryCalls = 0;
  await recovery.route('**/auth/v1/recover**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
        },
      });
      return;
    }
    recoveryCalls += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      body: JSON.stringify({ message: 'Authentication service unavailable' }),
    });
  });
  await recovery.goto(`${baseUrl}/forgot-password`);
  await recovery.getByLabel('Email address').fill('researcher@example.org');
  await recovery.getByRole('button', { name: 'Send password-reset link' }).click();
  await recovery.waitForResponse((response) => response.url().includes('/auth/v1/recover') && response.status() === 503);
  const recoveryError = recovery.getByRole('alert').filter({ hasText: /account service is temporarily unavailable/i });
  await recoveryError.waitFor();
  assert.equal(recoveryCalls, 1, 'one recovery request should produce one visible outage error');

  const callback = await browser.newPage();
  await callback.goto(`${baseUrl}/auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);
  await callback.getByRole('heading', { name: 'Sign-in was not completed' }).waitFor();
  await callback.getByRole('button', { name: 'Return to sign in' }).waitFor();

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await mobile.goto(`${baseUrl}/register`);
  await mobile.getByRole('heading', { name: 'Create your private workspace' }).waitFor();
  await mobile.getByRole('button', { name: 'Create private workspace' }).scrollIntoViewIfNeeded();
  assert.equal(await mobile.getByRole('button', { name: 'Create private workspace' }).isVisible(), true);

  const dataLab = await browser.newPage();
  const testUser = {
    id: 'eylo-e2e-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'researcher@example.org',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const sendAuthJson = async (route, body) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
        },
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      body: JSON.stringify(body),
    });
  };
  await dataLab.route('https://eylo-auth-test.supabase.co/auth/v1/token?grant_type=password', (route) => sendAuthJson(route, {
    access_token: 'eylo-e2e-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'eylo-e2e-refresh-token',
    user: testUser,
  }));
  await dataLab.route('https://eylo-auth-test.supabase.co/auth/v1/user**', (route) => sendAuthJson(route, testUser));
  await dataLab.goto(`${baseUrl}/login`);
  await dataLab.getByLabel('Email address').fill(testUser.email);
  await dataLab.getByLabel('Password').fill('Test-password-123');
  await dataLab.getByRole('button', { name: 'Continue with password' }).click();
  await dataLab.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached' });
  await dataLab.goto(`${baseUrl}/labs/data`);
  await dataLab.getByRole('heading', { name: 'Research Data Lab' }).waitFor();
  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'study.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('sample,score\nA,1\nB,2\nC,\n'),
  });
  await dataLab.getByRole('heading', { name: 'Column summary' }).waitFor();
  await dataLab.getByRole('row', { name: /score numeric 3 1 2 1.5/ }).waitFor();
  await dataLab.getByRole('img', { name: 'Bar chart of score by row number' }).waitFor();
  const summaryDownload = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export summary CSV' }).click();
  assert.equal((await summaryDownload).suggestedFilename(), 'research-data-summary.csv');
  await dataLab.getByRole('button', { name: 'Clear data' }).click();
  await dataLab.getByRole('heading', { name: 'Column summary' }).waitFor({ state: 'detached' });

  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/meetings**', (route) => sendAuthJson(route, [{
    id: 'meeting-e2e-1',
    user_id: testUser.id,
    data: {
      title: 'E2E accessibility review',
      date: '2099-01-10',
      time: '10:00',
      duration_minutes: 45,
      call_type: 'research_discussion',
      status: 'scheduled',
      meeting_link: 'javascript:alert(1)',
    },
    created_at: '2026-11-10T00:00:00.000Z',
  }]));
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/projects**', (route) => sendAuthJson(route, []));
  await dataLab.goto(`${baseUrl}/meetings`);
  const meetingCard = dataLab.getByRole('button', { name: 'Open meeting plan: E2E accessibility review' });
  await meetingCard.waitFor();
  await meetingCard.focus();
  await dataLab.keyboard.press('Enter');
  await dataLab.getByRole('heading', { name: 'E2E accessibility review' }).waitFor();
  assert.equal(await dataLab.getByRole('link', { name: /Open external meeting room/ }).count(), 0,
    'unsafe legacy meeting URLs must not become external links');

  // Exercise the Ideas interface against an isolated PostgREST test double. This
  // verifies UI wiring and error recovery; it does not claim live Supabase/RLS.
  const savedIdeas = [];
  let failIdeaRead = true;
  let ideaReadCount = 0;
  let nextIdeaId = 0;
  await dataLab.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').at(-1);
    const method = request.method();
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer',
    };
    const respond = (status, data) => route.fulfill({
      status,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify(data),
    });

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (table === 'ideas' && method === 'GET') {
      ideaReadCount += 1;
      if (failIdeaRead) {
        await respond(503, { message: 'Test workspace read outage' });
        return;
      }
      await respond(200, savedIdeas);
      return;
    }
    if (table === 'ideas' && method === 'POST') {
      const row = { id: `idea-${++nextIdeaId}`, user_id: testUser.id, ...request.postDataJSON() };
      savedIdeas.push(row);
      await respond(201, row);
      return;
    }
    if (table === 'ideas' && method === 'PATCH') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const row = savedIdeas.find(idea => idea.id === id);
      if (!row) { await respond(404, { message: 'Idea not found' }); return; }
      Object.assign(row, request.postDataJSON());
      await respond(200, row);
      return;
    }
    if (table === 'ideas' && method === 'DELETE') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const index = savedIdeas.findIndex(idea => idea.id === id);
      const [removed] = index >= 0 ? savedIdeas.splice(index, 1) : [];
      await respond(200, removed ? [{ id: removed.id }] : []);
      return;
    }

    // Profile, watchlist and other reads return isolated empty test data.
    await respond(method === 'POST' || method === 'PATCH' ? 201 : 200, method === 'GET' ? [] : {});
  });
  const initialIdeaReadFailure = dataLab.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/rest/v1/ideas') && response.status() === 503;
  }, { timeout: 10_000 });
  await dataLab.goto(`${baseUrl}/ideas`);
  await dataLab.getByRole('heading', { name: 'Ideas' }).waitFor();
  const initialIdeaFailureResponse = await initialIdeaReadFailure;
  assert.deepEqual(await initialIdeaFailureResponse.json(), { message: 'Test workspace read outage' });
  const ideaLoadAlert = dataLab.getByRole('alert');
  await ideaLoadAlert.getByText('Ideas could not be loaded.', { exact: true }).waitFor();
  const renderedIdeaError = (await ideaLoadAlert.locator('p').nth(1).textContent())?.trim();
  assert.ok(renderedIdeaError, 'Ideas error state should explain why the list did not load');
  console.log('Ideas error state detail: ' + renderedIdeaError);
  assert.ok(ideaReadCount > 0, 'the Ideas request must reach the isolated PostgREST error mock');
  failIdeaRead = false;
  await dataLab.getByRole('button', { name: 'Try again' }).click();
  await dataLab.getByText('Your Idea Vault is empty').waitFor();
  await dataLab.getByRole('button', { name: 'New' }).click();
  await dataLab.getByLabel('Idea title').fill('Climate adaptation evidence');
  await dataLab.getByRole('button', { name: 'Save Idea' }).click();
  await dataLab.getByText('Climate adaptation evidence').waitFor();
  await dataLab.getByRole('button', { name: 'Edit Climate adaptation evidence' }).click();
  await dataLab.getByLabel('Idea title').fill('Climate resilience evidence');
  await dataLab.getByRole('button', { name: 'Update idea' }).click();
  await dataLab.getByText('Climate resilience evidence').waitFor();
  await dataLab.reload();
  await dataLab.getByText('Climate resilience evidence').waitFor();
  dataLab.on('dialog', dialog => dialog.accept());
  await dataLab.getByRole('button', { name: 'Delete Climate resilience evidence' }).click();
  await dataLab.getByText('Your Idea Vault is empty').waitFor();

  console.log('Browser checks passed: auth, mobile registration, private CSV analysis, keyboard meeting access, and Idea Vault recovery/CRUD against an isolated test double.');
  const works = [
    {
      id: 'graph-paper-1',
      user_id: testUser.id,
      created_at: '2026-11-10T00:00:00.000Z',
      data: {
        source_id: 'https://openalex.org/W100',
        title: 'Graph paper one',
        year: 2024,
        source: 'OpenAlex',
        url: 'https://doi.org/10.1234/graph-one',
        project_id: 'graph-project-1',
        authorships: [{ author_id: 'https://openalex.org/A100', author_name: 'Graph Researcher', institutions: [{ id: 'https://openalex.org/I100', name: 'Graph University' }] }],
        openalex_topics: [{ id: 'https://openalex.org/T100', name: 'Graph methods' }],
        referenced_work_ids: ['https://openalex.org/W200'],
      },
    },
    {
      id: 'graph-paper-2',
      user_id: testUser.id,
      created_at: '2026-11-10T00:00:00.000Z',
      data: {
        source_id: 'https://openalex.org/W200',
        title: 'Graph paper two',
        year: 2022,
        source: 'OpenAlex',
        url: 'https://doi.org/10.1234/graph-two',
        project_id: 'graph-project-1',
        authorships: [{ author_id: 'https://openalex.org/A100', author_name: 'Graph Researcher', institutions: [] }],
        openalex_topics: [{ id: 'https://openalex.org/T100', name: 'Graph methods' }],
        referenced_work_ids: [],
      },
    },
  ];
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/saved_papers**', route => sendAuthJson(route, works));
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/saved_researchers**', route => sendAuthJson(route, [{
    id: 'graph-researcher-1', user_id: testUser.id, created_at: '2026-11-10T00:00:00.000Z',
    data: { openalex_id: 'https://openalex.org/A100', name: 'Graph Researcher', institution: 'Graph University', profile_url: 'https://openalex.org/A100' },
  }]));
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/projects**', route => sendAuthJson(route, [{
    id: 'graph-project-1', user_id: testUser.id, created_at: '2026-11-10T00:00:00.000Z', updated_at: '2026-11-10T00:00:00.000Z',
    data: { title: 'Graph project', evidence_matrix: { annotations: { 'graph-paper-1': { study_design: 'Researcher note: cohort study' } } } },
  }]));
  await dataLab.goto(`${baseUrl}/knowledge-graph`);
  await dataLab.getByRole('heading', { name: 'Knowledge Graph' }).waitFor();
  const graphPaper = dataLab.getByRole('button', { name: 'Explore graph node: Graph paper one (Publications)' });
  await graphPaper.focus();
  await dataLab.keyboard.press('Enter');
  await dataLab.getByRole('heading', { name: 'Graph paper one' }).waitFor();
  await dataLab.getByRole('button', { name: /Graph paper one Cites Graph paper two/ }).waitFor();

  // Project-linked Literature Review protocol: save, reload and JSON export
  // against the same isolated PostgREST fixtures; no production data changes.
  const reviewProject = {
    id: 'graph-project-1',
    user_id: testUser.id,
    created_at: '2026-11-10T00:00:00.000Z',
    updated_at: '2026-11-10T00:00:00.000Z',
    data: { title: 'Graph project' },
  };
  let protocolSaves = 0;
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/projects**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
          'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer',
        },
      });
      return;
    }
    if (request.method() === 'PATCH') {
      const patch = request.postDataJSON();
      assert.equal(url.searchParams.get('id'), 'eq.graph-project-1');
      assert.equal(patch.data.review_protocol.question, 'How do graph-based evidence tools support source tracing?');
      reviewProject.data = { ...reviewProject.data, ...patch.data };
      protocolSaves++;
      await sendAuthJson(route, reviewProject);
      return;
    }
    if (request.method() === 'GET') {
      const one = url.searchParams.has('id') || /vnd\.pgrst\.object/i.test(request.headers().accept || '');
      await sendAuthJson(route, one ? reviewProject : [reviewProject]);
      return;
    }
    throw new Error('Unexpected literature protocol project request: ' + request.method());
  });
  await dataLab.goto(baseUrl + '/literature-review?project_id=graph-project-1');
  await dataLab.getByRole('heading', { name: 'Literature Review Protocol' }).waitFor();
  await dataLab.getByLabel('Research question').fill('How do graph-based evidence tools support source tracing?');
  await dataLab.getByLabel('Exact search strings').fill('("graph" AND "citation") AND "research evidence"');
  await dataLab.getByLabel('Sources searched').fill('OpenAlex and Crossref');
  await dataLab.getByLabel('Inclusion criteria').fill('Studies reporting source tracing');
  await dataLab.getByLabel('Exclusion criteria').fill('No source tracing evaluation');
  await dataLab.getByRole('button', { name: 'Add to screening log' }).first().click();
  await dataLab.getByLabel('Decision').selectOption('exclude');
  await dataLab.getByLabel('Reason / screening note').fill('Does not report a method evaluation');
  await dataLab.getByRole('button', { name: 'Save protocol to project' }).click();
  try {
    await dataLab.getByText('Protocol saved privately in this research project.').waitFor({ timeout: 8000 });
  } catch (error) {
    const alerts = await dataLab.locator('[role="alert"]').allTextContents();
    throw new Error('Review protocol save failed: ' + JSON.stringify(alerts), { cause: error });
  }
  assert.equal(protocolSaves, 1);
  await dataLab.reload();
  await dataLab.getByLabel('Research question').waitFor();
  assert.equal(await dataLab.getByLabel('Research question').inputValue(),
    'How do graph-based evidence tools support source tracing?');
  const reviewDownloadPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export reproducible JSON' }).click();
  const reviewDownload = await reviewDownloadPromise;
  assert.equal(reviewDownload.suggestedFilename(), 'eylo-review-protocol.json');
  const { readFile } = await import('node:fs/promises');
  const exportedReview = JSON.parse(await readFile(await reviewDownload.path(), 'utf8'));
  assert.equal(exportedReview.project_id, 'graph-project-1');
  assert.equal(exportedReview.counts.excluded, 1);
  assert.equal(exportedReview.protocol.screening[0].paper_id, 'graph-paper-1');
  assert.match(exportedReview.reporting_note, /Not a PRISMA-compliant/);
  console.log('Browser checks passed: literature review save, reload, source screening and reproducible JSON export against authorized test doubles.');

  // Sign-out is a real Supabase operation, not a cosmetic redirect.
  // A local auth test double lets us verify logout navigation and route guards.
  await dataLab.route('**/auth/v1/logout**', async route => {
    await route.fulfill({
      status: 204,
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    });
  });
  await dataLab.getByRole('button', { name: 'Sign out of EYLO' }).click();
  await dataLab.getByRole('heading', { name: 'Continue your research' }).waitFor();
  await dataLab.goto(`${baseUrl}/projects`);
  await dataLab.getByRole('heading', { name: 'Continue your research' }).waitFor();
  assert.equal(new URL(dataLab.url()).pathname, '/login', 'sign-out must keep protected routes closed');

  console.log('Browser checks passed: auth, mobile registration, private data tools, and verified sign-out guard with isolated test doubles.');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
}
