import test from 'node:test';
import assert from 'node:assert/strict';
import { collectWorkspaceExport, WORKSPACE_EXPORT_TABLES } from '../src/lib/workspace-export.mjs';

const owner = '00000000-0000-4000-8000-000000000001';
function makeFetcher(dataByTable = {}) {
  const calls = [];
  return {
    calls,
    fetchPage: async (table, { offset, limit, userId }) => {
      calls.push({ table, offset, limit, userId });
      return { data: (dataByTable[table] || []).slice(offset, offset + limit), error: null };
    },
  };
}
function row(table, i, userId = owner) {
  return { id: table + '-' + i, user_id: userId, data: { title: table + ' ' + i } };
}

test('exports all user-owned collections, including records beyond the first page', async () => {
  const data = { saved_papers: [row('saved_papers', 1), row('saved_papers', 2), row('saved_papers', 3)] };
  const fetcher = makeFetcher(data);
  const result = await collectWorkspaceExport({
    userId: owner, email: 'disposable@example.invalid', fetchPage: fetcher.fetchPage, pageSize: 2,
    exportedAt: () => '2026-11-05T00:00:00Z',
  });
  assert.equal(result.collections.saved_papers.length, 3);
  assert.deepEqual(result.collections.projects, []);
  assert.equal(result.record_counts.saved_papers, 3);
  assert.equal(result.scope, 'authenticated-workspace-only');
  assert.ok(result.limitations.some(s => s.includes('Not a complete')));
  assert.deepEqual(new Set(Object.keys(result.collections)), new Set(WORKSPACE_EXPORT_TABLES));
  assert.deepEqual(fetcher.calls.filter(call => call.table === 'saved_papers').map(c => c.offset), [0, 2]);
});

test('aborts on any cross-account record instead of exporting it', async () => {
  const fetcher = makeFetcher({ projects: [row('projects', 1, 'different-user')] });
  await assert.rejects(
    collectWorkspaceExport({ userId: owner, fetchPage: fetcher.fetchPage }),
    /ownership/,
  );
  assert.equal(fetcher.calls.filter(c => c.table !== 'projects').length, 0);
});

test('aborts on error or malformed response rather than generating a partial file', async () => {
  await assert.rejects(collectWorkspaceExport({
    userId: owner, fetchPage: async () => ({ error: new Error('db unavailable') }),
  }), /read failed/);
  await assert.rejects(collectWorkspaceExport({
    userId: owner, fetchPage: async () => ({ data: null }),
  }), /invalid database response/);
});

test('detects duplicate pages that could hide records', async () => {
  await assert.rejects(collectWorkspaceExport({
    userId: owner, pageSize: 2,
    fetchPage: async (table) => ({
      data: table === 'projects' ? [row('projects', 1), row('projects', 1)] : [],
    }),
  }), /unstable pagination/);
});

test('fails instead of silently truncating a full table', async () => {
  const fetcher = makeFetcher({ projects: [row('projects', 1), row('projects', 2), row('projects', 3)] });
  await assert.rejects(collectWorkspaceExport({
    userId: owner, pageSize: 2, maxRowsPerTable: 2, fetchPage: fetcher.fetchPage,
  }), /safety limit/);
});

test('rejects missing session, invalid page sizes and unscoped exports', async () => {
  await assert.rejects(collectWorkspaceExport({ userId: '', fetchPage: async () => ({ data: [] }) }), /identity/);
  await assert.rejects(collectWorkspaceExport({ userId: owner, fetchPage: null }), /fetcher/);
  await assert.rejects(collectWorkspaceExport({ userId: owner, fetchPage: async () => ({ data: [] }), pageSize: 1000 }), /page size/);
});
