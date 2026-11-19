import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEyraCitationIds, isSafeEyraSourceUrl } from '../src/lib/eyra-citation-ids.mjs';

const sources = [
  { id: 'P1', title: 'Publication 1', url: 'https://openalex.org/W100' },
  { id: 'P2', title: 'Publication 2', url: 'https://openalex.org/W200' },
  { id: 'F1', title: 'Official grant', url: 'https://example.edu/opportunity' },
];

test('only sources explicitly referenced in answer appear as citations', () => {
  const result = checkEyraCitationIds('Methodological caveat [P2]; eligibility requires review [F1].', sources);
  assert.deepEqual(result.invalidIds, []);
  assert.deepEqual(result.citedIds, ['P2', 'F1']);
  assert.deepEqual(result.citedSources.map(source => source.id), ['P2', 'F1']);
  assert.equal(result.valid, true);
});

test('invented model citation IDs must not be treated as retrieved evidence', () => {
  const result = checkEyraCitationIds('This is certain [P99]. See [R3] and [P1].', sources);
  assert.equal(result.valid, false);
  assert.deepEqual(result.invalidIds, ['P99', 'R3']);
  assert.deepEqual(result.citedSources.map(source => source.id), ['P1']);
});

test('no reference is never silently assigned to every retrieved source', () => {
  const result = checkEyraCitationIds('General methodological guidance, no indexed citations.', sources);
  assert.equal(result.valid, true);
  assert.deepEqual(result.citedSources, []);
});

test('external citations reject unsafe link schemes and embedded credentials', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,evil', 'file:///etc/passwd',
    'https://user:secret@publisher.example/paper', 'not a URL', '//publisher.example/paper']) {
    assert.equal(isSafeEyraSourceUrl(value), false, value);
  }
  assert.equal(isSafeEyraSourceUrl('https://doi.org/10.1000/example'), true);
  assert.equal(isSafeEyraSourceUrl('https://openalex.org/W100'), true);
});

test('untrusted scholarly links never route to loopback or private-network destinations', () => {
  for (const url of [
    'http://localhost:3000', 'https://research.local/paper',
    'https://metadata.internal/admin', 'http://127.0.0.1:8000',
    'http://10.0.0.7/secret', 'https://172.16.0.2/report',
    'http://192.168.1.1/router', 'http://169.254.169.254/latest/meta-data',
    'http://[::1]/api', 'http://[fe80::1]/'
  ]) {
    assert.equal(isSafeEyraSourceUrl(url), false, url);
  }
  assert.equal(isSafeEyraSourceUrl('https://api.crossref.org/works/10.1000/example'), true);
  assert.equal(isSafeEyraSourceUrl('https://93.184.215.14/article'), true);
});
