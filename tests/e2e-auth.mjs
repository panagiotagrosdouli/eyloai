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

  // Verify a Library outage is recoverable and paper/project links survive a
  // page reload. These are isolated PostgREST fixtures, not live-RLS evidence.
  const libraryPaper = {
    id: 'library-paper-1', user_id: testUser.id, created_at: '2026-11-10T00:00:00.000Z',
    data: { title: 'Library persistence test paper', source: 'OpenAlex', year: 2025 },
  };
  const libraryProject = {
    id: 'library-project-1', user_id: testUser.id, created_at: '2026-11-10T00:00:00.000Z',
    data: { title: 'Library linked project', goal: 'Evaluate saved evidence', status: 'active' },
  };
  let libraryReadOutage = true;
  let linkedPaperWrites = 0;
  await dataLab.route('**/rest/v1/saved_papers**', async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, PATCH, OPTIONS',
      'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer',
    };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() === 'GET' && libraryReadOutage) {
      await route.fulfill({ status: 503, contentType: 'application/json', headers,
        body: JSON.stringify({ message: 'Temporary saved-paper outage' }) });
      return;
    }
    if (request.method() === 'PATCH') {
      linkedPaperWrites += 1;
      Object.assign(libraryPaper.data, request.postDataJSON()?.data || {});
    }
    const single = (request.headers()['accept'] || '').includes('application/vnd.pgrst.object+json');
    await route.fulfill({ status: 200, contentType: 'application/json', headers,
      body: JSON.stringify(single ? libraryPaper : [libraryPaper]) });
  });
  await dataLab.route('**/rest/v1/projects**', route => sendAuthJson(route, [libraryProject]));
  await dataLab.goto(`${baseUrl}/library`);
  await dataLab.getByRole('button', { name: 'Retry loading' }).waitFor();
  libraryReadOutage = false;
  await dataLab.getByRole('button', { name: 'Retry loading' }).click();
  await dataLab.getByText('Library persistence test paper').waitFor();
  await dataLab.getByLabel('Link paper to a project').selectOption('library-project-1');
  await dataLab.getByRole('link', { name: 'Open project' }).waitFor();
  assert.equal(linkedPaperWrites, 1, 'project linking should write the saved paper once');
  await dataLab.reload();
  await dataLab.getByText('Library persistence test paper').waitFor();
  assert.equal(await dataLab.getByLabel('Link paper to a project').inputValue(), 'library-project-1');
  console.log('Library recovery and persisted project link passed against isolated PostgREST fixtures.');

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
  assert.equal(exportedReview.protocol.screening[0].paper_id, 'library-paper-1');
  assert.match(exportedReview.reporting_note, /Not a PRISMA-compliant/);

  // Funding ranking and comparison browser flow against provider-shaped source
  // records. The fixtures verify UI integration without claiming live provider access.
  const fundingSourceRecords = [
    { id: 'grant-1', title: 'Official climate grant', type: 'grant', source: 'Grants.gov', agency: 'NSF', description: 'Climate resilience', eligibility: 'Universities', amount: '$1,000,000', deadline: '2099-12-31', deadline_days: 26600, categories: ['Climate'], source_url: 'https://www.grants.gov/search-results-detail/1' },
    { id: 'grant-2', title: 'Official health grant', type: 'grant', source: 'Grants.gov', agency: 'NIH', description: 'Health research', eligibility: 'Universities', amount: '', deadline: '', deadline_days: null, categories: ['Health'], source_url: 'https://www.grants.gov/search-results-detail/2' },
    { id: 'grant-3', title: 'Official EU call', type: 'call', source: 'EU Funding & Tenders Portal', agency: 'Horizon Europe', description: 'EU climate research', eligibility: 'Research organisations', amount: { currency: 'EUR', amount: 2000000 }, deadline: '2099-11-30', deadline_days: 26600, categories: ['Climate'], source_url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/HORIZON-CLIMATE' },
    { id: 'grant-4', title: 'Untrusted URL record', type: 'grant', source: 'Grants.gov', agency: 'NSF', description: 'Climate datasets', eligibility: '', amount: '', deadline: '', deadline_days: null, categories: ['Climate'], source_url: 'javascript:alert(1)' },
  ];
  let fundingSearchCalls = 0;
  await dataLab.route('**/api/opportunities**', async route => {
    fundingSearchCalls++;
    const url = new URL(route.request().url());
    const records = url.searchParams.get('q') === 'health' ? [fundingSourceRecords[1]] : fundingSourceRecords;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      query: url.searchParams.get('q'), source: 'Grants.gov + EU Funding & Tenders Portal',
      retrieved_at: new Date().toISOString(), partial_results: false, items: records,
    }) });
  });
  let fundingRankCalls = 0;
  await dataLab.route('**/api/eyra', async route => {
    fundingRankCalls++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ranked: [
      { id: 'grant-1', match_score: 90, match_reason: '<img src=x onerror=alert(1)> climate fit', difficulty: 'Medium', title: 'Model invented title' },
      { id: 'grant-1', match_score: 1, match_reason: 'duplicate', difficulty: 'High' },
      { id: 'unknown', match_score: 100, title: 'Invented opportunity' },
    ] } }) });
  });
  await dataLab.goto(`${baseUrl}/opportunities`);
  await dataLab.getByLabel('Funding search').fill('climate');
  const fundingResponse = dataLab.waitForResponse(response => response.url().includes('/api/opportunities'), { timeout: 10000 });
  await dataLab.getByRole('button', { name: 'Find' }).click();
  const fundingSourceResponse = await fundingResponse;
  assert.equal(fundingSourceResponse.status(), 200);
  const fundingFixturePayload = await fundingSourceResponse.json();
  assert.equal(fundingFixturePayload.items?.length, 4, 'the provider fixture must return four official records');
  try {
    await dataLab.getByText('Official climate grant', { exact: true }).waitFor({ timeout: 10000 });
  } catch (failure) {
    const alerts = await dataLab.locator('[role="alert"]').allTextContents();
    const bodyText = (await dataLab.locator('body').innerText()).slice(-1200);
    throw new Error(`Funding results missing after ${fundingSearchCalls} source and ${fundingRankCalls} ranking fixture request(s): ${JSON.stringify({ alerts, url: dataLab.url(), bodyText })}`, { cause: failure });
  }
  await dataLab.getByText('currency: EUR; amount: 2000000', { exact: true }).waitFor();
  assert.equal(await dataLab.getByRole('heading', { name: 'Model invented title' }).count(), 0);
  await dataLab.getByText('AI relevance estimate: 90/100').waitFor();
  await dataLab.getByText('<img src=x onerror=alert(1)> climate fit').waitFor();
  assert.equal(await dataLab.locator('img[src="x"]').count(), 0, 'model rationale must render as text');
  const compareFirst = dataLab.getByRole('button', { name: 'Add Official climate grant to comparison' });
  await compareFirst.focus();
  await dataLab.keyboard.press('Enter');
  await dataLab.getByRole('heading', { name: 'Compare official opportunities' }).waitFor();
  await dataLab.getByRole('button', { name: 'Add Official health grant to comparison' }).click();
  await dataLab.getByRole('button', { name: 'Add Official EU call to comparison' }).click();
  assert.equal(await dataLab.getByRole('button', { name: 'Add Untrusted URL record to comparison' }).isDisabled(), true);
  assert.equal(await dataLab.getByRole('link', { name: 'Open official source', exact: true }).count(), 3,
    'the comparison table exposes exactly the three selected safe official links');
  await dataLab.getByLabel('Filter by research field').fill('health');
  await dataLab.getByRole('columnheader', { name: /Official health grant/ }).waitFor();
  assert.equal(await dataLab.getByRole('columnheader', { name: /Official climate grant/ }).count(), 0,
    'comparison follows the filtered record set');
  assert.match(await dataLab.getByRole('cell').filter({ hasText: 'Not provided by source' }).first().textContent(), /Not provided/);
  await dataLab.getByLabel('Filter by research field').fill('');
  await dataLab.getByLabel('Funding search').fill('health');
  await dataLab.getByRole('button', { name: 'Find' }).click();
  await dataLab.getByRole('heading', { name: 'Official health grant' }).waitFor();
  await dataLab.getByRole('heading', { name: 'Compare official opportunities' }).waitFor({ state: 'detached' });
  assert.equal(fundingSearchCalls, 2);
  assert.equal(fundingRankCalls, 2);
  await dataLab.setViewportSize({ width: 375, height: 812 });
  assert.equal(await dataLab.getByRole('heading', { name: 'Official health grant' }).isVisible(), true);
  console.log('Funding ranking and comparison passed with authenticated browser fixtures; provider calls and production persistence were not exercised.');

  // Project-scoped Grant Builder browser workflow against isolated authenticated
  // PostgREST records. It checks switching, reload, notes and persisted drafts.
  await dataLab.route('**/api/capabilities', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ai: true, billing: false }),
  }));
  const grantCors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer',
  };
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/saved_opportunities**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: grantCors,
    body: JSON.stringify([{ id: 'grant-opportunity-1', user_id: testUser.id, data: {
      title: 'Official grant for project isolation', source_id: 'GRANT-E2E-1', type: 'grant',
      source_url: 'https://www.grants.gov/search-results-detail/100', agency: 'NSF',
      description: 'Official notice text', eligibility: 'Universities', amount: '$250,000',
    } }]),
  }));
  const grantProjects = [
    { id: 'grant-project-a', user_id: testUser.id, data: { title: 'Grant Project A', goal: 'A distinct research goal' } },
    { id: 'grant-project-b', user_id: testUser.id, data: { title: 'Grant Project B', goal: 'A separate research goal' } },
  ];
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/projects**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: grantCors, body: JSON.stringify(grantProjects),
  }));
  const grantApplications = [];
  let nextGrantApplication = 0;
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/grant_applications**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: grantCors });
      return;
    }
    if (request.method() === 'GET') {
      const opportunityId = url.searchParams.get('saved_opportunity_id')?.replace(/^eq\./, '');
      const projectId = url.searchParams.get('project_id')?.replace(/^eq\./, '');
      const rows = grantApplications.filter(row => row.user_id === testUser.id
        && row.saved_opportunity_id === opportunityId && row.project_id === projectId);
      await route.fulfill({ status: 200, contentType: 'application/json', headers: grantCors, body: JSON.stringify(rows) });
      return;
    }
    if (request.method() === 'POST') {
      const row = { id: `grant-application-${++nextGrantApplication}`, created_date: new Date().toISOString(), updated_date: new Date().toISOString(), ...request.postDataJSON() };
      grantApplications.push(row);
      await route.fulfill({ status: 201, contentType: 'application/json', headers: grantCors, body: JSON.stringify(row) });
      return;
    }
    if (request.method() === 'PATCH') {
      const projectId = url.searchParams.get('project_id')?.replace(/^eq\./, '');
      const expectedVersion = Number(url.searchParams.get('version')?.replace(/^eq\./, ''));
      const row = grantApplications.find(item => item.user_id === testUser.id
        && item.saved_opportunity_id === 'grant-opportunity-1'
        && item.project_id === projectId && item.version === expectedVersion);
      if (row) Object.assign(row, request.postDataJSON(), { updated_date: new Date().toISOString() });
      await route.fulfill({ status: 200, contentType: 'application/json', headers: grantCors, body: JSON.stringify(row ? [row] : []) });
      return;
    }
    throw new Error(`Unexpected grant application method: ${request.method()}`);
  });
  await dataLab.route('**/api/eyra', async route => {
    const prompt = route.request().postDataJSON()?.prompt || '';
    const projectName = prompt.includes('Title: Grant Project A') ? 'Grant Project A' : 'Grant Project B';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
      fit_summary: `Draft saved for ${projectName}`,
      eligibility_check: [{ requirement: 'Applicant type', evidence: 'Universities appear in notice text.', status: 'supported' }],
      project_summary: `${projectName} summary`, need_statement: 'Need to be confirmed by the researcher.',
      objectives: ['Objective grounded in the project record'], work_packages: [],
      impact_and_evaluation: 'To be defined.', budget_assumptions: [], missing_information: ['Confirm budget'], next_actions: ['Review official call'],
    } }) });
  });
  await dataLab.goto(`${baseUrl}/grant-builder`);
  await dataLab.getByRole('heading', { name: 'Grant Builder' }).waitFor();
  await dataLab.getByLabel('Project').selectOption('grant-project-a');
  await dataLab.getByRole('button', { name: 'Generate working draft' }).click();
  await dataLab.getByText('Draft saved for Grant Project A').waitFor();
  await dataLab.getByLabel('Tracker notes').fill('Notes unique to project A');
  await dataLab.getByRole('button', { name: 'Save tracker' }).click();
  await dataLab.getByText('Application tracker saved').waitFor();
  await dataLab.getByLabel('Project').selectOption('grant-project-b');
  await dataLab.getByText('Draft saved for Grant Project A').waitFor({ state: 'detached' });
  await dataLab.getByLabel('Tracker notes').fill('Notes unique to project B');
  await dataLab.getByRole('button', { name: 'Generate working draft' }).click();
  await dataLab.getByText('Draft saved for Grant Project B').waitFor();
  await dataLab.getByRole('button', { name: 'Save tracker' }).click();
  await dataLab.getByText('Application tracker saved').waitFor();
  await dataLab.getByLabel('Project').selectOption('grant-project-a');
  await dataLab.getByText('Draft saved for Grant Project A').waitFor();
  assert.equal(await dataLab.getByLabel('Tracker notes').inputValue(), 'Notes unique to project A');
  assert.equal(grantApplications.length, 2, 'one opportunity has a separate persisted application for each project');
  await dataLab.reload();
  await dataLab.getByText('Draft saved for Grant Project A').waitFor();
  assert.equal(await dataLab.getByLabel('Tracker notes').inputValue(), 'Notes unique to project A');
  console.log('Grant Builder project isolation passed with authenticated PostgREST fixtures; live RLS and concurrent database writes were not exercised.');

  // Research Gap Finder live-search and save workflow using scholarly-provider
  // shaped responses plus an isolated authenticated PostgREST persistence fixture.
  const providerCors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  await dataLab.route('https://api.openalex.org/works**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: providerCors,
    body: JSON.stringify({ results: [{
      id: 'https://openalex.org/W987654321', doi: 'https://doi.org/10.1234/climate.2026',
      title: 'Climate adaptation evidence in coastal cities', publication_year: 2026,
      authorships: [{ author: { display_name: 'A. Researcher', id: 'https://openalex.org/A123' } }],
      abstract_inverted_index: { Climate: [0], adaptation: [1], evidence: [2], coastal: [3], cities: [4] },
      primary_location: { source: { display_name: 'Climate Science Journal' } },
      cited_by_count: 12, open_access: { is_oa: true }, type: 'article', relevance_score: 0.98,
    }] }),
  }));
  await dataLab.route('https://export.arxiv.org/api/query**', route => route.fulfill({
    status: 200, contentType: 'application/atom+xml', headers: providerCors,
    body: '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>',
  }));
  await dataLab.route('https://www.ebi.ac.uk/europepmc/webservices/rest/search**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: providerCors, body: JSON.stringify({ resultList: { result: [] } }),
  }));
  await dataLab.route('https://api.crossref.org/works**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: providerCors, body: JSON.stringify({ message: { items: [] } }),
  }));
  await dataLab.route('https://api.semanticscholar.org/graph/v1/paper/search**', route => route.fulfill({
    status: 503, contentType: 'application/json', headers: providerCors, body: JSON.stringify({ message: 'test provider outage' }),
  }));
  const persistedGapPapers = [];
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/saved_papers**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { ...providerCors, 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', 'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info, prefer' } });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', headers: providerCors, body: JSON.stringify(persistedGapPapers) });
      return;
    }
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      const row = { id: 'saved-gap-paper-1', user_id: testUser.id, data: payload.data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      persistedGapPapers.push(row);
      const single = /vnd\.pgrst\.object\+json/i.test(request.headers().accept || '');
      await route.fulfill({ status: 201, contentType: 'application/json', headers: providerCors, body: JSON.stringify(single ? row : [row]) });
      return;
    }
    throw new Error(`Unexpected saved-paper method: ${request.method()}`);
  });
  await dataLab.route('https://eylo-auth-test.supabase.co/rest/v1/projects**', route => sendAuthJson(route, []));
  await dataLab.goto(`${baseUrl}/research-gaps`);
  await dataLab.getByRole('heading', { name: 'Research Gap Finder' }).waitFor();
  await dataLab.getByRole('textbox', { name: 'Search scholarly literature' }).fill('climate adaptation');
  await dataLab.getByRole('button', { name: 'Search literature' }).click();
  await dataLab.getByText('Climate adaptation evidence in coastal cities').waitFor();
  await dataLab.getByText(/4 of 5 sources responded/).waitFor();
  assert.equal(await dataLab.getByRole('button', { name: 'Find research gaps' }).isDisabled(), true,
    'retrieved but unsaved literature cannot enter analysis');
  await dataLab.getByRole('button', { name: 'Save to Library' }).click();
  await dataLab.getByText('Saved to Library and selected').waitFor();
  assert.equal(persistedGapPapers.length, 1, 'the authenticated persistence path stores the paper before it becomes analysis evidence');
  await dataLab.getByRole('button', { name: 'Already in Library' }).waitFor();
  await dataLab.reload();
  await dataLab.getByRole('heading', { name: 'Climate adaptation evidence in coastal cities' }).waitFor();
  assert.equal(await dataLab.getByRole('button', { name: 'Find research gaps' }).isDisabled(), true,
    'one saved paper is still below the two-paper analysis requirement');
  console.log('Research Gap Finder browser flow passed with provider-shaped fixtures and isolated authenticated persistence; live providers and production RLS were not exercised.');

  // Verify sign-out actually invalidates the session and protects private routes.
  await dataLab.setViewportSize({ width: 1365, height: 900 });
  await dataLab.route('**/auth/v1/logout**', route => route.fulfill({
    status: 204,
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
  }));
  await dataLab.getByRole('button', { name: 'Sign out of EYLO' }).click();
  await dataLab.getByRole('heading', { name: 'Continue your research' }).waitFor();
  await dataLab.goto(`${baseUrl}/projects`);
  await dataLab.getByRole('heading', { name: 'Continue your research' }).waitFor();
  assert.equal(new URL(dataLab.url()).pathname, '/login', 'private routes must remain protected after sign-out');

  console.log('Browser checks passed: auth, mobile registration, local CSV analysis, keyboard meeting access and source graph navigation.');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
}
