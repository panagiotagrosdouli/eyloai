import test from 'node:test';
import assert from 'node:assert/strict';
import { PROPOSAL_SECTIONS, METHODOLOGY_TOPICS } from '../src/lib/research-proposal-studio.mjs';
import { runAutonomousProposal } from '../src/lib/autonomous-proposal-engine.mjs';
import {
  buildGrantRequirementExtractionPrompt, grantCriticalRequirementIds, hasConfirmedCriticalGrantRequirements,
  grantRequiredSections, GRANT_REQUIREMENT_FIELDS, validateGrantProposalFields, validateGrantRequirements,
} from '../src/lib/grant-proposal-workflow.mjs';

const callText = [
  'Programme: Urban Research Call', 'Funding body: Example Research Agency', 'Call identifier: URC-2027-A',
  'Eligibility: Public universities may apply.', 'Deadline: 1 December 2027.', 'Scientific scope: Urban heat adaptation.',
  'Evaluation criteria: Excellence and impact.', 'Required sections: Excellence; Impact; Implementation.',
  'Page limits: 10 pages.', 'Formatting: 11 point font.', 'Budget constraints: Personnel and travel costs are eligible.',
  'Required attachments: Applicant CVs.',
].join('\n');
const quoteFor = id => callText.split('\n').find(line => line.toLowerCase().startsWith(`${id.replaceAll('_', ' ')}:`)) || '';
function requirements() {
  const listIds = new Set(['eligibility', 'evaluation_criteria', 'required_sections', 'page_limits', 'formatting', 'budget_constraints', 'required_attachments']);
  return Object.fromEntries(GRANT_REQUIREMENT_FIELDS.map(({ id }) => {
    const item = { value: quoteFor(id).split(': ').slice(1).join(': '), classification: 'direct', evidence_quote: quoteFor(id), section_or_page: '' };
    return [id, listIds.has(id) ? [item] : item];
  }));
}
const confirmedContext = () => ({
  source_name: 'official-call.txt', source_text: callText, requirements: requirements(),
  applicant_information: 'Applicant institution type not yet confirmed.', confirmed: true,
  confirmed_requirement_ids: grantCriticalRequirementIds(requirements()),
});

test('grant requirement quotes must be verbatim and missing fields cannot contain invented values', () => {
  const raw = requirements();
  raw.deadline.evidence_quote = 'Deadline: 1 January 2028.';
  assert.throws(() => validateGrantRequirements(raw, callText), /grant_requirement_quote_unverified/);
  const valid = requirements();
  valid.programme = { value: 'Invented programme', classification: 'missing', evidence_quote: '', section_or_page: '' };
  assert.throws(() => validateGrantRequirements(valid, callText), /grant_missing_requirement_has_content/);
});

test('requirement provenance keeps only locations present in the official text', () => {
  const raw = requirements();
  raw.deadline.section_or_page = 'Page 7';
  const checked = validateGrantRequirements(raw, callText);
  assert.equal(checked.deadline.section_or_page, '');
  raw.deadline.section_or_page = 'Deadline: 1 December 2027.';
  assert.equal(validateGrantRequirements(raw, callText).deadline.section_or_page, 'Deadline: 1 December 2027.');
});

test('grant intake prompt constrains extraction to the official text and labels uncertainty', () => {
  const prompt = buildGrantRequirementExtractionPrompt({ documentName: 'call.txt', sourceText: callText });
  assert.match(prompt, /Do not use outside knowledge/);
  assert.match(prompt, /exact evidence_quote copied verbatim/);
  assert.match(prompt, /eligibility, deadlines, amounts/);
  assert.match(prompt, /classification=missing/);
});

test('all critical requirements, including missing items, need researcher confirmation', () => {
  const context = confirmedContext();
  assert.equal(hasConfirmedCriticalGrantRequirements(context), true);
  context.confirmed_requirement_ids.pop();
  assert.equal(hasConfirmedCriticalGrantRequirements(context), false);
  context.confirmed_requirement_ids = grantCriticalRequirementIds(context.requirements);
  context.confirmed = false;
  assert.equal(hasConfirmedCriticalGrantRequirements(context), false);
});

test('engine refuses unconfirmed call requirements before any provider call', async () => {
  let calls = 0;
  await assert.rejects(runAutonomousProposal({
    idea: 'Study a funding call research topic', discipline: 'environmental', language: 'en',
    project: { id: 'project-grant', title: 'Project' }, grantCallContext: { ...confirmedContext(), confirmed: false },
    invoke: async () => { calls += 1; }, search: async () => ({ papers: [] }),
    savePaper: async value => value, checkpoint: async () => ({}),
  }), /grant_critical_requirements_unconfirmed/);
  assert.equal(calls, 0);
});

