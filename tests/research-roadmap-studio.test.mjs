import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchRoadmapPrompt, validateRoadmapDraft, appendApprovedRoadmapTasks, roadmapErrorMessage, roadmapMarkdown, roadmapSaveReceipt } from '../src/lib/research-roadmap-studio.mjs';
import { normalizeWorkplan, validateWorkplan } from '../src/lib/project-workplan.mjs';

const paper = { id: 'paper-1', project_id: 'project-1', title: 'Study', authors: 'A. Author', year: '2024', summary: 'Abstract only.', doi: '10.1234/study' };
const task = (task_key, overrides = {}) => ({
  task_key, phase: 'Preparation', title: `Review ${task_key}`, deliverable: 'Reviewed protocol draft', due_date: '',
  depends_on: [], risk: '', researcher_notes: '', evidence_summary: '', evidence_kind: 'proposal', source_ids: [], ...overrides,
});
const validDraft = () => ({ tasks: [task('prepare'), task('pilot', { phase: 'Pilot', depends_on: ['prepare'], evidence_summary: 'The abstract describes an intervention.', evidence_kind: 'source_fact', source_ids: ['paper-1'] })] });

test('roadmap validates strict task structure, source authorization, evidence citation and acyclic dependencies', () => {
  assert.equal(validateRoadmapDraft(validDraft(), [paper]).tasks.length, 2);
  const badSource = validDraft(); badSource.tasks[1].source_ids = ['foreign-paper'];
  assert.throws(() => validateRoadmapDraft(badSource, [paper]), /not selected/);
  const uncited = validDraft(); uncited.tasks[1].source_ids = [];
  assert.throws(() => validateRoadmapDraft(uncited, [paper]), /source references/);
  const cycle = validDraft(); cycle.tasks[0].depends_on = ['pilot'];
  assert.throws(() => validateRoadmapDraft(cycle, [paper]), /cycle/);
  const invalidDate = validDraft(); invalidDate.tasks[0].due_date = 'next month';
  assert.throws(() => validateRoadmapDraft(invalidDate, [paper]), /invalid research roadmap task/);
  const inventedDate = validDraft(); inventedDate.tasks[0].due_date = '2026-12-14';
  assert.throws(() => validateRoadmapDraft(inventedDate, [paper]), /not supplied in the selected project workplan/);
  assert.equal(validateRoadmapDraft(inventedDate, [paper], { allowedDates: ['2026-12-14'] }).tasks[0].due_date, '2026-12-14');
  assert.equal(validateRoadmapDraft(inventedDate, [paper], { allowResearcherEnteredDates: true }).tasks[0].due_date, '2026-12-14');
});

test('roadmap prompt uses explicitly selected proposal and methodology context', () => {
  const project = {
    id: 'project-1', title: 'Project', research_proposal: { research_question: 'Q', edited_sections: [{ section_id: 'objectives', claims: [{ text: 'Proposal objective', source_ids: [] }] }] },
    research_methodology: { research_question: 'Q', edited_topics: { analysis_methods: { status: 'drafted', claims: [{ text: 'Proposed analysis', kind: 'proposal', source_ids: [] }] } }, topic_notes: { analysis_methods: 'Private note' } },
    evidence_matrix: { ai_draft: { rows: [{ paper_id: 'paper-1', findings: 'Selected matrix evidence' }, { paper_id: 'other', findings: 'Must not include' }] } },
    plan_items: [{ id: 'work-item', title: 'Current task', phase: 'Analysis', deliverable: 'Reviewed protocol', status: 'todo', risk: 'Workplan risk', researcher_notes: 'Workplan researcher note', evidence_summary: 'Workplan evidence rationale', evidence_kind: 'source_fact', source_ids: ['paper-1', 'foreign-paper'] }],
    secret: 'Must not include',
  };
  const prompt = buildResearchRoadmapPrompt({ question: 'Q', papers: [paper], project, contextSelection: { project_objectives: false, research_proposal: true, research_methodology: true, evidence_matrix: true, literature_review: false, researcher_notes: false } });
  assert.match(prompt, /Proposal objective/); assert.match(prompt, /Proposed analysis/); assert.match(prompt, /Selected matrix evidence/);
  assert.doesNotMatch(prompt, /Private note|Workplan risk|Workplan researcher note|Workplan evidence rationale|foreign-paper|Must not include/);
  const notesPrompt = buildResearchRoadmapPrompt({ question: 'Q', papers: [paper], project, contextSelection: { project_objectives: true, research_proposal: true, research_methodology: true, evidence_matrix: false, literature_review: false, researcher_notes: true } });
  assert.match(notesPrompt, /Private note/);
  assert.match(notesPrompt, /Workplan researcher note/);
  assert.match(notesPrompt, /Workplan evidence rationale/);
  assert.doesNotMatch(notesPrompt, /foreign-paper|Must not include/);
  assert.match(prompt, /due_date must be empty unless an exact target date/);
});

