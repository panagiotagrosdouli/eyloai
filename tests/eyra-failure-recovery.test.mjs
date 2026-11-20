import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeEyraFailure } from '../src/lib/eyra-failure-guidance.mjs';
import { buildEvidenceOnlyFallback } from '../src/lib/eyra-evidence-fallback.mjs';

test('EYRA failure guidance separates billing quota, throttling and account-plan allowances', () => {
  assert.match(describeEyraFailure({ code: 'OPENAI_QUOTA_EXHAUSTED', status: 503 }), /administrator.*billing/);
  assert.match(describeEyraFailure({ code: 'OPENAI_RATE_LIMITED', status: 503, retryAfterSeconds: 12 }), /12 seconds/);
  assert.match(describeEyraFailure({ status: 429 }), /rate-limited/);
  assert.match(describeEyraFailure({ code: 'PLAN_LIMIT_REACHED', status: 429 }), /allowance.*plan/);
  assert.match(describeEyraFailure({ code: 'USAGE_CONTROLS_UNAVAILABLE' }), /usage controls/);
  assert.match(describeEyraFailure({ code: 'OPENAI_NOT_CONFIGURED' }), /administrator/);
  assert.match(describeEyraFailure({ code: 'OPENAI_AUTH_FAILED' }), /administrator/);
  assert.doesNotMatch(describeEyraFailure({
    code: 'OPENAI_RATE_LIMITED', retryAfterSeconds: 999999, message: 'secret-key=private',
  }), /999999|secret-key|private/);
});

test('incomplete streaming, suspicious citations and failed tool follow-ups have distinct safe guidance', () => {
  assert.match(describeEyraFailure({ code: 'EYRA_INCOMPLETE' }), /Partial text was not treated/);
  assert.match(describeEyraFailure({ code: 'EYRA_STREAM_INCOMPLETE' }), /Partial text was not treated/);
  assert.match(describeEyraFailure({ code: 'EYRA_UNSUPPORTED_CITATION' }), /answer was withheld/);
  assert.match(describeEyraFailure({ code: 'TOOL_FOLLOWUP_FAILED' }), /Inspect.*saved record/);
  assert.match(describeEyraFailure({ code: 'TOOL_FOLLOWUP_QUOTA_EXHAUSTED' }), /Inspect.*saved record/);
  assert.match(describeEyraFailure({ status: 401 }), /Sign in again/);
  assert.match(describeEyraFailure({ code: 'PROMPT_TOO_LONG' }), /smaller parts/);
  assert.match(describeEyraFailure({ status: 413 }), /smaller parts/);
  assert.doesNotMatch(describeEyraFailure({ code: 'UNKNOWN_UNTRUSTED', message: 'API key abc, password 123' }), /abc|password|123/);
});

test('evidence-only fallback keeps its verifiable original-source links and explains the failure', () => {
  const evidence = { attempted: true, sources: [{
    id: 'P1', type: 'Paper', title: 'A scientific record',
    url: 'https://doi.org/10.1111/test', meta: 'OpenAlex metadata',
  }] };
  const text = buildEvidenceOnlyFallback(evidence,
    { code: 'OPENAI_QUOTA_EXHAUSTED', status: 503, message: 'PRIVATE BILLING DETAIL' });
  assert.match(text, /not independently verified/);
  assert.match(text, /provider metadata/);
  assert.match(text, /### Why the analysis stopped/);
  assert.match(text, /credits are exhausted/);
  assert.match(text, /https:\/\/doi.org\/10.1111\/test/);
  assert.doesNotMatch(text, /PRIVATE BILLING DETAIL/);
});

test('failed authenticated requests preserve the source metadata without pretending AI finished', () => {
  const text = buildEvidenceOnlyFallback({ attempted: false, sources: [] }, { status: 401 });
  assert.match(text, /session needs to be renewed/);
  assert.match(text, /Sign in again/);
  assert.match(text, /No external retrieval was requested/);
  assert.doesNotMatch(text, /Retrieved source records/);
  assert.doesNotMatch(text, /complete analysis was produced/i);
});

test('command-center restores only failed read-only questions without blind tool retries', () => {
  const ui = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/lib/eyra-intelligence.js', import.meta.url), 'utf8');
  assert.match(ui, /code: 'EYRA_UNSUPPORTED_CITATION'/);
  assert.match(ui, /if \(!allowWorkspaceActions\) \{/);
  assert.match(ui, /setInput\(previous => previous\.trim\(\) \? previous : content\)/);
  assert.match(ui, /No automatic AI request was sent/);
  assert.match(ui, /buildEvidenceOnlyFallback\(evidence, error\)/);
  assert.match(ui, /if \(controller\.signal\.aborted\) return/);
  assert.match(client, /'EYRA_INCOMPLETE', 'EYRA_STREAM_INCOMPLETE'/);
  assert.match(client, /throw new EyraRequestError\('EYRA did not complete the response\.', 502, \{ code \}\)/);
  assert.doesNotMatch(client, /throw new EyraRequestError\(event\.error \|\| 'EYRA streaming failed\.'/);
});
