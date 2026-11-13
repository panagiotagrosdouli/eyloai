import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
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
  meetings: [], notifications: [], watchlists: [], monitoring_discoveries: [], profiles: [],
  eyra_conversations: [], eyra_messages: [], ideas: [], study_flashcard_decks: [], saved_papers: [], saved_researchers: [], saved_opportunities: [], search_history: [],
};
let aiCalls = 0;
let interruptSnapshotSave = true;
let snapshotWrites = 0;
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
async function json(route, value) { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(value) }); }
async function capture(page, name) {
  if (!process.env.EYLO_E2E_ARTIFACT_DIR) return;
  await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
  await page.screenshot({ path: `${process.env.EYLO_E2E_ARTIFACT_DIR}/${name}.png`, fullPage: true, animations: 'disabled' });
}

function rpc(name, args) {
  if (name === 'save_eyra_conversation_snapshot') {
    snapshotWrites += 1;
    const existing = tables.eyra_conversations.find(item => item.id === args.p_snapshot_id);
    if (existing) return existing;
    const thread = { id: args.p_snapshot_id, user_id: user.id, title: args.p_title, version: 1, updated_date: now() };
    tables.eyra_conversations.push(thread);
    args.p_messages.forEach((m, index) => tables.eyra_messages.push({ id: randomUUID(), user_id: user.id, conversation_id: thread.id, sequence_number: index + 1, role: m.role, content: { text: m.text }, sources: m.sources, created_date: now() }));
    return thread;
  }
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
    if (url.pathname.includes('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').at(-1); const result = rpc(name, request.postDataJSON());
      if (name === 'save_eyra_conversation_snapshot' && interruptSnapshotSave) { interruptSnapshotSave = false; return route.abort('failed'); }
      return json(route, result);
    }
    const table = url.pathname.split('/').at(-1);
    assert.ok(table in tables, `Unknown table: ${table}`);
    const filters = [...url.searchParams].filter(([key, value]) => value.startsWith('eq.') || value === 'is.null');
    const matching = row => filters.every(([key, value]) => { const current = key.startsWith('data->>') ? row.data?.[key.slice(7)] : row[key]; return value === 'is.null' ? current == null : String(current) === value.slice(3); });
    let rows = tables[table].filter(matching);
    if (request.method() !== 'GET') {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON(); assert.equal(payload.user_id, user.id);
        const row = { ...payload, id: randomUUID(), created_at: now(), updated_at: now() };
        tables[table].push(row); rows = [row];
      } else {
        assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`, 'writes must be owner filtered');
        if (request.method() === 'PATCH') rows.forEach(row => Object.assign(row, request.postDataJSON(), { updated_at: now() }));
        else if (request.method() === 'DELETE') {
          const removed = rows.map(row => row.id); tables[table] = tables[table].filter(row => !matching(row));
          if (table === 'eyra_conversations') tables.eyra_messages = tables.eyra_messages.filter(row => !removed.includes(row.conversation_id));
        }
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
  await capture(page, 'learning-course-mobile');
  console.log('PASS fixture: manual course, linked quiz, saved lesson progress, reload and mobile viewport.');

  await page.route('**/api/capabilities', route => json(route, { ai: true, billing: false, contact: false, scheduled_monitoring: false, institution_analytics: false }));
  const answer = 'Use your saved task to plan the next step.';
  await page.route('**/api/eyra', async route => {
    aiCalls++;
    const payload = route.request().postDataJSON();
    assert.equal(payload.stream, true);
    assert.equal(payload.enable_project_tools, undefined, 'workspace writes are disabled until the user opts in');
    assert.match(payload.prompt, /Review canonical task/);
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify({ type: 'delta', delta: answer })}\n\ndata: ${JSON.stringify({ type: 'done', text: answer, response_id: 'fixture-response' })}\n\n` });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Ask EYRA', exact: true }).click();
  await page.getByText('Workspace context ready · sources attached when retrieved').waitFor();
  await page.getByRole('button', { name: 'Strategy', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Allow project and Library actions for this request' }).isChecked(), false);
  await page.getByLabel('Message EYRA').fill('Explain how to plan my next task');
  await page.getByLabel('Message EYRA').press('Enter');
  await page.getByText(answer, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save conversation snapshot', exact: true }).click();
  await page.getByText(/Save was not confirmed/).waitFor();
  assert.equal(tables.eyra_conversations.length, 1, 'ambiguous transport failure can follow a committed write');
  await page.getByRole('button', { name: 'Save conversation snapshot', exact: true }).click();
  await page.getByRole('option', { name: /EYRA · Explain how to plan/ }).waitFor({ state: 'attached' });
  assert.equal(snapshotWrites, 2, 'retry repeats transport without duplicating records');

  assert.equal(tables.ideas.length, 0, 'chat history never enters Idea Vault');
  assert.equal(tables.eyra_conversations.length, 1);
  assert.equal(tables.eyra_messages.at(-1).content.text, answer);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear EYRA conversation' }).click();
  await page.getByText(answer, { exact: true }).waitFor({ state: 'detached' });
  await page.getByLabel('Saved EYRA conversation').selectOption(tables.eyra_conversations[0].id);
  await page.getByText(answer, { exact: true }).waitFor();
  assert.equal(aiCalls, 1, 'restoring a saved conversation does not call a model');
  await page.getByText('saved', { exact: true }).waitFor();
  await capture(page, 'eyra-conversation-mobile');
  await page.setViewportSize({ width: 1365, height: 900 });
  await capture(page, 'eyra-conversation-wide');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear EYRA conversation' }).click();
  let releaseHistory;
  let markHistoryStarted;
  const historyStarted = new Promise(resolve => { markHistoryStarted = resolve; });
  const historyGate = new Promise(resolve => { releaseHistory = resolve; });
  await page.route(`${supabaseUrl}/rest/v1/eyra_messages**`, async route => {
    markHistoryStarted(); await historyGate; await route.fallback();
  }, { times: 1 });
  await page.getByLabel('Saved EYRA conversation').selectOption(tables.eyra_conversations[0].id);
  await historyStarted;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear EYRA conversation' }).click();
  const historyResponse = page.waitForResponse(response => response.url().includes('/rest/v1/eyra_messages'));
  releaseHistory(); await (await historyResponse).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.getByText(answer, { exact: true }).count(), 0, 'late history cannot restore a chat after clear');
  await page.getByLabel('Saved EYRA conversation').selectOption(tables.eyra_conversations[0].id);
  await page.getByText(answer, { exact: true }).waitFor();
  console.log('PASS fixture: delayed history response cannot repopulate a cleared conversation.');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export conversation', exact: true }).click();
  const conversationDownload = await downloadPromise;
  assert.equal(conversationDownload.suggestedFilename(), 'eyra-conversation.json');
  const stream = await conversationDownload.createReadStream(); let exported = '';
  for await (const chunk of stream) exported += chunk;
  const exportedConversation = JSON.parse(exported);
  assert.equal(exportedConversation.messages.at(-1).content, answer);
  assert.equal(exportedConversation.messages.length, 2);
  assert.equal(aiCalls, 1, 'exports do not call AI');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete saved snapshot', exact: true }).click();
  assert.equal(tables.eyra_conversations.length, 1, 'cancelling confirmation does not delete');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete saved snapshot', exact: true }).click();
  await page.getByRole('button', { name: 'Delete saved snapshot', exact: true }).waitFor({ state: 'detached' });
  assert.equal(tables.eyra_conversations.length, 0);
  assert.equal(tables.eyra_messages.length, 0);
  await page.reload();
  await page.getByRole('button', { name: 'Ask EYRA', exact: true }).click();
  await page.getByText(answer, { exact: true }).waitFor({ state: 'detached' });
  console.log('PASS fixture: ambiguous snapshot save retries the same UUID, private export and confirmed cascade deletion; cancelled deletion leaves records unchanged.');


  await page.goto(`${origin}/projects/${tables.projects[0].id}`);
  await page.getByRole('button', { name: 'Reproducibility', exact: true }).click();
  await page.getByLabel('Materials assessed (required)').fill('Protocol v1');
  await page.getByRole('button', { name: 'Save checklist', exact: true }).click();
  await page.getByText('Documentation checklist saved privately in this project.').waitFor();
  assert.equal(tables.projects[0].data.reproducibility_review.manuscript_reference, 'Protocol v1');
  await page.reload();
  await page.getByRole('button', { name: 'Reproducibility', exact: true }).click();
  assert.equal(await page.getByLabel('Materials assessed (required)').inputValue(), 'Protocol v1');
  await page.getByLabel('Materials assessed (required)').fill('My unsaved revision');
  tables.projects[0].updated_date = '2026-11-14T00:00:00.000Z';
  tables.projects[0].data.reproducibility_review = { ...tables.projects[0].data.reproducibility_review, manuscript_reference: 'Other session revision' };
  await page.getByRole('button', { name: 'Save checklist', exact: true }).click();
  await page.getByText('This project changed in another tab. Reload before saving.').waitFor();
  assert.equal(await page.getByLabel('Materials assessed (required)').inputValue(), 'My unsaved revision');
  assert.equal(tables.projects[0].data.reproducibility_review.manuscript_reference, 'Other session revision');
  console.log('PASS fixture: reproducibility checklist save/reload and stale-write rejection preserve both the winning record and unsaved draft.');
  console.log('PASS fixture: authenticated EYRA streaming, task context, explicit action opt-in and canonical EYRA snapshot save/restore.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
