import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLibraryView } from '../src/lib/library-view.mjs';

function fixture() {
  const calls = [];
  const entities = {};
  for (const name of ['Project', 'SavedPaper', 'SavedResearcher', 'SavedOpportunity']) {
    entities[name] = Object.fromEntries(['get', 'list', 'filter'].map(method => [method, async (...args) => {
      calls.push({ name, method, args });
      if (method === 'get') return { id: args[0], title: name + ' exact target', project_id: 'project-b' };
      return method === 'filter' ? [{ id: name + '-b', project_id: args[0].project_id }] : [{ id: name + '-recent' }];
    }]));
  }
  return { calls, entities };
}

test('scoped Library verifies the exact project and filters each collection before its limit', async () => {
  const { calls, entities } = fixture();
  const result = await loadLibraryView({ entities, ownerId: 'owner-a', projectId: 'project-b' });
  assert.deepEqual(calls[0], { name: 'Project', method: 'get', args: ['project-b', 'owner-a'] });
  assert.equal(calls.filter(call => call.method === 'filter').length, 3);
  for (const call of calls.filter(call => call.method === 'filter')) assert.deepEqual(call.args, [{ project_id: 'project-b' }, '-created_date', 1000, 'owner-a']);
  assert.deepEqual(result.papers.map(row => row.id), ['SavedPaper-b']);
  assert.equal(result.projects[0].id, 'project-b', 'An explicit project outside recent1000 stays selectable');
  assert.deepEqual(result.failedCollections, []);
});

test('an exact paper outside recent1000 is loaded directly rather than substituted with recent papers', async () => {
  const { calls, entities } = fixture();
  const result = await loadLibraryView({ entities, ownerId: 'owner-a', paperId: 'older-paper' });
  assert.deepEqual(result.papers.map(row => row.id), ['older-paper']);
  assert.deepEqual(calls.find(call => call.name === 'SavedPaper'), { name: 'SavedPaper', method: 'get', args: ['older-paper', 'owner-a'] });
  assert.equal(calls.some(call => call.name === 'SavedPaper' && call.method === 'list'), false);
});

test('a focused paper outside the requested project cannot appear in that project or its exports', async () => {
  const { entities } = fixture();
  entities.SavedPaper.get = async id => ({ id, project_id: 'project-a', title: 'Wrong project paper' });
  const result = await loadLibraryView({ entities, ownerId: 'owner-a', projectId: 'project-b', paperId: 'paper-a' });
  assert.deepEqual(result.papers, []);
  assert.deepEqual(result.failedCollections, ['papers']);
  assert.equal(result.researchers.length, 1);
});

test('an inaccessible requested project fails before loading any collection', async () => {
  const { calls, entities } = fixture();
  entities.Project.get = async () => { throw new Error('Requested project unavailable'); };
  await assert.rejects(loadLibraryView({ entities, ownerId: 'owner-a', projectId: 'foreign-project' }), /unavailable/);
  assert.deepEqual(calls, []);
});

test('mismatched exact IDs and project-filter responses fail closed without fallback', async () => {
  const { entities } = fixture();
  entities.Project.get = async () => ({ id: 'other-project' });
  await assert.rejects(loadLibraryView({ entities, ownerId: 'owner-a', projectId: 'project-b' }), /could not be verified/);
  entities.Project.get = async id => ({ id });
  entities.SavedPaper.filter = async () => [{ id: 'wrong-project-paper', project_id: 'project-a' }];
  entities.SavedResearcher.filter = async () => { throw new Error('Network unavailable'); };
  const result = await loadLibraryView({ entities, ownerId: 'owner-a', projectId: 'project-b' });
  assert.deepEqual(result.failedCollections, ['papers', 'researchers']);
  assert.deepEqual(result.papers, []);
  assert.equal(result.opportunities.length, 1);
});

test('an unavailable focus is a recoverable collection failure, never a recent-paper fallback', async () => {
  const { entities } = fixture();
  entities.SavedPaper.get = async () => { throw Object.assign(new Error('Not visible'), { code: 'PGRST116' }); };
  let result = await loadLibraryView({ entities, ownerId: 'owner-a', paperId: 'older-paper' });
  assert.deepEqual(result.papers, []);
  assert.deepEqual(result.failedCollections, ['papers']);
  entities.SavedPaper.get = async id => ({ id });
  result = await loadLibraryView({ entities, ownerId: 'owner-a', paperId: 'older-paper' });
  assert.equal(result.papers[0].id, 'older-paper');
  assert.deepEqual(result.failedCollections, []);
});

test('unscoped Library preserves owner-checked lists and partial project-list failure', async () => {
  const { calls, entities } = fixture();
  entities.Project.list = async () => { throw new Error('Projects unavailable'); };
  const result = await loadLibraryView({ entities, ownerId: 'owner-a' });
  assert.equal(result.papers.length, 1);
  assert.equal(result.projectsLoaded, false);
  assert.match(result.notice, /project links could not be loaded/);
  for (const call of calls) assert.deepEqual(call.args, ['-created_date', 1000, 'owner-a']);
});

test('owner identity is mandatory before any read', async () => {
  const { calls, entities } = fixture();
  await assert.rejects(loadLibraryView({ entities, ownerId: '' }), /Sign in/);
  assert.deepEqual(calls, []);
});
