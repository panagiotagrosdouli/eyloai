import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectWorkspaceExport, WORKSPACE_EXPORT_TABLES, assertWorkspaceExportOwner,
  MAX_WORKSPACE_EXPORT_BYTES, WorkspaceExportSizeError,
} from '../src/lib/workspace-export.mjs';

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


test('a workspace export cannot be downloaded after the browser changes user accounts', () => {
  const accountB = '00000000-0000-4000-8000-000000000002';
  assert.equal(assertWorkspaceExportOwner(owner, { id: owner }), true);
  assert.throws(() => assertWorkspaceExportOwner(owner, { id: accountB }), /account changed/);
  assert.throws(() => assertWorkspaceExportOwner(owner, null), /account changed/);
  assert.throws(() => assertWorkspaceExportOwner(owner, { id: '' }), /account changed/);
  assert.throws(() => assertWorkspaceExportOwner('', { id: owner }), /account changed/);
});

test('workspace download enforces total rows across all ten collections', async () => {
  const fetcher = makeFetcher({
    projects: [row('projects', 1), row('projects', 2)],
    ideas: [row('ideas', 1), row('ideas', 2)],
  });
  await assert.rejects(
    collectWorkspaceExport({
      userId: owner, pageSize: 2, maxTotalRows: 3,
      fetchPage: fetcher.fetchPage,
    }),
    error => error instanceof WorkspaceExportSizeError && error.code === 'WORKSPACE_EXPORT_SIZE_LIMIT',
  );
});

test('workspace download measures actual UTF-8 byte size of row contents', async () => {
  const record = row('projects', 1);
  record.data.title = '🔬'.repeat(200);
  const fetcher = makeFetcher({ projects: [record] });
  await assert.rejects(
    collectWorkspaceExport({ userId: owner, maxExportBytes: 300, fetchPage: fetcher.fetchPage }),
    error => error instanceof WorkspaceExportSizeError,
  );
});

test('workspace download limits metadata even when tables are empty', async () => {
  await assert.rejects(
    collectWorkspaceExport({
      userId: owner,
      userMetadata: { research_interests: 'x'.repeat(3000) },
      maxExportBytes: 1000,
      fetchPage: makeFetcher().fetchPage,
    }),
    error => error.code === 'WORKSPACE_EXPORT_SIZE_LIMIT',
  );
});

test('workspace download rejects invalid byte and total row ceilings', async () => {
  const fetchPage = makeFetcher().fetchPage;
  for (const options of [{ maxExportBytes: 0 }, { maxTotalRows: 0 }, { maxTotalRows: 1, pageSize: 2 }]) {
    await assert.rejects(collectWorkspaceExport({ userId: owner, fetchPage, ...options }), /safety limit/);
  }
  assert.equal(MAX_WORKSPACE_EXPORT_BYTES, 50 * 1024 * 1024);
});

test('portable workspace version2 preserves canonical notes, file versions, learning and EYRA data with explicit byte exclusions', async () => {
  const data = {
    notes: [{ ...row('notes', 1), data: { title: 'Private note', content: 'Owner material' }, version: 2 }],
    note_versions: [{ ...row('note_versions', 1), snapshot: { content: 'Earlier owner material' } }],
    eyra_messages: [{ ...row('eyra_messages', 1), role: 'assistant', content: { text: 'Owner conversation' }, sources: [] }],
    eylo_file_versions: [{ ...row('eylo_file_versions', 1), storage_path: `${owner}/private-file/version.txt` }],
    learning_courses: [row('learning_courses', 1)],
    grant_applications: [row('grant_applications', 1)],
  };
  const fetcher = makeFetcher(data);
  const result = await collectWorkspaceExport({ userId: owner, fetchPage: fetcher.fetchPage });
  assert.equal(result.version, 2);
  for (const [table, rows] of Object.entries(data)) assert.deepEqual(result.collections[table], rows);
  assert.ok(result.limitations.some(value => value.includes('uploaded file bytes are not')));
  assert.ok(fetcher.calls.every(call => WORKSPACE_EXPORT_TABLES.includes(call.table)));
});
test('a foreign canonical EYRA message aborts export before any file can be emitted', async () => {
  const fetcher = makeFetcher({ eyra_messages: [{ ...row('eyra_messages', 1, 'other-owner'), content: { text: 'Private other account' } }] });
  await assert.rejects(collectWorkspaceExport({ userId: owner, fetchPage: fetcher.fetchPage }), /ownership/);
});