test('grant proposal fields reject invented financial amounts and incomplete coverage', () => {
  const good = {
    call_sections: grantRequiredSections(requirements()).map(({ name }) => ({ section_name: name, status: 'needs_input', claims: [] })),
    work_packages: [{ title: 'Protocol design', objective: 'Develop a reviewable protocol', activities: ['Co-design measures'], deliverables: ['Draft protocol'], milestone_keys: ['protocol'] }],
    budget_notes: ['Budget categories require applicant confirmation.'],
    requirement_coverage: GRANT_REQUIREMENT_FIELDS.map(({ id }) => ({ requirement_id: id, status: 'unverified', note: 'Researcher review required.' })),
  };
  assert.equal(validateGrantProposalFields(good, requirements()).work_packages.length, 1);
  assert.throws(() => validateGrantProposalFields({ ...good, budget_notes: ['Personnel: €100,000'] }, requirements()), /grant_budget_amount_unsupported/);
  assert.throws(() => validateGrantProposalFields({ ...good, requirement_coverage: good.requirement_coverage.slice(1) }, requirements()), /grant_requirement_coverage_invalid/);
  assert.throws(() => validateGrantProposalFields({ ...good, call_sections: good.call_sections.slice(1) }, requirements()), /grant_call_sections_invalid/);
});

test('single autonomous engine produces resumable grant draft and never writes milestones to workplan', async () => {
  const project = { id: 'project-grant', title: 'Urban heat', updated_date: 'v1', plan_items: [] };
  const paper = { id: 'paper-grant', project_id: project.id, title: 'Urban heat adaptation study', authors: 'A. Author', year: '2024', doi: '10.1000/urban', url: 'https://doi.org/10.1000/urban', summary: 'Study of urban heat exposure.' };
  const checkpoints = [];
  const prompts = [];
  let failDraftOnce = true;
  let planningCalls = 0;
  let searchCalls = 0;
  const sectionDraft = {
    sections: PROPOSAL_SECTIONS.map(({ id }) => ({ section_id: id, status: id === 'bibliography' ? 'drafted' : 'needs_input', claims: [] })),
    methodology_plan: Object.fromEntries(METHODOLOGY_TOPICS.map(({ id }) => [id, { status: 'needs_input', claims: [] }])),
    call_sections: grantRequiredSections(requirements()).map(({ name }) => ({ section_name: name, status: 'needs_input', claims: [{ heading: name, text: `${name} needs researcher review.`, kind: 'proposal', source_ids: [] }] })),
    milestones: [{ task_key: 'protocol', phase: 'Preparation', title: 'Review protocol', deliverable: 'Researcher-reviewed protocol', due_date: '', depends_on: [], risk: 'Feasibility requires review.', researcher_notes: '', evidence_summary: '', evidence_kind: 'proposal', source_ids: [] }],
    work_packages: [{ title: 'Protocol design', objective: 'Develop a reviewable protocol', activities: ['Co-design measures'], deliverables: ['Draft protocol'], milestone_keys: ['protocol'] }],
    budget_notes: ['Budget categories require applicant confirmation.'],
    requirement_coverage: GRANT_REQUIREMENT_FIELDS.map(({ id }) => ({ requirement_id: id, status: 'unverified', note: 'Researcher review required.' })),
  };
  const invoke = async ({ prompt }) => {
    prompts.push(prompt);
    if (prompt.includes('planning a research proposal')) { planningCalls += 1; return { research_question: 'How does urban design affect heat exposure?', search_query: 'urban design heat exposure', open_questions: ['Which season is relevant?'] }; }
    if (prompt.includes('selecting candidate records')) return { selected_source_keys: ['project:paper-grant'], assessments: [{ source_key: 'project:paper-grant', reason: 'Topic match.', limitation: 'Abstract only.' }] };
    if (failDraftOnce) { failDraftOnce = false; throw Object.assign(new Error('temporary provider failure'), { status: 503 }); }
    return structuredClone(sectionDraft);
  };
  const input = {
    idea: 'Study urban design and heat exposure in cities', discipline: 'environmental', language: 'en', project,
    savedPapers: [paper], grantCallContext: confirmedContext(), invoke,
    search: async () => { searchCalls += 1; return { papers: [], source_status: [] }; }, savePaper: async value => value,
    verifySource: async () => ({ status: 'Unverified', note: 'Fixture only.' }),
    checkpoint: async run => { checkpoints.push(structuredClone(run)); return { id: project.id, research_proposal: { autonomous_run: structuredClone(run) } }; },
  };
  let failedRun;
  await assert.rejects(runAutonomousProposal(input), error => {
    failedRun = error.run;
    return error.run?.stage === 'draft' && error.run?.status === 'failed';
  });
  assert.ok(failedRun, 'the failed grant draft remains at its verified checkpoint');
  const discoveryCallsAtFailure = searchCalls;
  const result = await runAutonomousProposal({ ...input, resumeRun: failedRun });
  assert.equal(result.run.status, 'complete');
  assert.equal(result.run.output_kind, 'grant_proposal');
  assert.equal(result.run.proposal_draft.work_packages[0].title, 'Protocol design');
  assert.equal(result.run.proposal_draft.requirement_coverage.length, GRANT_REQUIREMENT_FIELDS.length);
  assert.equal(result.run.milestones[0].due_date, '');
  assert.equal(planningCalls, 1, 'resume does not replan');
  assert.equal(searchCalls, discoveryCallsAtFailure, 'resume does not repeat scholarly discovery');
  assert.deepEqual(project.plan_items, []);
  assert.ok(prompts.at(-1).includes('GRANT PROPOSAL MODE'));
  assert.ok(checkpoints.some(run => run.grant_call?.confirmed === true));
});
