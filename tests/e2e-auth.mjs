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

  console.log('Browser checks passed: auth regressions, mobile registration and private CSV analysis/export/reset.');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
}
