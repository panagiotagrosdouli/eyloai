import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewProposalDraft } from '../src/lib/proposal-quality-review.mjs';
import { METHODOLOGY_TOPICS, PROPOSAL_SECTIONS } from '../src/lib/research-proposal-studio.mjs';

const paper = { id: 'selected-1' };
const completeSections = PROPOSAL_SECTIONS.map(({ id }) => ({ section_id: id, status: 'drafted', claims: [] }));
const methods = Object.fromEntries(METHODOLOGY_TOPICS.map(({ id }) => [id, { status: 'drafted', claims: [] }]));

test('proposal QC checks structure and flags unresolved scientific support for human review', () => {
  const findings = reviewProposalDraft({ sections: completeSections, methodologyPlan: methods, papers: [paper] });
  assert.equal(findings.length, 10);
  assert.equal(findings.find(item => item.pass === 'A').status, 'passed');
  assert.equal(findings.find(item => item.pass === 'C').status, 'human_review_required');
  assert.match(findings.find(item => item.pass === 'C').details, /cannot establish/);
  assert.equal(findings.find(item => item.pass === 'J').status, 'not_applicable');
});

test('proposal QC checks source identifiers in methodology claims as well as proposal sections', () => {
  const methodologyPlan = structuredClone(methods);
  methodologyPlan.validation.claims = [{ source_ids: ['fabricated-source'] }];
  const findings = reviewProposalDraft({ sections: completeSections, methodologyPlan, papers: [paper] });
  assert.equal(findings.find(item => item.pass === 'D').status, 'failed');
});
