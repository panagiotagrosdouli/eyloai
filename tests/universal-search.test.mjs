import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateSearchResults, searchSourcePage, searchWorkspaceRecords } from '../src/lib/universal-search-domain.mjs';

const collections = {
  Project: [{ id: 'p1', title: 'Climate adaptation', description: 'Coastal resilience' }],
  Note: [{ id: 'n1', title: 'Interview notes', content: 'Climate adaptation evidence' }],
  SavedPaper: [{ id: 'r1', title: 'Coastal change', abstract: 'A climate adaptation study' }],
  Idea: [{ id: 'i1', title: 'Question', content: 'Unrelated topic' }],
};

test('workspace search searches supported private records across sources', () => {
  assert.deepEqual(new Set(searchWorkspaceRecords(collections, 'climate').map(item => item.source)), new Set(['Note', 'Project', 'SavedPaper']));
  assert.deepEqual(searchWorkspaceRecords(collections, 'climate', 'Project').map(item => item.recordId), ['p1']);
  assert.deepEqual(searchWorkspaceRecords(collections, 'x'), []);
});

test('workspace search ranks exact and title matches ahead of body-only matches', () => {
  const result = searchWorkspaceRecords({ Note: [{ id: '1', title: 'Climate', content: '' }, { id: '2', title: 'Other', content: 'Climate info' }] }, 'climate');
  assert.equal(result[0].recordId, '1');
  assert.match(result[1].snippet, /Climate/);
});

test('workspace search returns safe route targets and snippets from matches', () => {
  const [result] = searchWorkspaceRecords({ Project: [{ id: 'safe-id', title: 'Coastal research', description: 'A resilience project' }] }, 'resilience');
  assert.equal(result.href, '/projects/safe-id');
  assert.match(result.snippet, /resilience/);
  const [note] = searchWorkspaceRecords({ Note: [{ id: 'note/1', title: 'Coastal field notes', content: 'Resilience observations' }] }, 'resilience');
  assert.equal(note.href, '/notes?focus=note%2F1');
});

test('workspace search paginates result sets and clamps invalid page sizes', () => {
  const items = Array.from({ length: 45 }, (_, id) => ({ id }));
  assert.deepEqual(paginateSearchResults(items, 2, 20), { items: items.slice(20, 40), total: 45, page: 2, pageSize: 20, pages: 3 });
  assert.equal(paginateSearchResults(items, 999, 0).page, 3);
  assert.equal(paginateSearchResults(items, 2, 500).pageSize, 100);
});

test('server search sends bounded page parameters and normalizes results into individual deep links', async () => {
  let call;
  const result = await searchSourcePage({
    rpc: async (...args) => { call = args; return { data: { total: 43, page: 2, page_size: 20, items: [{ id: 'note/3', title: 'Saved note', snippet: '<b>climate</b>', score: 0.42, updated_date: '2026-01-01T00:00:00Z' }] }, error: null }; },
    source: 'Note', query: ' climate ', page: 2, pageSize: 20,
  });
  assert.equal(call[0], 'search_workspace_records');
  assert.deepEqual(call[1], { p_source: 'Note', p_query: 'climate', p_page: 2, p_page_size: 20 });
  assert.deepEqual(result, {
    items: [{ id: 'Note:note/3', recordId: 'note/3', source: 'Note', sourceLabel: 'Notes', title: 'Saved note', snippet: '<b>climate</b>', updatedDate: '2026-01-01T00:00:00Z', score: 0.42, href: '/notes?focus=note%2F3' }],
    total: 43, page: 2, pageSize: 20, pages: 3,
  });
});

test('server search bounds requests and rejects invalid providers, malformed responses and errors', async () => {
  let call;
  await searchSourcePage({ rpc: async (...args) => { call = args; return { data: { total: 0, page: 1, page_size: 50, items: [] }, error: null }; }, source: 'Project', query: 'ab', page: 10001, pageSize: 500 });
  assert.deepEqual(call[1], { p_source: 'Project', p_query: 'ab', p_page: 10000, p_page_size: 50 });
  await assert.rejects(searchSourcePage({ rpc: async () => ({ data: null, error: null }), source: 'Profile', query: 'ab' }), { code: 'SEARCH_SOURCE_INVALID' });
  await assert.rejects(searchSourcePage({ rpc: async () => ({ data: { total: 1, page: 1, page_size: 20, items: [{ title: 'missing id' }] }, error: null }), source: 'Note', query: 'ab' }), { code: 'SEARCH_RESPONSE_INVALID' });
  await assert.rejects(searchSourcePage({ rpc: async () => ({ data: null, error: { code: '42501', message: 'denied' } }), source: 'Note', query: 'ab' }), { code: '42501', message: 'denied' });
});

