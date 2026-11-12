import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { validateMeetingsStagingTarget } from '../src/lib/meetings-e2e-target.mjs';

const required = ['EYLO_E2E_BASE_URL', 'EYLO_E2E_ALLOWED_HOST', 'EYLO_E2E_HOST_EMAIL', 'EYLO_E2E_HOST_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing staging settings: ${missing.join(', ')}`);
if (process.env.EYLO_E2E_CONFIRM_DATA_MUTATION !== 'YES') throw new Error('Set EYLO_E2E_CONFIRM_DATA_MUTATION=YES to generate and delete a staging course and quiz.');
const target = validateMeetingsStagingTarget(process.env.EYLO_E2E_BASE_URL, process.env.EYLO_E2E_ALLOWED_HOST);
const account = { email: process.env.EYLO_E2E_HOST_EMAIL, password: process.env.EYLO_E2E_HOST_PASSWORD };
const timeout = Number(process.env.EYLO_E2E_TIMEOUT_MS || 90_000);
const marker = `EYLO Learn e2e ${Date.now()}`;
const material = `Research questions guide a systematic investigation. A hypothesis states a testable prediction. An experimental protocol identifies variables, participants or samples, instruments, and procedures before data collection. Random allocation can balance known and unknown confounders. A preregistered analysis plan distinguishes confirmatory tests from exploratory analyses. Researchers should document exclusions, missing values, data transformations, and uncertainty. An assessment should test understanding and application of methods rather than unsupported trivia.`;
const browser = await chromium.launch({ headless: process.env.EYLO_E2E_HEADLESS !== 'false' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(); page.setDefaultTimeout(timeout);
let quizTitle = '';
let correctAnswers = [];
try {
  await page.goto(new URL('/login?from=%2Fquiz-generator', target.origin).href);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached', timeout });

  quizTitle = `${marker} assessment`;
  await page.goto(new URL('/quiz-generator', target.origin).href);
  await page.getByLabel('Quiz title').fill(quizTitle);
  await page.getByLabel('Subject').fill('Research methods');
  await page.getByLabel('Study material').fill(material);
  await page.getByLabel(/I understand the selected note or pasted study material/).check();
  await page.getByRole('button', { name: 'Generate quiz questions' }).click();
  await page.getByRole('heading', { name: 'Review before saving' }).waitFor({ timeout });
  const quizPreview = page.locator('ol.max-h-72 > li');
  assert.equal(await quizPreview.count(), 3);
  for (let index = 0; index < 3; index += 1) {
    const text = await quizPreview.nth(index).innerText();
    correctAnswers.push(text.split('Correct option:').at(-1).trim());
  }
  await page.getByRole('button', { name: 'Save quiz' }).click();
  await page.getByRole('status').getByText('Quiz and questions saved.').waitFor();

  await page.goto(new URL('/learn', target.origin).href);
  await page.getByRole('heading', { name: 'EYLO Learn' }).waitFor();
  await page.getByLabel('Course title').fill(marker);
  await page.getByLabel('Subject', { exact: true }).fill('Research methods');
  await page.getByLabel('Course material').fill(material);
  await page.getByLabel(/I understand the selected note or pasted text/).check();
  await page.getByLabel('Lessons').selectOption('3');
  await page.getByRole('button', { name: 'Generate lessons' }).click();
  const preview = page.getByRole('dialog', { name: 'Review before saving' });
  await preview.waitFor({ timeout });
  await preview.getByLabel('Optional assessment from Quiz Generator').first().selectOption({ label: quizTitle });
  await preview.getByRole('button', { name: 'Save course and lessons' }).click();
  await page.getByRole('status').getByText('Course, lessons and enrollment saved.').waitFor();
  await page.reload();
  await page.getByRole('heading', { name: marker }).waitFor();
  await page.getByRole('button', { name: 'Open lesson' }).first().click();
  await page.getByText('Objective:', { exact: false }).waitFor();
  await page.getByRole('link', { name: 'Take lesson assessment' }).click();
  await page.getByRole('heading', { name: quizTitle }).waitFor();
  await page.getByRole('button', { name: 'Start quiz' }).click();
  const fields = page.locator('fieldset');
  assert.equal(await fields.count(), 3);
  for (let index = 0; index < 3; index += 1) {
    const labels = fields.nth(index).locator('label');
    let selected = false;
    for (let option = 0; option < await labels.count(); option += 1) {
      if ((await labels.nth(option).innerText()).trim() === correctAnswers[index]) {
        await labels.nth(option).locator('input[type="radio"]').check(); selected = true; break;
      }
    }
    assert.ok(selected, `correct answer ${index + 1} is available in the saved quiz`);
  }
  await page.getByRole('button', { name: 'Submit for grading' }).click();
  await page.getByRole('status').getByText('Your answers were graded and the linked course progress was updated.').waitFor();
  await page.goto(new URL('/learn', target.origin).href);
  await page.reload();
  await page.getByText('Lesson 1 · Complete').waitFor();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete course ${marker}` }).click();
  await page.getByRole('status').getByText('Course and progress deleted.').waitFor();
  await page.goto(new URL('/quiz-generator', target.origin).href);
  await page.getByRole('button').filter({ hasText: quizTitle }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Delete quiz ${quizTitle}` }).click();
  await page.getByRole('status').getByText('Quiz and its attempts deleted.').waitFor();
  console.log(JSON.stringify({ result: 'PASS', target: target.origin, mobile: true, courseLessonsPersisted: true, quizAssessmentLinked: true, gradedAttemptSyncedToLessonProgress: true, deletion: true }));
} finally {
  await context.close();
  await browser.close();
}
