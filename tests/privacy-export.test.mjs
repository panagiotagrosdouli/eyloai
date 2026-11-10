import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPORT_TABLES, validatePageRequest } from '../api/privacy-export.js';

test('rejects arbitrary tables and identity selectors', () => {
  assert.equal(validatePageRequest({ table: 'auth.users', offset: '0' }), null);
  assert.equal(validatePageRequest({ table: 'stripe_webhook_events', offset: '0' }), null);
  assert.equal(validatePageRequest({ table: 'profiles', offset: '-1' }), null);
  assert.equal(validatePageRequest({ table: 'profiles', offset: '1' }), null);
  assert.equal(validatePageRequest({ table: 'profiles', offset: '999999999999999999999999' }), null);
  assert.deepEqual(validatePageRequest({ table: 'projects', offset: '200', user_id: 'someone-else' }),
    { table: 'projects', offset: 200 });
});
test('export catalog includes all first-party user data tables in versioned migrations', () => {
  for (const table of ['projects', 'ideas', 'meetings', 'saved_papers', 'saved_researchers',
    'saved_opportunities', 'search_history', 'watchlists', 'notifications',
    'monitoring_discoveries', 'profiles', 'billing_entitlements', 'eyra_usage_actions',
    'institution_memberships']) assert.ok(EXPORT_TABLES.includes(table));
});
