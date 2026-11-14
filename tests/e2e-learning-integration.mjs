import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { WORKSPACE_EXPORT_TABLES } from '../src/lib/workspace-export.mjs';

const origin = 'http://127.0.0.1:4174';
const supabaseUrl = 'https://eylo-learning-test.supabase.co';
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'learning@example.org', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {} };
let fixtureUser = user;
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
for (const table of WORKSPACE_EXPORT_TABLES) tables[table] ||= [];
let aiCalls = 0;
let interruptSnapshotSave = true;
let snapshotWrites = 0;
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
async function json(route, value) { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(value) }); }
async function capture(page, name) {
  if (!process.env.EYLO_E2E_ARTIFACT_DIR) return;
  await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
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
    if (url.pathname.includes('/auth/v1/token')) return json(route, { access_token: fixtureUser.id === user.id ? 'learning-fixture-access-token' : 'learning-fixture-access-token-b', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'learning-fixture-refresh-token', user: fixtureUser });
    if (url.pathname.includes('/auth/v1/user')) return json(route, fixtureUser);
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
        if (request.method() === 'PATCH') rows.forEach(row => Object.assign(row, request.postDataJSON(), { updated_at: now(), ...(table === 'projects' ? { updated_date: now() } : {}) }));
        else if (request.method() === 'DELETE') {
          const removed = rows.map(row => row.id); tables[table] = tables[table].filter(row => !matching(row));
          if (table === 'eyra_conversations') tables.eyra_messages = tables.eyra_messages.filter(row => !removed.includes(row.conversation_id));
        }
        else throw new Error('Unexpected fixture write');
      }
    }
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json');
    if (single && !rows.length) return route.fulfill({ status: 406, headers, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'No matching owner row' }) });
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

  tables.saved_papers.push({ id: '90000000-0000-4000-8000-000000000001', user_id: user.id, data: { title: 'Synthetic review protocol fixture paper', authors: 'Fixture Author', year: 2025, url: 'https://example.org/fixture-paper' } });
  tables.projects.push({ id: '10000000-0000-0000-0000-000000000002', user_id: user.id, data: { title: 'Second protocol project' }, updated_date: now() });
  await page.goto(`${origin}/literature-review?project_id=${tables.projects[0].id}`);
  await page.getByLabel('Research question').fill('What methods support coastal adaptation?');
  await page.getByLabel('Sources searched').fill('Fixture Library only');
  await page.getByLabel('Exact search strings').fill('coastal adaptation methods');
  await page.getByLabel('Inclusion criteria').fill('Relevant methods descriptions in supplied metadata');
  await page.getByLabel('Exclusion criteria').fill('Unrelated methods or missing context');
  await page.getByRole('button', { name: 'Add to screening log', exact: true }).click();
  await page.getByLabel('Screening decision for Synthetic review protocol fixture paper', { exact: true }).selectOption('include');
  await page.getByRole('button', { name: 'Save protocol to project', exact: true }).click();
  await page.getByText('Protocol saved privately in this research project.').waitFor();
  const protocolSnapshot = structuredClone(tables.projects[0].data.review_protocol);
  await page.reload();
  await page.getByLabel('Research question').waitFor();
  assert.equal(await page.getByLabel('Research question').inputValue(), protocolSnapshot.question);
  assert.equal(await page.getByLabel('Screening decision for Synthetic review protocol fixture paper', { exact: true }).inputValue(), 'include');
  await page.getByLabel('Research question').fill('My protocol draft');
  tables.projects[0].updated_date = '2026-11-16T00:00:00.000Z';
  tables.projects[0].data.review_protocol = { ...protocolSnapshot, question: 'Other session protocol' };
  await page.getByRole('button', { name: 'Save protocol to project', exact: true }).click();
  await page.getByText('This project changed in another tab. Reload before saving.').waitFor();
  assert.equal(await page.getByLabel('Research question').inputValue(), 'My protocol draft');
  assert.equal(tables.projects[0].data.review_protocol.question, 'Other session protocol');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByLabel('Select literature review project').selectOption(tables.projects[1].id);
  assert.equal(await page.getByLabel('Research question').inputValue(), 'My protocol draft');
  page.once('dialog', dialog => dialog.accept());
  await page.getByLabel('Select literature review project').selectOption(tables.projects[1].id);
  assert.equal(await page.getByLabel('Research question').inputValue(), '');
  assert.equal(await page.getByLabel('Select literature review project').inputValue(), tables.projects[1].id);
  await page.getByLabel('Research question').fill('Second project protocol');
  await page.getByLabel('Sources searched').fill('Fixture Library only');
  await page.getByLabel('Exact search strings').fill('second project methods');
  await page.getByLabel('Inclusion criteria').fill('Relevant supplied material');
  await page.getByLabel('Exclusion criteria').fill('Unrelated supplied material');
  await page.getByRole('button', { name: 'Save protocol to project', exact: true }).click();
  await page.getByText('Protocol saved privately in this research project.').waitFor();
  assert.equal(tables.projects[0].data.review_protocol.question, 'Other session protocol');
  assert.equal(tables.projects[1].data.review_protocol.question, 'Second project protocol');
  await page.reload();
  await page.getByLabel('Research question').waitFor();
  assert.equal(await page.getByLabel('Select literature review project').inputValue(), tables.projects[1].id);
  assert.equal(await page.getByLabel('Research question').inputValue(), 'Second project protocol');
  const reviewExportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export reproducible JSON', exact: true }).click();
  const reviewDownload = await reviewExportEvent;
  assert.equal(reviewDownload.suggestedFilename(), 'eylo-review-protocol.json');
  const reviewStream = await reviewDownload.createReadStream(); let reviewJson = '';
  for await (const chunk of reviewStream) reviewJson += chunk;
  const reviewExport = JSON.parse(reviewJson);
  assert.equal(reviewExport.project_id, tables.projects[1].id);
  assert.equal(aiCalls, 1, 'human protocol editing/export does not call a model');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await capture(page, 'literature-review-mobile');
  console.log('PASS fixture: Literature Review protocol/screening save/reload, CAS conflict draft retention, cancelled/confirmed project switching, private export and mobile viewport.');

  // Provider-shaped synthetic records exercise the real discovery normalizers,
  // card attribution and canonical Library persistence without live providers.
  const provenanceTitle = 'Coastal adaptation provenance fixture';
  const provenanceDoi = '10.1234/coastal-provenance-fixture';
  await page.route('https://api.openalex.org/**', route => json(route, { results: route.request().url().includes('/works?') ? [{
    id: 'https://openalex.org/W1234', doi: `https://doi.org/${provenanceDoi}`, title: provenanceTitle, publication_year: 2025, type: 'article', authorships: [],
  }] : [] }));
  await page.route('https://api.crossref.org/**', route => json(route, { message: { items: [{ DOI: provenanceDoi, title: [provenanceTitle], published: { 'date-parts': [[2025]] }, type: 'journal-article', abstract: '<jats:p>Coastal adaptation provenance fixture abstract.</jats:p>' }] } }));
  await page.route('https://export.arxiv.org/**', route => route.fulfill({ status: 200, headers, contentType: 'application/atom+xml', body: '<feed xmlns="http://www.w3.org/2005/Atom"></feed>' }));
  await page.route('https://www.ebi.ac.uk/**', route => json(route, { resultList: { result: [] } }));
  await page.route('https://api.semanticscholar.org/**', route => json(route, { data: [] }));
  await page.route('**/api/opportunities**', route => json(route, { items: [] }));
  await page.route('**/api/eyra', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture: AI unavailable' }) }));
  await page.goto(`${origin}/search?q=${encodeURIComponent(provenanceTitle)}&goal=review`);
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  await page.getByRole('heading', { name: provenanceTitle, exact: true }).waitFor();
  await page.getByText('Indexed by OpenAlex, Crossref · one publication, not independent studies.').waitFor();
  await page.getByText('Abstract metadata from Crossref.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: provenanceTitle, exact: true }).count(), 1);
  await page.getByTitle('Save to library', { exact: true }).click();
  await page.getByText('Paper saved to library', { exact: true }).waitFor();
  const provenanceSaved = tables.saved_papers.find(row => row.data.doi === provenanceDoi);
  assert.ok(provenanceSaved);
  assert.equal(provenanceSaved.data.source_id, `doi:${provenanceDoi}`);
  assert.deepEqual(provenanceSaved.data.indexed_by, ['OpenAlex', 'Crossref']);
  assert.equal(provenanceSaved.data.summary_source, 'Crossref');
  await capture(page, 'scholarly-provenance-mobile');
  console.log('PASS fixture: scholarly duplicate records render one publication with retained provider/abstract attribution and save canonical DOI/provenance to the Library while AI is unavailable.');

  for (let index = 0; index < 100; index++) tables.projects.push({ id: `10000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`, user_id: user.id, data: { title: `Recent fixture project ${index}` }, updated_date: now() });
  const olderProjectId = '10000000-0000-4000-8000-000000000999';
  tables.projects.push({ id: olderProjectId, user_id: user.id, data: { title: 'Authorized project beyond recent cap' }, updated_date: now() });
  await page.goto(`${origin}/literature-review?project_id=${olderProjectId}`);
  await page.getByLabel('Select literature review project').waitFor();
  assert.equal(await page.getByLabel('Select literature review project').inputValue(), olderProjectId);
  assert.equal(await page.getByLabel('Research question').inputValue(), '');
  tables.projects.push({ id: '10000000-0000-4000-8000-000000000998', user_id: '00000000-0000-0000-0000-000000000002', data: { title: 'Other account private fixture project' }, updated_date: now() });
  await page.goto(`${origin}/literature-review?project_id=10000000-0000-4000-8000-000000000998`);
  await page.getByText('Could not load the requested private project and saved papers. Check access and your connection, then retry.').waitFor();
  assert.equal(await page.getByLabel('Select literature review project').count(), 0, 'a missing/foreign requested ID never substitutes another owned project');
  assert.equal(await page.getByText('Other account private fixture project', { exact: true }).count(), 0);
  await page.goto(`${origin}/literature-review?project_id=10000000-0000-4000-8000-000000000997`);
  await page.getByText('Could not load the requested private project and saved papers. Check access and your connection, then retry.').waitFor();
  assert.equal(await page.getByLabel('Select literature review project').count(), 0);
  console.log('PASS fixture: protocol deep links load an authorized exact project beyond the recent cap and fail closed for distinct foreign-owner and missing IDs; synthetic PostgREST, not hosted RLS.');


  // Real React forms and canonical Project SDK; transport remains synthetic.
  for (const [kind, title, singular, fields] of [
    ['journal', 'Research Journal', 'entry', { Observation: 'Measured a lower response rate', 'Interpretation and uncertainty': 'Small sample; uncertain', 'Next step': 'Repeat collection' }],
    ['experiments', 'Experiment Lab', 'experiment', { Hypothesis: 'A testable hypothesis', 'Method and analysis plan': 'Compare supplied measurements', 'Observed result': 'No difference observed', 'Limitations and deviations': 'Exploratory sample' }],
    ['publications', 'Publication Tracker', 'publication', { 'Journal or venue': 'User-supplied test venue', 'Submission reference or DOI': 'TEST-2026-01', 'Next action': 'Review manuscript', 'Decision and revision notes': 'Awaiting response' }],
  ]) {
    const project = tables.projects[0];
    await page.goto(`${origin}/projects/${project.id}/research/${kind}`);
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.getByRole('button', { name: `New ${singular}`, exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill(`${title} private fixture`);
    for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByText('Record saved to this project.', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: `${title} private fixture`, exact: true }).waitFor();
    await page.getByRole('button', { name: `Edit ${singular}`, exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill(`${title} retained draft`);
    // A second writer changes the canonical project while the form is open.
    project.updated_date = '2026-11-15T00:00:00.000Z'; project.data.concurrent_marker = kind;
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'changed in another tab' }).waitFor();
    assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), `${title} retained draft`);
    await page.getByRole('button', { name: 'Reload latest project' }).click();
    await page.getByRole('button', { name: 'Save record', exact: true }).click();
    await page.getByText('Record saved to this project.', { exact: true }).waitFor();
    assert.equal(project.data.concurrent_marker, kind);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export saved records' }).click();
    const download = await downloadEvent; const stream = await download.createReadStream(); let content = '';
    for await (const chunk of stream) content += chunk;
    const exported = JSON.parse(content); assert.equal(exported.workspace, kind); assert.equal(exported.records[0].title, `${title} retained draft`);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${title} mobile overflow`);
    await capture(page, `research-${kind}-mobile`);
    await page.getByLabel('Find saved records').fill('unmatched-query'); await page.getByText('No records match your search.', { exact: true }).waitFor();
    await page.getByLabel('Find saved records').fill('');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: `Delete ${singular}`, exact: true }).click();
    assert.equal(await page.getByRole('heading', { name: `${title} retained draft`, exact: true }).count(), 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete ${singular}`, exact: true }).click();
    await page.getByText('Record deleted.', { exact: true }).waitFor();
    await page.reload(); await page.getByText(`No records yet. Add your first ${singular}.`, { exact: true }).waitFor();
    await page.setViewportSize({ width: 1280, height: 900 });
    console.log(`PASS fixture: ${title} create/reload, owner-filtered CAS conflict and draft recovery, portable export, search, mobile and cancelled/confirmed deletion.`);
  }
  await page.goto(`${origin}/projects/${tables.projects[0].id}/research/journal`);
  await page.getByRole('button', { name: 'New entry', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Must not leak to another project');
  page.once('dialog', dialog => dialog.accept());
  await page.goto(`${origin}/projects/10000000-0000-4000-8000-000000000998/research/journal`);
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByLabel('Title', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'New entry', exact: true }).isDisabled(), true);
  console.log('PASS fixture: foreign project research workspace fails closed without carrying another project draft. Hosted RLS remains unverified.');
  const planningProject = tables.projects[0];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${origin}/projects/${planningProject.id}/budget`);
  await page.getByLabel('Allocated budget').fill('1.00');
  await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.getByLabel('Expense title').fill('=SUM(1,2) fixture expense');
  await page.getByLabel('Planned amount').fill('0.10');
  await page.getByLabel('Actual amount').fill('0.20');
  assert.equal(await page.getByRole('button', { name: 'Save Research Budget', exact: true }).isDisabled(), true, 'unapplied expense draft cannot be reported saved');
  await page.getByRole('button', { name: 'Apply expense to draft' }).click();
  await page.getByRole('button', { name: 'Save Research Budget', exact: true }).click();
  await page.getByText('Research Budget saved.', { exact: true }).waitFor();
  await page.reload();
  const budgetTotalsPanel = page.getByRole('region', { name: 'Draft budget totals' });
  await budgetTotalsPanel.waitFor();
  assert.match(await budgetTotalsPanel.innerText(), /EUR 0.80/);
  const csvEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export saved expenses CSV' }).click();
  const csvStream = await (await csvEvent).createReadStream(); let budgetCsv = '';
  for await (const chunk of csvStream) budgetCsv += chunk;
  assert.ok(budgetCsv.includes(`"'=SUM(1,2) fixture expense"`));
  assert.ok(budgetCsv.includes('"0.10","0.20"'));
  await page.getByRole('button', { name: 'Edit expense', exact: true }).click();
  await page.getByLabel('Actual amount').fill('1.20');
  await page.getByRole('button', { name: 'Apply expense to draft' }).click();
  planningProject.updated_date = '2026-11-16T00:00:00.000Z';
  planningProject.data.research_budget.allocation = '2.00'; planningProject.data.planning_marker = 'Other writer preserved';
  await page.getByRole('button', { name: 'Save Research Budget', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'changed in another tab' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save Research Budget', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Compare latest save' }).click();
  await page.getByRole('region', { name: 'Workspace conflict comparison' }).waitFor();
  assert.match(await page.getByRole('region', { name: 'Workspace conflict comparison' }).innerText(), /allocation: 2.00/);
  await page.getByRole('button', { name: 'Keep my draft for review' }).click();
  await page.getByRole('button', { name: 'Save Research Budget', exact: true }).click();
  await page.getByText('Research Budget saved.', { exact: true }).waitFor();
  assert.equal(planningProject.data.research_budget.lines[0].actual, '1.20');
  assert.equal(planningProject.data.planning_marker, 'Other writer preserved');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(page, 'research-budget-mobile');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Remove expense' }).click();
  assert.equal(await page.getByRole('heading', { name: '=SUM(1,2) fixture expense', exact: true }).count(), 1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove expense' }).click();
  await page.getByRole('button', { name: 'Save Research Budget', exact: true }).click();
  await page.getByText('Research Budget saved.', { exact: true }).waitFor();
  await page.reload(); await page.getByText('No expenses yet.', { exact: true }).waitFor();
  console.log('PASS fixture: Research Budget exact decimals, formula-safe CSV, pending-editor save guard, persistence, explicit conflict comparison, unrelated-data preservation, mobile and confirmed removal.');

  tables.notes[0].version = 1;
  await page.goto(`${origin}/projects/${planningProject.id}/thesis`);
  await page.getByLabel('Thesis title').fill('Canonical Notes thesis');
  await page.getByRole('button', { name: 'Add chapter', exact: true }).click();
  await page.getByLabel('Chapter title').fill('Introduction');
  await page.getByLabel('Target words').fill('100');
  await page.getByLabel('Chapter status').selectOption('complete');
  await page.getByLabel('Linked saved Note').selectOption(tables.notes[0].id);
  await page.getByLabel('Pin to current saved Note version', { exact: true }).check();
  await page.getByLabel('Chapter guidance').fill('Explain the supplied evidence and uncertainty.');
  assert.equal(await page.getByRole('button', { name: 'Save Thesis Studio', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Apply chapter to draft' }).click();
  await page.getByRole('button', { name: 'Add chapter', exact: true }).click();
  await page.getByLabel('Chapter title').fill('Methods');
  await page.getByLabel('Target words').fill('50');
  await page.getByRole('button', { name: 'Apply chapter to draft' }).click();
  await page.getByRole('button', { name: 'Move Methods up', exact: true }).click();
  await page.getByRole('button', { name: 'Save Thesis Studio', exact: true }).click();
  await page.getByText('Thesis Studio saved.', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: '1. Methods', exact: true }).waitFor();
  const thesisProgressPanel = page.getByRole('region', { name: 'Thesis progress' });
  assert.match(await thesisProgressPanel.innerText(), /Saved-note words: 8/);
  assert.match(await thesisProgressPanel.innerText(), /Target words: 150/);
  assert.match(await thesisProgressPanel.innerText(), /content: 1 of 2/);
  const mdEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Compile saved thesis Markdown' }).click();
  const mdStream = await (await mdEvent).createReadStream(); let thesisMd = '';
  for await (const chunk of mdStream) thesisMd += chunk;
  assert.ok(thesisMd.indexOf('## Methods') < thesisMd.indexOf('## Introduction'));
  assert.ok(thesisMd.includes(tables.notes[0].data.content));
  assert.ok(thesisMd.includes(tables.notes[0].id));
  assert.equal(tables.notes[0].data.title, 'Canonical note', 'thesis editing never rewrites canonical Notes');
  // Canonical history is fixture transport, not hosted Note-version/RLS acceptance.
  const pinnedOriginal = structuredClone(tables.notes[0]);
  tables.note_versions.push({ id: randomUUID(), note_id: pinnedOriginal.id, user_id: user.id, version: 1, snapshot: structuredClone(pinnedOriginal.data), created_date: now() });
  tables.notes[0].version = 2;
  tables.notes[0].data.content = 'Latest revised canonical content has changed substantially.';
  await page.reload();
  await page.getByRole('heading', { name: '2. Introduction', exact: true }).waitFor();
  assert.match(await thesisProgressPanel.innerText(), /Saved-note words: 8/);
  const pinnedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Compile saved thesis Markdown' }).click();
  let pinnedMd = ''; for await (const chunk of await (await pinnedDownload).createReadStream()) pinnedMd += chunk;
  assert.ok(pinnedMd.includes(pinnedOriginal.data.content));
  assert.ok(!pinnedMd.includes(tables.notes[0].data.content));
  assert.match(pinnedMd, /pinned version 1/);
  const jsonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export saved thesis JSON' }).click();
  let pinnedJson = ''; for await (const chunk of await (await jsonDownload).createReadStream()) pinnedJson += chunk;
  const pinExport = JSON.parse(pinnedJson);
  assert.equal(pinExport.version, 2); assert.equal(pinExport.notes[0].version, 1);
  assert.equal(pinExport.notes[0].content, pinnedOriginal.data.content);
  assert.equal(pinExport.notes[0].updated_date, '', 'archive time must not masquerade as the original save time');
  const historyRow = tables.note_versions.find(row => row.note_id === pinnedOriginal.id);
  const forgedVersion = async route => json(route, { ...historyRow, user_id: '00000000-0000-0000-0000-000000000002', snapshot: { content: 'Foreign history must not render' } });
  await page.route(`${supabaseUrl}/rest/v1/note_versions**`, forgedVersion);
  await page.getByRole('button', { name: 'Refresh saved Notes' }).click();
  await page.getByRole('alert').filter({ hasText: 'Counts are incomplete' }).waitFor();
  assert.equal(await page.getByText('Foreign history must not render', { exact: true }).count(), 0);
  await page.unroute(`${supabaseUrl}/rest/v1/note_versions**`, forgedVersion);
  tables.note_versions = tables.note_versions.filter(row => row !== historyRow);
  await page.getByRole('button', { name: 'Refresh saved Notes' }).click();
  await page.getByRole('alert').filter({ hasText: 'Counts are incomplete' }).waitFor();
  await page.getByLabel('Thesis title').fill('Must not save a pruned pin');
  await page.getByRole('button', { name: 'Save Thesis Studio', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'A linked note is unavailable or belongs to another project' }).waitFor();
  assert.equal(planningProject.data.thesis_outline.title, 'Canonical Notes thesis');
  await page.getByRole('button', { name: 'Compile saved thesis Markdown' }).click();
  await page.getByRole('alert').filter({ hasText: 'A linked note is unavailable or belongs to another project' }).waitFor();
  await page.getByLabel('Thesis title').fill('Canonical Notes thesis');
  await page.getByRole('button', { name: 'Edit chapter', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Use current saved Note version', exact: true }).click();
  await page.getByRole('button', { name: 'Apply chapter to draft' }).click();
  await page.getByRole('button', { name: 'Save Thesis Studio', exact: true }).click();
  await page.getByText('Thesis Studio saved.', { exact: true }).waitFor();
  assert.equal(planningProject.data.thesis_outline.chapters[1].note_version, 2);
  assert.equal(tables.notes[0].version, 2, 'repinning changes only the project outline, never the Note');
  console.log('PASS fixture: Thesis pins survive later canonical Note edits, export exact retained version/provenance, reject foreign/pruned history without latest fallback and explicitly repin to the current version. Hosted RLS remains unverified.');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await capture(page, 'thesis-studio-mobile');
  const canonicalNote = tables.notes.shift();
  await page.getByRole('button', { name: 'Refresh saved Notes' }).click();
  await page.getByRole('alert').filter({ hasText: 'Counts are incomplete' }).waitFor();
  await page.getByLabel('Thesis title').fill('Must not save with unavailable source');
  await page.getByRole('button', { name: 'Save Thesis Studio', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'A linked note is unavailable or belongs to another project' }).waitFor();
  assert.equal(planningProject.data.thesis_outline.title, 'Canonical Notes thesis');
  tables.notes.unshift(canonicalNote);
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await page.getByRole('heading', { name: '1. Methods', exact: true }).waitFor();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Remove chapter', exact: true }).nth(1).click();
  assert.equal(await page.getByRole('heading', { name: '2. Introduction', exact: true }).count(), 1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove chapter', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Save Thesis Studio', exact: true }).click();
  await page.getByText('Thesis Studio saved.', { exact: true }).waitFor();
  assert.ok(tables.notes.some(note => note.id === canonicalNote.id && note.data.content === canonicalNote.data.content), 'removing a chapter must never delete or rewrite its canonical Note');
  console.log('PASS fixture: Thesis Studio ordered chapters, canonical note word counts, saved-content compile/provenance, reload, mobile, missing-note save rejection and cancelled/confirmed chapter removal without deleting Notes.');

  // Existing outline links and Notes deep links must fetch authorized IDs beyond recent1000.
  for (let i = 0; i < 1000; i++) tables.notes.push({ id: `30000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`, user_id: user.id, data: { title: `Padding note ${i}`, content: '', tags: [], project_id: planningProject.id }, updated_date: now() });
  const oldNoteId = '30000000-0000-4000-8000-000000009999';
  tables.notes.push({ id: oldNoteId, user_id: user.id, data: { title: 'Authorized old chapter note', content: 'Exact older chapter content', tags: [], project_id: planningProject.id }, updated_date: now() });
  planningProject.data.thesis_outline.chapters.push({ id: randomUUID(), title: 'Older chapter', target_words: 20, status: 'writing', note_id: oldNoteId, guidance: '' });
  await page.goto(`${origin}/projects/${planningProject.id}/thesis`);
  await page.getByRole('link', { name: 'Edit linked note: Authorized old chapter note', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#note-title')?.value === 'Authorized old chapter note');
  assert.equal(await page.getByLabel('Note content', { exact: true }).inputValue(), 'Exact older chapter content');
  const foreignNoteId = '30000000-0000-4000-8000-000000009998';
  tables.notes.push({ id: foreignNoteId, user_id: '00000000-0000-0000-0000-000000000002', data: { title: 'Foreign confidential note', content: 'Must never show', tags: [] }, updated_date: now() });
  await page.evaluate(target => { history.pushState(null, '', target); dispatchEvent(new PopStateEvent('popstate')); }, `/notes?focus=${foreignNoteId}`);
  await page.getByRole('alert').filter({ hasText: 'The requested private note could not be loaded' }).waitFor();
  assert.equal(await page.getByLabel('Note title', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Note content', { exact: true }).inputValue(), '');
  assert.equal(await page.getByText('Foreign confidential note', { exact: true }).count(), 0);
  tables.notes = tables.notes.filter(note => !note.data.title?.startsWith('Padding note'));
  for (const path of ['budget', 'thesis']) {
    await page.goto(`${origin}/projects/10000000-0000-4000-8000-000000000998/${path}`);
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: `Save ${path === 'budget' ? 'Research Budget' : 'Thesis Studio'}`, exact: true }).count(), 0);
  }
  console.log('PASS fixture: exact thesis/Notes links beyond recent1000; foreign note query change clears the old editor and fails closed; foreign project Budget/Thesis cannot write. Hosted authorization remains unverified.');
  await page.setViewportSize({ width: 390, height: 844 });
  const contributionTables = WORKSPACE_EXPORT_TABLES.filter(table => table.startsWith('eylo_') && !['eylo_files','eylo_file_versions'].includes(table));
  for (const table of contributionTables) tables[table] = [
    {id: randomUUID(),user_id:user.id,display_name:'Owned contribution',name:'Owner record'},
    {id: randomUUID(),user_id:'00000000-0000-0000-0000-000000000002',display_name:'Foreign collaboration data'},
  ];
  delete tables.eylo_directory[0].id;
  tables.eylo_api_tokens[0].token_hash='digest-never-export';
  tables.eylo_api_tokens[0].raw_token='secret-never-export';
  await page.goto(`${origin}/settings`);
  await page.getByLabel('Settings section').selectOption('privacy');
  const workspaceDownloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download saved workspace', exact: true }).click();
  const workspaceDownload = await workspaceDownloadEvent;
  const workspaceStream = await workspaceDownload.createReadStream(); let workspaceJson = '';
  for await (const chunk of workspaceStream) workspaceJson += chunk;
  const workspaceExport = JSON.parse(workspaceJson);
  assert.equal(workspaceExport.version, 3);
  assert.equal(workspaceExport.account.user_id, user.id);
  assert.equal(workspaceExport.collections.notes[0].data.title, 'Canonical note');
  assert.equal(workspaceExport.collections.learning_courses.length, 1);
  assert.equal(workspaceExport.collections.quiz_attempts.length, 1);
  assert.equal(workspaceExport.collections.time_entries.length, 1);
  assert.ok(workspaceExport.collections.projects.every(row => row.user_id === user.id));
  assert.ok(Object.keys(workspaceExport.collections).includes('eyra_messages'));
  assert.equal(Object.keys(workspaceExport.collections).length,40);
  for(const table of contributionTables) {assert.equal(workspaceExport.collections[table].length,1); assert.equal(workspaceExport.collections[table][0].user_id,user.id);}
  assert.equal(workspaceJson.includes('never-export'),false);
  assert.equal(workspaceJson.includes('Foreign collaboration data'),false);
  console.log('PASS fixture: Settings downloads owner-validated portable workspace v3 with40 collections and excludes token material/foreign contributions; including canonical notes, learning and timer records; file bytes explicitly excluded.');
  const privateATitle = 'Account A confidential fixture paper';
  const privateBTitle = 'Account B confidential fixture paper';
  const ownerB = { ...user, id: '00000000-0000-0000-0000-000000000002', email: 'second-fixture@example.org' };
  tables.saved_papers.push({ id: '90000000-0000-4000-8000-000000000010', user_id: user.id, data: { title: privateATitle } });
  tables.saved_papers.push({ id: '90000000-0000-4000-8000-000000000011', user_id: ownerB.id, data: { title: privateBTitle } });
  await page.goto(`${origin}/library`);
  await page.getByText(privateATitle, { exact: true }).waitFor();
  let markOwnerQuery;
  let releaseOwnerQuery;
  const ownerQueryStarted = new Promise(resolve => { markOwnerQuery = resolve; });
  const ownerQueryGate = new Promise(resolve => { releaseOwnerQuery = resolve; });
  await page.route(`${supabaseUrl}/rest/v1/saved_papers**`, async route => {
    if (new URL(route.request().url()).searchParams.get('user_id') === `eq.${ownerB.id}`) {
      markOwnerQuery(); await ownerQueryGate;
    }
    await route.fallback();
  });
  fixtureUser = ownerB;
  try {
    const signedInId = await page.evaluate(async () => {
      const { supabase } = await import('/src/lib/supabaseClient.js');
      const result = await supabase.auth.signInWithPassword({ email: 'second-fixture@example.org', password: 'Fixture-password-123' });
      if (result.error) throw result.error;
      return result.data.user.id;
    });
    assert.equal(signedInId, ownerB.id);
    await Promise.race([ownerQueryStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('New account did not reload its private route')), 5000))]);
    assert.equal(await page.getByText(privateATitle, { exact: true }).count(), 0, 'old-account content must disappear before new-account data arrives');
    releaseOwnerQuery();
    await page.getByText(privateBTitle, { exact: true }).waitFor();
    assert.equal(await page.getByText(privateATitle, { exact: true }).count(), 0);
    console.log('PASS fixture: a same-route authenticated account switch removes old private component state before the delayed new-owner query resolves.');
  } finally { releaseOwnerQuery(); }
  for (let i = 0; i < 251; i += 1) tables.notes.push({ id: `31000000-0000-4000-8000-${String(i).padStart(12, '0')}`, user_id: user.id, data: { title: `Graph coverage note ${i}`, content: '', project_id: planningProject.id }, updated_date: now() });
  await page.goto(`${origin}/knowledge-graph`);
  const graphB = page.getByRole('button', { name: `Explore graph node: ${privateBTitle} (Publications)`, exact: true });
  await graphB.waitFor();
  let markGraphOwnerQuery, releaseGraphOwnerQuery;
  const graphOwnerStarted = new Promise(resolve => { markGraphOwnerQuery = resolve; });
  const graphOwnerGate = new Promise(resolve => { releaseGraphOwnerQuery = resolve; });
  await page.route(`${supabaseUrl}/rest/v1/saved_papers**`, async route => {
    if (new URL(route.request().url()).searchParams.get('user_id') === `eq.${user.id}`) { markGraphOwnerQuery(); await graphOwnerGate; }
    await route.fallback();
  });
  fixtureUser = user;
  try {
    await page.evaluate(async email => {
      const { supabase } = await import('/src/lib/supabaseClient.js');
      const result = await supabase.auth.signInWithPassword({ email, password: 'Fixture-password-123' });
      if (result.error) throw result.error;
    }, user.email);
    await Promise.race([graphOwnerStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('New graph owner did not request its collection')), 5000))]);
    assert.equal(await graphB.count(), 0, 'previous account graph disappears before the new query resolves');
    releaseGraphOwnerQuery();
    await page.getByRole('button', { name: `Explore graph node: ${privateATitle} (Publications)`, exact: true }).waitFor();
    assert.equal(await graphB.count(), 0);
    await page.getByText(/Showing at most 250 recent records per collection/).waitFor();
    console.log('PASS fixture: same-route Knowledge Graph account switch clears old nodes while new-owner queries are delayed; bounded Notes coverage is disclosed. This is not hosted two-user RLS acceptance.');
  } finally { releaseGraphOwnerQuery(); }
  const oldTaskId = '40000000-0000-4000-8000-000000009999';
  const foreignTaskId = '40000000-0000-4000-8000-000000009998';
  tables.life_tasks = [
    ...Array.from({ length: 1000 }, (_, i) => ({ id: `41000000-0000-4000-8000-${String(i).padStart(12, '0')}`, user_id: user.id, data: { title: `Recent task ${i}`, status: 'todo' }, updated_date: now() })),
    { id: oldTaskId, user_id: user.id, data: { title: 'Authorized older exact task', status: 'todo' }, updated_date: '2001-01-01T00:00:00Z' },
    { id: foreignTaskId, user_id: ownerB.id, data: { title: 'Foreign confidential task', status: 'todo' }, updated_date: '2001-01-01T00:00:00Z' },
  ];
  await page.goto(`${origin}/life?focus=${oldTaskId}`);
  await page.waitForFunction(() => document.querySelector('#life-task-title')?.value === 'Authorized older exact task');
  const beforeTasks = tables.life_tasks.length;
  await page.evaluate(target => { history.pushState(null, '', target); dispatchEvent(new PopStateEvent('popstate')); }, `/life?focus=${foreignTaskId}`);
  await page.getByRole('alert').filter({ hasText: 'The requested private task could not be loaded' }).waitFor();
  assert.equal(await page.getByLabel('Task title', { exact: true }).inputValue(), '');
  assert.equal(await page.getByText('Foreign confidential task', { exact: true }).count(), 0);
  await page.evaluate(() => { history.pushState(null, '', '/life?focus=40000000-0000-4000-8000-000000009997'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByRole('alert').filter({ hasText: 'The requested private task could not be loaded' }).waitFor();
  assert.equal(await page.getByLabel('Task title', { exact: true }).inputValue(), '');
  assert.equal(tables.life_tasks.length, beforeTasks, 'opening or refusing an exact target never creates a task');
  await page.evaluate(() => { history.pushState(null, '', '/life'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByLabel('Task title', { exact: true }).fill('Created after refused target');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await page.getByText('Task saved.', { exact: true }).waitFor();
  assert.equal(tables.life_tasks.length, beforeTasks + 1);
  console.log('PASS fixture: exact Life task beyond recent1000 opens; same-route foreign/missing targets clear the editor and fail closed without a substitute or mutation. Hosted RLS remains unverified.');
  console.log('PASS fixture: authenticated EYRA streaming, task context, explicit action opt-in and canonical EYRA snapshot save/restore.');
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
