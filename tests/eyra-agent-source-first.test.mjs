import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildEyraAgentEvidence,
  buildEyraAgentPrompt,
  eyraAgentFailureMessage,
} from '../src/lib/eyra-agent-evidence.mjs';

test('Research Agent uses only real source-linked publications and retains stable IDs', () => {
  const papers = Array.from({ length: 14 }, (_, i) => ({
    title: 'Research article ' + (i + 1) + ' ' + 'T'.repeat(4000),
    url: 'https://openalex.org/W' + (i + 100),
    year: 2025,
    source_index: 'OpenAlex',
    summary: 'A retrieved abstract excerpt ' + 'A'.repeat(10000),
  }));
  papers.unshift({ title: 'Unsafe record', url: 'javascript:alert(1)' });
  const evidence = buildEyraAgentEvidence('research', papers);
  assert.equal(evidence.records.length, 8);
  assert.equal(evidence.records[0].id, 'P1');
  assert.equal(evidence.records[0].url, 'https://openalex.org/W100');
  assert.equal(evidence.records[7].id, 'P8');
  assert.doesNotMatch(evidence.context, /javascript:/i);
  assert.doesNotMatch(evidence.context, /\[P9\]/);
  assert.ok(evidence.context.length < 9000);
  const instructions = '## Scope\nExplain the retrieved works\n## Limitations\nIdentify what is unknown.';
  const prompt = buildEyraAgentPrompt(instructions, 'research', evidence);
  assert.match(prompt, /## Scope\nExplain the retrieved works\n## Limitations/);
  assert.match(prompt, /\[P1\]/);
  assert.match(prompt, /\[P8\]/);
  assert.match(prompt, /not independently verified|not independent verification|not independently/i);
  assert.ok(prompt.length < 20000);
});

test('Funding Agent preserves official amounts, dates and original links without inventing absent fields', () => {
  const evidence = buildEyraAgentEvidence('funding', [
    {
      title: 'Official grant programme', source: 'Grants.gov',
      source_url: 'https://www.grants.gov/search-results-detail/12345',
      amount: '$100,000', deadline: '2026-12-01', eligibility: 'Registered nonprofits',
      description: 'Real provider synopsis',
    },
    {
      title: 'Unspecified EU grant', source: 'EU Funding & Tenders Portal',
      source_url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals',
      description: '',
    },
  ]);
  assert.equal(evidence.records.length, 2);
  assert.match(evidence.context, /\[F1\]/);
  assert.match(evidence.context, /Amount: \$100,000/);
  assert.match(evidence.context, /Deadline: 2026-12-01/);
  assert.match(evidence.context, /Eligibility: Registered nonprofits/);
  assert.match(evidence.context, /\[F2\]/);
  assert.match(evidence.context, /Amount: not provided/);
  assert.match(evidence.context, /Deadline: not provided/);
  const prompt = buildEyraAgentPrompt('Give eight top programmes', 'funding', evidence);
  assert.match(prompt, /fewer than eight listings, report only the listings supplied/);
  assert.match(prompt, /Do not invent programs, award amounts, dates/);
});

test('EYRA Research/Funding refuse unsourced prompts and protect against fabricated listings', () => {
  for (const key of ['research', 'funding']) {
    const context = buildEyraAgentEvidence(key, [
      { title: 'Bad protocol', url: 'http://unsecure.example/', source_url: 'javascript:alert(1)' },
      { title: 'No URL' },
    ]);
    assert.equal(context.records.length, 0);
    assert.equal(context.status, 'no_retrieved_records');
    assert.throws(() => buildEyraAgentPrompt('Provide a scientific report', key, context),
      /No source-linked records/);
  }
  assert.equal(buildEyraAgentEvidence('research', null).records.length, 0);
  assert.equal(buildEyraAgentEvidence('research', [{ title: 'Possible', url: 'https://someone:password@evil.example/' }]).records.length, 0);
});

test('Non-retrieval agents are clearly planning-only and never claim external browsing', () => {
  const data = buildEyraAgentEvidence('startup', []);
  assert.equal(data.status, 'planning_only');
  const prompt = buildEyraAgentPrompt('## Business plan\nEstimate MVP', 'startup', data);
  assert.match(prompt, /planning exercise, not verified live research/);
  assert.match(prompt, /Do not claim you browsed databases/);
});

test('EYRA failure copy identifies quota and 429 separately without leaking provider error text', () => {
  assert.match(eyraAgentFailureMessage({ code: 'OPENAI_QUOTA_EXHAUSTED', status: 503, message: 'Secret upstream details' }), /administrator.*billing/);
  assert.match(eyraAgentFailureMessage({ code: 'OPENAI_RATE_LIMITED', status: 503 }), /rate-limited/);
  assert.match(eyraAgentFailureMessage({ status: 401 }), /sign in/);
  assert.match(eyraAgentFailureMessage({ status: 413 }), /Reduce the question/);
  assert.match(eyraAgentFailureMessage({ code: 'OPENAI_NOT_CONFIGURED' }), /not configured/);
  assert.equal(eyraAgentFailureMessage({ name: 'AbortError' }), '');
  assert.doesNotMatch(eyraAgentFailureMessage({ status: 500, message: 'Private key leaked' }), /Private key/);
});

test('EYRA agent panel handles source search, loading, errors, abort and evidence display', () => {
  const ui = readFileSync(new URL('../src/components/eyra/EyraAgentPanel.jsx', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/lib/eyra-intelligence.js', import.meta.url), 'utf8');
  assert.match(ui, /searchAllPapersWithStatus\(topic,/);
  assert.match(ui, /searchFundingOpportunities\(topic, 8,/);
  assert.match(ui, /buildEyraAgentPrompt\(agent\.prompt\(topic\), activeAgent, evidence\)/);
  assert.match(ui, /if \(!evidence\.records\.length\) throw new Error\('NO_VERIFIED_AGENT_SOURCES'\)/);
  assert.match(ui, /catch \(error\)/);
  assert.match(ui, /finally \{/);
  assert.match(ui, /setLoading\(false\)/);
  assert.match(ui, /abortRef\.current\?\.abort\(\)/);
  assert.match(ui, /role="alert"/);
  assert.match(ui, /aria-label="EYRA retrieved evidence"/);
  assert.match(ui, /target="_blank" rel="noopener noreferrer"/);
  assert.match(ui, /Your question is preserved/);
  assert.match(client, /this\.code = typeof details\.code === 'string'/);
  assert.match(client, /this\.retryAfterSeconds =/);
});
