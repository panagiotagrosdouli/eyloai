import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4174';
const supabaseUrl = 'https://eylo-learning-test.supabase.co';
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'learning@example.org', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: 'learning-browser-public-test-key' }, stdio: 'ignore',
});
let browser;
const now = () => new Date().toISOString();
const tables = {
  projects: [{ id: '10000000-0000-0000-0000-000000000001', user_id: user.id, data: { title: 'Canonical project' }, updated_date: now() }],
  notes: [{ id: '30000000-0000-0000-0000-000000000001', user_id: user.id, data: { title: 'Canonical note', content: 'Review supplied evidence and document methods and limitations.' }, updated_date: now() }],
  life_tasks: [{ id: '40000000-0000-0000-0000-000000000001', user_id: user.id, data: { title: 'Review canonical task', status: 'todo' }, updated_date: now() }],
  time_entries: [], quizzes: [], quiz_questions: [], quiz_attempts: [], learning_courses: [], learning_lessons: [], learning_lesson_progress: [], learning_enrollments: [],
  notifications: [], watchlists: [], monitoring_discoveries: [], profiles: [],
};
let aiCalls = 0;
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
async function json(route, value) { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(value) }); }

function rpc(name, args) {
  if (name === 'create_quiz') {
    const quiz = { id: randomUUID(), user_id: user.id, title: args.p_title, subject: args.p_subject, source_note_id: args.p_source_note_id, revision: 1, created_at: now(), updated_at: now() };
    tables.quizzes.push(quiz);
    args.p_questions.forEach((q, position) => tables.quiz_questions.push({ ...q, id: randomUUID(), quiz_id: quiz.id, user_id: user.id, position }));
    return [{ id: quiz.id, title: quiz.title, question_count: args.p_questions.length, created_at: quiz.created_at }];
  }
  if (name === 'submit_quiz_attempt' || name === 'submit_learning_quiz_attempt') {
    const questions = tables.quiz_questions.filter(q => q.quiz_id === args.p_quiz_id);
    assert.equal(args.p_answers.length, questions.length);
    const answers = questions.map(q => { const a = args.p_answers.find(item => item.question_id === q.id); assert.ok(a); return { ...a, is_correct: a.selected_index === q.correct_index }; });
    const attempt = { id: randomUUID(), user_id: user.id, quiz_id: args.p_quiz_id, learning_lesson_id: args.p_lesson_id || null, started_at: args.p_started_at, completed_at: now(), total_count: questions.length, correct_count: answers.filter(a => a.is_correct).length, answers };
    tables.quiz_attempts.push(attempt);
    if (args.p_lesson_id) {
      const lesson = tables.learning_lessons.find(l => l.id === args.p_lesson_id);
      assert.equal(lesson.quiz_id, attempt.quiz_id);
      const row = tables.learning_lesson_progress.find(p => p.lesson_id === lesson.id);
      Object.assign(row, { status: 'completed', assessment_attempt_id: attempt.id, completed_at: now() });
    }
    return [attempt];
  }
  if (name === 'create_learning_course') {
    const course = { id: randomUUID(), user_id: user.id, title: args.p_title, subject: args.p_subject, description: args.p_description, source_note_id: args.p_source_note_id, revision: 1, created_at: now(), updated_at: now() };
    tables.learning_courses.push(course);
    args.p_lessons.forEach((lesson, position) => tables.learning_lessons.push({ ...lesson, id: randomUUID(), user_id: user.id, course_id: course.id, position, pass_threshold: 60 }));
    return [{ id: course.id, lesson_count: args.p_lessons.length, created_at: course.created_at }];
  }
  if (name === 'set_learning_lesson_progress') {
    const lesson = tables.learning_lessons.find(l => l.id === args.p_lesson_id);
    let row = tables.learning_lesson_progress.find(p => p.lesson_id === lesson.id);
    if (!row) { row = { id: randomUUID(), user_id: user.id, lesson_id: lesson.id, course_id: lesson.course_id }; tables.learning_lesson_progress.push(row); }
    Object.assign(row, { status: args.p_status, updated_at: now(), last_opened_at: now(), completed_at: args.p_status === 'completed' ? now() : null });
    return [row];
  }
  throw new Error(`Unexpected fixture RPC: ${name}`);
}

