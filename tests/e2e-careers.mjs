import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

// Browser fixtures verify UI behavior only; no hosted/source acceptance claim.
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* Starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/general-jobs', route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"source unavailable"}' }));
  let unavailable = true;
  let empty = false;
  await page.route('**/api/euraxess?**', route => {
    if (unavailable) return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"EURAXESS unavailable"}' });
    const index = Number(new URL(route.request().url()).searchParams.get('page') || 0);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      items: empty ? [] : [{ id: `role-${index}`, title: `Doctoral candidate in climate science ${index}`, country: 'France', source: 'EURAXESS', source_url: `https://euraxess.ec.europa.eu/jobs/${index + 100}` }],
      source_url: 'https://euraxess.ec.europa.eu/jobs/search', has_more: index === 0,
    }) });
  });
  await page.goto(`${origin}/careers`);
  await page.getByRole('textbox', { name: 'Research field or role' }).fill('PhD climate research');
  await page.getByRole('button', { name: 'Search roles' }).click();
  await page.getByText('Career listings are temporarily unavailable. Please retry.', { exact: true }).waitFor();
  unavailable = false;
  empty = true;
  await page.getByRole('button', { name: 'Retry search' }).click();
  await page.getByText('No matching roles in the available listings. Unavailable sources could not be evaluated.', { exact: true }).waitFor();
  await page.getByText(/Search coverage is incomplete/).waitFor();
  empty = false;
  await page.getByRole('button', { name: 'Retry search' }).click();
  await page.getByRole('heading', { name: 'Doctoral candidate in climate science 0', exact: true }).waitFor();
  await page.getByText(/Search coverage is incomplete/).waitFor();
  await page.getByRole('button', { name: 'Load more EURAXESS results' }).click();
  await page.getByRole('heading', { name: 'Doctoral candidate in climate science 1', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Open original listing' }).count(), 2);
  assert.equal(await page.getByRole('link', { name: 'Open original listing' }).first().getAttribute('href'), 'https://euraxess.ec.europa.eu/jobs/100');
  assert.equal(await page.getByRole('button', { name: 'Load more EURAXESS results' }).count(), 0);
  for (const width of [320, 390, 768, 1365]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px`);
  }
  console.log('PASS Careers browser fixtures: outage, retry, synonyms, partial coverage, pagination, original links, responsive widths.');
} finally {
  await browser?.close();
  const stopped = once(server, 'exit');
  server.kill('SIGTERM');
  await stopped;
}
