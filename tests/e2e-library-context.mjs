// Browser + actual Supabase client against isolated HTTP fixtures only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const host = `http://127.0.0.1:${port}`, sb = 'https://eylo-library-fixture.supabase.co';
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'library@example.org', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
const projectA = '10000000-0000-4000-8000-000000000001', projectB = '10000000-0000-4000-8000-000000000002';
const emptyProject = '10000000-0000-4000-8000-000000000003';
const paperB = '20000000-0000-4000-8000-000000000001', paperB2 = '20000000-0000-4000-8000-000000000002';
const row = (id, data) => ({ id, user_id: user.id, data, created_date: '2026-11-16T00:00:00Z', updated_date: '2026-11-16T00:00:00Z' });
const recentCount = process.env.EYLO_LIBRARY_REPRO === '1' ? 2 : 1001;
const tables = {
  projects: [row(projectA, { title: 'Current project' }), ...Array.from({ length: recentCount - 1 }, (_, index) => row(randomUUID(), { title: `Other project ${index}` })), row(projectB, { title: 'Older selected project', goal: 'Preserve project evidence' }), row(emptyProject, { title: 'Empty project' })],
  saved_papers: [
    ...Array.from({ length: recentCount }, (_, index) => row(randomUUID(), { title: `Recent unrelated paper ${index}`, project_id: projectA })),
    row(paperB, { title: 'Older focused publication', doi: '10.1234/retained', authors: 'Fixture Author', project_id: projectB, url: 'javascript:window.__unsafeLibraryLink=true' }),
    row(paperB2, { title: 'Second selected publication', doi: '10.1234/second', project_id: projectB, url: 'https://publisher.example/second' }),
  ],
  saved_researchers: [row(randomUUID(), { name: 'Selected project researcher', project_id: projectB, profile_url: 'https://user:secret@publisher.example/profile' }), row(randomUUID(), { name: 'Unrelated researcher', project_id: projectA })],
  saved_opportunities: [row(randomUUID(), { title: 'Selected project funding', project_id: projectB, url: 'data:text/html,unsafe' }), row(randomUUID(), { title: 'Unrelated funding', project_id: projectA })],
};
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
const json = (route, value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: sb, VITE_SUPABASE_ANON_KEY: 'library-public-fixture' }, stdio: 'ignore',
});
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(host)).ok) break; } catch { /* starting */ }
    if (attempt === 99 || server.exitCode !== null) throw new Error('Library fixture server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [], reads = [];
    let failFocused = false, injectForeign = false;
    let releaseDelayed, delayedStarted;
    let holdProjectB = false;
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/api/capabilities', route => json(route, { ai: false, billing: false }));
    await context.route(`${sb}/**`, async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/token')) return json(route, { user, access_token: 'library-fixture-access', refresh_token: 'library-fixture-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 });
      if (url.pathname.endsWith('/user')) return json(route, user);
      if (url.pathname.endsWith('/logout')) return json(route, {});
      const table = url.pathname.split('/').at(-1);
      if (!(table in tables)) return json(route, []);
      const filters = [...url.searchParams].filter(([, value]) => value.startsWith('eq.'));
      assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`, 'Private reads must carry the owner predicate');
      const target = url.searchParams.get('data');
      const expectedData = target?.startsWith('cs.') ? JSON.parse(target.slice(3)) : null;
      reads.push({ table, id: url.searchParams.get('id'), projectId: expectedData?.project_id });
      if (table === 'saved_papers' && failFocused && url.searchParams.get('id') === `eq.${paperB}`) return json(route, { message: 'Temporary failure' }, 503);
      let rows = tables[table].filter(row => filters.every(([key, value]) => String(row[key]) === value.slice(3))
        && (!expectedData || Object.entries(expectedData).every(([key, value]) => row.data[key] === value)));
      if (request.method() === 'PATCH') rows.forEach(row => Object.assign(row, { ...request.postDataJSON(), updated_date: new Date().toISOString() }));
      else assert.equal(request.method(), 'GET', 'Fixture permits only the explicit project-link write');
      if (table === 'saved_papers' && expectedData?.project_id === projectB && holdProjectB) {
        delayedStarted();
        await new Promise(resolve => { releaseDelayed = resolve; });
      }
      if (table === 'saved_papers' && expectedData?.project_id === projectB && injectForeign) rows = [row(paperB, { title: 'Foreign owner canary', project_id: projectB })].map(row => ({ ...row, user_id: '00000000-0000-4000-8000-000000000002' }));
      const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
      if (single && !rows.length) return json(route, { code: 'PGRST116', message: 'No visible row' }, 406);
      return json(route, single ? rows[0] : rows.slice(0, Number(url.searchParams.get('limit')) || rows.length));
    });
    await page.goto(host + '/login');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password').fill('Synthetic-fixture-password');
    await page.getByRole('button', { name: 'Continue with password' }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'));

    await page.goto(`${host}/library?focus=${paperB}`);
    await page.waitForFunction(() => document.querySelector('h4') || document.querySelector('main [role="alert"]'));
    assert.deepEqual(await page.locator('main h4').allTextContents(), ['Older focused publication'], 'An exact old-paper link must render that paper only, rather than unrelated recent records');
    assert.equal(await page.getByRole('link', { name: 'Open source for Older focused publication', exact: true }).count(), 0, 'Executable source URLs must not become links');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export RIS', exact: true }).click();
    const content = await readFile(await (await download).path(), 'utf8');
    assert.match(content, /TI  - Older focused publication/);
    assert.equal([...content.matchAll(/^TY  - /gm)].length, 1);
    assert.doesNotMatch(content, /Recent unrelated|javascript:/);
    const beforeOwnerMismatch = reads.length;
    assert.equal(await page.evaluate(async () => {
      const { supabaseEntities } = await import('/src/services/supabase-entities.js');
      try { await supabaseEntities.SavedPaper.filter({}, '-created_date', 1000, 'different-owner'); }
      catch (error) { return error.code; }
    }), 'ENTITY_OWNER_CHANGED');
    assert.equal(reads.length, beforeOwnerMismatch, 'Expected-owner mismatch is rejected before a private table query');

    await page.goto(`${host}/research-journey?project_id=${projectB}`);
    await page.getByRole('heading', { name: 'Recently linked research records', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Open Library', exact: true }).getAttribute('href'), `/library?project_id=${projectB}`);
    await page.getByRole('link', { name: 'Open Library', exact: true }).click();
    await page.getByRole('heading', { name: 'Older focused publication', exact: true }).waitFor();
    assert.deepEqual(await page.locator('main h4').allTextContents(), ['Older focused publication', 'Second selected publication']);
    assert.equal(await page.getByRole('combobox', { name: 'Filter Library by project', exact: true }).inputValue(), projectB);
    assert.ok(await page.getByRole('option', { name: 'Older selected project', exact: true }).count() > 0, 'A project older than the recent1000 list is retained');
    assert.equal(await page.getByRole('link', { name: 'Open review protocol', exact: true }).getAttribute('href'), `/literature-review?project_id=${projectB}`);
    const projectDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export RIS', exact: true }).click();
    const projectRis = await readFile(await (await projectDownload).path(), 'utf8');
    assert.equal([...projectRis.matchAll(/^TY  - /gm)].length, 2);
    assert.doesNotMatch(projectRis, /Recent unrelated/);
    await page.getByRole('button', { name: /^Researchers/ }).click();
    await page.getByRole('heading', { name: 'Selected project researcher', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Unrelated researcher', exact: true }).count(), 0);
    assert.equal(await page.getByRole('link', { name: /Open researcher profile/ }).count(), 0);
    await page.getByRole('button', { name: /^Opportunities/ }).click();
    await page.getByRole('heading', { name: 'Selected project funding', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Open official source/ }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);

    await page.getByRole('combobox', { name: 'Filter Library by project', exact: true }).selectOption(projectA);
    await page.getByRole('heading', { name: 'Unrelated funding', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('project_id'), projectA);
    assert.equal(await page.getByRole('heading', { name: 'Selected project funding', exact: true }).count(), 0);
    await page.goto(`${host}/library?project_id=${emptyProject}`);
    await page.getByText('No papers linked to this project', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Researchers/ }).click();
    await page.getByText('No researchers linked to this project', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Opportunities/ }).click();
    await page.getByText('No opportunities linked to this project', { exact: true }).waitFor();

    await page.goto(`${host}/library?project_id=${projectA}&focus=${paperB}`);
    await page.getByRole('alert').filter({ hasText: 'This collection could not be loaded.' }).waitFor();
    assert.equal(await page.locator('main h4').count(), 0, 'Focus cannot override the selected project');
    assert.equal(await page.getByRole('button', { name: 'Export RIS', exact: true }).count(), 0);
    const beforeForeign = reads.length;
    await page.goto(`${host}/library?project_id=10000000-0000-4000-8000-000000000999`);
    await page.getByText(/The requested private Library view could not be loaded/).waitFor();
    assert.equal(reads.slice(beforeForeign).filter(read => read.table !== 'projects').length, 0, 'No collections read after denied project access');

    failFocused = true;
    await page.goto(`${host}/library?focus=${paperB}`);
    await page.getByRole('alert').filter({ hasText: 'This collection could not be loaded.' }).waitFor();
    assert.equal(await page.locator('main h4').count(), 0);
    failFocused = false;
    await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
    await page.getByRole('heading', { name: 'Older focused publication', exact: true }).waitFor();

    injectForeign = true;
    await page.goto(`${host}/library?project_id=${projectB}`);
    await page.getByRole('alert').filter({ hasText: 'This collection could not be loaded.' }).waitFor();
    assert.equal(await page.getByText('Foreign owner canary', { exact: true }).count(), 0);
    injectForeign = false;

    holdProjectB = true;
    const started = new Promise(resolve => { delayedStarted = resolve; });
    await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
    await started;
    await page.getByRole('link', { name: 'Show entire Library', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Showing 50 of 1000 loaded papers.' }).waitFor();
    assert.equal(await page.locator('main h4').count(), 50);
    releaseDelayed();
    holdProjectB = false;
    await page.waitForTimeout(100);
    assert.equal(await page.getByRole('heading', { name: 'Older focused publication', exact: true }).count(), 0, 'An obsolete scoped load cannot overwrite a newer whole-Library view');
    await page.getByRole('button', { name: 'Show more records', exact: true }).click();
    assert.equal(await page.locator('main h4').count(), 100);
    await page.getByRole('searchbox', { name: 'Search saved library items', exact: true }).fill('Recent unrelated paper 100');
    assert.equal(await page.getByRole('button', { name: 'Show more records', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    assert.ok(reads.some(read => read.table === 'saved_papers' && read.projectId === projectB));
    if (process.env.EYLO_E2E_ARTIFACT_DIR) {
      await page.goto(`${host}/library?project_id=${projectB}`);
      await page.getByRole('heading', { name: 'Older focused publication', exact: true }).waitFor();
      await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
      await page.screenshot({ path: `${process.env.EYLO_E2E_ARTIFACT_DIR}/library-project-${width}.png`, fullPage: true, animations: 'disabled' });
    }
    await context.close();
    console.log(`PASS ${width}px: exact old source, matching RIS, owner-checked project scope across all collections, safe source links, direct Journey handoff, recovery, stale-load rejection and bounded cards. Synthetic HTTP, not hosted RLS.`);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
