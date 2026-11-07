import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRemotivePayload } from '../scripts/update-remotive-snapshot.mjs';

test('Remotive snapshots keep source links and normalize HTML descriptions', () => {
  const snapshot = normalizeRemotivePayload({
    jobs: [{
      id: 42,
      title: '&lt;h2&gt;Research data scientist&lt;/h2&gt;',
      company_name: 'Example Lab',
      url: 'https://remotive.com/remote-jobs/data/role-42',
      candidate_required_location: 'Worldwide',
      description: '&lt;p&gt;Build careful models &amp; reports&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
      salary: '$80,000',
      publication_date: '2026-11-06T09:00:00',
    }],
  }, '2026-11-07T00:00:00.000Z');

  assert.equal(snapshot.source, 'Remotive');
  assert.equal(snapshot.provider_delay_hours, 24);
  assert.equal(snapshot.retrieved_at, '2026-11-07T00:00:00.000Z');
  assert.equal(snapshot.items[0].id, 'remotive-42');
  assert.equal(snapshot.items[0].title, 'Research data scientist');
  assert.equal(snapshot.items[0].description, 'Build careful models & reports');
  assert.equal(snapshot.items[0].source_url, 'https://remotive.com/remote-jobs/data/role-42');
});

test('Remotive snapshots reject untrusted links and empty unusable responses', () => {
  assert.throws(() => normalizeRemotivePayload({ jobs: [{ id: 1, title: 'Role', url: 'https://example.org/job/1' }] }), /no usable listings/);
  assert.throws(() => normalizeRemotivePayload({ data: [] }), /invalid jobs payload/);
});

test('Remotive snapshots cap descriptions and accept only HTTPS source URLs', () => {
  const longDescription = 'x'.repeat(1500);
  const snapshot = normalizeRemotivePayload({
    jobs: [
      { id: 1, title: 'Role', url: 'http://remotive.com/remote-jobs/role-1', description: longDescription },
      { id: 2, title: 'Role', url: 'https://www.remotive.com/remote-jobs/role-2', description: longDescription },
    ],
  });
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].description.length, 1200);
  assert.equal(snapshot.items[0].source_url, 'https://www.remotive.com/remote-jobs/role-2');
});
