// Actual browser + Supabase client, synthetic HTTP only. No hosted accounts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const sb = 'https://eylo-session-fixture.supabase.co';
const users = ['a', 'b'].map((name, index) => ({
  id: `00000000-0000-4000-8000-00000000000${index + 1}`,
  email: `${name}@example.org`, aud: 'authenticated', role: 'authenticated',
  app_metadata: { provider: 'email' }, user_metadata: {},
}));
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (route, value, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: sb, VITE_SUPABASE_ANON_KEY: 'session-public-fixture' }, stdio: 'ignore',
});
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(origin)).ok) break; } catch { /* starting */ }
    if (attempt === 99 || server.exitCode !== null) throw new Error('Session fixture server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let logoutCalls = 0, privateCalls = 0, refreshCalls = 0;
    await context.route(`${sb}/**`, route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (url.pathname.endsWith('/token')) {
        const body = request.postDataJSON();
        const user = body.email ? users.find(user => user.email === body.email) : users.find(user => body.refresh_token === `refresh-${user.id}`);
        assert.ok(user, 'Only fixture identities can authenticate');
        if (!body.email) refreshCalls++;
        return json(route, { user, access_token: `token-${user.id}`, refresh_token: `refresh-${user.id}`, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 });
      }
      if (url.pathname.endsWith('/user')) {
        const user = users.find(user => request.headers().authorization === `Bearer token-${user.id}`);
        return json(route, user || {}, user ? 200 : 401);
      }
      if (url.pathname.endsWith('/logout')) { logoutCalls++; return json(route, {}); }
      return json(route, []);
    });
    await context.route('**/api/capabilities', route => json(route, { ai: false, billing: false }));
    await page.goto(origin + '/');
    const signIn = email => page.evaluate(async email => {
      const { requireSupabase } = await import('/src/lib/supabaseClient.js');
      const result = await requireSupabase().auth.signInWithPassword({ email, password: 'Synthetic-fixture-only' });
      if (result.error) throw result.error;
    }, email);
    for (const [kind, path] of [['shared', '/api/session-boundary-fixture'], ['eyra', '/api/eyra'], ['billing', '/api/billing']]) {
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await context.route(`**${path}`, async route => {
        privateCalls++;
        assert.equal(route.request().headers().authorization, `Bearer token-${users[0].id}`);
        await held;
        await json(route, { private: 'owner-a only' }, 401).catch(() => {});
      });
      await signIn(users[0].email);
      const requestStarted = page.waitForRequest(request => new URL(request.url()).pathname === path);
      await page.evaluate(async kind => {
        const { protectedApiFetch } = await import('/src/lib/protected-api.js');
        const { invokeEyra } = await import('/src/lib/eyra-intelligence.js');
        const { startCheckout } = await import('/src/lib/billing.js');
        const pending = kind === 'eyra' ? invokeEyra({ prompt: 'owner-a private research' })
          : kind === 'billing' ? startCheckout('pro')
            : protectedApiFetch('/api/session-boundary-fixture', { method: 'POST', body: 'owner-a research' });
        window.fixtureResult = pending.then(() => ({ leaked: true }), error => ({ code: error.code }));
      }, kind);
      await requestStarted;
      await signIn(users[1].email);
      release();
      assert.deepEqual(await page.evaluate(() => window.fixtureResult), { code: 'SESSION_CHANGED' }, kind);
      await context.unroute(`**${path}`);
    }
    assert.equal(privateCalls, 3, 'Each caller sends once, never replays under the second account');
    assert.equal(refreshCalls, 0, 'No refresh after an account boundary');
    assert.deepEqual(await page.evaluate(async () => {
      const { invalidateAuthentication, requireSupabase } = await import('/src/lib/supabaseClient.js');
      const error = await invalidateAuthentication(undefined, 'obsolete-owner-a-token');
      const { data } = await requireSupabase().auth.getSession();
      return { code: error.code, userId: data.session?.user?.id };
    }), { code: 'SESSION_CHANGED', userId: users[1].id });
    assert.equal(logoutCalls, 0, 'A delayed failure must not sign out the new account');
    let retryCalls = 0;
    await context.route('**/api/session-refresh-fixture', route => {
      retryCalls++;
      assert.equal(route.request().headers().authorization, `Bearer token-${users[1].id}`);
      assert.equal(route.request().headers()['x-fixture'], 'preserved');
      return json(route, { ok: true }, retryCalls === 1 ? 401 : 200);
    });
    assert.equal(await page.evaluate(async () => {
      const { protectedApiFetch } = await import('/src/lib/protected-api.js');
      const response = await protectedApiFetch('/api/session-refresh-fixture', { headers: new Headers({ 'x-fixture': 'preserved' }) });
      await response.json();
      return response.status;
    }), 200);
    assert.equal(retryCalls, 2);
    assert.equal(refreshCalls, 1, 'Same-account refresh still works');

    // Real browser account-switch regression for public EYLO Home. Unscoped
    // legacy localStorage must not disclose prior users' saved research.
    const researchPage = await context.newPage();
    researchPage.on('pageerror', error => errors.push(error.message));
    await researchPage.goto(origin + '/search');
    await researchPage.getByRole('link', { name: 'Discover', exact: true }).waitFor();
    await researchPage.evaluate(async ownerIds => {
      const { discoveryBrowserScope, writeDiscoveryBrowserList } =
        await import('/src/lib/discovery-browser-storage.mjs');
      const stores = { local: window.localStorage, session: window.sessionStorage };
      for (const [index, ownerId] of ownerIds.entries()) {
        const owner = discoveryBrowserScope('authenticated', ownerId);
        writeDiscoveryBrowserList(owner, 'saved', [{
          id: 'browser-e2e-' + index,
          title: index === 0 ? 'A-only research paper' : 'B-only research paper',
          authors: 'Fixture author',
        }], stores);
      }
      window.localStorage.setItem('eylo-public-saved-papers-v1',
        JSON.stringify([{ title: 'Unscoped legacy private research' }]));
    }, users.map(user => user.id));
    await researchPage.reload();
    await researchPage.getByRole('link', { name: 'Discover', exact: true }).waitFor();
    const openSaved = () => researchPage.locator('button:visible').filter({ hasText: /^saved\\b/i }).first().click();
    await openSaved();
    await researchPage.getByRole('heading', { name: 'B-only research paper' }).waitFor();
    assert.equal(await researchPage.getByRole('heading', { name: 'A-only research paper' }).count(), 0);
    assert.equal(await researchPage.getByText('Unscoped legacy private research').count(), 0);

    await researchPage.evaluate(async email => {
      const { requireSupabase } = await import('/src/lib/supabaseClient.js');
      const result = await requireSupabase().auth.signInWithPassword({
        email, password: 'Synthetic-fixture-only',
      });
      if (result.error) throw result.error;
    }, users[0].email);
    await researchPage.getByRole('heading', { name: 'A-only research paper' }).waitFor();
    assert.equal(await researchPage.getByRole('heading', { name: 'B-only research paper' }).count(), 0);

    await researchPage.evaluate(async () => {
      const { requireSupabase } = await import('/src/lib/supabaseClient.js');
      const result = await requireSupabase().auth.signOut();
      if (result.error) throw result.error;
    });
    await researchPage.getByText('Save a paper from your research results to see it here.').waitFor();
    assert.equal(await researchPage.getByRole('heading', { name: 'A-only research paper' }).count(), 0);
    assert.equal(await researchPage.getByRole('heading', { name: 'B-only research paper' }).count(), 0);
    await researchPage.close();

    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: shared API, EYRA and Checkout callers cancel on account switch; no replay/sign-out, same-account refresh works. Actual Supabase client, synthetic HTTP; no live model/payment or hosted RLS claim.`);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
