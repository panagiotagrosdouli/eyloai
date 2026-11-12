import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { readFile as readDataLabDownload } from 'node:fs/promises';
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
  const canary = 'SENSITIVE_LOCAL_CSV_CANARY_7729';
  const originalCsv = Buffer.from('sample,score\n' + canary + ',1\nB,2\nC,\n');
  const digestOf = content => createHash('sha256').update(content).digest('hex');
  const outboundCsvBodies = [];
  dataLab.on('request', request => {
    if (request.postData()?.includes(canary)) outboundCsvBodies.push(request.url());
  });
  await dataLab.goto(`${baseUrl}/labs/data`);
  await dataLab.getByRole('heading', { name: 'Research Data Lab' }).waitFor();
  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'study.csv',
    mimeType: 'text/csv',
    buffer: originalCsv,
  });
  await dataLab.getByRole('heading', { name: 'Column summary' }).waitFor();
  await dataLab.getByRole('row', { name: /score numeric 3 1 2 1.5/ }).waitFor();
  await dataLab.getByRole('img', { name: 'Bar chart of score by row number' }).waitFor();
  const summaryDownload = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export summary CSV' }).click();
  assert.equal((await summaryDownload).suggestedFilename(), 'research-data-summary.csv');
  await dataLab.getByText('Local file identity (SHA-256)').waitFor();
  await dataLab.getByText(digestOf(originalCsv), { exact: true }).waitFor();

  const qualityPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export quality JSON' }).click();
  const qualityDownload = await qualityPromise;
  assert.equal(qualityDownload.suggestedFilename(), 'research-data-quality.json');
  const qualityFile = JSON.parse(await readDataLabDownload(await qualityDownload.path(), 'utf8'));
  assert.equal(qualityFile.audit.totalRows, 3);
  assert.equal(qualityFile.provenance.sha256, digestOf(originalCsv));
  assert.equal(qualityFile.provenance.file_bytes, originalCsv.byteLength);
  assert.equal(qualityFile.provenance.columns, 2);
  assert.equal(JSON.stringify(qualityFile).includes(canary), false,
    'An aggregate export must not include private source CSV values');

  const modifiedCsv = Buffer.from('sample,score\nA,1\nB,2\nC,99\n');
  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'study-modified.csv', mimeType: 'text/csv', buffer: modifiedCsv,
  });
  await dataLab.getByText(digestOf(modifiedCsv), { exact: true }).waitFor();
  assert.notEqual(digestOf(modifiedCsv), digestOf(originalCsv));
  assert.equal(await dataLab.getByText(digestOf(originalCsv), { exact: true }).count(), 0,
    'Replacing a file must not expose the previous fingerprint');

  await dataLab.getByRole('button', { name: 'Clear data' }).click();
  await dataLab.getByRole('heading', { name: 'Column summary' }).waitFor({ state: 'detached' });
  assert.equal(await dataLab.getByText('Local file identity (SHA-256)').count(), 0,
    'Clear must remove the fingerprint');

  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'oversized.csv', mimeType: 'text/csv',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 65),
  });
  await dataLab.getByText('The CSV exceeds the 5 MB limit.').waitFor();
  assert.equal(await dataLab.getByText('Local file identity (SHA-256)').count(), 0);

  // 4,000 rows, ~99% of the 5 MiB bound, within field and row caps.
  const nearLimit = Buffer.from('sample,score\n' + ('x'.repeat(1294) + ',1\n').repeat(4000));
  assert.ok(nearLimit.byteLength < 5 * 1024 * 1024);
  assert.ok(nearLimit.byteLength > 0.98 * 5 * 1024 * 1024);
  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'near-limit.csv', mimeType: 'text/csv', buffer: nearLimit,
  });
  await dataLab.getByText(digestOf(nearLimit), { exact: true }).waitFor({ timeout: 60000 });

  await dataLab.getByRole('button', { name: 'Clear data' }).click();

  // A genuine browser without WebCrypto must not invent a digest.
  const disabled = await dataLab.evaluate(() => {
    Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: undefined });
    return window.crypto.subtle === undefined;
  });
  assert.equal(disabled, true);
  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'no-webcrypto.csv', mimeType: 'text/csv',
    buffer: Buffer.from('sample,score\nA,7\nB,8\n'),
  });
  await dataLab.getByText('File fingerprint unavailable in this browser. Data analysis remains local.').waitFor();
  const fallbackPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export quality JSON' }).click();
  const fallback = JSON.parse(await readDataLabDownload(await (await fallbackPromise).path(), 'utf8'));
  assert.equal(fallback.provenance, null);
  assert.deepEqual(outboundCsvBodies, [], 'No raw uploaded CSV bytes should appear in outbound requests');

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

  // Exercise Universal Search through its authenticated browser workflow using
  // the PostgREST RPC shape. One source outage must be reported as partial.
  let searchRpcCalls = 0;
  await dataLab.route('**/rest/v1/rpc/search_workspace_records', async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    const args = request.postDataJSON();
    assert.equal(args.p_query, 'climate');
    assert.ok(args.p_page_size <= 50);
    searchRpcCalls += 1;
    if (args.p_source === 'LifeGoal') {
      await route.fulfill({ status: 503, headers, body: JSON.stringify({ code: 'SOURCE_UNAVAILABLE', message: 'notes unavailable' }) });
      return;
    }
    const items = args.p_source === 'Project'
      ? [{ id: `project-${args.p_page}`, title: `Climate project ${args.p_page}`, snippet: 'Coastal research', score: 0.8, updated_date: '2026-11-12T00:00:00Z' }]
      : args.p_source === 'Note'
        ? [{ id: 'note-1', title: 'Climate note', snippet: 'Saved source-backed note', score: 0.8, updated_date: '2026-11-12T00:00:00Z' }]
        : [];
    await route.fulfill({ status: 200, headers, body: JSON.stringify({ total: args.p_source === 'Project' ? 21 : args.p_source === 'Note' ? 1 : 0, page: args.p_page, page_size: args.p_page_size, items }) });
  });
  await dataLab.route('**/rest/v1/rpc/search_private_files', async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    const args = request.postDataJSON();
    assert.equal(args.p_query, 'climate');
    assert.ok(args.p_page_size <= 50);
    await route.fulfill({ status: 200, headers, body: JSON.stringify({
      total: 1, page: args.p_page, page_size: args.p_page_size,
      items: [{ id: 'file-1', title: 'Climate protocol.md', snippet: 'Source screening workflow', score: 0.7, updated_date: '2026-11-12T00:00:00Z' }],
    }) });
  });
  await dataLab.route('**/rest/v1/notes**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    await route.fulfill({ status: 200, headers, body: JSON.stringify([{ id: 'note-1', user_id: testUser.id, updated_date: '2026-11-12T00:00:00Z', data: { title: 'Climate note', content: 'Saved source-backed note', tags: [], project_id: '' } }]) });
  });
  await dataLab.route('**/rest/v1/note_versions**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    await route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers, body: route.request().method() === 'OPTIONS' ? '' : '[]' });
  });
  await dataLab.route('**/rest/v1/projects**', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    await route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 200, headers, body: route.request().method() === 'OPTIONS' ? '' : '[]' });
  });
  await dataLab.goto(`${baseUrl}/workspace/search`);
  await dataLab.getByRole('heading', { name: 'Search your workspace' }).waitFor();
  await dataLab.getByRole('searchbox', { name: 'Search your records' }).fill('climate');
  await dataLab.getByRole('alert').getByText('Partial results:', { exact: false }).waitFor();
  await dataLab.getByRole('link', { name: 'Climate note' }).waitFor();
  await dataLab.getByRole('link', { name: 'Climate project 1' }).waitFor();
  const fileSearchResult = dataLab.getByRole('link', { name: 'Climate protocol.md' });
  await fileSearchResult.waitFor();
  assert.equal(await fileSearchResult.getAttribute('href'), '/files?focus=file-1');
  assert.equal(await dataLab.getByText('Page 1 of 2').isVisible(), true);
  assert.ok(searchRpcCalls >= 8, 'one bounded server search call is made per workspace source');
  await dataLab.getByRole('region', { name: 'Projects search results' }).getByRole('button', { name: 'Next' }).click();
  await dataLab.getByRole('link', { name: 'Climate project 2' }).waitFor();
  await dataLab.getByRole('link', { name: 'Climate note' }).click();
  assert.equal(new URL(dataLab.url()).pathname, '/notes');
  assert.equal(new URL(dataLab.url()).searchParams.get('focus'), 'note-1');
  await dataLab.getByLabel('Note title').waitFor();
  await dataLab.waitForFunction(() => document.querySelector('#note-title')?.value === 'Climate note');
  assert.equal(await dataLab.getByLabel('Note title').inputValue(), 'Climate note', 'record deep link should open the exact saved note');
  console.log('Universal Search rendered paginated results, partial source coverage and opened the exact note from an RPC-shaped response.');

  // EYLO Files browser workflow uses isolated PostgREST and Storage fixtures;
  // it exercises the real page and SDK calls without touching a live project.
  const filesPage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await filesPage.route('https://eylo-auth-test.supabase.co/auth/v1/token?grant_type=password', route => sendAuthJson(route, {
    access_token: 'eylo-files-e2e-access-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'eylo-files-e2e-refresh-token', user: testUser,
  }));
  await filesPage.route('https://eylo-auth-test.supabase.co/auth/v1/user**', route => sendAuthJson(route, testUser));
  const fileRows = [];
  const versionRows = [];
  const storedObjects = new Map();
  const storageReads = [];
  filesPage.on('request', request => {
    if (request.url().includes('/storage/v1/object/') && request.method() === 'GET') storageReads.push(request.url());
  });
  await filesPage.route('https://eylo-auth-test.supabase.co/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': '*',
    } });
    const table = url.pathname.split('/').at(-1);
    if (table === 'projects') return sendAuthJson(route, [{ id: 'file-project-1', user_id: testUser.id, data: { title: 'File project' } }]);
    if (table === 'eylo_files') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (request.method() === 'GET') return sendAuthJson(route, fileRows.filter(row => !id || row.id === id));
      if (request.method() === 'POST') {
        const row = { ...request.postDataJSON(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        fileRows.push(row); return sendAuthJson(route, row);
      }
      if (request.method() === 'PATCH') {
        const row = fileRows.find(item => item.id === id);
        if (!row) return sendAuthJson(route, []);
        Object.assign(row, request.postDataJSON(), { updated_at: new Date().toISOString() });
        return sendAuthJson(route, row);
      }
      if (request.method() === 'DELETE') {
        const index = fileRows.findIndex(item => item.id === id);
        const removed = index >= 0 ? fileRows.splice(index, 1) : [];
        return sendAuthJson(route, removed);
      }
    }
    if (table === 'eylo_file_versions') {
      if (request.method() === 'GET') {
        const ids = (url.searchParams.get('file_id') || '').match(/\((.*)\)/)?.[1]?.replaceAll('"', '').split(',') || [];
        const fileId = url.searchParams.get('file_id')?.replace('eq.', '');
        const versionId = url.searchParams.get('id')?.replace('eq.', '');
        const matchingRows = versionRows.filter(row => (!ids.length && !fileId || ids.includes(row.file_id) || row.file_id === fileId)
          && (!versionId || row.id === versionId))
          .sort((left, right) => right.version_number - left.version_number);
        return sendAuthJson(route, matchingRows);
      }
      if (request.method() === 'POST') {
        const row = { ...request.postDataJSON(), created_at: new Date().toISOString() };
        versionRows.push(row); return sendAuthJson(route, row);
      }
    }
    // The authenticated application shell also loads a private watchlist summary.
    // Keep this test fixture isolated and do not mistake that unrelated GET for
    // an EYLO Files request; other unexpected write operations still fail.
    if (['watchlists', 'monitoring_discoveries', 'notifications'].includes(table) && request.method() === 'GET') return sendAuthJson(route, []);
    throw new Error(`Unexpected EYLO Files database request ${request.method()} ${url.pathname}`);
  });
  await filesPage.route('https://eylo-auth-test.supabase.co/rest/v1/rpc/search_private_files', async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const args = request.postDataJSON();
    assert.equal(args.p_query, 'protocol');
    assert.ok(args.p_page_size <= 50);
    const file = fileRows.find(row => row.name.toLocaleLowerCase().includes(args.p_query));
    return route.fulfill({ status: 200, headers, body: JSON.stringify({
      total: file ? 1 : 0, page: args.p_page, page_size: args.p_page_size,
      items: file ? [{ id: file.id, title: file.name, snippet: file.description, score: 0.7, updated_date: file.updated_at }] : [],
    }) });
  });
  await filesPage.route('https://eylo-auth-test.supabase.co/storage/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': '*',
    } });
    if (request.method() === 'POST' && url.pathname.includes('/object/eylo-files/')) {
      const path = decodeURIComponent(url.pathname.split('/object/eylo-files/')[1]);
      storedObjects.set(path, request.postDataBuffer());
      return sendAuthJson(route, { Key: path });
    }
    if (request.method() === 'GET' && url.pathname.includes('/object/')) {
      const path = decodeURIComponent(url.pathname.split('/object/').at(-1).replace(/^authenticated\//, '').replace(/^eylo-files\//, ''));
      const bytes = storedObjects.get(path);
      if (!bytes) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ status: 200, body: bytes, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'content-type': 'text/plain',
      } });
    }
    if (request.method() === 'DELETE' && url.pathname.endsWith('/object/eylo-files')) {
      for (const path of request.postDataJSON().prefixes) storedObjects.delete(path);
      return sendAuthJson(route, []);
    }
    throw new Error(`Unexpected EYLO Files storage request ${request.method()} ${url.pathname}`);
  });
  await filesPage.goto(`${baseUrl}/login`);
  await filesPage.getByLabel('Email address').fill(testUser.email);
  await filesPage.getByLabel('Password').fill('Test-password-123');
  await filesPage.getByRole('button', { name: 'Continue with password' }).click();
  await filesPage.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached' });
  await filesPage.goto(`${baseUrl}/files`);
  await filesPage.getByRole('heading', { name: 'EYLO Files' }).waitFor();
  await filesPage.locator('input[type="file"]').setInputFiles({ name: 'protocol.txt', mimeType: 'text/plain', buffer: Buffer.from('version one') });
  await filesPage.getByText('protocol.txt', { exact: true }).waitFor();
  assert.equal(fileRows.length, 1);
  assert.equal(versionRows.length, 1);
  assert.equal(storedObjects.size, 1);
  await filesPage.getByLabel('File note').fill('Methods protocol');
  await filesPage.getByLabel('Link protocol.txt to a project').selectOption('file-project-1');
  await filesPage.getByRole('button', { name: 'Save details' }).click();
  await filesPage.getByText('Open linked project').waitFor();
  await filesPage.getByRole('button', { name: 'Upload new version' }).click();
  await filesPage.locator('input[type="file"]').setInputFiles({ name: 'protocol.txt', mimeType: 'text/plain', buffer: Buffer.from('version two') });
  await filesPage.getByText('New file version saved').waitFor({ timeout: 8000 });
  assert.equal(versionRows.length, 2, 'the browser submitted and persisted the second version row');
  await filesPage.getByText('Version 2 · latest').waitFor({ timeout: 8000 });
  assert.equal(versionRows.length, 2, 'each upload is stored as a separate immutable version');
  assert.equal(storedObjects.size, 2, 'the earlier object remains available after a replacement upload');
  const savedFileId = fileRows[0].id;
  await filesPage.goto(`${baseUrl}/workspace/search`);
  await filesPage.getByRole('heading', { name: 'Search your workspace' }).waitFor();
  await filesPage.getByLabel('Filter by source').selectOption('EyloFile');
  await filesPage.getByRole('searchbox', { name: 'Search your records' }).fill('protocol');
  await filesPage.getByRole('link', { name: 'protocol.txt' }).click();
  assert.equal(new URL(filesPage.url()).pathname, '/files');
  assert.equal(new URL(filesPage.url()).searchParams.get('focus'), savedFileId);
  await filesPage.getByRole('heading', { name: 'EYLO Files' }).waitFor();
  const focusedFileCard = filesPage.locator(`#eylo-file-${savedFileId}`);
  await focusedFileCard.waitFor({ timeout: 8000 });
  assert.match(await focusedFileCard.getAttribute('class'), /border-primary/, 'search deep link focuses the exact private file');
  await filesPage.reload();
  await filesPage.getByText('Methods protocol').waitFor();
  assert.equal(await filesPage.getByLabel('Link protocol.txt to a project').inputValue(), 'file-project-1');
  const versionDownload = filesPage.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await filesPage.getByRole('button', { name: 'Download' }).first().click();
  const downloadedVersion = await versionDownload;
  if (!downloadedVersion) throw new Error('EYLO file download failed: ' + JSON.stringify({
    storageReads, versionRows, alert: await filesPage.locator('[role="alert"]').allInnerTexts(),
    body: (await filesPage.locator('body').innerText()).slice(-1500),
  }));
  assert.equal(downloadedVersion.suggestedFilename(), 'protocol.txt');
  assert.equal(await readDataLabDownload(await downloadedVersion.path(), 'utf8'), 'version two',
    'the selected latest version must download the exact persisted bytes');
  await filesPage.getByRole('link', { name: 'Create a document' }).first().click();
  await filesPage.getByRole('heading', { name: 'Document Editor' }).waitFor();
  const editor = filesPage.getByLabel('Document text (Markdown)');
  await editor.fill('# Proposal\n\nA source-linked research plan.');
  await filesPage.getByRole('button', { name: 'Save version' }).click();
  await filesPage.getByRole('heading', { name: 'Document Editor' }).waitFor();
  await filesPage.getByText('All changes saved').waitFor();
  const markdownPath = new URL(filesPage.url()).pathname;
  assert.match(markdownPath, /^\/documents\/[\da-f-]+$/i);
  assert.equal(fileRows.length, 2);
  const editorBody = filesPage.getByLabel('Document text (Markdown)');
  await editorBody.fill('# Proposal\n\nRevised with a verified citation.');
  await filesPage.getByRole('button', { name: 'Save version' }).click();
  await filesPage.getByText(/Version 2 ·/).waitFor();
  await filesPage.reload();
  assert.equal(await filesPage.getByLabel('Document text (Markdown)').inputValue(), '# Proposal\n\nRevised with a verified citation.');
  const markdownExport = filesPage.waitForEvent('download');
  await filesPage.getByRole('button', { name: 'Export Markdown' }).click();
  assert.equal((await markdownExport).suggestedFilename(), 'Untitled research note.md');
  console.log('EYLO Files browser workflow passed against isolated PostgREST and Storage fixtures.');

  // Verify sign-out actually invalidates the session and protects private routes.
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