try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Learning browser server exited');
    try { if ((await fetch(origin)).ok) break; } catch { /* server starting */ }
    if (i === 99) throw new Error('Learning browser server did not start');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(20_000);
  await page.route('**/api/capabilities', route => json(route, { ai: false, billing: false, contact: false, scheduled_monitoring: false, institution_analytics: false }));
  await page.route('**/api/eyra', route => { aiCalls++; return route.fulfill({ status: 503, headers, body: '{}' }); });
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    if (url.pathname.includes('/auth/v1/token')) return json(route, { access_token: 'learning-fixture-access-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'learning-fixture-refresh-token', user });
    if (url.pathname.includes('/auth/v1/user')) return json(route, user);
    if (url.pathname.includes('/rest/v1/rpc/')) return json(route, rpc(url.pathname.split('/').at(-1), request.postDataJSON()));
    const table = url.pathname.split('/').at(-1);
    assert.ok(table in tables, `Unknown table: ${table}`);
    const filters = [...url.searchParams].filter(([key, value]) => value.startsWith('eq.') || value === 'is.null');
    const matching = row => filters.every(([key, value]) => value === 'is.null' ? row[key] == null : String(row[key]) === value.slice(3));
    let rows = tables[table].filter(matching);
    if (request.method() !== 'GET') {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON(); assert.equal(payload.user_id, user.id);
        const row = { ...payload, id: randomUUID(), created_at: now(), updated_at: now() };
        tables[table].push(row); rows = [row];
      } else {
        assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`, 'writes must be owner filtered');
        if (request.method() === 'PATCH') rows.forEach(row => Object.assign(row, request.postDataJSON(), { updated_at: now() }));
        else if (request.method() === 'DELETE') tables[table] = tables[table].filter(row => !matching(row));
        else throw new Error('Unexpected fixture write');
      }
    }
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    return json(route, single ? rows[0] : rows.slice(Number(url.searchParams.get('offset')) || 0, (Number(url.searchParams.get('offset')) || 0) + (Number(url.searchParams.get('limit')) || rows.length)));
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill('Fixture-password-123');
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached' });
  await page.goto(`${origin}/time-tracker`);
  await page.getByRole('heading', { name: 'EYLO Time Tracker' }).waitFor();
  await page.getByLabel('What are you working on?').fill('Review source methods');
  await page.getByLabel('Life task', { exact: true }).first().selectOption(tables.life_tasks[0].id);
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop timer', exact: true }).waitFor();
  assert.equal(tables.time_entries[0].life_task_id, tables.life_tasks[0].id);
  await page.reload();
  await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
  await page.getByText(/Timer stopped after/).waitFor();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all CSV' }).click();
  assert.equal((await download).suggestedFilename(), 'eylo-time-entries.csv');
  console.log('PASS fixture: canonical task timer start, reload, stop and export.');

  await page.goto(`${origin}/quiz-generator`);
  await page.getByRole('button', { name: 'Write a quiz' }).click();
  await page.getByLabel('Preview quiz title').fill('Manual methods quiz');
  for (let i = 1; i <= 3; i++) {
    await page.getByLabel(`Question ${i}`, { exact: true }).fill(`Methods question ${i}`);
    for (let j = 1; j <= 4; j++) await page.getByLabel(`Question ${i} option ${j}`, { exact: true }).fill(`Q${i} option ${j}`);
    await page.getByLabel(`Question ${i} explanation`, { exact: true }).fill(`Researcher-authored explanation ${i}.`);
  }
  await page.getByRole('button', { name: 'Save quiz and questions' }).click();
  await page.getByRole('heading', { name: 'Manual methods quiz' }).waitFor();
  await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
  for (let i = 1; i <= 3; i++) await page.getByRole('radio', { name: `Q${i} option 1`, exact: true }).check();
  await page.getByRole('button', { name: 'Submit for grading' }).click();
  await page.getByRole('heading', { name: 'Saved result: 3/3 (100%)' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Saved result: 3/3 (100%)' }).waitFor();
  assert.equal(aiCalls, 0, 'manual quiz creation must not invoke AI');
  console.log('PASS fixture: manual quiz creation, saved attempt, grading response and reload.');

  await page.goto(`${origin}/learn`);
  await page.getByRole('button', { name: 'Write a course' }).click();
  await page.getByLabel('Preview course title').fill('Manual methods course');
  await page.getByLabel('Lesson 1 title').fill('Inspect evidence');
  await page.getByLabel('Lesson 1 objective').fill('Record methods and limitations');
  await page.getByLabel('Lesson 1 content').fill('Review the supplied study methods and record the evidence and limitations before interpreting results.');
  await page.getByLabel('Lesson 1 assessment').selectOption(tables.quizzes[0].id);
  await page.getByRole('button', { name: 'Save course and lessons' }).click();
  await page.getByRole('heading', { name: 'Manual methods course' }).waitFor();
  await page.getByRole('button', { name: 'Open lesson' }).click();
  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await page.getByRole('button', { name: 'Reopen lesson' }).waitFor();
  await page.reload();
  await page.getByText('Lesson 1 · Complete').waitFor();
  assert.equal(tables.learning_lessons[0].quiz_id, tables.quizzes[0].id);
  assert.equal(aiCalls, 0, 'manual lesson creation must not invoke AI');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  console.log('PASS fixture: manual course, linked quiz, saved lesson progress, reload and mobile viewport.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
