import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autonomousProposalErrorMessage,
  buildProposalCandidates,
  PROPOSAL_DISCIPLINES,
  PROPOSAL_LANGUAGES,
  runAutonomousProposal,
  planAutonomousProposalQueries,
  hasAutonomousProposalCheckpointReceipt,
  validateProposalSourceSelection,
} from '../src/lib/autonomous-proposal-engine.mjs';
import { METHODOLOGY_TOPICS, PROPOSAL_SECTIONS } from '../src/lib/research-proposal-studio.mjs';
import { exportResearchProposalMarkdown } from '../src/lib/research-proposal-studio.mjs';

const project = { id: 'project-a', title: 'Urban heat', plan_items: [], updated_date: 'v1' };
const source = { id: 'record-1', project_id: 'project-a', source_id: 'doi:10.1000/alpha', title: 'Urban shade and heat', authors: 'A. Researcher', year: '2024', doi: '10.1000/alpha', url: 'https://doi.org/10.1000/alpha', summary: 'Observed air temperature in public spaces.' };
const discovered = { id: 'W123', title: source.title, authors: source.authors, year: source.year, doi: source.doi, url: source.url, summary: source.summary, source_index: 'OpenAlex' };
const proposal = (sourceId = 'record-1') => ({
  sections: PROPOSAL_SECTIONS.map(({ id }) => ({
    section_id: id,
    status: id === 'bibliography' ? 'drafted' : 'needs_input',
    claims: id === 'literature_context' ? [{ heading: 'Record scope', text: 'The supplied abstract describes urban temperature observations.', kind: 'source_fact', source_ids: [sourceId] }] : [],
  })),
  methodology_plan: Object.fromEntries(METHODOLOGY_TOPICS.map(({ id }) => [id, { status: 'needs_input', claims: [] }])),
  milestones: [{ task_key: 'review', phase: 'Preparation', title: 'Review protocol', deliverable: 'Researcher-reviewed protocol', due_date: '', depends_on: [], risk: 'Access and measurement feasibility require local review.', researcher_notes: '', evidence_summary: '', evidence_kind: 'proposal', source_ids: [] }],
});

function adapters({ failDraft = false, badCitationOnce = false, onSearch = () => {}, selectedKey = 'project:record-1', generatedSourceId = 'record-1', verifySource = async () => ({ status: 'Unverified', note: 'Fixture verifier is not configured.' }) } = {}) {
  let draftCalls = 0;
  let saves = 0;
  const checkpoints = [];
  const invoke = async ({ prompt }) => {
    if (prompt.includes('planning a research proposal')) return { research_question: 'How does urban tree cover relate to pedestrian-level heat?', search_query: 'urban tree cover pedestrian-level heat', open_questions: ['Which seasonal periods are essential?'] };
    if (prompt.includes('selecting candidate records')) return { selected_source_keys: [selectedKey], assessments: [{ source_key: selectedKey, reason: 'Matches the proposed urban heat topic.', limitation: 'The abstract alone does not establish causal effects.' }] };
    draftCalls += 1;
    if (failDraft && draftCalls === 1) throw Object.assign(new Error('provider detail'), { status: 504 });
    const answer = proposal(generatedSourceId);
    if (badCitationOnce && draftCalls === 1) answer.sections.find(section => section.section_id === 'literature_context').claims[0].source_ids = ['fabricated-record'];
    return answer;
  };
  return {
    checkpoints, get saves() { return saves; }, get draftCalls() { return draftCalls; },
    invoke,
    search: async ({ query, signal, limit }) => { onSearch(query, { signal, limit }); return { papers: [discovered], source_status: [{ id: 'openalex', status: 'available', count: 1 }] }; },
    savePaper: async paper => { saves += 1; return { ...paper, id: 'saved-record-1', project_id: project.id }; },
    verifySource,
    checkpoint: async run => { checkpoints.push(structuredClone(run)); return { id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }; },
  };
}

test('candidate preparation deduplicates DOI and prefers a project-linked record', () => {
  const candidates = buildProposalCandidates({ discoveries: [discovered], savedPapers: [source], projectId: project.id });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].key, 'project:record-1');
  assert.equal(candidates[0].origin, 'project');
});

test('bounded discovery query planner creates distinct focused, discipline and keyword strategies', () => {
  const queries = planAutonomousProposalQueries({ search_query: 'How does urban tree cover relate to pedestrian-level heat?' }, 'environmental');
  assert.ok(queries.length <= 3);
  assert.equal(new Set(queries).size, queries.length);
  assert.ok(queries.some(query => query.includes('environmental')));
  assert.ok(queries.every(query => query.length <= 600));
});

test('source selection rejects fabricated IDs and only accepts discovered candidates', () => {
  const candidates = buildProposalCandidates({ discoveries: [discovered], projectId: project.id });
  assert.throws(() => validateProposalSourceSelection({ selected_source_keys: ['project:unknown'], assessments: [] }, candidates), /selection_invalid_ids/);
});

