import test from 'node:test';
import assert from 'node:assert/strict';
import {
  METHODOLOGY_SECTIONS, RESEARCH_METHODOLOGY_SCHEMA, buildMethodologyPrompt,
  validateMethodologyDraft, methodologySaveReceipt, methodologyErrorMessage, methodologyMarkdown,
} from '../src/lib/research-methodology-studio.mjs';

const paper = { id: 'paper-1', project_id: 'project-1', title: 'A study', authors: 'A. Author', year: '2024', doi: '10.1234/example', url: 'https://doi.org/10.1234/example', summary: 'Abstract only.' };
const draft = () => ({ topics: Object.fromEntries(METHODOLOGY_SECTIONS.map(section => [section.id, { status: 'drafted', claims: [] }])) });

test('methodology schema requires every discipline-adaptable section and rejects extra keys', () => {
  assert.deepEqual(RESEARCH_METHODOLOGY_SCHEMA.properties.topics.required, METHODOLOGY_SECTIONS.map(section => section.id));
  assert.equal(RESEARCH_METHODOLOGY_SCHEMA.additionalProperties, false);
  assert.equal(RESEARCH_METHODOLOGY_SCHEMA.properties.topics.additionalProperties, false);
});

test('methodology draft validates all sections and marks every generated method proposed', () => {
  const result = draft();
  result.topics.study_design.claims.push({ heading: 'Design', text: 'A proposed prospective design.', kind: 'proposal', source_ids: [] });
  const validated = validateMethodologyDraft(result, [paper]);
  assert.equal(validated.topics.study_design.implementation_state, 'proposed');
  assert.equal(validated.topics.study_design.claims[0].origin, 'eyra');
  delete result.topics.limitations;
  assert.throws(() => validateMethodologyDraft(result, [paper]), /incomplete/);
});

test('methodology rejects fabricated, cross-project and uncited source-based claims', () => {
  for (const claim of [
    { heading: 'Fact', text: 'A factual assertion.', kind: 'source_fact', source_ids: [] },
    { heading: 'Fact', text: 'A factual assertion.', kind: 'source_fact', source_ids: ['unknown'] },
    { heading: 'Fact', text: 'A factual assertion.', kind: 'interpretation', source_ids: ['project-2-paper'] },
  ]) {
    const result = draft(); result.topics.data_sources.claims = [claim];
    assert.throws(() => validateMethodologyDraft(result, [paper]), /citation|selected/);
  }
});

test('authorized prompt includes only selected scholarly records and explicitly checked project outputs', () => {
  const project = {
    id: 'project-1', title: 'Project', private_secret: 'do not send',
    objectives: ['Objective one', 'Objective two'],
    evidence_matrix: { research_question: 'Q', ai_draft: { rows: [{ paper_id: 'paper-1', findings: 'Reported abstract-level finding' }, { paper_id: 'other', findings: 'exclude' }] }, annotations: { 'paper-1': { note: 'Researcher note' } } },
    literature_review: { research_question: 'Q', edited_sections: [{ heading: 'Theme', claims: [{ text: 'Review claim', source_ids: ['paper-1'] }] }] },
    research_proposal: { research_question: 'Q', selected_paper_ids: ['paper-1'], edited_sections: [{ claims: [{ text: 'Proposal claim', source_ids: ['paper-1'] }] }] },
  };
  const prompt = buildMethodologyPrompt({ question: 'Q', discipline: 'qualitative', papers: [paper], project, contextSelection: { project_objectives: true, evidence_matrix: true, literature_review: false, research_proposal: true, researcher_notes: false } });
  assert.match(prompt, /Objective one/);
  assert.match(prompt, /Reported abstract-level finding/);
  assert.match(prompt, /Proposal claim/);
  assert.doesNotMatch(prompt, /Review claim|Researcher note|exclude|do not send/);
  assert.match(prompt, /metadata and abstracts/);
  assert.match(prompt, /Do not invent experiments already performed/);
});

test('methodology save receipt requires matching project UUID and exact artifact', () => {
  const artifact = { research_question: 'Q', edited_topics: draft().topics };
  assert.equal(methodologySaveReceipt({ id: 'project-1', research_methodology: artifact }, 'project-1', artifact), true);
  assert.equal(methodologySaveReceipt({ id: 'project-2', research_methodology: artifact }, 'project-1', artifact), false);
  assert.equal(methodologySaveReceipt({ id: 'project-1', research_methodology: {} }, 'project-1', artifact), false);
});

test('safe errors cover cancel, rate limit, timeout and malformed output', () => {
  assert.match(methodologyErrorMessage({ name: 'AbortError' }), /cancelled/i);
  assert.match(methodologyErrorMessage({ status: 429, retryAfterSeconds: 3 }), /3 seconds/);
  assert.match(methodologyErrorMessage({ code: 'EYRA_TIMEOUT' }), /timed out/);
  assert.match(methodologyErrorMessage(new Error('sensitive provider detail')), /valid methodology plan/);
  assert.doesNotMatch(methodologyErrorMessage(new Error('sensitive provider detail')), /sensitive/);
});

test('Markdown export contains all sections and verified DOI links with unverified researcher-state labels', () => {
  const topics = draft().topics;
  topics.study_design.claims = [{ heading: 'Design', text: 'Researcher proposal.', kind: 'proposal', origin: 'researcher', source_ids: ['paper-1'] }];
  topics.study_design.implementation_state = 'researcher_reported_validated';
  const markdown = methodologyMarkdown({ question: 'Q', discipline: 'quantitative', topics, papers: [paper] });
  for (const section of METHODOLOGY_SECTIONS) assert.match(markdown, new RegExp(`## ${section.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(markdown, /https:\/\/doi\.org\/10\.1234\/example/);
  assert.match(markdown, /not independently verified/);
  assert.match(markdown, /Researcher edit/);
});
