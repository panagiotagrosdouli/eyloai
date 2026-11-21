import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const out = await mkdtemp(path.join(tmpdir(), 'eylo-company-pages-'));
const env = {
  ...process.env,
  EYLO_GITHUB_PAGES: 'true',
  VITE_SUPABASE_URL: 'https://eylo-landing-fixture.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'company-browser-public-fixture',
};
const origin = 'http://127.0.0.1:' + port;
const base = origin + '/eyloai/';
let browser, server;

async function screenshot(page, name) {
  const dir = process.env.EYLO_E2E_ARTIFACT_DIR;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, name + '.png'), fullPage: true });
}

try {
  const build = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir'], { env, stdio: 'pipe' });
  let output = '';
  build.stdout.on('data', chunk => { output += chunk; });
  build.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(build, 'exit');
  assert.equal(code, 0, output.slice(-3000));

  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', out, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { env, stdio: 'ignore' });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, 'production Pages preview starts');

  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await context.route('**/api/capabilities', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contact: false }) }));
  const page = await context.newPage();
  const errors = [], badAssets = [];
  let authRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(origin) && /\/(assets|brand)\//.test(response.url())) badAssets.push(response.url());
  });
  page.on('request', request => {
    if (request.url().includes('/auth/v1/')) authRequests += 1;
  });

  await page.goto(base);
  await page.getByRole('heading', { level: 1 }).waitFor();
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
  assert.match(await page.getByRole('heading', { level: 1 }).innerText(), /One place to ask, learn[\s\S]*create and do more/);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://panagiotagrosdouli.github.io/eyloai/');
  for (const heading of ['From your idea to your next step.', 'What would you like to do?', 'Stay in control of important decisions.', 'Good questions, clear answers.']) {
    assert.ok(await page.getByRole('heading').filter({ hasText: heading }).count(), heading);
  }

  // Each visitor goal has a real matching destination, not the same research link.
  for (const label of ['Ask & explore', 'Learn & create', 'Plan & organize', 'Research & evidence']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    const href = await page.getByRole('link', { name: 'Explore this path' }).getAttribute('href');
    if (label === 'Research & evidence') assert.match(href, /discover/);
    else assert.doesNotMatch(href, /^\/discover$/);
  }
  await page.getByRole('button', { name: 'Ask & explore', exact: true }).click();

  // FAQ is keyboard-accessible and doesn't trigger an AI request.
  const question = page.locator('summary').filter({ hasText: 'How is EYLO different from ChatGPT?' });
  await question.focus();
  await page.keyboard.press('Enter');
  assert.equal(await question.evaluate(el => el.parentElement.open), true);
  await page.keyboard.press('Enter');
  assert.equal(await question.evaluate(el => el.parentElement.open), false);
  for (const anchor of await page.locator('a[href^="#"]').all()) {
    const href = await anchor.getAttribute('href');
    assert.equal(await page.locator(href).count(), 1, href + ' resolves uniquely');
  }
  assert.equal(authRequests, 0, 'public landing makes no implicit authentication calls');
  await screenshot(page, 'company-landing-desktop');

  // Appearance preferences work regardless of which persona was selected.
  const chooser = page.getByRole('complementary', { name: 'Choose your EYLO appearance' });
  if (await chooser.count()) await chooser.getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to night mode', exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
  await page.reload();
  await page.getByRole('button', { name: 'Switch to day mode', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
  await screenshot(page, 'company-landing-night');

  for (const route of ['company', 'contact', 'plans', 'discover', 'find-researchers', 'login', 'register', 'forgot-password']) {
    await page.goto(base + route);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true, route + ' retains theme');
    await page.setViewportSize({ width: 320, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route + ' fits 320px');
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  await page.goto(base);
  await page.getByRole('button', { name: 'Switch to day mode', exact: true }).click();
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'landing fits width ' + width);
    if (width < 1024) {
      const menu = page.getByRole('button', { name: 'Open menu', exact: true });
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate(el => document.activeElement === el), true, 'Escape restores menu focus');
    await menu.click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Choose your starting point' }).click();
    assert.equal(new URL(page.url()).pathname, '/eyloai/start');
      await page.goto(base);
    }
    if (width === 390) await screenshot(page, 'company-landing-mobile');
  }

  await page.goto(base);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');

  await page.getByRole('link', { name: 'What we do', exact: true }).click();
  await page.getByRole('heading', { name: 'From questions to clarity.', exact: true }).waitFor();
  await page.goto(base);
  await page.getByRole('link', { name: 'Explore EYLO', exact: true }).first().click();
  assert.equal(new URL(page.url()).pathname, '/eyloai/start');
  assert.deepEqual(badAssets, [], 'brand and built assets resolve under Pages base');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS: all-purpose landing navigation, accessible goals, FAQ, light/dark, Pages base, mobile320/390/768/1024, public routes and keyboard navigation; no implicit authentication.');
} finally {
  await browser?.close();
  server?.kill('SIGTERM');
}