test('researcher approval appends selected tasks and preserves existing workplan items', () => {
  const existing = [{ id: 'existing-1', title: 'Existing task', phase: 'Prior', deliverable: 'Existing output', status: 'todo', depends_on: [], risk: 'Existing risk', researcher_notes: 'Keep this', source_ids: ['paper-1'] }];
  const draft = validDraft();
  const result = appendApprovedRoadmapTasks(existing, draft, ['prepare', 'pilot'], () => `new-${Math.random()}`);
  assert.equal(result.valid, true); assert.equal(result.items.length, 3);
  assert.equal(result.items[0].title, 'Existing task');
  assert.equal(result.items[0].risk, 'Existing risk');
  assert.equal(result.items[1].status, 'todo');
  assert.equal(result.items[2].depends_on[0], result.items[1].id);
  assert.deepEqual(result.items[2].source_ids, ['paper-1']);
  const missingPrerequisite = appendApprovedRoadmapTasks(existing, draft, ['pilot'], () => 'unused');
  assert.equal(missingPrerequisite.valid, false);
  assert.equal(appendApprovedRoadmapTasks(existing, draft, [], () => 'unused').valid, false);
});

test('project workplan persistence normalization retains roadmap metadata and validates dependencies', () => {
  const normalized = normalizeWorkplan([{ id: 'one', title: 'Task', phase: 'Analysis', risk: 'Recruitment risk', researcher_notes: 'Researcher plan note', evidence_summary: 'Abstract reports...', evidence_kind: 'source_fact', source_ids: ['paper-1', 'paper-1'] }]);
  assert.equal(normalized[0].phase, 'Analysis'); assert.equal(normalized[0].risk, 'Recruitment risk');
  assert.equal(normalized[0].researcher_notes, 'Researcher plan note'); assert.equal(normalized[0].evidence_kind, 'source_fact');
  assert.deepEqual(normalized[0].source_ids, ['paper-1']);
  assert.equal(validateWorkplan(normalized).valid, true);
});

test('workplan save receipt verifies the project UUID and complete normalized task list', () => {
  const items = [{ id: 'one', title: 'Task', phase: 'Analysis', deliverable: '', due_date: '', status: 'todo', depends_on: [], risk: '', researcher_notes: '', evidence_summary: '', evidence_kind: 'none', source_ids: [] }];
  assert.equal(roadmapSaveReceipt({ id: 'project-1', plan_items: items }, 'project-1', items), true);
  assert.equal(roadmapSaveReceipt({ id: 'project-2', plan_items: items }, 'project-1', items), false);
  assert.equal(roadmapSaveReceipt({ id: 'project-1', plan_items: [] }, 'project-1', items), false);
});

test('roadmap Markdown export keeps verified source links and proposed status', () => {
  const markdown = roadmapMarkdown({ question: 'Q', tasks: validDraft().tasks, papers: [paper] });
  assert.match(markdown, /Proposed research execution roadmap/);
  assert.match(markdown, /https:\/\/doi\.org\/10\.1234\/study/);
  assert.match(markdown, /No task is represented as completed/);
});

test('roadmap provider and cancellation errors remain safe', () => {
  assert.match(roadmapErrorMessage({ name: 'AbortError' }), /cancelled/i);
  assert.doesNotMatch(roadmapErrorMessage(new Error('provider credential leaked')), /credential/);
});