test('complete proposal orchestration checkpoints stages, saves authentic sources, and keeps milestones out of workplan', async () => {
  const deps = adapters();
  let current = structuredClone(project);
  const result = await runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project: current,
    savedPapers: [source], contextSelection: { project_objectives: true }, ...deps,
    checkpoint: async run => {
      deps.checkpoints.push(structuredClone(run));
      current = { ...current, updated_date: `v${deps.checkpoints.length}`, research_proposal: { ...(current.research_proposal || {}), autonomous_run: structuredClone(run) } };
      return current;
    },
  });
  assert.equal(result.run.status, 'complete');
  assert.deepEqual(result.run.selected_paper_ids, ['record-1']);
  assert.equal(result.run.proposal_draft.sections.length, 23);
  assert.ok(result.run.search_queries.length <= 3);
  assert.equal(new Set(result.run.search_queries).size, result.run.search_queries.length);
  assert.equal(result.run.bibliography[0].doi, '10.1000/alpha');
  assert.equal(result.run.milestones[0].due_date, '');
  assert.deepEqual(project.plan_items, [], 'generation must not append milestones to the project workplan');
  assert.deepEqual(deps.checkpoints.map(run => run.stage).filter((stage, index, values) => index === 0 || stage !== values[index - 1]), ['plan', 'discover', 'select', 'save_sources', 'verify_sources', 'draft', 'complete']);
  assert.equal(result.run.generation_context.identity_check.includes('record identity only'), true);
  assert.equal(PROPOSAL_DISCIPLINES.some(item => item.id === 'environmental'), true);
  assert.equal(PROPOSAL_LANGUAGES.some(item => item.id === 'en'), true);
});

test('newly discovered selected records are linked before their saved project IDs enter citations', async () => {
  const deps = adapters({ selectedKey: 'discovery:W123', generatedSourceId: 'saved-record-1' });
  let observedSavedSource = false;
  const result = await runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'el', project,
    savedPapers: [], ...deps,
    savePaper: async paper => {
      observedSavedSource = paper.id === 'W123';
      return { ...paper, id: 'saved-record-1', project_id: project.id };
    },
    checkpoint: async run => ({ id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }),
  });
  assert.equal(observedSavedSource, true);
  assert.deepEqual(result.run.selected_paper_ids, ['saved-record-1']);
  assert.equal(result.run.proposal_draft.sections.find(section => section.section_id === 'literature_context').claims[0].source_ids[0], 'saved-record-1');
  assert.equal(result.run.generation_context.language, 'el');
});

test('metadata disagreement is exposed for researcher review and is never treated as evidence support', async () => {
  const deps = adapters({ verifySource: async () => ({
    status: 'Partially verified', source: 'Crossref', note: 'Crossref metadata comparison only.',
    fields: [{ label: 'Title', status: 'mismatch', savedValue: 'Urban shade and heat', sourceValue: 'Different title' }],
  }) });
  const result = await runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [source], ...deps,
  });
  assert.equal(result.run.source_verifications[0].status, 'Partially verified');
  assert.equal(result.run.source_verifications[0].fields[0].status, 'mismatch');
  assert.match(result.run.generation_context.identity_check, /record identity only/);
});

test('a transient draft failure resumes from the durable draft checkpoint without rediscovery', async () => {
  const first = adapters({ failDraft: true });
  let persisted = null;
  const runFirst = async () => runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [source], ...first,
    checkpoint: async run => { persisted = structuredClone(run); return { id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }; },
  });
  await assert.rejects(runFirst(), error => error.message === 'provider_timeout' && error.run.stage === 'draft' && error.run.status === 'failed');
  let searches = 0;
  const resumed = adapters({ onSearch: () => { searches += 1; } });
  const result = await runAutonomousProposal({
    idea: persisted.idea, discipline: persisted.discipline, language: persisted.language, project,
    savedPapers: [source], resumeRun: persisted, ...resumed,
    checkpoint: async run => ({ id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }),
  });
  assert.equal(result.run.status, 'complete');
  assert.equal(searches, 0);
  assert.equal(resumed.draftCalls, 1);
});

