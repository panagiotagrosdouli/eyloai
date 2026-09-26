import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEntityFilters, rowToEntity, splitPayload } from '../src/services/entity-serialization.js';

test('entity writes keep every application field in the JSONB data column', () => {
  assert.deepEqual(splitPayload({
    title: 'Project',
    project_id: 'project-1',
    year: 2025,
    created_date: 'ignored client metadata',
    user_id: 'ignored user override',
    unknown: undefined,
  }), {
    data: { title: 'Project', project_id: 'project-1', year: 2025 },
  });
});

test('entity rows restore JSONB fields and database timestamps', () => {
  assert.deepEqual(rowToEntity({
    id: 'record-1',
    user_id: 'private-user-id',
    created_date: '2026-01-01T00:00:00Z',
    updated_date: '2026-01-02T00:00:00Z',
    data: { title: 'Saved paper', project_id: 'project-1' },
  }), {
    title: 'Saved paper',
    project_id: 'project-1',
    id: 'record-1',
    created_date: '2026-01-01T00:00:00Z',
    updated_date: '2026-01-02T00:00:00Z',
  });
});

test('empty and malformed JSONB data does not break entity reads', () => {
  assert.equal(rowToEntity(null), null);
  assert.deepEqual(rowToEntity({ id: 'record-2', data: null }), {
    id: 'record-2', created_date: '', updated_date: '',
  });
});

test('entity filters target JSONB data instead of nonexistent table columns', () => {
  const calls = [];
  const query = {
    contains(column, value) { calls.push({ column, value }); return this; },
  };

  assert.equal(applyEntityFilters(query, { project_id: 'project-1' }), query);
  assert.deepEqual(calls, [{ column: 'data', value: { project_id: 'project-1' } }]);
});
