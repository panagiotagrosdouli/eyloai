import test from 'node:test';
import assert from 'node:assert/strict';
import { describeWorkspaceSourceFailures } from '../src/lib/workspace-dashboard.mjs';

test('workspace dashboard failure summary names failed sections and deduplicates them', () => {
  assert.equal(
    describeWorkspaceSourceFailures(['events', 'activity', 'events']),
    'Calendar, Recent activity',
  );
});

test('workspace dashboard failure summary never exposes unknown backend details', () => {
  assert.equal(
    describeWorkspaceSourceFailures(['projects', 'permission denied: secret row 4']),
    'Recent projects, Another workspace section',
  );
  assert.equal(describeWorkspaceSourceFailures([]), '');
  assert.equal(describeWorkspaceSourceFailures(null), '');
});
