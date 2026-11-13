import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdir, readFile as readDataLabDownload } from 'node:fs/promises';
import { chromium } from 'playwright';
import { parseResearchCsv } from '../src/lib/research-data.mjs';

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

async function captureFixturePage(page, name) {
  const directory = process.env.EYLO_E2E_ARTIFACT_DIR;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
}

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
  await dataLab.getByRole('row', { name: /score numeric — — —/ }).waitFor();
  assert.match(await dataLab.locator('[role="note"]').first().innerText(), /aggregate-only export is not guaranteed to be anonymous/i);
  await dataLab.getByLabel('Minimum disclosure cell size').selectOption('1');
  await dataLab.getByRole('row', { name: /score numeric 3 1 2 1.5/ }).waitFor();
  await dataLab.getByRole('img', { name: 'Bar chart of score by row number' }).waitFor();
  const summaryDownload = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export summary CSV' }).click();
  const summaryFile = await summaryDownload;
  assert.equal(summaryFile.suggestedFilename(), 'research-data-summary.csv');
  const summaryCsv = await readDataLabDownload(await summaryFile.path(), 'utf8');
  const parsedSummary = parseResearchCsv(summaryCsv);
  assert.equal(parsedSummary.headers.includes('Disclosure'), true);
  assert.ok(parsedSummary.rows.every(row => row.length === parsedSummary.headers.length));
  assert.equal(summaryCsv.includes(canary), false, 'summary export must not contain raw source text');
  await dataLab.getByText('Local file identity (SHA-256)').waitFor();
  await dataLab.getByText(digestOf(originalCsv), { exact: true }).waitFor();
  await dataLab.getByRole('button', { name: 'Save metadata to Data Catalog' }).click();
  await dataLab.getByRole('status').filter({ hasText: 'Dataset metadata saved in this browser.' }).waitFor();
  assert.equal(await dataLab.getByRole('listitem').filter({ hasText: digestOf(originalCsv) }).count(), 1,
    'saved metadata must appear in the Data Catalog list');
  const catalogStorage = await dataLab.evaluate(() => localStorage.getItem('eylo.research-data-catalog.v1:eylo-e2e-user'));
  assert.ok(catalogStorage.includes(digestOf(originalCsv)));
  assert.equal(catalogStorage.includes(canary), false, 'the catalog must never persist raw CSV values');
  const catalogDownloadPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export catalog metadata' }).click();
  const catalogDownload = await catalogDownloadPromise;
  assert.equal(catalogDownload.suggestedFilename(), 'eylo-local-research-catalog.json');
  const exportedCatalog = JSON.parse(await readDataLabDownload(await catalogDownload.path(), 'utf8'));
  assert.equal(exportedCatalog.rawDataIncluded, false);
  assert.equal(exportedCatalog.anonymityGuaranteed, false);
  assert.equal(JSON.stringify(exportedCatalog).includes(canary), false);

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
  assert.equal(await dataLab.getByRole('listitem').filter({ hasText: digestOf(originalCsv) }).count(), 1,
    'Replacing the active file must not silently erase its separately saved catalog metadata');
  await dataLab.getByRole('button', { name: 'Remove study.csv from catalog' }).click();
  assert.equal(await dataLab.getByRole('listitem').filter({ hasText: digestOf(originalCsv) }).count(), 0,
    'Removing a catalog entry must remove its saved fingerprint');
  await dataLab.getByRole('button', { name: 'Save metadata to Data Catalog' }).click();
  await dataLab.getByRole('button', { name: 'Clear catalog' }).click();
  await dataLab.getByRole('button', { name: 'Confirm clear catalog' }).click();
  assert.equal(await dataLab.evaluate(() => localStorage.getItem('eylo.research-data-catalog.v1:eylo-e2e-user')), null,
    'Clear catalog must remove the browser-local metadata');

  await dataLab.getByRole('button', { name: 'Clear data' }).click();
  await dataLab.getByRole('heading', { name: 'Column summary' }).waitFor({ state: 'detached' });
  assert.equal(await dataLab.getByText('Local file identity (SHA-256)').count(), 0,
    'Clear must remove the fingerprint');

  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'relationship.csv', mimeType: 'text/csv',
    buffer: Buffer.from('hours,score\n1,2\n2,4\n3,6\n,8\n'),
  });
  await dataLab.getByLabel('Minimum disclosure cell size').selectOption('1');
  const comparisonStatus = dataLab.getByRole('status').filter({ hasText: 'Pearson correlation, r' });
  await comparisonStatus.waitFor();
  const comparisonText = await comparisonStatus.innerText();
  assert.match(comparisonText, /Pearson correlation, r\s+1/);
  assert.match(comparisonText, /Complete pairs used\s+3/);
  assert.match(comparisonText, /Rows skipped for blanks or non-numeric cells\s+1/);
  await dataLab.getByRole('img', { name: 'Scatter plot of hours against score using a sample of 3 complete rows' }).waitFor();
  const comparisonDownloadPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export comparison CSV' }).click();
  const comparisonDownload = await comparisonDownloadPromise;
  assert.equal(comparisonDownload.suggestedFilename(), 'research-variable-comparison.csv');
  const comparisonCsv = await readDataLabDownload(await comparisonDownload.path(), 'utf8');
  assert.match(comparisonCsv, /Pearson correlation \(r\)/);
  assert.match(comparisonCsv, /Complete pairs used/);
  assert.equal(comparisonCsv.includes(canary), false, 'comparison export must not include private source values');
  await dataLab.locator('input[type="file"]').setInputFiles({
    name: 'grouped-study.csv', mimeType: 'text/csv',
    buffer: Buffer.from('group,score\ncontrol,1\ncontrol,3\ntreatment,5\ntreatment,7\nrare,987654321\n,9\n'),
  });
  await dataLab.getByLabel('Minimum disclosure cell size').selectOption('5');
  await dataLab.getByText('Small groups below k=5 are omitted without showing their labels, counts, or numeric summaries.').waitFor();
  const suppressedExportPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export comparison CSV' }).click();
  const suppressedExport = await suppressedExportPromise;
  const suppressedCsv = await readDataLabDownload(await suppressedExport.path(), 'utf8');
  assert.equal(suppressedCsv.includes('control'), false);
  assert.equal(suppressedCsv.includes('treatment'), false);
  assert.equal(suppressedCsv.includes('rare'), false);
  assert.equal(suppressedCsv.includes('987654321'), false, 'the suppressed singleton value must not be exported');
  await dataLab.getByLabel('Minimum disclosure cell size').selectOption('1');
  await dataLab.getByText('Observed categories', { exact: true }).waitFor();
  await dataLab.getByRole('row', { name: /control 2 2 2 1\.4142 1 3/ }).waitFor();
  await dataLab.getByRole('row', { name: /treatment 2 6 6 1\.4142 5 7/ }).waitFor();
  await dataLab.setViewportSize({ width: 375, height: 812 });
  assert.equal(await dataLab.getByLabel('Comparison variable 1').isVisible(), true);
  assert.equal(await dataLab.getByLabel('Comparison variable 2').isVisible(), true);
  await captureFixturePage(dataLab, 'data-comparison-mobile');
  await dataLab.getByRole('button', { name: 'Export comparison CSV' }).scrollIntoViewIfNeeded();
  assert.equal(await dataLab.getByRole('button', { name: 'Export comparison CSV' }).isVisible(), true);
  const groupedExportPromise = dataLab.waitForEvent('download');
  await dataLab.getByRole('button', { name: 'Export comparison CSV' }).click();
  const groupedExport = await groupedExportPromise;
  const groupedCsv = await readDataLabDownload(await groupedExport.path(), 'utf8');
  assert.match(groupedCsv, /"Category","Count","Mean","Median","Sample SD","Minimum","Maximum"/);
  assert.match(groupedCsv, /"control","2","2","2"/);
  const parsedGrouped = parseResearchCsv(groupedCsv);
  assert.ok(parsedGrouped.rows.every(row => row.length === parsedGrouped.headers.length));
  assert.equal(groupedCsv.includes(canary), false, 'grouped export must not contain the unrelated raw source text');
  await dataLab.setViewportSize({ width: 1365, height: 900 });
  await dataLab.getByRole('button', { name: 'Clear data' }).click();

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
      if (request.method() === 'GET') {
        const rows = fileRows.filter(row => (!id || row.id === id) && row.user_id === testUser.id);
        return sendAuthJson(route, request.headers().accept?.includes('application/vnd.pgrst.object+json') ? rows[0] : rows);
      }
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
        const matchingRows = versionRows.filter(row => (ids.includes(row.file_id) || row.file_id === fileId) && (!versionId || row.id === versionId) && row.user_id === testUser.id)
          .sort((left, right) => right.version_number - left.version_number);
        const limit = Number(url.searchParams.get('limit')) || matchingRows.length;
        return sendAuthJson(route, request.headers().accept?.includes('application/vnd.pgrst.object+json') ? matchingRows[0] : matchingRows.slice(0, limit));
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
      const form = await new Response(request.postDataBuffer(), { headers: { 'content-type': request.headers()['content-type'] } }).formData();
      const uploadedFile = [...form.values()].find(value => typeof value !== 'string');
      assert.ok(uploadedFile, 'the upload must include file bytes');
      storedObjects.set(path, Buffer.from(await uploadedFile.arrayBuffer()));
      return sendAuthJson(route, { Key: path });
    }
    if (request.method() === 'GET' && url.pathname.includes('/object/')) {
      const path = decodeURIComponent(url.pathname.split('/object/').at(-1).replace(/^authenticated\//, '').replace(/^eylo-files\//, ''));
      const bytes = storedObjects.get(path);
      if (!bytes) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ status: 200, body: bytes, headers: { 'content-type': 'text/plain' } });
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
  try {
    await focusedFileCard.waitFor({ timeout: 8000 });
  } catch (cause) {
    console.log('EYLO FILE FOCUS DIAGNOSTIC', JSON.stringify({ fileRows, url: filesPage.url(), body: (await filesPage.locator('body').innerText()).slice(-1800) }));
    throw cause;
  }
  assert.match(await focusedFileCard.getAttribute('class'), /border-primary/, 'search deep link focuses the exact private file');
  await filesPage.reload();
  await filesPage.getByText('Methods protocol').waitFor();
  assert.equal(await filesPage.getByLabel('Link protocol.txt to a project').inputValue(), 'file-project-1');
  const versionDownload = filesPage.waitForEvent('download');
  await filesPage.getByRole('button', { name: 'Download' }).first().click();
  assert.equal((await versionDownload).suggestedFilename(), 'protocol.txt');
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
  await filesPage.getByRole('option', { name: /Version 2 ·/ }).waitFor({ state: 'attached' });
  await filesPage.getByText('All changes saved').waitFor();
  await filesPage.reload();
  await filesPage.getByText('All changes saved').waitFor();
  assert.equal(await filesPage.getByLabel('Document text (Markdown)').inputValue(), '# Proposal\n\nRevised with a verified citation.');
  const markdownExport = filesPage.waitForEvent('download');
  await filesPage.getByRole('button', { name: 'Export Markdown' }).click();
  assert.equal((await markdownExport).suggestedFilename(), 'Untitled research note.md');
  await captureFixturePage(filesPage, 'document-editor-mobile');
  await filesPage.setViewportSize({ width: 1365, height: 900 });
  await captureFixturePage(filesPage, 'document-editor-wide');
  console.log('EYLO Files browser workflow passed against isolated PostgREST and Storage fixtures.');
  // Exercise structured workplan creation, dependency/progress UI, optimistic
  // persistence and reload against a provider-shaped PostgREST fixture.
  const workplanId = 'workplan-e2e-1';
  let workplanData = { title: 'Workplan E2E project', goal: 'Verify project task persistence', status: 'active', plan_items: [] };
  let workplanVersion = '2026-11-12T00:00:00.000Z';
  const workplanRow = () => ({
    id: workplanId, user_id: testUser.id, created_at: '2026-11-11T00:00:00.000Z', updated_at: workplanVersion,
    data: workplanData,
  });
  let workplanWrites = 0;
  const workplanPostgrestFixture = async route => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').at(-1);
    if (table !== 'projects') {
      await route.fallback();
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return;
    }
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (request.method() === 'GET') {
      if (url.searchParams.get('id') === `eq.${workplanId}`) {
        await route.fulfill({ status: 200, headers, body: JSON.stringify(workplanRow()) });
      } else {
        await route.fulfill({ status: 200, headers, body: JSON.stringify([workplanRow()]) });
      }
      return;
    }
    if (request.method() === 'PATCH') {
      assert.equal(url.searchParams.get('id'), `eq.${workplanId}`);
      assert.equal(url.searchParams.get('user_id'), `eq.${testUser.id}`, 'every update must remain owner-scoped');
      const expectedVersion = url.searchParams.get('updated_date')?.replace(/^eq\./, '');
      assert.ok(expectedVersion, 'every workplan update must carry its loaded version');
      if (expectedVersion !== workplanVersion) {
        await route.fulfill({ status: 200, headers, body: '[]' });
        return;
      }
      const body = request.postDataJSON();
      workplanData = { ...workplanData, ...(body.data || {}) };
      workplanVersion = new Date(Date.parse(workplanVersion) + 1000).toISOString();
      workplanWrites += 1;
      await route.fulfill({ status: 200, headers, body: JSON.stringify(workplanRow()) });
      return;
    }
    throw new Error(`Unexpected workplan request: ${request.method()} ${request.url()}`);
  };
  await dataLab.route('**/rest/v1/**', workplanPostgrestFixture);
  await dataLab.goto(`${baseUrl}/projects/${workplanId}`);
  const workplanProjectTitle = dataLab.getByPlaceholder('Project title');
  await workplanProjectTitle.waitFor();
  assert.equal(await workplanProjectTitle.inputValue(), 'Workplan E2E project');
  await dataLab.getByRole('button', { name: 'Timeline' }).click();
  await dataLab.locator('#workplan-new-title').fill('Approve protocol');
  await dataLab.getByLabel('Deliverable (optional)').fill('Approved protocol document');
  await dataLab.getByLabel('Target date (optional)').fill('2026-12-01');
  await dataLab.getByRole('button', { name: 'Add task' }).click();
  await dataLab.locator('#workplan-new-title').fill('Collect data');
  await dataLab.getByLabel('Deliverable (optional)').fill('De-identified dataset');
  await dataLab.getByLabel('Depends on (optional)').selectOption({ label: 'Approve protocol' });
  await dataLab.getByRole('button', { name: 'Add task' }).click();
  await dataLab.getByLabel('Status', { exact: true }).first().selectOption('done');
  await dataLab.getByText('50%', { exact: true }).waitFor();
  await dataLab.getByRole('button', { name: 'Save workplan' }).click();
  await dataLab.getByText('Workplan saved').waitFor();
  assert.equal(workplanWrites, 1);
  assert.equal(workplanData.plan_items.length, 2);
  assert.deepEqual(workplanData.plan_items[1].depends_on, [workplanData.plan_items[0].id]);
  await dataLab.reload();
  await dataLab.getByRole('button', { name: 'Timeline' }).click();
  await dataLab.getByLabel('Task', { exact: true }).nth(2).waitFor();
  assert.equal(await dataLab.getByLabel('Deliverable', { exact: true }).nth(1).inputValue(), 'De-identified dataset');
  assert.equal(await dataLab.getByLabel('Target date', { exact: true }).first().inputValue(), '2026-12-01');
  assert.equal(workplanWrites, 1, 'reopening the project reads the saved plan without creating a duplicate write');

  // Two separately authenticated browser sessions load one version. Session A
  // commits; session B's stale compare-and-set must conflict and keep its draft.
  const peerStorage = await dataLab.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const peerSession = await browser.newPage();
  await peerSession.addInitScript(storage => { for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value); }, peerStorage);
  await peerSession.route('**/auth/v1/user**', route => sendAuthJson(route, testUser));
  await peerSession.route('**/rest/v1/**', workplanPostgrestFixture);
  await peerSession.goto(`${baseUrl}/projects/${workplanId}`);
  await peerSession.getByPlaceholder('Project title').waitFor();
  await peerSession.getByRole('button', { name: 'Timeline' }).click();
  await dataLab.getByLabel('Deliverable', { exact: true }).nth(1).fill('Session A committed deliverable');
  await peerSession.getByLabel('Deliverable', { exact: true }).nth(1).fill('Session B recoverable draft');
  await dataLab.getByRole('button', { name: 'Save workplan' }).click();
  await dataLab.getByText('Workplan saved').waitFor();
  await peerSession.getByRole('button', { name: 'Save workplan' }).click();
  await peerSession.getByRole('alert').getByText('This project changed in another session.', { exact: false }).waitFor();
  assert.equal(await peerSession.getByLabel('Deliverable', { exact: true }).nth(1).inputValue(), 'Session B recoverable draft');
  assert.equal(workplanData.plan_items[1].deliverable, 'Session A committed deliverable');
  assert.equal(workplanWrites, 2, 'the stale session must not produce a second server write');
  await peerSession.close();
  console.log('Structured project workplan persistence and reload passed against isolated PostgREST fixtures.');
  await captureFixturePage(dataLab, 'project-workplan-wide');
  await dataLab.setViewportSize({ width: 390, height: 844 });
  assert.equal(await dataLab.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true,
    'project header and workplan must fit the mobile viewport');
  await captureFixturePage(dataLab, 'project-workplan-mobile');
  await dataLab.setViewportSize({ width: 1365, height: 900 });
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
  await dataLab.getByText('Climate adaptation evidence in coastal cities', { exact: true }).waitFor();
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
