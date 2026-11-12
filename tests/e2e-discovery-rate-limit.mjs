import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const providers = ['openalex_works', 'arxiv', 'europe_pmc', 'crossref', 'semantic_scholar'];
const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
  env: process.env,
  stdio: 'ignore',
});
let browser;

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited with status ${server.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/discover`);
      if (response.ok) return;
    } catch {
      // The preview is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Vite preview did not become ready within 30 seconds.');
}

try {
  await waitForServer();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });

  const limited = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const seenProviders = new Set();
  await limited.route('**/api/discovery**', async route => {
    const provider = new URL(route.request().url()).searchParams.get('provider');
    if (provider) seenProviders.add(provider);
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store', 'retry-after': '9' },
      body: JSON.stringify({
        code: 'DISCOVERY_RATE_LIMITED',
        error: 'Too many scholarly searches from this network. Try again shortly.',
      }),
    });
  });

  await limited.goto(`${baseUrl}/discover?q=${encodeURIComponent('climate adaptation in coastal cities')}`);
  const eyloMessage = 'EYLO public search limit reached for this network; wait before retrying';
  await limited.getByText(eyloMessage, { exact: true }).waitFor();
  assert.equal(await limited.getByText(eyloMessage, { exact: true }).count(), 1,
    'one EYLO throttle should not be repeated once for every index');
  assert.ok([...providers].every(provider => seenProviders.has(provider)),
    `expected all paper indexes to report EYLO throttling; saw ${[...seenProviders].join(', ')}`);
  assert.match(await limited.locator('body').innerText(), /No records have been invented/);
  assert.equal(await limited.getByRole('button', { name: 'Retry live retrieval' }).isVisible(), true,
    'retry remains available on a mobile viewport');

  const retryResponses = providers.map(provider => limited.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/discovery'
      && url.searchParams.get('provider') === provider
      && response.status() === 429;
  }));
  await limited.getByRole('button', { name: 'Retry live retrieval' }).click();
  await Promise.all(retryResponses);
  await limited.getByText(eyloMessage, { exact: true }).waitFor();

  const providerLimited = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await providerLimited.route('**/api/discovery**', async route => {
    const provider = new URL(route.request().url()).searchParams.get('provider');
    if (provider === 'openalex_works') {
      await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'provider quota' }) });
      return;
    }
    const body = provider === 'arxiv'
      ? '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'
      : provider === 'europe_pmc'
        ? { resultList: { result: [] } }
        : provider === 'crossref'
          ? { message: { items: [] } }
          : provider === 'semantic_scholar'
            ? { data: [] }
            : { results: [] };
    await route.fulfill({
      status: 200,
      contentType: provider === 'arxiv' ? 'application/atom+xml' : 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  });

  await providerLimited.goto(`${baseUrl}/discover?q=${encodeURIComponent('coastal erosion')}`);
  await providerLimited.getByText(/OpenAlex is rate limited \(HTTP 429\)/).waitFor();
  assert.equal(await providerLimited.getByText('EYLO public search limit reached for this network; wait before retrying').count(), 0,
    'an upstream provider 429 must not be attributed to EYLO');
  console.log('Public discovery browser rate-limit regression passed on mobile and desktop.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  if (server.exitCode === null) {
    await new Promise(resolve => {
      server.once('exit', resolve);
      setTimeout(resolve, 2_000).unref();
    });
  }
}
