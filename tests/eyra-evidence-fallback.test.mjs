import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildEvidenceOnlyFallback } from '../src/lib/eyra-evidence-fallback.mjs';

const page = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
const timeline = readFileSync(new URL('../src/components/eyra/EyraConversationTimeline.jsx', import.meta.url), 'utf8');
const evidence = { attempted: true, sources: [
  { id: 'P1', type: 'Paper', title: 'A [misleading](javascript:alert(1)) claim', url: 'https://doi.org/10.1234/example', meta: 'Abstract is unverified' },
  { id: 'F1', type: 'Funding', title: 'Grant', url: 'https://example.org/call' },
] };

test('fallback makes clear retrieved metadata are not independently verified', () => {
  const text = buildEvidenceOnlyFallback(evidence, new Error('AI unavailable'));
  assert.match(text, /not independently verified/);
  assert.match(text, /provider metadata/);
  assert.match(text, /original publications/);
  assert.doesNotMatch(text, /verified records|source-backed scientific conclusion/i);
});

test('fallback does not interpret retrieval errors as proof of no results', () => {
  const text = buildEvidenceOnlyFallback({ attempted: true, sources: [] }, new Error('Timeout'));
  assert.match(text, /Retrieval failure and absence of results must not be confused/);
  const noSearch = buildEvidenceOnlyFallback({ attempted: false, sources: [] }, new Error('Failed'));
  assert.match(noSearch, /No external retrieval was requested/);
});

test('unsafe records and markdown control characters never produce an extra link', () => {
  const text = buildEvidenceOnlyFallback({ sources: [
    ...evidence.sources,
    { id: 'P2', type: 'Paper', title: 'Injected', url: 'javascript:alert(1)' },
    { id: 'R2', type: 'Researcher', title: 'Credentials', url: 'https://secret:password@example.org/profile' },
  ] });
  assert.doesNotMatch(text, /\]\(javascript:/);
  assert.doesNotMatch(text, /Injected|Credentials/);
  assert.ok(text.includes(String.raw`A \[misleading\]\(javascript:alert\(1\)\) claim`));
  assert.match(text, /https:\/\/doi.org\/10.1234\/example/);
});

test('auth failures show a clear retry instead of a claimed synthesis', () => {
  const text = buildEvidenceOnlyFallback(evidence, { status: 401 });
  assert.match(text, /session needs renewal/);
  assert.match(text, /no AI synthesis was produced/);
});

test('EYRA source chips and fallback descriptions do not claim independent verification', () => {
  assert.match(page, /buildEvidenceOnlyFallback\(evidence, error\)/);
  assert.match(timeline, /not independently verified/);
  assert.doesNotMatch(page, /buildVerifiedEvidenceFallback/);
  assert.doesNotMatch(page, /ShieldCheck/);
});
