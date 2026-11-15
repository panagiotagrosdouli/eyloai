// Opt-in authenticated UX smoke checks. Read-only, no account mutations.
// Run with EYLO_E2E_BASE_URL and EYLO_E2E_STORAGE_STATE (Playwright storage state).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.EYLO_E2E_BASE_URL?.replace(/\/$/, '');
const storageState = process.env.EYLO_E2E_STORAGE_STATE;
if (!base || !storageState) {
  throw new Error('Set EYLO_E2E_BASE_URL and EYLO_E2E_STORAGE_STATE for an authorized, already signed-in test account. No credentials are stored in this script.');
}
const widths = [320, 390, 768, 1024, 1440];
const artifactDir = process.env.EYLO_E2E_ARTIFACT_DIR;
const browser = await chromium.launch({ headless: true });
const observations = [];
const screens = ['/home', '/search', '/projects', '/library', '/study-planner', '/opportunities', '/tools', '/research-journey'];
try {
  for (const width of widths) {
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ storageState, viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
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
        if (artifactDir) {
          await mkdir(artifactDir, { recursive: true });
          await page.screenshot({ path: path.join(artifactDir, `${width}-${colorScheme}-${route.slice(1).replaceAll('/', '-')}.png`), fullPage: true, animations: 'disabled' });
        }
        observations.push({ route, width, colorScheme, navigationMs: Date.now() - begin, pageErrors: [...pageErrors] });
      }
      assert.deepEqual(pageErrors, [], 'Unexpected browser errors at ' + width + 'px');
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (artifactDir) {
  await writeFile(path.join(artifactDir, 'ux-observations.json'), JSON.stringify(observations, null, 2));
}
console.log(`EYLO authenticated UX smoke checks passed: ${observations.length} route/viewport/theme observations.`);
