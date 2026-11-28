import test from 'node:test';
import assert from 'node:assert/strict';
import { collectProjectScientificArtifacts, deriveScientificDashboardFindings, scientificSnapshotSignature } from '../src/lib/project-scientific-review.mjs';

const papers = [
  { id: 'p1', project_id: 'owner-1', title: 'Why Most Published Research Findings Are False', year: 2005, doi: '10.1371/journal.pmed.0020124', summary: 'Abstract-only fixture; does not establish claim support.', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1182327/' },
  { id: 'p2', project_id: 'owner-1', title: 'Correction: Why Most Published Research Findings Are False', year: 2022, doi: '10.1371/journal.pmed.1004085', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9410711/' },
  { id: 'foreign', project_id: 'other-owner', title: 'Private foreign record', doi: '10.1371/journal.pmed.0020124', summary: 'Must not show' },
];
const project = {
  id: 'owner-1',
  evidence_matrix: { ai_draft: { rows: [{ paper_id:'p1', findings:'Needs careful interpretation' }] } },
  literature_review: { edited_sections: [{ section_id:'synthesis', claims:[{text:'Unreviewed claim',source_ids:['p1']}] }] },
  research_proposal: { edited_sections:[{section_id:'background',claims:[{kind:'source_fact',text:'A factual claim',source_ids:['p1']},{kind:'proposal',text:'Proposed experiment',source_ids:[]}]}] },
  research_methodology: { edited_topics: { sampling: { claims:[{kind:'proposal',text:'Proposed selection',source_ids:[]}] } } },
  grant_proposal: { edited_sections:[{heading:'Impact',content:'Provisional impact description',source_ids:['p1']}] },
};

test('actual persisted five-stage shapes map to a project-owned unreviewed review snapshot', () => {
  const result = collectProjectScientificArtifacts(project, papers);
  assert.equal(result.artifacts.length, 5);
  assert.deepEqual(result.artifacts.map(a=>a.kind), ['evidence_matrix','literature_review','research_proposal','research_methodology','grant_proposal']);
  assert.deepEqual(result.sources.map(x=>x.id), ['p1','p2']);
  assert.ok(result.artifacts.flatMap(a=>a.claims).every(c=>c.semantic_support==='not_yet_reviewed'));
  assert.equal(result.sources[0].access, 'abstract_only');
  assert.equal(result.sources[1].access, 'metadata_only');
  assert.equal(result.independent_human_reviews, 'not_yet_reviewed');
});

test('a foreign paper ID is never considered a linked citation', () => {
  const changed = structuredClone(project);
  changed.literature_review.edited_sections[0].claims[0].source_ids = ['foreign'];
  const r = collectProjectScientificArtifacts(changed, papers);
  assert.equal(r.artifacts.find(a=>a.kind==='literature_review').claims[0].source_status,'unresolved_source_ids');
  assert.ok(deriveScientificDashboardFindings(r).some(f=>f.kind==='missing_source'));
  assert.equal(r.sources.some(s=>s.id==='foreign'), false);
});

test('source DOI identity and an abstract never auto-promote a claim to supported', () => {
  const r = collectProjectScientificArtifacts(project, papers);
  assert.equal(r.sources[0].doi,'10.1371/journal.pmed.0020124');
  assert.equal(r.artifacts.find(a=>a.kind==='literature_review').claims[0].semantic_support,'not_yet_reviewed');
});

test('edit changes scientific snapshot signature so previous reviewer approval cannot be reused', () => {
  const before = collectProjectScientificArtifacts(project, papers);
  const edited = structuredClone(project);
  edited.grant_proposal.edited_sections[0].content = 'New claim requiring re-review';
  const after = collectProjectScientificArtifacts(edited, papers);
  assert.notEqual(scientificSnapshotSignature(before), scientificSnapshotSignature(after));
});

test('methodology without reviewed sources remains provisional and automated warnings are labeled as checks', () => {
  const r = collectProjectScientificArtifacts(project, papers);
  assert.ok(r.artifacts.some(a=>a.kind==='research_methodology'));
  assert.ok(r.artifacts.some(a=>a.kind==='grant_proposal'));
  assert.equal(deriveScientificDashboardFindings(r).some(f=>f.kind==='insufficient_evidence'),false);
  assert.ok(r.dimensions.includes('methodological_appropriateness'));
  assert.ok(r.dimensions.includes('grant_requirement_coverage'));
});
