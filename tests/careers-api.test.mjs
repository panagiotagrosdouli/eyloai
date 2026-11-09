import test from 'node:test';
import assert from 'node:assert/strict';

import { combineCareerSearchResults, filterCareerListings, normalizeRemotiveSnapshot, rankCareers } from '../src/lib/careers-api.js';

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

test('career search excludes weak description-only hits and ranks exact role titles first', () => {
  const listings = [
    {
      title: 'Strategic Account Executive Enterprise - DACH',
      organization: 'Malt',
      country: 'Munich',
      description: 'A freelance marketplace connecting freelancers with companies.',
    },
    {
      title: 'Freelance Writer',
      organization: 'IAPWE',
      country: 'Worldwide',
      description: 'Create articles and blog posts.',
    },
    {
      title: 'Freelance Copywriter',
      organization: 'Coalition Technologies',
      country: 'Worldwide',
      description: 'Write research-backed copy for client websites.',
    },
  ];

  const filtered = filterCareerListings(listings, 'Freelance Writer');
  assert.deepEqual(filtered.map(item => item.title), ['Freelance Writer', 'Freelance Copywriter']);
  const ranked = rankCareers(filtered, '', 'Freelance Writer');
  assert.equal(ranked[0].title, 'Freelance Writer');
  assert.equal(ranked[0].query_score, 100);
});

test('multi-term research job searches require both concepts and match AI as a word', () => {
  const listings = [
    { title: 'Postdoctoral researcher in AI', description: 'Develop machine learning methods.' },
    { title: 'AI product manager', description: 'Lead product work at a technology company.' },
    { title: 'Postdoctoral researcher in biology', description: 'Study biological systems.' },
    { title: 'Paid communications assistant', description: 'Coordinate outreach and content.' },
  ];

  assert.deepEqual(
    filterCareerListings(listings, 'postdoctoral AI').map(item => item.title),
    ['Postdoctoral researcher in AI'],
  );
  assert.deepEqual(filterCareerListings(listings, 'AI').map(item => item.title), [
    'Postdoctoral researcher in AI',
    'AI product manager',
  ]);
});

test('career results continue to sort by local CV overlap when a CV is available', () => {
  const ranked = rankCareers([
    { title: 'Research writer', organization: '', country: '', description: 'science statistics' },
    { title: 'Sales manager', organization: '', country: '', description: 'pipeline accounts' },
  ], 'science statistics', 'Research writer');
  assert.equal(ranked[0].title, 'Research writer');
  assert.equal(ranked[0].match_score, 100);
});


test('all job sources use the same relevance filter before display', () => {
  const results = combineCareerSearchResults(
    [
      { title: 'Postdoctoral researcher in molecular biology', description: 'Research role in a laboratory.' },
      { title: 'Postdoctoral researcher in AI', description: 'Research role in artificial intelligence.' },
    ],
    [{ title: 'AI product manager', description: 'Product leadership role.' }],
    'postdoctoral AI',
  );

  assert.deepEqual(results.map(item => item.title), ['Postdoctoral researcher in AI']);
});
