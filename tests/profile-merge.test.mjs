import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeWorkspaceProfile } from '../src/lib/profile-merge.mjs';

test('a saved workspace profile wins over outdated authentication metadata', () => {
  assert.deepEqual(
    mergeWorkspaceProfile(
      { full_name: 'Old Name', research_interests: 'Physics', country: 'GR' },
      { full_name: 'Updated Name', research_interests: 'Biology' },
    ),
    { full_name: 'Updated Name', research_interests: 'Biology', country: 'GR' },
  );
});

test('legacy users can still obtain profile values from auth metadata', () => {
  assert.deepEqual(
    mergeWorkspaceProfile({ user_type: 'researcher' }, {}, 'Account Name'),
    { user_type: 'researcher', full_name: 'Account Name' },
  );
});

test('an explicitly cleared persisted name is not restored from stale auth metadata', () => {
  assert.equal(mergeWorkspaceProfile({ full_name: 'Old' }, { full_name: '' }).full_name, '');
});
