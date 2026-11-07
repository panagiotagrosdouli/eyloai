import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRemotiveSnapshot } from '../src/lib/careers-api.js';

test('browser Remotive snapshots keep only safe source-linked roles', () => {
  const snapshot = normalizeRemotiveSnapshot({
    source: 'Remotive',
    retrieved_at: '2026-11-07T00:00:00.000Z',
    items: [
      {
        id: 'remotive-42',
        title: '<h2>Research data scientist</h2>',
        organization: '<b>Example Lab</b>',
        country: 'Worldwide',
        description: '<p>Build careful models.</p>',
        source_url: 'https://remotive.com/remote-jobs/data/role-42',
      },
      {
        id: 'bad-link',
        title: 'Untrusted role',
        source_url: 'https://example.org/jobs/1',
      },
    ],
  });

  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].source, 'Remotive');
  assert.equal(snapshot.items[0].title, 'Research data scientist');
  assert.equal(snapshot.items[0].organization, 'Example Lab');
  assert.equal(snapshot.items[0].description, 'Build careful models.');
  assert.equal(snapshot.items[0].source_url, 'https://remotive.com/remote-jobs/data/role-42');
  assert.equal(snapshot.retrieved_at, '2026-11-07T00:00:00.000Z');
});

test('browser Remotive snapshots reject malformed or unusable data', () => {
  assert.throws(() => normalizeRemotiveSnapshot({ source: 'other', items: [], retrieved_at: 'x' }), /invalid/);
  assert.throws(() => normalizeRemotiveSnapshot({
    source: 'Remotive',
    retrieved_at: '2026-11-07T00:00:00.000Z',
    items: [{ id: 'no-link', title: 'No trusted source', source_url: 'https://example.org/job' }],
  }), /no usable listings/);
});
