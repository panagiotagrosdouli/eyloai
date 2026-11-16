import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReviewScreeningPapers } from '../src/lib/literature-review-sources.mjs';
import { validateReviewProtocol, reviewProtocolSnapshot } from '../src/lib/literature-review-protocol.mjs';

const protocol = {
  question: 'Which methods were used?', search_strings: 'methods AND outcomes',
  search_databases: 'Recorded Library search', inclusion_criteria: 'Relevant studies', exclusion_criteria: 'Unrelated studies',
  screening: [{ paper_id: 'older-paper', decision: 'include', reason: 'Human decision' }],
};
const recentPapers = Array.from({ length: 100 }, (_, index) => ({ id: `recent-${index}`, title: `Recent ${index}` }));

test('a retained paper beyond the first 100 remains authorized for save and reproducible export', async () => {
  const calls = [];
  const saved = structuredClone(protocol);
  const result = await loadReviewScreeningPapers({ recentPapers, protocol, ownerId: 'owner-a', getPaper: async (id, ownerId) => {
    calls.push({ id, ownerId });
    return { id, title: 'Older retained study', doi: '10.1234/older' };
  } });
  assert.deepEqual(calls, [{ id: 'older-paper', ownerId: 'owner-a' }]);
  assert.equal(result.papers.length, 101);
  assert.deepEqual(result.unavailableIds, []);
  const checked = validateReviewProtocol(protocol, result.papers.map(paper => paper.id));
  assert.equal(checked.ok, true);
  const snapshot = reviewProtocolSnapshot({ id: 'project-a' }, checked.protocol, result.papers, '2026-11-16T00:00:00Z');
  assert.equal(snapshot.protocol.screening[0].title, 'Older retained study');
  assert.equal(snapshot.counts.included, 1);
  assert.deepEqual(protocol, saved, 'Loading never edits the retained human decisions');
});

test('recent records are reused and duplicate references make one owner-checked lookup', async () => {
  let calls = 0;
  const result = await loadReviewScreeningPapers({ recentPapers, protocol: { screening: [
    { paper_id: 'recent-0' }, { paper_id: 'older-paper' }, { paper_id: 'older-paper' },
  ] }, ownerId: 'owner-a', getPaper: async id => { calls++; return { id }; } });
  assert.equal(calls, 1);
  assert.equal(result.papers.length, 101);
});

test('missing or RLS-invisible retained sources stay explicit without inventing metadata or dropping decisions', async () => {
  const result = await loadReviewScreeningPapers({ recentPapers: [], protocol, ownerId: 'owner-a', getPaper: async () => {
    throw Object.assign(new Error('No owner row'), { code: 'PGRST116' });
  } });
  assert.deepEqual(result, { papers: [], unavailableIds: ['older-paper'] });
  assert.equal(validateReviewProtocol(protocol, []).ok, false, 'Cannot silently export a truncated log');
  assert.equal(protocol.screening[0].decision, 'include');
});

for (const code of ['NETWORK_FAILURE', 'WORKSPACE_SCHEMA_MISMATCH', 'ENTITY_OWNER_CHANGED', 'ENTITY_OWNER_MISMATCH']) {
  test(`${code} is a load failure, not an empty source set`, async () => {
    await assert.rejects(loadReviewScreeningPapers({ recentPapers: [], protocol, ownerId: 'owner-a', getPaper: async () => {
      throw Object.assign(new Error('Source read failed'), { code });
    } }), { code });
  });
}

test('a returned source must match the requested retained identifier', async () => {
  await assert.rejects(loadReviewScreeningPapers({ recentPapers: [], protocol, ownerId: 'owner-a', getPaper: async () => ({ id: 'different-paper' }) }), /identifier could not be verified/);
});

test('invalid owner, identifier and oversized stored protocols fail before any source reads', async () => {
  const getPaper = async () => { throw new Error('Unexpected read'); };
  await assert.rejects(loadReviewScreeningPapers({ recentPapers: [], protocol, ownerId: '', getPaper }), /signed-in owner/);
  await assert.rejects(loadReviewScreeningPapers({ recentPapers: [], protocol: { screening: [{ paper_id: {} }] }, ownerId: 'owner-a', getPaper }), /invalid source/);
  await assert.rejects(loadReviewScreeningPapers({ recentPapers: [], protocol: { screening: Array.from({ length: 101 }, () => ({ paper_id: 'paper' })) }, ownerId: 'owner-a', getPaper }), /100-source/);
});

test('source hydration bounds simultaneous authenticated reads to five', async () => {
  let active = 0, peak = 0;
  const result = await loadReviewScreeningPapers({ recentPapers: [], protocol: { screening: Array.from({ length: 12 }, (_, index) => ({ paper_id: `old-${index}` })) }, ownerId: 'owner-a', getPaper: async id => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return { id };
  } });
  assert.equal(peak, 5);
  assert.equal(result.papers.length, 12);
});
