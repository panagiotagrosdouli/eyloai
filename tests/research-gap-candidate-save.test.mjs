import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSavedGapCandidate, saveResearchGapCandidate } from '../src/lib/research-gap-candidate-save.mjs';

const papers = [
  { id: 'owner-paper-a', title: 'Paper A', doi: '10.1000/a', year: 2023 },
  { id: 'owner-paper-b', title: 'Paper B', doi: '10.1000/b', year: 2024 },
];
const gap = {
  question: 'Does this method generalize?',
  proposed_question: 'Does this method generalize across datasets?',
  supporting_papers: ['P1'],
  counterevidence_papers: ['P2'],
  explanation: 'A candidate from a narrow sample',
  uncertainty: 'No exhaustive search',
};
const at = '2026-11-11T21:00:00.000Z';

test('candidate preserves source identities, counterevidence and uncertainty', () => {
  const saved = buildSavedGapCandidate(gap, papers, at);
  assert.equal(saved.review_status, 'candidate_needs_human_review');
  assert.equal(saved.supporting_papers[0].paper_id, 'owner-paper-a');
  assert.equal(saved.counterevidence_papers[0].paper_id, 'owner-paper-b');
  assert.deepEqual(saved.selected_source_ids, ['owner-paper-a', 'owner-paper-b']);
  assert.equal(saved.uncertainty, 'No exhaustive search');
});

test('rejects fake source IDs and unsupported hypotheses rather than inventing provenance', () => {
  assert.throws(() => buildSavedGapCandidate({ ...gap, supporting_papers: ['P3'] }, papers, at), /Unverified/);
  assert.throws(() => buildSavedGapCandidate({ ...gap, supporting_papers: [] }, papers, at), /supporting paper/);
  assert.throws(() => buildSavedGapCandidate(gap, [{ id: 'owner-paper-a' }], at), /at least two/);
});

test('persists candidate to existing user-owned project and deduplicates repeated saves', async () => {
  const writes = [];
  const project = { id: 'owner-project', title: 'Project one', updated_date: '2026-11-12T06:00:00Z', gap_candidates: [] };
  const entities = { Project: {
    async get(id) { assert.equal(id, 'owner-project'); return project; },
    async updateIfUnchanged(id, patch, version) {
      assert.equal(version, project.updated_date);
      assert.equal(id, 'owner-project');
      writes.push(patch);
      project.gap_candidates = patch.gap_candidates;
      return project;
    },
  } };
  const input = { entities, projectId: project.id, gap, selectedPapers: papers, recordedAt: at };
  assert.deepEqual(await saveResearchGapCandidate(input), { status: 'saved', count: 1 });
  assert.deepEqual(await saveResearchGapCandidate(input), { status: 'already_saved', count: 1 });
  assert.equal(writes.length, 1);
});

test('refuses missing/unowned projects and cannot overwrite an existing candidate list at its cap', async () => {
  await assert.rejects(() => saveResearchGapCandidate({
    entities: { Project: { async get() { return null; } } },
    projectId: 'missing-project', gap, selectedPapers: papers, recordedAt: at,
  }), /unavailable/);
  await assert.rejects(() => saveResearchGapCandidate({
    entities: { Project: { async get() { return { id: 'owner-project', gap_candidates: Array.from({ length: 20 }, (_, i) => ({ question: 'old-' + i })) }; } } },
    projectId: 'owner-project', gap, selectedPapers: papers, recordedAt: at,
  }), /20-candidate/);
});
