import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { validateMeetingsStagingTarget } from '../src/lib/meetings-e2e-target.mjs';

const required = [
  'EYLO_E2E_BASE_URL', 'EYLO_E2E_ALLOWED_HOST',
  'EYLO_E2E_HOST_EMAIL', 'EYLO_E2E_HOST_PASSWORD',
  'EYLO_E2E_GUEST_EMAIL', 'EYLO_E2E_GUEST_PASSWORD',
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing staging settings: ${missing.join(', ')}`);
if (process.env.EYLO_E2E_CONFIRM_DATA_MUTATION !== 'YES') {
  throw new Error('Set EYLO_E2E_CONFIRM_DATA_MUTATION=YES to create and delete a test calendar entry.');
}
const target = validateMeetingsStagingTarget(process.env.EYLO_E2E_BASE_URL, process.env.EYLO_E2E_ALLOWED_HOST);
const hostAccount = { email: process.env.EYLO_E2E_HOST_EMAIL, password: process.env.EYLO_E2E_HOST_PASSWORD };
const guestAccount = { email: process.env.EYLO_E2E_GUEST_EMAIL, password: process.env.EYLO_E2E_GUEST_PASSWORD };
if (hostAccount.email.trim().toLowerCase() === guestAccount.email.trim().toLowerCase()) {
  throw new Error('Host and guest must be distinct staging users.');
}
const timeout = Number(process.env.EYLO_E2E_TIMEOUT_MS || 45_000);
const marker = `EYLO calendar e2e ${Date.now()}`;
const browser = await chromium.launch({ headless: process.env.EYLO_E2E_HEADLESS !== 'false' });
const hostContext = await browser.newContext({ viewport: { width: 1365, height: 900 } });
const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const host = await hostContext.newPage();
const guest = await guestContext.newPage();
host.setDefaultTimeout(timeout); guest.setDefaultTimeout(timeout);

async function login(page, account) {
  await page.goto(new URL('/login?from=%2Fcalendar', target.origin).href);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached', timeout });
}

try {
  await login(host, hostAccount);
  await host.goto(new URL('/calendar', target.origin).href);
  await host.getByRole('heading', { name: 'EYLO Calendar' }).waitFor();
  await host.getByLabel('Title', { exact: true }).fill(marker);
  await host.getByLabel('Type', { exact: true }).selectOption('study');
  await host.getByLabel('Subject or topic').fill('Browser verification');
  await host.getByLabel('Starts at').fill(await host.evaluate(() => {
    const date = new Date(Date.now() + 60 * 60_000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }));
  await host.getByLabel('Reminder', { exact: true }).selectOption('5');
  await host.getByRole('button', { name: 'Save calendar entry' }).click();
  await host.getByRole('status').getByText('Calendar entry saved.').waitFor();

  await host.reload();
  await host.getByText(marker, { exact: true }).waitFor();
  await host.goto(new URL('/study-planner', target.origin).href);
  const session = host.getByRole('heading', { name: marker });
  await session.waitFor();
  await host.getByRole('button', { name: `Complete ${marker}` }).click();
  await host.getByRole('status').getByText('Study session marked complete.').waitFor();

  await host.goto(new URL('/calendar', target.origin).href);
  await host.getByText('Completed', { exact: true }).waitFor();
  host.once('dialog', dialog => dialog.accept());
  await host.getByRole('button', { name: `Delete ${marker}` }).click();
  await host.getByRole('status').getByText('Calendar entry deleted.').waitFor();

  await login(guest, guestAccount);
  await guest.goto(new URL('/calendar', target.origin).href);
  await guest.getByRole('heading', { name: 'EYLO Calendar' }).waitFor();
  await guest.getByText(marker, { exact: true }).waitFor({ state: 'detached' });

  console.log(JSON.stringify({ result: 'PASS', target: target.origin, createdReloaded: true, studyPlannerSync: true, completedStatusPersisted: true, deleted: true, secondAccountIsolation: true }));
} finally {
  await Promise.all([guestContext.close(), hostContext.close()]);
  await browser.close();
}
