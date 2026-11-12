import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireEntityVersion, requireVersionedWriteResult } from '../src/lib/entity-optimistic-version.mjs';
import { reviewSavedGapCandidate } from '../src/lib/gap-candidate-review.mjs';

test('version-aware update requires a previously loaded database timestamp', () => {
  assert.equal(requireEntityVersion('2026-11-12T06:00:00Z'), '2026-11-12T06:00:00Z');
  for (const invalid of ['', null, 'unknown']) {
    assert.throws(() => requireEntityVersion(invalid), error => error.code === 'ENTITY_VERSION_REQUIRED');
  }
});

test('zero-row update is a conflict rather than a successful data save', () => {
  assert.throws(() => requireVersionedWriteResult({ data: null, error: null }),
    error => error.code === 'ENTITY_CONFLICT');
  assert.throws(() => requireVersionedWriteResult({ data: {}, error: null }),
    error => error.code === 'ENTITY_CONFLICT');
  const err = new Error('Network failure');
  assert.throws(() => requireVersionedWriteResult({ error: err }), error => error === err);
  assert.equal(requireVersionedWriteResult({ data: { id: 'owned-record' }, error: null }).id, 'owned-record');
});

test('the repository implements a conditional update under owner and updated_date predicates', () => {
  const source = readFileSync(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8');
  const start = source.indexOf('async updateIfUnchanged(entityId, patch, expectedUpdatedDate)');
  const end = source.indexOf('async delete(entityId)', start);
  assert.ok(start >= 0 && end > start);
  const guarded = source.slice(start, end);
  assert.match(guarded, /requireEntityVersion\(expectedUpdatedDate\)/);
  assert.match(guarded, /\.eq\('user_id', user\.id\)/);
  assert.match(guarded, /\.eq\('updated_date', version\)/);
  assert.match(guarded, /requireVersionedWriteResult\(result\)/);
});

test('stale human reviews surface conflicts rather than overwriting another tab', async () => {
  const original = { question: 'Important question', recorded_at: '2026-11-12T06:00:00Z' };
  const project = { id: 'owned-project', updated_date: '2026-11-12T06:15:00Z', gap_candidates: [original] };
  let versionChecked = null;
  const entities = { Project: {
    async get() { return project; },
    async updateIfUnchanged(id, patch, version) {
      versionChecked = version;
      assert.equal(id, project.id);
      assert.equal(patch.gap_candidates[0].review_status, 'needs_more_evidence');
      throw Object.assign(new Error('This project changed in another tab.'), { code: 'ENTITY_CONFLICT' });
    },
  } };
  await assert.rejects(() => reviewSavedGapCandidate({
    entities, projectId: project.id, index: 0,
    expected: original, status: 'needs_more_evidence', note: 'Further evidence needed',
    reviewedAt: '2026-11-12T06:20:00Z',
  }), error => error.code === 'ENTITY_CONFLICT');
  assert.equal(versionChecked, project.updated_date);
});
