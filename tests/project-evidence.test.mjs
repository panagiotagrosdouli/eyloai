import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProjectEvidenceContext,
  canonicalDoi,
  mergeProjectIds,
  paperLookupFilter,
  projectAssociationFilter,
  researcherLookupFilter,
} from '../src/lib/project-evidence.js';

test('project association preserves existing many-to-many links without duplicates', () => {
  assert.deepEqual(
    mergeProjectIds({ project_ids: ['p1', 'p2'], project_id: 'p1' }, 'p3'),
    ['p1', 'p2', 'p3'],
  );
});

test('project filter uses JSON containment shape expected by the entity repository', () => {
  assert.deepEqual(projectAssociationFilter('abc'), { project_ids: ['abc'] });
  assert.equal(projectAssociationFilter(''), null);
});

test('paper lookup prefers a canonical DOI over URL', () => {
  assert.deepEqual(
    paperLookupFilter({ doi: 'https://doi.org/10.1000/ABC', url: 'https://example.org/paper' }),
    { doi: '10.1000/abc' },
  );
  assert.deepEqual(
    paperLookupFilter({ url: 'https://example.org/paper' }),
    { url: 'https://example.org/paper' },
  );
});

test('researcher lookup uses stable profile URL before name/institution', () => {
  assert.deepEqual(
    researcherLookupFilter({ name: 'Ada Example', institution: 'Example U', profile_url: 'https://openalex.org/A1' }),
    { profile_url: 'https://openalex.org/A1' },
  );
});

test('project evidence context exposes only supplied saved records and identifiers', () => {
  const context = buildProjectEvidenceContext([
    {
      title: 'Evidence paper',
      authors: 'A. Author',
      year: 2026,
      source: 'Journal',
      doi: '10.1000/evidence',
    },
  ], [
    {
      name: 'R. Researcher',
      institution: 'University',
      profile_url: 'https://openalex.org/A2',
    },
  ]);

  assert.match(context.papers, /\[S1\]/);
  assert.match(context.papers, /10\.1000\/evidence/);
  assert.match(context.researchers, /\[SR1\]/);
  assert.doesNotMatch(context.papers, /invented/i);
});
