import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceProposalWorkflow,
  cancelProposalWorkflow,
  createProposalWorkflow,
  deduplicateProposalSearchResults,
  failProposalWorkflow,
  getProposalWorkflowProgress,
  markProposalResearcherReviewed,
  planProposalQueries,
  PROPOSAL_WORKFLOW_STAGES,
  PROPOSAL_WORKFLOW_BUDGET,
  retryProposalWorkflowStage,
  reviewProposalDraft,
} from '../src/lib/research-proposal-orchestrator.mjs';

test('proposal query planning uses only researcher-supplied topic and discipline within the strategy budget', () => {
  const queries = planProposalQueries({ question: 'How does urban heat affect public health?', discipline: 'epidemiology' });
  assert.equal(queries[0], 'How does urban heat affect public health?');
  assert.ok(queries.some(query => query.includes('epidemiology')));
  assert.ok(queries.length <= PROPOSAL_WORKFLOW_BUDGET.searchStrategies);
  assert.throws(() => planProposalQueries({ question: 'short' }), /at least 8 characters/);
});

test('proposal run advances through the explicit ordered stages and reaches export-ready progress', () => {
  let run = createProposalWorkflow({ projectId: 'project-1', question: 'How does heat affect health?', discipline: 'Public health', now: '2026-01-01T00:00:00Z' });
  for (const stage of PROPOSAL_WORKFLOW_STAGES.slice(1)) run = advanceProposalWorkflow(run, stage, {}, '2026-01-01T00:00:01Z');
  run = { ...run, status: 'complete' };
  assert.equal(run.stage, 'EXPORT_READY');
  assert.equal(getProposalWorkflowProgress(run), 100);
  assert.throws(() => advanceProposalWorkflow(run, 'EXPORT_READY'), /cannot advance/);
});

test('proposal intake requires an idea, discipline, purpose and output language', () => {
  assert.throws(() => createProposalWorkflow({ projectId: 'project-1', question: 'How does heat affect health?' }), /discipline/);
  assert.throws(() => createProposalWorkflow({ projectId: 'project-1', question: 'How does heat affect health?', discipline: 'Public health', language: '' }), /purpose and preferred language/);
});

test('proposal workflow rejects skipped or repeated transitions', () => {
  const run = createProposalWorkflow({ projectId: 'project-1', question: 'How does heat affect health?', discipline: 'Public health' });
  assert.throws(() => advanceProposalWorkflow(run, 'SOURCE_DISCOVERY'), /Invalid proposal workflow transition/);
});

test('export readiness requires an explicit researcher review action', () => {
  let run = createProposalWorkflow({ projectId: 'project-1', question: 'How does heat affect health?', discipline: 'Public health' });
  for (const stage of PROPOSAL_WORKFLOW_STAGES.slice(1, 9)) run = advanceProposalWorkflow(run, stage);
  run = { ...run, status: 'awaiting_researcher' };
  assert.equal(run.stage, 'RESEARCHER_REVIEW');
  assert.throws(() => markProposalResearcherReviewed({ ...run, status: 'running' }), /review stage/);
  const reviewed = markProposalResearcherReviewed(run, '2026-01-01T00:00:00Z');
  assert.equal(reviewed.stage, 'EXPORT_READY');
  assert.equal(reviewed.status, 'complete');
  assert.equal(getProposalWorkflowProgress(reviewed), 100);
});

test('cancellation retains the active stage for resumption and retries stay bounded', () => {
  let run = createProposalWorkflow({ projectId: 'project-1', question: 'How does heat affect health?', discipline: 'Public health' });
  run = advanceProposalWorkflow(run, 'REQUIREMENTS');
  run = failProposalWorkflow(run, 'SEARCH_FAILED');
  run = retryProposalWorkflowStage(run);
  assert.equal(run.stage, 'REQUIREMENTS');
  run = cancelProposalWorkflow(run);
  assert.equal(run.status, 'cancelled');
  assert.equal(run.stage, 'REQUIREMENTS');
  run = retryProposalWorkflowStage({ ...run, status: 'failed' });
  assert.throws(() => retryProposalWorkflowStage({ ...run, status: 'failed' }), /retry limit/);
});

test('proposal source discovery deduplicates DOI duplicates and caps selected records', () => {
  const records = deduplicateProposalSearchResults([
    { papers: [{ id: 'a', title: 'Study A', authors: 'A', year: 2020, doi: '10.1234/abc', source_index: 'OpenAlex' }] },
    { papers: [{ id: 'b', title: 'Study A', authors: 'A', year: 2020, doi: 'https://doi.org/10.1234/abc', source_index: 'Crossref' }] },
  ]);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].indexed_by, ['OpenAlex', 'Crossref']);
  assert.equal(deduplicateProposalSearchResults([{ papers: Array.from({ length: 30 }, (_, id) => ({ id: String(id), title: `Study ${id}`, authors: 'A', year: 2020 })) }], 5).length, 5);
});

test('quality review checks core structure and citation traceability while preserving human verification limits', () => {
  const findings = reviewProposalDraft({
    sections: [
      { section_id: 'research_title', status: 'drafted', claims: [{ text: 'Title', source_ids: ['foreign'] }] },
      { section_id: 'research_questions', status: 'needs_input', claims: [] },
    ],
    methodologyPlan: { sampling: { status: 'needs_input' } },
    papers: [{ id: 'selected' }],
  });
  assert.equal(findings.length, 7);
  assert.equal(findings.find(item => item.pass === 'A').status, 'needs_review');
  assert.equal(findings.find(item => item.pass === 'B').status, 'failed');
  assert.equal(findings.find(item => item.pass === 'C').status, 'human_review_required');
  assert.equal(findings.find(item => item.pass === 'G').status, 'not_applicable');
});
