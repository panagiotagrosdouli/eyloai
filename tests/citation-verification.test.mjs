import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCitationMetadata,
  normalizeDoi,
  verifyCitation,
} from '../src/lib/citation-verification.mjs';

const saved = {
  doi: 'https://doi.org/10.1234/Example',
  title: 'A Trial: Results.',
  authors: 'Alice Smith, Bob Jones',
  year: 2024,
};
const crossref = {
  DOI: '10.1234/example',
  title: ['A Trial Results'],
  author: [{ given: 'Alice', family: 'Smith' }, { given: 'Bob', family: 'Jones' }],
  published: { 'date-parts': [[2024, 5, 2]] },
  'container-title': ['Journal of Testing'],
};

test('DOI normalization accepts resolver links and DOI prefixes without guessing malformed identifiers', () => {
  assert.equal(normalizeDoi('doi: https://doi.org/10.1234/Example'), '10.1234/example');
  assert.equal(normalizeDoi('http://dx.doi.org/10.5555/ABC%2Fxyz'), '10.5555/abc/xyz');
  assert.equal(normalizeDoi('https://example.com/10.1234/x'), '');
  assert.equal(normalizeDoi('10.12/x'), '');
  assert.equal(normalizeDoi('10.1234/has space'), '');
});

test('matching DOI, title, year and first author surname are verified against Crossref', () => {
  const result = compareCitationMetadata(saved, crossref);
  assert.equal(result.status, 'Verified');
  assert.deepEqual(result.fields.map(item => item.status), ['match', 'match', 'match', 'match']);
  assert.equal(result.journal, 'Journal of Testing');
  assert.match(result.note, /does not establish scientific correctness/);
  assert.equal(result.retractionStatus, 'No Crossref update notice listed');
  assert.deepEqual(result.updateNotices, []);
  assert.match(result.note, /absent notice does not confirm/);
});

test('Crossref retraction notices are surfaced with their source, related DOI, and date', () => {
  const result = compareCitationMetadata(saved, {
    ...crossref,
    'update-to': [{
      DOI: '10.9876/retraction-notice',
      type: 'retraction',
      label: 'Retraction',
      source: 'retraction-watch',
      updated: { 'date-parts': [[2025, 3, 1]] },
    }],
  });
  assert.equal(result.status, 'Verified');
  assert.equal(result.retractionStatus, 'Retraction notice found');
  assert.deepEqual(result.updateNotices, [{
    doi: '10.9876/retraction-notice',
    type: 'retraction',
    label: 'Retraction',
    source: 'retraction-watch',
    updated: 2025,
    isRetraction: true,
  }]);
});

test('other Crossref update notices are not mislabelled as retractions', () => {
  const result = compareCitationMetadata(saved, {
    ...crossref,
    'update-to': [{ DOI: '10.9876/correction', type: 'correction', label: 'Correction', source: 'publisher' }],
  });
  assert.equal(result.retractionStatus, 'Other update notice listed');
  assert.equal(result.updateNotices[0].isRetraction, false);
});

test('disagreements and missing fields remain visible as partial verification', () => {
  const mismatch = compareCitationMetadata(
    { ...saved, title: 'Different saved title', year: 2022, authors: 'Alice Taylor' },
    crossref,
  );
  assert.equal(mismatch.status, 'Partially verified');
  assert.deepEqual(mismatch.fields.filter(item => item.status === 'mismatch').map(item => item.label), [
    'Title', 'Publication year', 'First author surname',
  ]);

  const missing = compareCitationMetadata({ doi: saved.doi }, { DOI: crossref.DOI });
  assert.equal(missing.status, 'Partially verified');
  assert.equal(missing.fields.filter(item => item.status === 'unavailable').length, 3);
});

test('an absent or mismatching DOI is unverified and never treated as a match', () => {
  assert.equal(compareCitationMetadata({ title: saved.title }, crossref).status, 'Unverified');
  assert.equal(compareCitationMetadata(saved, { ...crossref, DOI: '10.4321/other' }).status, 'Unverified');
});

test('verification requests only the exact DOI proxy and handles missing records and provider failures', async () => {
  let requestedUrl = '';
  let requestedOptions;
  const verified = await verifyCitation(saved, async (url, options) => {
    requestedUrl = url;
    requestedOptions = options;
    return new Response(JSON.stringify({ message: crossref }), { status: 200 });
  });
  assert.equal(verified.status, 'Verified');
  assert.equal(new URL('https://eylo.test' + requestedUrl).searchParams.get('provider'), 'crossref');
  assert.equal(new URL('https://eylo.test' + requestedUrl).searchParams.get('doi'), '10.1234/example');
  assert.equal(requestedOptions.headers.accept, 'application/json');

  const notFound = await verifyCitation(saved, async () => new Response('', { status: 404 }));
  assert.equal(notFound.status, 'Unverified');
  assert.match(notFound.note, /did not return a record/);
  await assert.rejects(
    verifyCitation(saved, async () => new Response('', { status: 503 })),
    /Crossref verification failed \(503\)/,
  );
});

test('verification with no DOI performs no network request', async () => {
  let called = false;
  const result = await verifyCitation({ title: 'No identifier' }, async () => {
    called = true;
    return new Response('{}');
  });
  assert.equal(result.status, 'Unverified');
  assert.equal(called, false);
});
