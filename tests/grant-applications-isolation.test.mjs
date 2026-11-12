import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createGrantApplicationRepository,
  GrantApplicationConflictError,
  legacyGrantApplication,
} from '../src/lib/grant-applications-repository.mjs';

function memoryClient() {
  const rows = [];
  const filtersSeen = [];
  let nextId = 0;
  return {
    rows,
    filtersSeen,
    from(table) {
      assert.equal(table, 'grant_applications');
      let action = 'select';
      let values = null;
      const conditions = [];
      const builder = {
        select() { return builder; },
        insert(row) { action = 'insert'; values = row; return builder; },
        update(patch) { action = 'update'; values = patch; return builder; },
        eq(key, value) { conditions.push([key, value]); return builder; },
        async maybeSingle() { return execute(false); },
        async single() { return execute(true); },
      };
      async function execute(single) {
        filtersSeen.push([...conditions]);
        const matches = (row) => conditions.every(([key, value]) => row[key] === value);
        if (action === 'insert') {
          if (rows.some((row) => row.user_id === values.user_id
            && row.saved_opportunity_id === values.saved_opportunity_id
            && row.project_id === values.project_id)) return { data: null, error: { code: '23505' } };
          const row = { id: `application-${++nextId}`, ...values };
          rows.push(row);
          return { data: { ...row }, error: null };
        }
        const row = rows.find(matches) || null;
        if (action === 'update' && row) Object.assign(row, values);
        return { data: row ? { ...row } : null, error: null };
      }
      return builder;
    },
  };
}

test('one opportunity stores independent drafts per project and reopens the right one', async () => {
  const db = memoryClient();
  const repo = createGrantApplicationRepository(db, 'user-1');
  await repo.save({ opportunityId: 'opportunity-1', projectId: 'project-a', status: 'drafting', notes: 'A notes', draft: { fit_summary: 'Draft A' } });
  await repo.save({ opportunityId: 'opportunity-1', projectId: 'project-b', status: 'researching', notes: 'B notes', draft: { fit_summary: 'Draft B' } });

  assert.deepEqual((await repo.get('opportunity-1', 'project-a')).draft, { fit_summary: 'Draft A' });
  assert.deepEqual((await repo.get('opportunity-1', 'project-b')).draft, { fit_summary: 'Draft B' });
  assert.equal((await repo.get('opportunity-1', 'project-a')).notes, 'A notes');
  assert.equal((await repo.get('opportunity-1', 'project-b')).notes, 'B notes');
  assert.equal(db.rows.length, 2);
  assert.ok(db.filtersSeen.flat().some(([key, value]) => key === 'user_id' && value === 'user-1'), 'every read/write query carries the authenticated owner filter');
});

test('concurrent grant saves use compare-and-set and preserve the winning notes', async () => {
  const db = memoryClient();
  const repo = createGrantApplicationRepository(db, 'user-1');
  const created = await repo.save({ opportunityId: 'opportunity-1', projectId: 'project-a', status: 'researching', notes: 'initial', draft: null });
  const first = await repo.save({ opportunityId: 'opportunity-1', projectId: 'project-a', status: 'drafting', notes: 'first writer', draft: null, expectedVersion: created.version });
  assert.equal(first.version, 2);
  await assert.rejects(repo.save({ opportunityId: 'opportunity-1', projectId: 'project-a', status: 'drafting', notes: 'stale writer', draft: null, expectedVersion: created.version }), GrantApplicationConflictError);
  assert.equal((await repo.get('opportunity-1', 'project-a')).notes, 'first writer');
});

test('legacy draft imports only to its recorded project and never overwrites the legacy entity', () => {
  const opportunity = {
    id: 'opportunity-1',
    application_project_id: 'project-a',
    application_status: 'internal_review',
    application_notes: 'legacy notes',
    application_draft: JSON.stringify({ fit_summary: 'legacy draft' }),
  };
  assert.equal(legacyGrantApplication(opportunity, 'project-b'), null);
  assert.deepEqual(legacyGrantApplication(opportunity, 'project-a'), {
    draft: { fit_summary: 'legacy draft' }, status: 'internal_review', notes: 'legacy notes', version: null, legacy: true,
  });
  assert.equal(opportunity.application_draft, '{"fit_summary":"legacy draft"}');
});

test('migration enforces owner scoped parent references, pair uniqueness, RLS, and versions', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261112090000_project_scoped_grant_applications.sql', import.meta.url), 'utf8');
  assert.match(sql, /foreign key \(saved_opportunity_id, user_id\)/i);
  assert.match(sql, /foreign key \(project_id, user_id\)/i);
  assert.match(sql, /unique \(user_id, saved_opportunity_id, project_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /auth\.uid\(\)\) = user_id/i);
  assert.match(sql, /version integer not null default 1/i);
});
