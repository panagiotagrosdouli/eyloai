import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { validateMeetingsStagingTarget } from '../src/lib/meetings-e2e-target.mjs';

const required = ['EYLO_E2E_BASE_URL', 'EYLO_E2E_ALLOWED_HOST', 'EYLO_E2E_HOST_EMAIL', 'EYLO_E2E_HOST_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing staging settings: ${missing.join(', ')}`);
if (process.env.EYLO_E2E_CONFIRM_DATA_MUTATION !== 'YES') throw new Error('Set EYLO_E2E_CONFIRM_DATA_MUTATION=YES to create and delete staging time entries.');
const target = validateMeetingsStagingTarget(process.env.EYLO_E2E_BASE_URL, process.env.EYLO_E2E_ALLOWED_HOST);
const account = { email: process.env.EYLO_E2E_HOST_EMAIL, password: process.env.EYLO_E2E_HOST_PASSWORD };
const timeout = Number(process.env.EYLO_E2E_TIMEOUT_MS || 45_000);
const marker = `EYLO time e2e ${Date.now()}`;
const browser = await chromium.launch({ headless: process.env.EYLO_E2E_HEADLESS !== 'false' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(timeout);

try {
  await page.goto(new URL('/login?from=%2Ftime-tracker', target.origin).href);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached', timeout });
  await page.goto(new URL('/time-tracker', target.origin).href);
  await page.getByRole('heading', { name: 'EYLO Time Tracker' }).waitFor();
  await page.getByLabel('What are you working on?').fill(`${marker} timer`);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.getByRole('status').getByText('Timer started.').waitFor();
  await page.reload();
  await page.getByText(`${marker} timer`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Stop timer' }).click();
  await page.getByRole('status').getByText('Timer stopped after').waitFor();

  await page.getByText('Add a manual time entry').click();
  await page.getByLabel('Description').fill(`${marker} manual`);
  await page.getByRole('button', { name: 'Save manual entry' }).click();
  await page.getByRole('status').getByText('Manual time entry saved.').waitFor();
  await page.reload();
  await page.getByText(`${marker} manual`, { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all CSV' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'eylo-time-entries.csv');
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile(path, 'utf8');
  assert.ok(csv.includes(marker), 'exported CSV includes the created time entries');

  for (const description of [`${marker} timer`, `${marker} manual`]) {
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete time entry ${description}` }).click();
    await page.getByRole('status').getByText('Time entry deleted.').waitFor();
  }
  console.log(JSON.stringify({ result: 'PASS', target: target.origin, mobile: true, timerReload: true, manualEntry: true, export: true, deletion: true }));
} finally {
  await context.close();
  await browser.close();
}
