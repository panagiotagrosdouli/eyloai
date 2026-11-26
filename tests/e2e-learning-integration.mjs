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
let autonomousPlanCalls = 0;
let autonomousProposalMode = 'normal';
let proposalResponseMode = 'normal';
let proposalRequestStartedResolve;
let proposalHoldResolve;
let scholarlyDiscoveryCalls = 0;
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
  await page.route('**/api/eyra', async route => {
    const body = route.request().postDataJSON();
    if (body.prompt?.includes('Extract funding-call requirements from the supplied official document text')) {
      const text = 'Programme: Urban Research Call\nFunding body: Example Research Agency\nCall identifier: URC-2027-A\nEligibility: Public universities may apply.\nDeadline: 1 December 2027.\nScientific scope: Urban heat adaptation.\nEvaluation criteria: Excellence and impact.\nRequired sections: Excellence; Impact; Implementation.\nPage limits: 10 pages.\nFormatting: 11 point font.\nBudget constraints: Personnel and travel costs are eligible.\nRequired attachments: Applicant CVs.';
      const item = (value, evidence_quote) => ({ value, classification: 'direct', evidence_quote, section_or_page: '' });
      const list = (value, evidence_quote) => [item(value, evidence_quote)];
      return json(route, { data: {
        programme: item('Urban Research Call', 'Programme: Urban Research Call'),
        funding_body: item('Example Research Agency', 'Funding body: Example Research Agency'),
        call_identifier: item('URC-2027-A', 'Call identifier: URC-2027-A'),
        eligibility: list('Public universities may apply.', 'Eligibility: Public universities may apply.'),
        deadline: item('1 December 2027', 'Deadline: 1 December 2027.'),
        scientific_scope: item('Urban heat adaptation', 'Scientific scope: Urban heat adaptation.'),
        evaluation_criteria: list('Excellence and impact.', 'Evaluation criteria: Excellence and impact.'),
        required_sections: list('Excellence; Impact; Implementation.', 'Required sections: Excellence; Impact; Implementation.'),
        page_limits: list('10 pages.', 'Page limits: 10 pages.'),
        formatting: list('11 point font.', 'Formatting: 11 point font.'),
        budget_constraints: list('Personnel and travel costs are eligible.', 'Budget constraints: Personnel and travel costs are eligible.'),
        required_attachments: list('Applicant CVs.', 'Required attachments: Applicant CVs.'),
      } });
    }
    if (body.prompt?.includes('planning a research proposal from a researcher')) {
      autonomousPlanCalls += 1;
      assert.match(body.prompt, /Write all string values in English/);
      return json(route, { data: {
        research_question: 'Do randomized interventions improve clinical outcomes?',
        search_query: 'randomized intervention clinical outcomes',
        open_questions: ['Which outcomes and follow-up period matter most to the intended population?'],
      } });
    }
    if (body.prompt?.includes('selecting candidate records for a preliminary research proposal')) {
      const match = body.prompt.match(/CANDIDATE RECORDS\n([\s\S]*\])$/);
      assert.ok(match, 'complete proposal source selection receives the bounded retrieved candidates');
      const candidates = JSON.parse(match[1]);
      const selected = candidates.find(candidate => candidate.source_key.startsWith('project:')) || candidates[0];
      assert.ok(selected?.source_key);
      return json(route, { data: {
        selected_source_keys: [selected.source_key],
        assessments: [{ source_key: selected.source_key, reason: 'The title and available abstract match the research question.', limitation: 'Abstract metadata does not establish causal support or study quality.' }],
      } });
    }
    if (body.prompt?.includes('Create a preliminary evidence matrix')) {
      const sourceJson = body.prompt.split('RECORDS:\n').at(-1);
      const [source] = JSON.parse(sourceJson);
      return json(route, { data: { rows: [{ paper_id: source.id, study_design: 'Controlled trial', dataset: 'Adults described in the abstract', findings: 'The abstract reports an improvement.', limitations: 'Not reported in the available record.' }] } });
    }
    if (body.prompt?.includes('researcher-reviewed methodology plan')) {
      const [sourceId] = [...body.prompt.matchAll(/"source_id":"([^"]+)"/g)].map(match => match[1]);
      assert.ok(sourceId, 'methodology prompt must include a saved selected source identifier');
      assert.ok(body.prompt.includes('Researcher-edited proposal evidence note.'), 'selected proposal context must be authorized for methodology drafting');
      const sectionIds = ['research_approach','study_design','research_questions','testable_hypotheses','population_sampling','data_sources','variables_measurements','data_collection_procedures','analysis_methods','validation_strategy','reproducibility','ethical_considerations','limitations','research_risks'];
      const topics = Object.fromEntries(sectionIds.map(id => [id, { status: 'needs_input', claims: [] }]));
      topics.study_design = { status: 'drafted', claims: [{ heading: 'Proposed design', text: 'A researcher-reviewed proposed design.', kind: 'proposal', source_ids: [] }] };
      topics.data_sources = { status: 'drafted', claims: [{ heading: 'Abstract record', text: 'The selected scholarly abstract reports an intervention.', kind: 'source_fact', source_ids: [sourceId] }] };
      return json(route, { data: { topics } });
    }
    if (body.prompt?.includes('reviewable research execution roadmap')) {
      if (roadmapMode === 'error') return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ error: 'fixture provider credential leaked' }) });
      if (roadmapMode === 'cancel') {
        await new Promise(resolve => setTimeout(resolve, 800));
        try { return await json(route, { data: { tasks: [] } }); } catch { return; }
      }
      const [sourceId] = [...body.prompt.matchAll(/"source_id":"([^"]+)"/g)].map(match => match[1]);
      assert.ok(sourceId, 'roadmap prompt must include a selected scholarly source');
      assert.ok(body.prompt.includes('Researcher-edited proposed methodology.'), 'roadmap prompt must reuse the saved methodology context');
      const tasks = [
        { task_key: 'review', phase: 'Protocol', title: 'Review protocol', deliverable: 'Reviewed protocol', due_date: '', depends_on: [], risk: 'Recruitment access', researcher_notes: 'Confirm access with the researcher.', evidence_summary: '', evidence_kind: 'proposal', source_ids: [] },
        { task_key: 'pilot', phase: 'Pilot', title: 'Plan pilot', deliverable: 'Pilot plan', due_date: '', depends_on: ['review'], risk: '', researcher_notes: '', evidence_summary: 'The selected abstract reports an intervention.', evidence_kind: 'source_fact', source_ids: [sourceId] },
      ];
      return json(route, { data: { tasks } });
    }
    if (body.prompt?.includes('scientific research proposal')) {
      if (proposalResponseMode === 'hold') {
        proposalRequestStartedResolve?.();
        await new Promise(resolve => { proposalHoldResolve = resolve; });
        try { await route.abort('failed'); } catch { /* Reload may already have aborted the browser request. */ }
        return;
      }
      const [sourceId] = [...body.prompt.matchAll(/"source_id":"([^"]+)"/g)].map(match => match[1]);
      assert.ok(sourceId, 'proposal prompt must include a saved source identifier');
      assert.ok(body.prompt.includes('Researcher-edited synthesis.'), 'explicitly selected Literature Review context must be available');
      assert.ok(body.prompt.includes('Researcher-checked finding'), 'selected Evidence Matrix context must be available');
      assert.match(body.prompt, /ADDITIONAL REQUIRED OUTPUT: milestones/);
      assert.match(body.prompt, /OUTPUT LANGUAGE\nEnglish/);
      if (autonomousProposalMode === 'timeout_once') {
        autonomousProposalMode = 'normal';
        return route.fulfill({ status: 504, headers, contentType: 'application/json', body: JSON.stringify({ error: 'fixture provider token must not reach the interface' }) });
      }
      assert.match(body.prompt, /Return all 23 proposal sections/);
      const sectionIds = ['research_title','abstract','background','problem_statement','research_gap','scientific_rationale','research_objectives','research_questions','hypotheses','literature_context','conceptual_framework','research_methodology','study_design','sampling_and_data_sources','data_collection','data_analysis_plan','ethical_considerations','data_management_reproducibility','expected_contributions','research_limitations','risk_management','research_timeline','bibliography'];
      const sections = sectionIds.map((section_id, index) => ({
        section_id, status: section_id === 'bibliography' ? 'drafted' : 'needs_input',
        claims: section_id === 'background' ? [{ heading: 'Available abstract evidence', text: 'The selected abstract reports a controlled intervention.', kind: 'source_fact', source_ids: [sourceId] }]
          : section_id === 'research_title' ? [{ heading: 'Working title', text: 'A proposed study of the selected question.', kind: 'proposal', source_ids: [] }] : [],
      }));
      const methodology_plan = Object.fromEntries(['approach','population_sampling','variables_constructs','validation','reproducibility'].map(id => [id, { status: 'needs_input', claims: [] }]));
      const draft = { sections, methodology_plan, milestones: [{ task_key: 'review-protocol', phase: 'Preparation', title: 'Review the study protocol', deliverable: 'Researcher-reviewed study protocol', due_date: '', depends_on: [], risk: 'Study feasibility and approvals require local researcher assessment.', researcher_notes: '', evidence_summary: '', evidence_kind: 'proposal', source_ids: [] }] };
      if (body.prompt.includes('GRANT PROPOSAL MODE')) {
        assert.match(body.prompt, /DIRECTLY EXTRACTED REQUIREMENTS/);
        assert.match(body.prompt, /APPLICANT INFORMATION PROVIDED BY RESEARCHER/);
        assert.match(body.prompt, /\["Excellence","Impact","Implementation"\]/);
        draft.call_sections = ['Excellence','Impact','Implementation'].map(section_name => ({ section_name, status: 'drafted', claims: [{ heading: section_name, text: `Draft ${section_name} content for researcher review.`, kind: 'proposal', source_ids: [] }] }));
        draft.work_packages = [{ title: 'Protocol design', objective: 'Develop the research protocol.', activities: ['Define measures with the research team.'], deliverables: ['Draft protocol.'], milestone_keys: ['review-protocol'] }];
        draft.budget_notes = ['Cost categories require researcher confirmation.'];
        draft.requirement_coverage = ['programme','funding_body','call_identifier','eligibility','deadline','scientific_scope','evaluation_criteria','required_sections','page_limits','formatting','budget_constraints','required_attachments'].map(requirement_id => ({ requirement_id, status: 'unverified', note: 'Researcher verification required.' }));
      }
      return json(route, { data: draft });
    }
    if (body.prompt?.includes('preliminary narrative literature review')) {
      const [sourceId] = [...body.prompt.matchAll(/"source_id":"([^"]+)"/g)].map(match => match[1]);
      assert.ok(sourceId, 'literature review prompt must include a saved source identifier');
      const sectionIds = ['background', 'themes', 'study_comparisons', 'synthesis', 'contradictions', 'limitations', 'research_gaps', 'conclusions'];
      return json(route, { data: { sections: sectionIds.map((section_id, index) => ({
        section_id,
        claims: index === 0 ? [{ heading: 'Available abstract evidence', text: 'The selected abstract reports a controlled intervention.', source_ids: [sourceId] }] : [],
      })) } });
    }
    if (body.stream === true) aiCalls++;
    return route.fulfill({ status: 503, headers, body: '{}' });
  });
  await page.route('https://api.openalex.org/works?**', route => { scholarlyDiscoveryCalls += 1; return json(route, { results: [{
      id: 'https://doi.org/10.5555/eylo-matrix-fixture', doi: 'https://doi.org/10.5555/eylo-matrix-fixture',
      title: 'Randomized intervention improves clinical outcome in a controlled trial',
      authorships: [{ author: { display_name: 'Fixture Researcher', id: 'https://openalex.org/A1234567890' }, institutions: [] }],
      publication_year: 2024, abstract_inverted_index: { 'The': [0], 'randomized': [1], 'trial': [2], 'enrolled': [3], 'adults': [4], 'and': [5], 'reported': [6], 'improvement.': [7] },
      primary_location: { source: { display_name: 'Fixture Journal' } },
      cited_by_count: 4, open_access: { is_oa: true }, type: 'article', relevance_score: 0.95,
    }] }); });
  await page.route(/\/api\/discovery\?.*provider=crossref.*doi=/, async route => {
    const query = new URL(route.request().url()).searchParams;
    assert.equal(query.get('doi'), '10.5555/eylo-matrix-fixture');
    return json(route, { message: {
      DOI: '10.5555/eylo-matrix-fixture', title: ['Randomized intervention improves clinical outcome in a controlled trial'],
      author: [{ family: 'Researcher' }], published: { 'date-parts': [[2024]] },
      'container-title': ['Fixture Journal'], 'update-to': [],
    } });
  });
  for (const providerUrl of ['https://export.arxiv.org/**', 'https://www.ebi.ac.uk/**', 'https://api.crossref.org/**', 'https://api.semanticscholar.org/**']) {
    await page.route(providerUrl, route => route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture provider unavailable' }) }));
  }
  await page.route(`${supabaseUrl}/**`, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const url = new URL(request.url());
    if (url.pathname.includes('/auth/v1/token')) return json(route, { access_token: fixtureUser.id === user.id ? 'learning-fixture-access-token' : 'learning-fixture-access-token-b', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'learning-fixture-refresh-token', user: fixtureUser });
    if (url.pathname.includes('/auth/v1/user')) return json(route, fixtureUser);
    if (url.pathname.includes('/rest/v1/rpc/')) {
      const name = url.pathname.split('/').at(-1);
      if (name === 'transition_time_entry' && failNextTimerTransition) {
        failNextTimerTransition = false;
        return route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ message: 'Timer service unavailable' }) });
      }
      const result = rpc(name, request.postDataJSON());
      if (name === 'save_eyra_conversation_snapshot' && interruptSnapshotSave) { interruptSnapshotSave = false; return route.abort('failed'); }
      return json(route, result);
    }
    const table = url.pathname.split('/').at(-1);
    assert.ok(table in tables, `Unknown table: ${table}`);
    const filters = [...url.searchParams].filter(([key, value]) => value.startsWith('eq.') || value === 'is.null');
    const containment = url.searchParams.get('data');
    const expectedData = containment?.startsWith('cs.') ? JSON.parse(containment.slice(3)) : null;
    const matching = row => (expectedData === null || containsJson(row.data, expectedData)) && filters.every(([key, value]) => { const current = key.startsWith('data->>') ? row.data?.[key.slice(7)] : row[key]; return value === 'is.null' ? current == null : String(current) === value.slice(3); });
    let rows = tables[table].filter(matching);
    // Mirror the PostgREST order requested by the production history loader.
    // It fetches newest sequence numbers first, then reverses that page.
    if (table === 'eyra_messages' && url.searchParams.get('order') === 'sequence_number.desc') {
      rows = [...rows].sort((left, right) => right.sequence_number - left.sequence_number);
    }
    if (request.method() !== 'GET') {
      if (request.method() === 'POST') {
        const payload = request.postDataJSON(); assert.equal(payload.user_id, user.id);
        const row = { ...payload, id: randomUUID(), created_at: now(), updated_at: now(), ...(table === 'life_tasks' ? { created_date: now(), updated_date: now() } : {}) };
        tables[table].push(row); rows = [row];
      } else {
        assert.equal(url.searchParams.get('user_id'), `eq.${user.id}`, 'writes must be owner filtered');
        if (request.method() === 'PATCH') rows.forEach(row => {
          Object.assign(row, request.postDataJSON(), { updated_at: now(), ...(['projects', 'life_tasks'].includes(table) ? { updated_date: now() } : {}) });
          // Reproduce the canonical conversation's optimistic version trigger.
          if (table === 'eyra_conversations') {
            row.version = (row.version || 1) + 1;
            row.updated_date = now();
          }
        });
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
  // Real-browser acceptance for the public, AI-independent beginner entry.
  const beforePublicAiCalls = aiCalls;
  await page.goto(`${origin}/start`);
  await page.getByRole('heading', { name: 'What would you like to do?' }).waitFor();
  await page.getByRole('link', { name: 'Search publications' }).waitFor();
  await page.getByRole('link', { name: 'Find researchers' }).waitFor();
  await page.getByRole('link', { name: 'Explore careers' }).waitFor();
  await page.getByRole('link', { name: 'Open my workspace' }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Public getting-started mobile overflow');
  assert.equal(aiCalls, beforePublicAiCalls, 'new visitors do not trigger an AI call on the public guide');
  await capture(page, 'getting-started-mobile');
  await page.getByRole('link', { name: 'See plans and availability' }).click();
  await page.waitForURL('**/pricing');
  await page.goBack();
  await page.getByRole('link', { name: 'Contact EYLO' }).click();
  await page.getByRole('heading', { name: 'Get in touch.' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/contact');
  await page.goBack();
  await page.getByRole('link', { name: 'Search publications' }).click();
  await page.waitForURL('**/search');
  assert.equal(new URL(page.url()).pathname, '/search');
  console.log('PASS fixture: public first-use guide opens on mobile, presents real reachable research goals and works without AI or sign-in.');

  await page.goto(`${origin}/login`);
  await page.getByLabel('Email address').fill(user.email);
  await page.getByLabel('Password').fill('Fixture-password-123');
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached' });
  await page.getByRole('link', { name: 'EYLO workspace home', exact: true }).waitFor();
  await page.evaluate(async () => {
    const { savePreferences } = await import('/src/lib/preferences.js');
    savePreferences({ theme: 'dark' });
  });
  await page.waitForFunction(() => {
    const logo = document.querySelector('[aria-label="EYLO workspace home"] img');
    if (!logo || !document.documentElement.classList.contains('dark')) return false;
    const image = getComputedStyle(logo).content;
    // Vite can inline the supplied SVG as a data URL instead of keeping its filename.
    return image.includes('eylo-dark') || decodeURIComponent(image).includes('#e9f2fb');
  });
  await page.evaluate(async () => {
    const { savePreferences } = await import('/src/lib/preferences.js');
    savePreferences({ theme: 'light' });
  });
  await page.goto(`${origin}/time-tracker`);
  await page.getByRole('heading', { name: 'EYLO Time Tracker' }).waitFor();
  await page.getByLabel('What are you working on?').fill('Review source methods');
  await page.getByLabel('Life task', { exact: true }).first().selectOption(tables.life_tasks[0].id);
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await page.getByRole('button', { name: 'Stop timer', exact: true }).waitFor();
  assert.equal(tables.time_entries[0].life_task_id, tables.life_tasks[0].id);
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Timer service unavailable' }).waitFor();
  assert.equal(tables.time_entries[0].pause_intervals?.length || 0, 0);
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await page.getByRole('button', { name: 'Resume timer', exact: true }).waitFor();
  assert.equal(tables.time_entries[0].pause_intervals[0].ended_at, null);
  await page.reload();
  await page.getByRole('button', { name: 'Resume timer', exact: true }).click();
  await page.getByRole('button', { name: 'Pause timer', exact: true }).waitFor();
  assert.ok(tables.time_entries[0].pause_intervals[0].ended_at);
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await page.getByRole('button', { name: 'Resume timer', exact: true }).waitFor();

  await page.reload();
  await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
  await page.getByText(/Timer stopped after/).waitFor();
  assert.ok(tables.time_entries[0].pause_intervals.at(-1).ended_at);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all CSV' }).click();
  assert.equal((await download).suggestedFilename(), 'eylo-time-entries.csv');
  await page.getByLabel('Report from', { exact: true }).fill('2026-11-14');
  await page.getByLabel('Report through', { exact: true }).fill('2026-11-13');
  await page.getByRole('alert').filter({ hasText: 'Report end date must be on or after its start date.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Export report CSV', exact: true }).isDisabled(), true);
  await page.getByLabel('Report through', { exact: true }).fill('2026-11-14');
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report CSV', exact: true }).click();
  assert.equal((await reportDownload).suggestedFilename(), 'eylo-time-report-2026-11-14-2026-11-14.csv');

  console.log('PASS fixture: canonical task timer start, failed pause retry, pause/resume reload, stop while paused and export.');
  const originalEntries = structuredClone(tables.time_entries);
  tables.time_entries = Array.from({ length: 1001 }, (_, index) => ({
    id: randomUUID(), user_id: user.id, description: `History entry ${index}`,
    started_at: '2026-11-14T10:00:00Z', ended_at: '2026-11-14T10:01:00Z',
  }));
  tables.time_entries.push({ id: randomUUID(), user_id: user.id, description: 'Recovered old timer', started_at: '2026-11-01T09:00:00Z', ended_at: null });
  await page.reload();
  await page.getByRole('button', { name: 'Stop timer', exact: true }).waitFor();
  await page.getByText('Showing 50 of 1002 loaded entries').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Start timer', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Show more entries', exact: true }).click();
  await page.getByText('Showing 100 of 1002 loaded entries').waitFor();
  tables.time_entries = originalEntries;
  console.log('PASS fixture: complete time history recovers an active timer beyond 1,000 rows and bounds rendered entries.');


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
  const eyraTranscript = page.locator('[aria-label="EYRA conversation"]');
  await page.route('**/api/eyra', async route => {
    const payload = route.request().postDataJSON();
    if (payload.stream !== true) return route.fallback();
    aiCalls++;
    assert.equal(payload.stream, true);
    assert.equal(payload.enable_project_tools, undefined, 'workspace writes are disabled until the user opts in');
    assert.match(payload.prompt, /Review canonical task/);
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify({ type: 'delta', delta: answer })}\n\ndata: ${JSON.stringify({ type: 'done', text: answer, response_id: 'fixture-response' })}\n\n` });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Ask EYRA', exact: true }).click();
  await page.waitForFunction(() => {
    const viewport = document.querySelector('[aria-label="EYRA conversation"]');
    const heading = viewport?.querySelector('h3');
    if (!viewport || !heading) return false;
    const bounds = viewport.getBoundingClientRect();
    const title = heading.getBoundingClientRect();
    return title.top >= bounds.top && title.bottom <= bounds.bottom && viewport.scrollTop === 0;
  }, undefined, { timeout: 5000 });
  await page.getByText('History & tools', { exact: true }).click();
  await page.getByText('Workspace context available', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Strategy', exact: true }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Allow authorized workspace and research tools for this request' }).isChecked(), false);
  await page.getByLabel('Message EYRA').fill('Explain how to plan my next task');
  await page.getByLabel('Message EYRA').press('Enter');
  await eyraTranscript.getByText(answer, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save conversation snapshot', exact: true }).click();
  await page.getByText(/Save was not confirmed/).waitFor();
  assert.equal(tables.eyra_conversations.length, 1, 'ambiguous transport failure can follow a committed write');
  await page.getByRole('button', { name: 'Save conversation snapshot', exact: true }).click();
  await page.getByRole('option', { name: /EYRA · Explain how to plan/ }).waitFor({ state: 'attached' });
  assert.equal(snapshotWrites, 2, 'retry repeats transport without duplicating records');
  await page.getByRole('button', { name: 'Rename saved conversation', exact: true }).click();
  await page.getByLabel('Conversation title').fill('Methods review — renamed');
  await page.getByRole('button', { name: 'Save title', exact: true }).click();
  await page.getByRole('option', { name: 'Methods review — renamed' }).waitFor({ state: 'attached' });
  assert.equal(tables.eyra_conversations[0].title, 'Methods review — renamed');
  assert.equal(tables.eyra_conversations[0].version, 2,
    'rename must preserve optimistic versioning on the canonical conversation row');
  assert.equal(tables.eyra_messages.at(-1).content.text, answer,
    'renaming does not alter stored conversation messages');

  assert.equal(tables.ideas.length, 0, 'chat history never enters Idea Vault');
  assert.equal(tables.eyra_conversations.length, 1);
  assert.equal(tables.eyra_messages.at(-1).content.text, answer);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear EYRA conversation' }).click();
  await eyraTranscript.getByText(answer, { exact: true }).waitFor({ state: 'detached' });
  await page.getByLabel('Saved EYRA conversation').selectOption(tables.eyra_conversations[0].id);
  await eyraTranscript.getByText(answer, { exact: true }).waitFor();
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
  // Explicitly require the confirmation dialog: a guarded/no-op Clear click
  // must fail this test at the actual cause, not 20 seconds later at the DOM.
  // A native confirmation dialog is already covered in the earlier clear.
  // Here, keep confirmation deterministic so the race test actually measures
  // Clear versus the held history response, not Playwright dialog timing.
  await page.evaluate(() => {
    window.__eyraOriginalConfirm = window.confirm;
    window.__eyraConfirmCalls = 0;
    window.confirm = () => { window.__eyraConfirmCalls++; return true; };
  });
  await page.getByRole('button', { name: 'Clear EYRA conversation' }).click();
  const clearConfirmCalls = await page.evaluate(() => {
    const count = window.__eyraConfirmCalls;
    window.confirm = window.__eyraOriginalConfirm;
    delete window.__eyraOriginalConfirm;
    delete window.__eyraConfirmCalls;
    return count;
  });
  assert.equal(clearConfirmCalls, 1, 'Clear during a pending restore must reach the confirmation handler exactly once');
  const clearDiagnostics = await page.evaluate(() => ({
    transcript: document.querySelector('[aria-label="EYRA conversation"]')?.innerText.slice(0, 600),
    localKeys: Object.keys(sessionStorage).filter(key => key.includes('eyra')),
    clearButtons: [...document.querySelectorAll('[aria-label="Clear EYRA conversation"]')].length,
  }));
  console.log('EYRA pending-restore clear diagnostics (synthetic fixture only):', JSON.stringify(clearDiagnostics));
  // Verify the actual React clear committed before the delayed network
  // response is released. A real stale history restore must not resurrect it.
  await eyraTranscript.getByText(answer, { exact: true }).waitFor({ state: 'detached' });
  const historyResponse = page.waitForResponse(response => response.url().includes('/rest/v1/eyra_messages'));
  releaseHistory(); await (await historyResponse).finished();
  await page.waitForTimeout(250);
  assert.equal(await eyraTranscript.getByText(answer, { exact: true }).count(), 0, 'late history cannot restore a chat after clear');
  await page.getByLabel('Saved EYRA conversation').selectOption(tables.eyra_conversations[0].id);
  await eyraTranscript.getByText(answer, { exact: true }).waitFor();
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
  await page.getByText('History & tools', { exact: true }).click();
  await page.getByText(answer, { exact: true }).waitFor({ state: 'detached' });
  console.log('PASS fixture: ambiguous snapshot save retries the same UUID, private export and confirmed cascade deletion; cancelled deletion leaves records unchanged.');

  // A missing hosted schema must not advertise cloud persistence.
  const cloudSchemaMissing = route => route.fulfill({
    status: 404, headers, contentType: 'application/json',
    body: JSON.stringify({ code: 'PGRST205', message: 'Fixture table unavailable' }),
  });
  await page.route(`${supabaseUrl}/rest/v1/eyra_conversations**`, cloudSchemaMissing);
  await page.goto(`${origin}/home`);
  await page.locator('button[title="Ask EYRA"]').click();
  await page.getByText('History & tools', { exact: true }).click();
  const cloudNotice = page.getByRole('status', { name: 'Cloud conversation history' });
  await cloudNotice.getByText(/Cloud conversation saving is not activated here/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save conversation snapshot', exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel('Saved EYRA conversation').isDisabled(), true);
  const exportWhileOffline = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export conversation', exact: true }).click();
  assert.equal((await exportWhileOffline).suggestedFilename(), 'eyra-conversation.json');
  await page.unroute(`${supabaseUrl}/rest/v1/eyra_conversations**`, cloudSchemaMissing);
  console.log('PASS fixture: missing EYRA cloud history disables false cloud saves while local export remains available.');



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

  const projectBeforeMatrixFixture = structuredClone(tables.projects[0]);
  const papersBeforeMatrixFixture = structuredClone(tables.saved_papers);
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  const question = 'Do randomized interventions improve clinical outcomes?';
  await page.getByLabel('Research question', { exact: true }).fill(question);
  await page.getByRole('button', { name: 'Search scholarly sources', exact: true }).click();
  await page.getByRole('heading', { name: 'Randomized intervention improves clinical outcome in a controlled trial' }).waitFor();
  await page.getByRole('button', { name: 'Add to project', exact: true }).click();
  await page.getByText(/Added .* to this private project/).waitFor();
  assert.equal(tables.saved_papers.some(paper => paper.user_id === user.id && paper.data.project_id === tables.projects[0].id), true);
  await page.getByRole('button', { name: 'Analyze selected (1)', exact: true }).click();
  await page.getByText(/EYRA drafted 1 rows from the selected publication records/).waitFor();
  await page.getByLabel('Key findings EYRA draft for Randomized intervention improves clinical outcome in a controlled trial').fill('Researcher-checked finding');
  await page.getByRole('button', { name: 'Save matrix', exact: true }).click();
  await page.getByText('Evidence Matrix saved to this private research project.').waitFor();
  assert.equal(tables.projects[0].data.evidence_matrix.research_question, question);
  assert.equal(tables.projects[0].data.evidence_matrix.ai_draft.rows[0].findings, 'Researcher-checked finding');
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  assert.equal(await page.getByLabel('Research question', { exact: true }).inputValue(), question);
  assert.equal(await page.getByLabel('Key findings EYRA draft for Randomized intervention improves clinical outcome in a controlled trial').inputValue(), 'Researcher-checked finding');
  await page.getByRole('heading', { name: 'Build a source-grounded review', exact: true }).waitFor();
  const reviewQuestion = page.locator('label').filter({ hasText: 'Literature review research question' }).locator('textarea');
  assert.equal(await reviewQuestion.inputValue(), question);
  await page.getByLabel('Search scope (researcher defined)').fill('Fixture scholarly search; selected abstract only');
  await page.getByRole('button', { name: 'Generate literature review', exact: true }).click();
  const backgroundClaim = page.getByLabel('Scientific background claim 1', { exact: true });
  await backgroundClaim.fill('Researcher-edited synthesis.');
  await page.getByRole('button', { name: 'Generate literature review', exact: true }).click();
  await page.getByText(/Your edited review remains intact/).waitFor();
  assert.equal(await backgroundClaim.inputValue(), 'Researcher-edited synthesis.', 'regeneration must preserve researcher edits');
  await page.locator('section[aria-labelledby="literature-review-builder-title"]').getByRole('button', { name: 'Save to project', exact: true }).click();
  await page.getByText('Literature review saved to this private research project.').waitFor();
  assert.equal(tables.projects[0].data.literature_review.edited_sections[0].claims[0].text, 'Researcher-edited synthesis.');
  assert.deepEqual(tables.projects[0].data.literature_review.selected_paper_ids, [tables.saved_papers[0].id]);
  assert.equal(tables.projects[0].data.literature_review.ai_draft.research_question, question);
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  assert.equal(await page.locator('label').filter({ hasText: 'Literature review research question' }).locator('textarea').inputValue(), question);
  assert.equal(await page.getByLabel('Scientific background claim 1', { exact: true }).inputValue(), 'Researcher-edited synthesis.');
  assert.equal(tables.projects[0].data.literature_review.search_scope, 'Fixture scholarly search; selected abstract only');
  assert.ok(await page.locator('a[href="https://doi.org/10.5555/eylo-matrix-fixture"]').count() > 0, 'review citations must link to the saved scholarly record');
  const literatureReviewDownloadEvent = page.waitForEvent('download');
  await page.locator('section[aria-labelledby="literature-review-builder-title"]').getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const downloadedReview = await literatureReviewDownloadEvent;
  assert.equal(downloadedReview.suggestedFilename(), 'literature-review-draft.md');
  const reviewMarkdown = await readFile(await downloadedReview.path(), 'utf8');
  assert.match(reviewMarkdown, /Researcher-edited synthesis/);
  assert.match(reviewMarkdown, /https:\/\/doi\.org\/10\.5555\/eylo-matrix-fixture/);
  assert.match(reviewMarkdown, /10\.5555\/eylo-matrix-fixture/);
  // Proposal Studio reuses the selected source and the explicitly selected, saved upstream artifacts.
  await page.getByLabel('Researcher-authored matrix notes', { exact: true }).check();
  await page.locator('section[aria-labelledby="research-proposal-builder-title"]').getByLabel('Literature Review', { exact: true }).check();
  const proposalQuestion = page.locator('label').filter({ hasText: 'Research idea' }).locator('textarea');
  assert.equal(await proposalQuestion.inputValue(), question);
  const plansBeforeCompleteRun = autonomousPlanCalls;
  const searchesBeforeCompleteRun = scholarlyDiscoveryCalls;
  proposalResponseMode = 'hold';
  const proposalRequestStarted = new Promise(resolve => { proposalRequestStartedResolve = resolve; });
  await page.getByRole('button', { name: 'Generate Complete Proposal', exact: true }).click();
  await proposalRequestStarted;
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.stage, 'draft', 'the running provider stage is checkpointed before generation begins');
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.status, 'running');
  await page.reload();
  proposalHoldResolve?.();
  proposalResponseMode = 'normal';
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.getByRole('button', { name: 'Resume saved run', exact: true }).waitFor();
  autonomousProposalMode = 'timeout_once';
  await page.getByRole('button', { name: 'Resume saved run', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'timed out' }).waitFor();
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.stage, 'draft', 'a provider error keeps the last verified checkpoint');
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.status, 'failed');
  await page.getByRole('button', { name: 'Resume saved run', exact: true }).click();
  await page.getByText('Complete proposal saved as an editable draft.', { exact: false }).waitFor();
  assert.equal(autonomousPlanCalls, plansBeforeCompleteRun + 1, 'resume continues from the saved draft stage without replanning');
  assert.equal(scholarlyDiscoveryCalls - searchesBeforeCompleteRun, tables.projects[0].data.research_proposal.autonomous_run.search_queries.length, 'resume continues without repeating bounded multi-query discovery');
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.status, 'complete');
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.milestones.length, 1);
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.source_verifications[0].status, 'Verified');
  assert.equal((tables.projects[0].data.plan_items || []).length, 0, 'generated milestones remain proposals and do not enter the workplan');
  await page.getByText('Selected scholarly records', { exact: true }).waitFor();
  await page.getByText('Open scientific questions', { exact: true }).waitFor();
  const proposalBackground = page.getByLabel('Background statement 1', { exact: true });
  await proposalBackground.waitFor();
  await proposalBackground.fill('Researcher-edited proposal evidence note.');
  await page.getByRole('button', { name: 'Generate Complete Proposal', exact: true }).click();
  await page.getByText(/Your edits remain intact/).waitFor();
  assert.equal(await page.getByLabel('Background statement 1', { exact: true }).inputValue(), 'Researcher-edited proposal evidence note.', 'complete regeneration must not overwrite a researcher-authored claim');
  assert.equal(autonomousPlanCalls, plansBeforeCompleteRun + 2);
  assert.equal(await proposalBackground.inputValue(), 'Researcher-edited proposal evidence note.', 'regeneration must preserve researcher edits');
  assert.equal(await page.getByRole('heading', { name: 'Research Title', exact: true }).count(), 1);
  assert.equal(await page.getByRole('heading', { name: 'Bibliography', exact: true }).count(), 1);
  assert.ok(await page.locator('a[href="https://doi.org/10.5555/eylo-matrix-fixture"]').count() > 0, 'proposal sources must link to the saved scholarly record');
  await page.locator('section[aria-labelledby="research-proposal-builder-title"]').getByRole('button', { name: 'Save to project', exact: true }).click();
  await page.getByText('Proposal saved to this private research project.', { exact: true }).waitFor();
  assert.equal(tables.projects[0].data.research_proposal.edited_sections.length, 23);
  assert.equal(tables.projects[0].data.research_proposal.edited_sections.find(section => section.section_id === 'background').claims[0].text, 'Researcher-edited proposal evidence note.');
  assert.deepEqual(tables.projects[0].data.research_proposal.selected_paper_ids, [tables.saved_papers[0].id]);
  const approval = page.locator('section[aria-label="Research quality review"]');
  await approval.getByLabel(/I reviewed the sources, claims, uncertainties/).check();
  await approval.getByRole('button', { name: 'Save review approval for export', exact: true }).click();
  await page.getByText(/Your review approval is saved/).waitFor();
  assert.equal(tables.projects[0].data.research_proposal.researcher_review.approved, true, 'review approval must be receipt-verified and persisted');
  assert.equal(tables.projects[0].data.research_proposal.researcher_review.draft_revision, tables.projects[0].data.research_proposal.draft_revision);
  const proposalDownloadEvent = page.waitForEvent('download');
  await page.locator('section[aria-labelledby="research-proposal-builder-title"]').getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const proposalDownload = await proposalDownloadEvent;
  assert.equal(proposalDownload.suggestedFilename(), 'research-proposal-draft.md');
  const proposalMarkdown = await readFile(await proposalDownload.path(), 'utf8');
  assert.match(proposalMarkdown, /Researcher-edited proposal evidence note/);
  assert.match(proposalMarkdown, /10\.5555\/eylo-matrix-fixture/);
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  assert.equal(await page.locator('label').filter({ hasText: 'Research idea' }).locator('textarea').inputValue(), question);
  assert.equal(await page.getByLabel('Background statement 1', { exact: true }).inputValue(), 'Researcher-edited proposal evidence note.');
  const methodologySection = page.locator('section[aria-labelledby="research-methodology-studio-title"]');
  const methodologyQuestion = methodologySection.locator('label').filter({ hasText: 'Methodology research question' }).locator('textarea');
  assert.equal(await methodologyQuestion.inputValue(), question, 'methodology must reuse the saved project question');
  await methodologySection.getByRole('button', { name: 'Draft methodology with EYRA', exact: true }).click();
  const methodologyDesign = page.getByLabel('Study design statement 1', { exact: true });
  await methodologyDesign.waitFor();
  await methodologyDesign.fill('Researcher-edited proposed methodology.');
  assert.ok(await methodologySection.getByRole('link', { name: /Randomized intervention improves clinical outcome in a controlled trial/ }).count(), 'methodology must link its selected scholarly record');
  await methodologySection.getByRole('button', { name: 'Save methodology', exact: true }).click();
  await page.getByText('Methodology plan saved to this private research project.', { exact: true }).waitFor();
  assert.equal(tables.projects[0].data.research_methodology.edited_topics.study_design.claims[0].text, 'Researcher-edited proposed methodology.');
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  assert.equal(await page.getByLabel('Study design statement 1', { exact: true }).inputValue(), 'Researcher-edited proposed methodology.');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'methodology editor must fit the mobile browser viewport');
  const methodologyDownloadEvent = page.waitForEvent('download');
  await page.locator('section[aria-labelledby="research-methodology-studio-title"]').getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const methodologyDownload = await methodologyDownloadEvent;
  assert.equal(methodologyDownload.suggestedFilename(), 'research-methodology-plan.md');
  const methodologyFile = await methodologyDownload.path();
  assert.ok((await readFile(methodologyFile, 'utf8')).includes('Researcher-edited proposed methodology.'));
  const roadmapSection = page.locator('section[aria-labelledby="research-roadmap-studio-title"]');
  assert.equal(await roadmapSection.locator('label').filter({ hasText: 'Roadmap research question' }).locator('textarea').inputValue(), question);
  const roadmapQuestion = roadmapSection.locator('label').filter({ hasText: 'Roadmap research question' }).locator('textarea');
  await roadmapQuestion.focus(); await roadmapQuestion.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.type), 'checkbox', 'roadmap source selection must follow the question in keyboard order');
  roadmapMode = 'error';
  await roadmapSection.getByRole('button', { name: 'Draft roadmap with EYRA', exact: true }).click();
  await roadmapSection.getByRole('alert').filter({ hasText: 'EYRA could not produce a valid research roadmap' }).waitFor();
  assert.doesNotMatch(await roadmapSection.getByRole('alert').innerText(), /credential leaked/);
  assert.equal((tables.projects[0].data.plan_items || []).length, 0, 'provider failure must not modify the workplan');
  roadmapMode = 'cancel';
  await roadmapSection.getByRole('button', { name: 'Draft roadmap with EYRA', exact: true }).click();
  await roadmapSection.getByRole('button', { name: 'Cancel drafting', exact: true }).click();
  await roadmapSection.getByRole('alert').filter({ hasText: 'Roadmap drafting was cancelled' }).waitFor();
  assert.equal((tables.projects[0].data.plan_items || []).length, 0, 'cancellation must not modify the workplan');
  roadmapMode = 'normal';
  await roadmapSection.getByRole('button', { name: 'Draft roadmap with EYRA', exact: true }).click();
  const roadmapTaskTitle = roadmapSection.getByLabel('Proposed task').first();
  await roadmapTaskTitle.waitFor();
  await roadmapTaskTitle.fill('Researcher-reviewed protocol task');
  await roadmapSection.getByLabel('Researcher notes').first().fill('Researcher risk and access note.');
  assert.ok(await roadmapSection.getByRole('link', { name: /Randomized intervention improves clinical outcome/ }).count(), 'roadmap must show its authentic project source');
  await roadmapSection.getByRole('button', { name: 'Approve selected tasks into workplan draft', exact: true }).click();
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.getByText(/Approved proposed tasks were added to the current workplan draft/).waitFor();
  assert.equal(await page.locator('section[aria-labelledby="structured-workplan-title"] input[id^="workplan-title-"]').count(), 2, 'roadmap approval must append two proposed tasks to the existing project planner');
  assert.equal(await page.getByLabel('Researcher notes').first().inputValue(), 'Researcher risk and access note.');
  assert.equal((tables.projects[0].data.plan_items || []).length, 0, 'approval only updates the draft; it does not persist tasks');
  await page.getByRole('button', { name: 'Save workplan', exact: true }).click();
  await page.getByText('Workplan saved', { exact: true }).waitFor();
  assert.equal(tables.projects[0].data.plan_items.length, 2);
  assert.equal(tables.projects[0].data.plan_items[0].title, 'Researcher-reviewed protocol task');
  assert.equal(tables.projects[0].data.plan_items[0].status, 'todo');
  assert.equal(tables.projects[0].data.plan_items[0].researcher_notes, 'Researcher risk and access note.');
  assert.equal(tables.projects[0].data.plan_items[1].depends_on[0], tables.projects[0].data.plan_items[0].id);
  await page.reload();
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  assert.equal(await page.locator('section[aria-labelledby="structured-workplan-title"] input[id^="workplan-title-"]').first().inputValue(), 'Researcher-reviewed protocol task');
  assert.equal(await page.getByLabel('Researcher notes').first().inputValue(), 'Researcher risk and access note.');
  tables.projects[0].updated_date = '2099-01-01T00:00:00.000Z';
  const workplanTitle = page.locator('section[aria-labelledby="structured-workplan-title"] input[id^="workplan-title-"]').first();
  await workplanTitle.fill('Unsaved roadmap edit retained after conflict');
  await page.getByRole('button', { name: 'Save workplan', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'This project changed in another session. Your workplan edits are still here' }).waitFor();
  assert.equal(await workplanTitle.inputValue(), 'Unsaved roadmap edit retained after conflict');
  assert.equal(tables.projects[0].data.plan_items[0].title, 'Researcher-reviewed protocol task', 'a stale workplan save must preserve the winning task list');
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  const savedProposalSnapshot = structuredClone(tables.projects[0].data.research_proposal);
  await page.getByLabel('Background statement 1', { exact: true }).fill('Unsaved proposal edit preserved after conflict.');
  tables.projects[0].updated_date = '2099-01-01T00:00:00.000Z';
  await page.locator('section[aria-labelledby="research-proposal-builder-title"]').getByRole('button', { name: 'Save to project', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'This project changed in another session. Your proposal edits remain here' }).waitFor();
  assert.equal(await page.getByLabel('Background statement 1', { exact: true }).inputValue(), 'Unsaved proposal edit preserved after conflict.');
  assert.deepEqual(tables.projects[0].data.research_proposal, savedProposalSnapshot, 'a stale proposal save must preserve the winning private project artifact');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'proposal editor must fit the 390px mobile browser viewport');
  assert.equal(await page.locator('section[aria-labelledby="research-proposal-builder-title"]').getByRole('button', { name: 'Export Markdown', exact: true }).isDisabled(), true, 'a later edit invalidates the prior approval and disables export');
  console.log('PASS fixture: selected scholarly source + Evidence Matrix + Literature Review → structured proposal generation, edit-preserving regeneration, private project save/reload and DOI-linked Markdown export.');

  // Grant call intake must quote the supplied notice, require review, and reuse the same autonomous engine.
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  const grantCallText = 'Programme: Urban Research Call\nFunding body: Example Research Agency\nCall identifier: URC-2027-A\nEligibility: Public universities may apply.\nDeadline: 1 December 2027.\nScientific scope: Urban heat adaptation.\nEvaluation criteria: Excellence and impact.\nRequired sections: Excellence; Impact; Implementation.\nPage limit: 10 pages.\nFormatting: 11 point font.\nBudget constraints: Personnel and travel costs are eligible.\nRequired attachments: Applicant CVs.';
  const grantStudio = page.locator('section[aria-labelledby="research-proposal-builder-title"]');
  await grantStudio.getByLabel('Proposal type').selectOption('grant_proposal');
  await grantStudio.getByLabel('Official call text').fill(grantCallText);
  await grantStudio.getByLabel('Applicant and institutional information supplied by you').fill('Public university; applicant team roles and facilities need researcher confirmation.');
  await grantStudio.getByRole('button', { name: 'Extract call requirements', exact: true }).click();
  await grantStudio.getByText(/Inspect provenance and confirm critical requirements/).waitFor();
  const requirementChecks = grantStudio.locator('label').filter({ hasText: 'I reviewed this requirement or its missing status.' });
  assert.equal(await requirementChecks.count(), 10, 'every critical requirement, including absent facts, needs an explicit researcher review');
  for (let i = 0; i < 10; i++) await requirementChecks.nth(i).getByRole('checkbox').check();
  await grantStudio.getByRole('button', { name: 'Save critical requirement review', exact: true }).click();
  await grantStudio.getByText(/Critical call requirements saved as researcher-reviewed/).waitFor();
  autonomousProposalMode = 'normal';
  await grantStudio.getByRole('button', { name: 'Generate Complete Proposal', exact: true }).click();
  await grantStudio.getByRole('heading', { name: 'Call coverage and proposed work packages', exact: true }).waitFor();
  assert.equal(tables.projects[0].data.research_proposal.output_kind, 'grant_proposal');
  assert.equal(tables.projects[0].data.research_proposal.grant_context.confirmed, true);
  assert.equal(tables.projects[0].data.research_proposal.ai_draft.work_packages.length, 1);
  assert.deepEqual(tables.projects[0].data.research_proposal.ai_draft.call_sections.map(section => section.section_name), ['Excellence','Impact','Implementation']);
  assert.equal(tables.projects[0].data.research_proposal.requirement_coverage, undefined, 'coverage remains within the saved draft version');
  assert.equal(tables.projects[0].data.research_proposal.ai_draft.requirement_coverage.length, 12);
  assert.equal(tables.projects[0].data.plan_items.length, 2, 'grant milestones and work packages do not write to the real workplan');
  const grantTitle = grantStudio.getByLabel('Title', { exact: true });
  await grantTitle.fill('Researcher-edited work package title');
  const grantExcellence = grantStudio.getByLabel('Excellence', { exact: true });
  await grantExcellence.fill('Researcher-edited Excellence section.');
  await grantStudio.getByRole('button', { name: 'Save to project', exact: true }).click();
  await grantStudio.getByText('Proposal saved to this private research project.', { exact: true }).waitFor();
  assert.equal(tables.projects[0].data.research_proposal.edited_work_packages[0].title, 'Researcher-edited work package title');
  assert.equal(tables.projects[0].data.research_proposal.edited_call_sections[0].claims[0].text, 'Researcher-edited Excellence section.');
  const grantReview = grantStudio.getByRole('button', { name: 'Save review approval for export', exact: true });
  await grantStudio.getByLabel(/I reviewed the sources, claims, uncertainties/).check();
  await grantReview.click();
  await grantStudio.getByText(/Your review approval is saved/).waitFor();
  const grantDownloadEvent = page.waitForEvent('download');
  await grantStudio.getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const grantDownload = await grantDownloadEvent;
  const grantMarkdown = await readFile(await grantDownload.path(), 'utf8');
  assert.match(grantMarkdown, /Eligibility: Public universities may apply/);
  assert.match(grantMarkdown, /Researcher-edited work package title/);
  assert.match(grantMarkdown, /Researcher-edited Excellence section/);
  assert.match(grantMarkdown, /Requirement coverage/);
  await page.reload();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  assert.equal(await page.locator('section[aria-labelledby="research-proposal-builder-title"]').getByLabel('Proposal type').inputValue(), 'grant_proposal');
  assert.equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'Researcher-edited work package title');
  assert.equal(await page.getByLabel('Excellence', { exact: true }).inputValue(), 'Researcher-edited Excellence section.');
  assert.equal(await page.getByRole('button', { name: 'Export Markdown', exact: true }).isDisabled(), false, 'a saved exact-revision researcher approval survives reload');
  assert.equal(tables.projects[0].data.research_proposal.autonomous_run.output_kind, 'grant_proposal');
  console.log('PASS fixture: grant call quotes + critical confirmation → same autonomous scholarly proposal engine → editable work package → owner-scoped save/reload and approval-gated export; no workplan write.');

  const savedReviewSnapshot = structuredClone(tables.projects[0].data.literature_review);
  tables.projects[0].updated_date = '2099-01-01T00:00:00.000Z';
  await page.locator('section[aria-labelledby="literature-review-builder-title"]').getByRole('button', { name: 'Save to project', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'This project changed in another session.' }).waitFor();
  assert.equal(await reviewQuestion.inputValue(), question, 'version conflicts must preserve the local research question');
  assert.equal(await page.getByLabel('Scientific background claim 1', { exact: true }).inputValue(), 'Researcher-edited synthesis.');
  assert.deepEqual(tables.projects[0].data.literature_review, savedReviewSnapshot, 'a stale save must not overwrite the winning artifact');
  const evidenceCsv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  assert.match((await evidenceCsv).suggestedFilename(), /^evidence-matrix-/);
  Object.assign(tables.projects[0], projectBeforeMatrixFixture);
  tables.saved_papers.splice(0, tables.saved_papers.length, ...papersBeforeMatrixFixture);
  console.log('PASS fixture: scholarly search → Evidence Matrix → source-grounded Literature Review edit/regenerate/save/reload → version-conflict preservation → citation-linked Markdown and matrix CSV export.');

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
  await page.getByLabel('Find a saved publication').fill('unrelated search phrase');
  await page.getByText('No saved papers match these filters. Your recorded decisions have not changed.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Add to screening log' }).count(), 0);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  assert.equal(await page.getByLabel('Find a saved publication').inputValue(), '');
  await page.getByLabel('Filter publication list by status', { exact: true }).selectOption('unscreened');
  await page.getByText('No saved papers match these filters. Your recorded decisions have not changed.').waitFor();
  await page.getByLabel('Filter publication list by status', { exact: true }).selectOption('include');
  assert.equal(await page.getByLabel('Screening decision for Synthetic review protocol fixture paper', { exact: true }).inputValue(), 'include');
  assert.equal(tables.projects[0].data.review_protocol.screening[0].decision, 'include', 'screening filters never mutate saved decisions');
  await page.getByLabel('Filter publication list by status', { exact: true }).selectOption('all');
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

  // A retained human decision must survive once its source leaves recent100.
  const retainedRows = [...tables.saved_papers];
  tables.saved_papers.unshift(...Array.from({ length: 100 }, (_, index) => ({
    id: randomUUID(), user_id: user.id, data: { title: `Newer Library fixture ${index}` },
  })));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/literature-review?project_id=${tables.projects[0].id}`);
    await page.getByLabel('Screening decision for Synthetic review protocol fixture paper', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Screening decision for Synthetic review protocol fixture paper', { exact: true }).inputValue(), 'include');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  await capture(page, 'review-retained-source-mobile');
  await page.getByLabel('Research question').fill('Retained older source still supports my review protocol');
  await page.getByRole('button', { name: 'Save protocol to project', exact: true }).click();
  await page.getByText('Protocol saved privately in this research project.').waitFor();
  const retainedExportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export reproducible JSON', exact: true }).click();
  const retainedStream = await (await retainedExportEvent).createReadStream();
  let retainedJson = '';
  for await (const chunk of retainedStream) retainedJson += chunk;
  const retainedExport = JSON.parse(retainedJson);
  assert.equal(retainedExport.protocol.screening[0].paper_id, retainedRows[0].id);
  assert.equal(retainedExport.protocol.screening[0].title, retainedRows[0].data.title);
  assert.equal(retainedExport.counts.included, 1);
  tables.saved_papers = tables.saved_papers.filter(row => row.id !== retainedRows[0].id);
  await page.reload();
  await page.getByText(/Some screened publications are unavailable in your Library/).waitFor();
  assert.equal(tables.projects[0].data.review_protocol.screening[0].paper_id, retainedRows[0].id, 'An unavailable source must not silently erase a saved human decision');
  await capture(page, 'review-unavailable-source-mobile');
  await page.getByRole('button', { name: 'Save protocol to project', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'One screening record is not in your authorized saved Library.' }).waitFor();
  await page.getByRole('button', { name: `Remove unavailable publication ${retainedRows[0].id}`, exact: true }).click();
  await page.getByRole('button', { name: 'Save protocol to project', exact: true }).click();
  await page.getByText('Protocol saved privately in this research project.').waitFor();
  assert.equal(tables.projects[0].data.review_protocol.screening.length, 0);
  tables.saved_papers = retainedRows;
  console.log('PASS fixture: retained source beyond recent100 renders on desktop/mobile, saves and exports exact metadata; unavailable sources remain explicit until researcher removal. No hosted RLS claim.');

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
  // Public /search is now the EYLO discovery home; this fixture exercises
  // the authenticated literature-analysis workflow, which auto-runs URL queries.
  await page.goto(`${origin}/workspace/literature-search?q=${encodeURIComponent(provenanceTitle)}&goal=review`);
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
    const mobileWidth = await page.evaluate(() => {
      const viewportWidth = innerWidth;
      const documentWidth = document.documentElement.scrollWidth;
      const offenders = [...document.querySelectorAll('body *')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1)
          && getComputedStyle(element).position !== 'fixed';
      }).slice(0, 16).map(element => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className.slice(0, 140) : '',
        text: (element.textContent || '').trim().slice(0, 45),
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }));
      return { viewportWidth, documentWidth, offenders };
    });
    if (mobileWidth.documentWidth > mobileWidth.viewportWidth) {
      console.error('Mobile overflow diagnostics (fixture only):', JSON.stringify(mobileWidth));
    }
    assert.ok(mobileWidth.documentWidth <= mobileWidth.viewportWidth, `${title} mobile overflow`);
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
  // Direct deep-link Back must return to the owning project without creating
  // a two-page loop between the parent and the journal on mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  const parentBack = page.getByRole('link', { name: 'Back to Project', exact: true });
  await parentBack.waitFor();
  assert.equal(new URL(await parentBack.getAttribute('href'), origin).pathname, `/projects/${tables.projects[0].id}`);
  await parentBack.click();
  await page.waitForURL(`${origin}/projects/${tables.projects[0].id}`);
  await page.getByRole('link', { name: 'Back to My workspace', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Back to previous EYLO page' }).count(), 0,
    'returning to a direct deep-link parent must not suggest the departed child again');
  console.log('PASS fixture: direct project deep-link Back returns to its owner without looping to the departed page.');
  await page.setViewportSize({ width: 1280, height: 900 });
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
  assert.equal(Object.keys(workspaceExport.collections).length,WORKSPACE_EXPORT_TABLES.length);
  for(const table of contributionTables) {assert.equal(workspaceExport.collections[table].length,1); assert.equal(workspaceExport.collections[table][0].user_id,user.id);}
  assert.equal(workspaceJson.includes('never-export'),false);
  assert.equal(workspaceJson.includes('Foreign collaboration data'),false);
  console.log(`PASS fixture: Settings downloads owner-validated portable workspace v3 with${WORKSPACE_EXPORT_TABLES.length} collections and excludes token material/foreign contributions; including canonical notes, learning and timer records; file bytes explicitly excluded.`);
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
  await page.goto(`${origin}/habits`);
  await page.getByRole('heading', { name: 'Habits', exact: true }).waitFor();
  const habitToday = await page.getByLabel('First check-in date', { exact: true }).inputValue();
  const tomorrow = new Date(`${habitToday}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  await page.getByLabel('Habit', { exact: true }).fill('Future reading routine');
  await page.getByLabel('First check-in date', { exact: true }).fill(tomorrow.toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Save habit', exact: true }).click();
  await page.getByRole('heading', { name: 'Future reading routine', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Check in for Future reading routine', exact: true }).isDisabled(), true);
  await page.getByLabel('Habit', { exact: true }).fill('Today reading routine');
  await page.getByLabel('First check-in date', { exact: true }).fill(habitToday);
  await page.getByRole('button', { name: 'Save habit', exact: true }).click();
  await page.getByRole('heading', { name: 'Today reading routine', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Check in for Today reading routine', exact: true }).click();
  await page.getByText(/Recorded for .*Next check-in is/).waitFor();
  await page.reload();
  const routine = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Today reading routine', exact: true }) });
  await routine.getByText('Saved check-in history', { exact: true }).click();
  await routine.getByText('Completed', { exact: true }).waitFor();
  await routine.getByText('Scheduled', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Check in for Today reading routine', exact: true }).isDisabled(), true);
  console.log('PASS fixture: future habit check-ins are disabled; saved completion and next scheduled date survive reload in history.');
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
  await page.goto(`${origin}/time-tracker`);
  await page.getByRole('heading', { name: 'Review source methods', exact: true }).waitFor();
  await page.getByLabel('What are you working on?').fill('Private account A draft');
  tables.time_entries.push({ id: randomUUID(), user_id: ownerB.id, description: 'Account B private timer', started_at: now(), ended_at: null, pause_intervals: [], timer_revision: 0 });
  let markTimeOwnerQuery, releaseTimeOwnerQuery;
  const timeOwnerStarted = new Promise(resolve => { markTimeOwnerQuery = resolve; });
  const timeOwnerGate = new Promise(resolve => { releaseTimeOwnerQuery = resolve; });
  await page.route(`${supabaseUrl}/rest/v1/time_entries**`, async route => {
    if (new URL(route.request().url()).searchParams.get('user_id') === `eq.${ownerB.id}`) { markTimeOwnerQuery(); await timeOwnerGate; }
    await route.fallback();
  });
  fixtureUser = ownerB;
  try {
    await page.evaluate(async email => {
      const { supabase } = await import('/src/lib/supabaseClient.js');
      const result = await supabase.auth.signInWithPassword({ email, password: 'Fixture-password-123' });
      if (result.error) throw result.error;
    }, ownerB.email);
    await Promise.race([timeOwnerStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('New timer owner did not reload history')), 5000))]);
    assert.equal(await page.getByRole('heading', { name: 'Review source methods', exact: true }).count(), 0);
    assert.equal(await page.getByLabel('What are you working on?').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Export all CSV', exact: true }).isDisabled(), true);
    releaseTimeOwnerQuery();
    await page.getByRole('heading', { name: 'Account B private timer', exact: true }).waitFor();
    assert.equal(await page.getByText('Private account A draft', { exact: true }).count(), 0);
    console.log('PASS fixture: same-route timer account switch hides old records, draft controls and exports before the new-owner history query resolves.');
  } finally { releaseTimeOwnerQuery(); }

} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
