// Opt-in authenticated UX smoke checks. Read-only, no account mutations.
// Run with EYLO_E2E_BASE_URL and EYLO_E2E_STORAGE_STATE (Playwright storage state).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarizeUxObservations } from '../src/lib/ux-observation-summary.mjs';

const base = process.env.EYLO_E2E_BASE_URL?.replace(/\/$/, '');
const storageState = process.env.EYLO_E2E_STORAGE_STATE;
if (!base || !storageState) {
  throw new Error('Set EYLO_E2E_BASE_URL and EYLO_E2E_STORAGE_STATE for an authorized, already signed-in test account. No credentials are stored in this script.');
}
const widths = [320, 390, 768, 1024, 1440];
const artifactDir = process.env.EYLO_E2E_ARTIFACT_DIR;
const allowScreenshots = process.env.EYLO_E2E_ALLOW_SCREENSHOTS === '1';
const browser = await chromium.launch({ headless: true });
const observations = [];
const screens = ['/home', '/search', '/projects', '/library', '/study-planner', '/opportunities', '/tools', '/research-journey'];
try {
  for (const width of widths) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ storageState, viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        const supported = window.PerformanceObserver?.supportedEntryTypes || [];
        window.__eyloUxVitals = { lcpMs: null, cls: supported.includes('layout-shift') ? 0 : null, clsEntries: 0 };
        if (supported.includes('largest-contentful-paint')) {
          try {
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) window.__eyloUxVitals.lcpMs = entry.startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
          } catch { /* null means not measured, not 0. */ }
        }
        if (supported.includes('layout-shift')) {
          try {
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                  window.__eyloUxVitals.cls += entry.value;
                  window.__eyloUxVitals.clsEntries += 1;
                }
              }
            }).observe({ type: 'layout-shift', buffered: true });
          } catch { window.__eyloUxVitals.cls = null; }
        }
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', () => pageErrors.push('Uncaught browser exception (details omitted for privacy)'));
      for (const route of screens) {
        const begin = Date.now();
        await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15000 });
        assert.ok(!page.url().includes('/login'), 'Not authenticated on ' + route);
        assert.equal(await page.locator('main#main-content').count(), 1, 'Missing primary landmark');
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        assert.ok(documentWidth <= viewportWidth + 2, `Horizontal page overflow at ${route}, ${width}px: ${documentWidth}px`);
        if (route === '/home') {
          await page.getByRole('heading', { name: 'What would you like to work on?' }).waitFor();
          await page.getByRole('button', { name: 'Start researching' }).waitFor();
        }
        if (route === '/research-journey') {
          await page.getByRole('heading', { name: 'Research Journey' }).waitFor();
          await page.getByRole('combobox', { name: 'Research project' }).waitFor();
          await page.getByRole('button', { name: 'Refresh progress' }).waitFor();
        }
        if (route === '/tools') {
          await page.getByRole('searchbox', { name: 'Find a tool or task' }).fill('study plan');
          await page.getByRole('link', { name: /Make a study plan/i }).waitFor();
          await page.getByRole('searchbox', { name: 'Find a tool or task' }).fill('thesis');
          await page.getByRole('link', { name: /Organize my thesis/i }).waitFor();
        }
        // Bound the lab observation interval; do not claim field stability or INP.
        await page.waitForTimeout(500);
        const vitals = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0];
          return {
            lcpMs: window.__eyloUxVitals?.lcpMs ?? null,
            cls: window.__eyloUxVitals?.cls ?? null,
            clsEntries: window.__eyloUxVitals?.clsEntries ?? null,
            domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : null,
          };
        });
        const navigationMs = Date.now() - begin;
        if (artifactDir && allowScreenshots) {
          await mkdir(artifactDir, { recursive: true });
          await page.screenshot({ path: path.join(artifactDir, `${width}-${colorScheme}-${route.slice(1).replaceAll('/', '-')}.png`), fullPage: true, animations: 'disabled' });
        }
        observations.push({ route, width, colorScheme, navigationMs,
          lcpMs: vitals.lcpMs, cls: vitals.cls, clsEntries: vitals.clsEntries,
          domContentLoadedMs: vitals.domContentLoadedMs,
          inpMs: null, // INP needs representative real interactions; never synthesize it.
          pageErrors: pageErrors.splice(0) });
      }
      assert.equal(observations.filter(item => item.width === width && item.colorScheme === colorScheme).flatMap(item => item.pageErrors).length, 0,
        'Unexpected browser errors at ' + width + 'px');
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (artifactDir) {
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, 'ux-observations.json'), JSON.stringify(observations, null, 2));
  await writeFile(path.join(artifactDir, 'ux-summary.json'), JSON.stringify(summarizeUxObservations(observations), null, 2));
}
console.log(`EYLO authenticated UX smoke checks passed: ${observations.length} route/viewport/theme observations.`);
