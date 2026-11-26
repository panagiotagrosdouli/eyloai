import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
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
let failNextTimerTransition = true;
let interruptSnapshotSave = true;
let snapshotWrites = 0;
let roadmapMode = 'normal';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
function containsJson(value, expected) {
  if (Array.isArray(expected)) return Array.isArray(value) && expected.every(item => value.some(candidate => containsJson(candidate, item)));
  if (expected !== null && typeof expected === 'object') return value !== null && typeof value === 'object'
    && Object.entries(expected).every(([key, item]) => containsJson(value[key], item));
  return Object.is(value, expected);
}
async function json(route, value) { await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(value) }); }
async function capture(page, name) {
  if (!process.env.EYLO_E2E_ARTIFACT_DIR) return;
  await mkdir(process.env.EYLO_E2E_ARTIFACT_DIR, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${process.env.EYLO_E2E_ARTIFACT_DIR}/${name}.png`, fullPage: true, animations: 'disabled' });
}

function rpc(name, args) {
  if (name === 'transition_time_entry') {
    const entry = tables.time_entries.find(row => row.id === args.p_entry_id && row.user_id === user.id);
    assert.ok(entry);
    assert.equal(args.p_expected_revision, entry.timer_revision ?? 0);
    entry.pause_intervals ||= [];
    const last = entry.pause_intervals.at(-1);
    if (args.p_action === 'pause') entry.pause_intervals.push({ started_at: now(), ended_at: null });
    else if (last?.ended_at === null) last.ended_at = now();
    if (args.p_action === 'stop') entry.ended_at = now();
    entry.timer_revision = (entry.timer_revision ?? 0) + 1;
    return entry;
  }
  if (name === 'save_eyra_conversation_snapshot') {
    snapshotWrites += 1;
    const existing = tables.eyra_conversations.find(item => item.id === args.p_snapshot_id);
    if (existing) return existing;
    const thread = { id: args.p_snapshot_id, user_id: user.id, title: args.p_title, version: 1, updated_date: now() };
    tables.eyra_conversations.push(thread);
    // Cloud messages can share a timestamp; a timeline must not use it as a unique React key.
    const sharedCreatedDate = now();
    args.p_messages.forEach((m, index) => tables.eyra_messages.push({ id: randomUUID(), user_id: user.id, conversation_id: thread.id, sequence_number: index + 1, role: m.role, content: { text: m.text }, sources: m.sources, created_date: sharedCreatedDate }));
    return thread;
  }
  if (name === 'create_quiz') {
    const quiz = { id: randomUUID(), user_id: user.id, title: args.p_title, subject: args.p_subject, source_note_id: args.p_source_note_id, revision: 1, created_at: now(), updated_at: now() };
    tables.quizzes.push(quiz);
    args.p_questions.forEach((q, position) => tables.quiz_questions.push({ ...q, id: randomUUID(), quiz_id: quiz.id, user_id: user.id, 