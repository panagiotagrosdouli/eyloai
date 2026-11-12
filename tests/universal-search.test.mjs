import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateSearchResults, searchWorkspaceRecords } from '../src/lib/universal-search-domain.mjs';
import { readFile } from 'node:fs/promises';

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
});

test('workspace search paginates result sets and clamps invalid page sizes', () => {
  const items = Array.from({ length: 45 }, (_, id) => ({ id }));
  assert.deepEqual(paginateSearchResults(items, 2, 20), { items: items.slice(20, 40), total: 45, page: 2, pageSize: 20, pages: 3 });
  assert.equal(paginateSearchResults(items, 999, 0).page, 3);
  assert.equal(paginateSearchResults(items, 2, 500).pageSize, 100);
});

test('workspace search page uses per-user repositories and reports partial source errors', async () => {
  const [ui, repo, app] = await Promise.all([
    readFile(new URL('../src/pages/UniversalSearch.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(repo, /async list\(sort = '-created_date', limit = 100\)[\s\S]*eq\('user_id', user\.id\)/);
  assert.match(ui, /Promise\.allSettled/);
  assert.match(ui, /Some sources could not be loaded/);
  assert.match(ui, /pageData\.pages/);
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*<Route path="\/workspace\/search" element=\{<UniversalSearch \/>\}/);
});
