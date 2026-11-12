import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4174';
const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://eylo-learning-test.supabase.co', VITE_SUPABASE_ANON_KEY: 'eylo-learning-e2e-public-key' },
  stdio: 'ignore',
});
let browser;
const user = { id: 'eylo-learning-user', aud: 'authenticated', role: 'authenticated', email: 'student@example.org', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-01-01T00:00:00.000Z' };
const records = [];
const versions = [];

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with status ${server.exitCode}`);
    try { if ((await fetch(`${baseUrl}/login`)).ok) return; } catch { /* wait for Vite */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Vite did not become ready.');
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const authResponse = async (route, body) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'access-control-allow-headers': '*' } });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
  };
  await page.route('**/auth/v1/token?grant_type=password', (route) => authResponse(route, { access_token: 'eylo-learning-access', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'eylo-learning-refresh', user }));
  await page.route('**/auth/v1/user**', (route) => authResponse(route, user));
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }));
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().method() === 'OPTIONS') return authResponse(route, []);
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/learning_record_versions')) return authResponse(route, versions.filter((item) => item.user_id === user.id && item.note_id === url.searchParams.get('note_id')?.replace('eq.', '')).sort((a, b) => b.version_number - a.version_number));
    if (!url.pathname.endsWith('/learning_records')) return authResponse(route, []);
    const method = route.request().method();
    const wantsObject = route.request().headers().accept?.includes('vnd.pgrst.object');
    const response = (value) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-range': `0-${Math.max(0, records.length - 1)}/${records.length}` }, body: JSON.stringify(value) });
    if (method === 'GET') return response(records.filter((item) => item.user_id === user.id));
    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const row = { id: `learning-${records.length + 1}`, user_id: user.id, kind: payload.kind, parent_id: payload.parent_id || null, data: payload.data || {}, created_date: new Date().toISOString(), updated_date: new Date().toISOString() };
      records.unshift(row);
      if (row.kind === 'note') versions.push({ id: `version-${versions.length + 1}`, note_id: row.id, user_id: user.id, version_number: versions.filter((item) => item.note_id === row.id).length + 1, snapshot: row.data, created_date: new Date().toISOString() });
      return response(wantsObject ? row : [row]);
    }
    if (method === 'PATCH') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const row = records.find((item) => item.id === id && item.user_id === user.id);
      const expectedVersion = url.searchParams.get('updated_date')?.replace('eq.', '');
      if (!row || (expectedVersion && row.updated_date !== expectedVersion)) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-range': '*/0' }, body: 'null' });
      Object.assign(row, route.request().postDataJSON(), { updated_date: new Date().toISOString() });
      if (row.kind === 'note') versions.push({ id: `version-${versions.length + 1}`, note_id: row.id, user_id: user.id, version_number: versions.filter((item) => item.note_id === row.id).length + 1, snapshot: row.data, created_date: new Date().toISOString() });
      return response(wantsObject ? row : [row]);
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id')?.replace('eq.', '');
      const index = records.findIndex((item) => item.id === id && item.user_id === user.id);
      const removed = index >= 0 ? records.splice(index, 1) : [];
      return response(removed);
    }
    return response([]);
  });

  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill('Test-password-123');
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.waitForURL(/\/home/);
  await page.goto(`${baseUrl}/learn`);
  await page.getByRole('heading', { name: 'Learn, plan, and make progress' }).waitFor();

  await page.getByRole('button', { name: 'Study planner' }).click();
  await page.getByLabel('Subject name').fill('Biology');
  await page.getByRole('button', { name: 'Add subject' }).click();
  await page.locator('article strong').filter({ hasText: 'Biology' }).waitFor();

  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Title').fill('Cell biology review');
  await page.getByRole('textbox', { name: 'Note content' }).fill('Mitochondria function :: ATP production :: Protein synthesis\nWhere is DNA stored? :: In the nucleus :: In the ribosome');
  await page.getByLabel('Subject').selectOption({ label: 'Biology' });
  await page.getByRole('button', { name: 'Save now' }).click();
  await page.getByLabel('Title').fill('Cell biology revised');
  await page.getByRole('button', { name: 'Save now' }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('dialog').getByText(/Version 1/).waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Flashcards' }).click();
  await page.getByLabel('Import from a note written with “question :: answer” lines').selectOption({ label: 'Cell biology revised' });
  await page.getByRole('button', { name: 'Import cards' }).click();
  await page.getByText('Mitochondria function', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Start review' }).click();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: 'Good' }).click();
  await page.getByText('Review saved').waitFor();

  await page.getByRole('button', { name: 'Quizzes' }).click();
  await page.getByLabel('Create questions from a note with “question :: answer :: distractor” lines').selectOption({ label: 'Cell biology revised' });
  await page.getByText('Quiz: Cell biology revised').waitFor();
  await page.getByRole('button', { name: 'Take quiz' }).click();
  await page.getByLabel('ATP production', { exact: true }).check();
  await page.getByRole('button', { name: 'Submit quiz' }).click();
  await page.getByText('50%', { exact: true }).waitFor();
  assert.ok(records.some((item) => item.kind === 'quiz_attempt' && item.data.percent === 50), 'quiz attempt should be persisted');
  assert.ok(records.some((item) => item.kind === 'flashcard' && item.data.review_count === 1), 'flashcard review outcome should be persisted');

  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByLabel('Title').fill('My unsaved rewrite');
  const savedNote = records.find((item) => item.kind === 'note');
  savedNote.data = { ...savedNote.data, title: 'Remote session title' };
  savedNote.updated_date = '2026-12-01T00:00:00.000Z';
  versions.push({ id: `version-${versions.length + 1}`, note_id: savedNote.id, user_id: user.id, version_number: versions.filter((item) => item.note_id === savedNote.id).length + 1, snapshot: savedNote.data, created_date: new Date().toISOString() });
  await page.getByRole('button', { name: 'Save now' }).click();
  await page.getByRole('alert').getByText(/changed in another tab or session/i).waitFor();
  assert.equal(await page.getByLabel('Title').inputValue(), 'My unsaved rewrite', 'a concurrent edit must preserve the local draft');
  await page.getByRole('alert').getByRole('button', { name: 'Load latest version' }).click();
  await page.getByLabel('Title').waitFor();
  assert.equal(await page.getByLabel('Title').inputValue(), 'Remote session title');

  await page.reload();
  await page.getByRole('heading', { name: 'Learn, plan, and make progress' }).waitFor();
  assert.equal(records.filter((item) => item.user_id === user.id).length > 5, true, 'the connected learning journey should create persistent records');
  await page.getByRole('button', { name: 'Sign out of EYLO' }).click();
  await page.getByLabel('Email address').waitFor();
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill('Test-password-123');
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.waitForURL(/\/home/);
  await page.goto(`${baseUrl}/learn`);
  await page.getByRole('heading', { name: 'Learn, plan, and make progress' }).waitFor();
  await page.getByText('Remote session title', { exact: true }).waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Study planner' }).click();
  assert.equal(await page.getByLabel('Subject name').isVisible(), true, 'study planner controls remain available on mobile');
  console.log('Learning workspace Playwright journey passed: login → subject → note → review → quiz → conflict recovery → logout/login → resume.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
