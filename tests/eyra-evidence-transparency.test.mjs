import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeEyraCitedEvidence } from '../src/lib/eyra-evidence-status.mjs';

test('publication citation labels link retrieval, not scientific verification', () => {
  const result = describeEyraCitedEvidence([
    { id: 'P1', type: 'Paper', title: 'A clinical study', url: 'https://doi.org/10.1000/example' },
  ]);
  assert.deepEqual(result.items.map(item => item.id), ['P1']);
  assert.match(result.items[0].scope, /full text and claim support not independently verified/);
  assert.match(result.summary, /scientific claims.*not independently verified/);
});

test('funding eligibility and researcher metadata are explicitly limited', () => {
  const result = describeEyraCitedEvidence([
    { id: 'F1', title: 'A research call', url: 'https://example.org/call' },
    { id: 'R1', title: 'Researcher', url: 'https://openalex.org/A123' },
    { id: 'I1', title: 'Institution', url: 'https://openalex.org/I123' },
  ]);
  assert.match(result.items[0].scope, /eligibility and deadline require official confirmation/);
  assert.match(result.items[1].scope, /affiliation and current status require confirmation/);
  assert.match(result.items[2].scope, /affiliation and current status require confirmation/);
});

test('reject duplicate IDs, unsafe links and malformed citations without rendering clickable evidence', () => {
  const result = describeEyraCitedEvidence([
    { id: 'P1', title: 'Valid', url: 'https://doi.org/10.1111/abc' },
    { id: 'P1', title: 'Duplicate', url: 'https://doi.org/10.1111/def' },
    { id: 'P2', title: 'Unsafe', url: 'javascript:alert(1)' },
    { id: 'P3', title: 'Credentials', url: 'https://user:password@publisher.org' },
    { id: 'X1', title: 'Fabricated', url: 'https://example.org' },
  ]);
  assert.deepEqual(result.items.map(item => item.id), ['P1']);
  assert.equal(result.hiddenCount, 4);
});

test('source labels are bounded and missing records do not imply verification', () => {
  const result = describeEyraCitedEvidence([{ id: 'P4', title: 'A'.repeat(500), meta: 'B'.repeat(1000), url: 'https://example.org/study' }]);
  assert.equal(result.items[0].title.length, 300);
  assert.equal(result.items[0].meta.length, 600);
  assert.match(describeEyraCitedEvidence([]).summary, /No linked retrieved records/);
  assert.equal(describeEyraCitedEvidence(null).items.length, 0);
});

test('compact EYRA remains consent-scoped and source chips no longer imply peer-reviewed claim verification', () => {
  const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  assert.match(source, /describeEyraCitedEvidence\(msg\.sources\)/);
  assert.match(source, /aria-label="EYRA retrieved source records"/);
  assert.doesNotMatch(source, /<ShieldCheck/);
  assert.match(source, /preferences\.data_personalization && resourceContext/);
  assert.match(source, /checkEyraCitationIds\(baseAnswer, evidence\.sources\)/);
  assert.match(source, /write_confirmed: allowWorkspaceActions && writeConfirmed/);
});
