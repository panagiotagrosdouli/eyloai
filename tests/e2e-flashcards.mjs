import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { validateMeetingsStagingTarget } from '../src/lib/meetings-e2e-target.mjs';

const required = ['EYLO_E2E_BASE_URL', 'EYLO_E2E_ALLOWED_HOST', 'EYLO_E2E_HOST_EMAIL', 'EYLO_E2E_HOST_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing staging settings: ${missing.join(', ')}`);
if (process.env.EYLO_E2E_CONFIRM_DATA_MUTATION !== 'YES') throw new Error('Set EYLO_E2E_CONFIRM_DATA_MUTATION=YES to create and delete staging flashcards.');
const target = validateMeetingsStagingTarget(process.env.EYLO_E2E_BASE_URL, process.env.EYLO_E2E_ALLOWED_HOST);
const account = { email: process.env.EYLO_E2E_HOST_EMAIL, password: process.env.EYLO_E2E_HOST_PASSWORD };
const timeout = Number(process.env.EYLO_E2E_TIMEOUT_MS || 45_000);
const marker = `EYLO flashcards e2e ${Date.now()}`;
const browser = await chromium.launch({ headless: process.env.EYLO_E2E_HEADLESS !== 'false' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(timeout);
try {
  await page.goto(new URL('/login?from=%2Fflashcards', target.origin).href);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached', timeout });
  await page.goto(new URL('/flashcards', target.origin).href);
  await page.getByRole('heading', { name: 'EYLO Flashcards' }).waitFor();

  await page.getByLabel('Deck name').fill(marker);
  await page.getByLabel('Description').fill('staging acceptance');
  await page.getByRole('button', { name: 'Save deck' }).click();
  await page.getByRole('status').getByText('Deck saved.').waitFor();
  await page.getByLabel('Question').fill(`${marker} question`);
  await page.getByLabel('Answer').fill(`${marker} answer`);
  await page.getByRole('button', { name: 'Save flashcard' }).click();
  await page.getByRole('status').getByText('Flashcard saved.').waitFor();
  await page.reload();
  await page.getByText(`${marker} question`, { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Review 1 due' }).click();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByText(`${marker} answer`, { exact: true }).waitFor();
  await page.getByRole('button', { name: /Good/ }).click();
  await page.getByRole('status').getByText('Review session complete. Your next dates were saved.').waitFor();
  await page.reload();
  await page.getByText('1 cards · 0 due now').waitFor();
  await page.getByText('1 successful reviews').waitFor();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete card ${marker} question` }).click();
  await page.getByRole('status').getByText('Flashcard deleted.').waitFor();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete deck ${marker}` }).click();
  await page.getByRole('status').getByText('Deck and its reviews deleted.').waitFor();
  assert.equal(await page.getByText(marker, { exact: true }).count(), 0);
  console.log(JSON.stringify({ result: 'PASS', target: target.origin, mobile: true, savedAndReloaded: true, spacedRepetitionPersisted: true, deletion: true }));
} finally {
  await context.close();
  await browser.close();
}