test('proposal-specific HTTP 429 saves the draft checkpoint and resumes without repeating source linking', async () => {
  const first = adapters({ selectedKey: 'discovery:W123', generatedSourceId: 'saved-record-1' });
  let durableRun;
  const firstInvoke = first.invoke;
  first.invoke = async input => {
    if (input.prompt.includes('scientific research proposal')) throw Object.assign(new Error('provider throttled'), { status: 429 });
    return firstInvoke(input);
  };
  await assert.rejects(runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [], ...first,
    checkpoint: async run => { durableRun = structuredClone(run); return { id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }; },
  }), error => error.message === 'provider_rate_limited' && error.run.stage === 'draft' && error.run.status === 'failed');
  assert.equal(first.saves, 1, 'the selected discovery is linked once before the provider reports its limit');
  assert.equal(durableRun.error_code, 'provider_rate_limited');
  const resumed = adapters({ generatedSourceId: 'saved-record-1' });
  let searchCalls = 0;
  let resumeSaveCalls = 0;
  resumed.search = async () => { searchCalls += 1; return { papers: [discovered] }; };
  resumed.savePaper = async paper => { resumeSaveCalls += 1; return { ...paper, id: 'saved-record-1', project_id: project.id }; };
  const result = await runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [{ ...discovered, id: 'saved-record-1', project_id: project.id }], resumeRun: durableRun, ...resumed,
    checkpoint: async run => ({ id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }),
  });
  assert.equal(result.run.status, 'complete');
  assert.equal(searchCalls, 0, 'resume from draft does not repeat scholarly discovery');
  assert.equal(resumeSaveCalls, 0, 'resume uses the already receipt-verified linked record');
});

test('cancelling an active proposal provider request saves a paused durable checkpoint', async () => {
  const controller = new AbortController();
  const deps = adapters();
  let startedResolve;
  const started = new Promise(resolve => { startedResolve = resolve; });
  let savedRun;
  const invoke = deps.invoke;
  deps.invoke = async input => {
    if (input.prompt.includes('scientific research proposal')) {
      startedResolve();
      return new Promise((resolve, reject) => input.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }));
    }
    return invoke(input);
  };
  const runPromise = runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [source], ...deps, signal: controller.signal,
    checkpoint: async run => { savedRun = structuredClone(run); return { id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }; },
  });
  await started;
  controller.abort();
  await assert.rejects(runPromise, error => error.message === 'cancelled' && error.run.status === 'paused' && error.run.stage === 'draft');
  assert.equal(savedRun.status, 'paused');
  assert.equal(savedRun.error_code, 'cancelled');
});

test('invalid citation gets one bounded correction attempt; fabricated citation is never accepted', async () => {
  const deps = adapters({ badCitationOnce: true });
  const result = await runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [source], ...deps,
  });
  assert.equal(result.run.status, 'complete');
  assert.equal(deps.draftCalls, 2);
  assert.deepEqual(result.run.proposal_draft.sections.find(section => section.section_id === 'literature_context').claims[0].source_ids, ['record-1']);
});

test('project version conflict stops without retrying a checkpoint write', async () => {
  const deps = adapters();
  let writes = 0;
  await assert.rejects(runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [source], ...deps,
    checkpoint: async () => { writes += 1; throw Object.assign(new Error('stale write'), { code: 'ENTITY_CONFLICT' }); },
  }), error => error.message === 'project_conflict');
  assert.equal(writes, 2, 'only the initial checkpoint and one failed-version checkpoint are attempted');
});

test('cancellation records a resumable checkpoint without losing completed planning', async () => {
  const controller = new AbortController();
  const deps = adapters();
  let lastRun;
  await assert.rejects(runAutonomousProposal({
    idea: 'Study urban tree shade and pedestrian heat exposure', discipline: 'environmental', language: 'en', project,
    savedPapers: [source], ...deps,
    search: async ({ signal }) => { controller.abort(); signal.throwIfAborted(); return { papers: [] }; },
    checkpoint: async run => { lastRun = structuredClone(run); return { id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }; },
    signal: controller.signal,
  }), error => error.message === 'cancelled' && error.run.status === 'paused');
  assert.equal(lastRun.stage, 'discover');
  assert.ok(lastRun.planning.research_question);
});

test('checkpoint receipts bind to exact project and run; Markdown export includes milestones as unapproved', () => {
  const run = { run_id: 'r1', status: 'complete' };
  const receipt = { id: project.id, research_proposal: { autonomous_run: run } };
  assert.equal(hasAutonomousProposalCheckpointReceipt(receipt, project.id, run), true);
  assert.equal(hasAutonomousProposalCheckpointReceipt(receipt, 'other', run), false);
  assert.equal(hasAutonomousProposalCheckpointReceipt({ id: project.id, research_proposal: { autonomous_run: { ...run, status: 'failed' } } }, project.id, run), false);
  const markdown = exportResearchProposalMarkdown({ question: 'Question', researchType: 'other', sections: [], methodologyPlan: {}, bibliography: [], milestones: [{ phase: 'Preparation', title: 'Review protocol', deliverable: 'Protocol', due_date: '', depends_on: [], risk: '', evidence_summary: '', evidence_kind: 'proposal', source_ids: [] }] });
  assert.match(markdown, /Proposed research milestones/);
  assert.match(markdown, /have not been approved or added to the project workplan/);
});

test('provider errors expose no raw details and cancellation has a recoverable message', () => {
  assert.match(autonomousProposalErrorMessage('provider_timeout'), /checkpoint is saved/);
  assert.match(autonomousProposalErrorMessage('cancelled'), /resume it/);
  assert.doesNotMatch(autonomousProposalErrorMessage('provider_failed'), /credential|token|provider detail/i);
});
