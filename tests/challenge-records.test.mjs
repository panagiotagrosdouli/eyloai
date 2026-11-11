import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVerifiedChallengeRanking, savedChallengeKey } from '../src/lib/challenge-records.mjs';

test('EYRA ranking cannot change official challenge fields, eligibility or source URLs', () => {
  const official = [{
    id: 'official-12', title: 'Verified funding call', deadline: '2027-01-03',
    eligibility: 'EU universities', url_hint: 'https://example.org/official',
    amount: '$15,000', match_reason: '', source: 'Grants.gov',
  }];
  const result = applyVerifiedChallengeRanking(official, [
    { id: 'official-12', match_reason: ' Matches the research area. ',
      title: 'Fake offer', deadline: '2099-01-01', amount: '$1 billion',
      eligibility: 'Everybody', url_hint: 'https://evil.example/' },
  ]);
  assert.equal(result[0].title, official[0].title);
  assert.equal(result[0].deadline, official[0].deadline);
  assert.equal(result[0].amount, official[0].amount);
  assert.equal(result[0].eligibility, official[0].eligibility);
  assert.equal(result[0].url_hint, official[0].url_hint);
  assert.equal(result[0].match_reason, 'Matches the research area.');
  assert.equal(official[0].match_reason, '');
});

test('unknown, malformed and duplicate AI ranking entries cannot change official results', () => {
  const official = [{ id: 'A', title: 'A' }, { id: 'B', title: 'B' }];
  const results = applyVerifiedChallengeRanking(official, [
    { id: 'UNKNOWN', match_reason: 'fake' },
    { id: 'A', match_reason: 7 },
    { id: 'A', match_reason: 'Supported' },
    { id: 'A', match_reason: 'Override' },
    { id: 'B', match_reason: 'x'.repeat(900) },
  ]);
  assert.deepEqual(results.map(result => result.title), ['A', 'B']);
  assert.equal(results[0].match_reason, 'Supported');
  assert.equal(results[1].match_reason.length, 500);
  assert.equal(applyVerifiedChallengeRanking(official, null)[0].match_reason, '');
});

test('saving keys identify official records consistently between challenges and library', () => {
  const challenge = { source: 'Grants.gov', source_id: '1234', url_hint: 'https://grants.gov/a' };
  const library = { source: 'grants.gov', source_id: '1234', url: 'https://grants.gov/a' };
  assert.equal(savedChallengeKey(challenge), savedChallengeKey(library));
  assert.equal(savedChallengeKey({ url_hint: 'https://example.org/call' }), savedChallengeKey({ url: 'https://example.org/call' }));
  assert.equal(savedChallengeKey({ title: 'No verified identifier' }), '');
});
