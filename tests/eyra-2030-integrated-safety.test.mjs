import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateEyraResearchQuality } from '../src/lib/eyra-quality-metrics.mjs';
import { describeEyraCitedEvidence } from '../src/lib/eyra-evidence-status.mjs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('one compact EYRA command center exposes both safe runs and evidence-limited citations', () => {
  const ui = read('../src/components/eyra/EyraCommandCenter.jsx');
  const runView = read('../src/components/eyra/EyraAgentRunHistory.jsx');
  const timeline = read('../src/components/eyra/EyraConversationTimeline.jsx');
  assert.match(ui, /listEyraAgentRuns/);
  assert.match(ui, /markAgentRunForReview/);
  assert.match(runView, /aria-label="EYRA agent runs"/);
  assert.match(ui, /<EyraAgentRunHistory/);
  assert.match(timeline, /describeEyraCitedEvidence\(msg\.sources\)/);
  assert.match(timeline, /aria-label="EYRA retrieved source records"/);
  assert.match(ui, /buildEvidenceOnlyFallback\(evidence, error\)/);
  assert.doesNotMatch(ui, /buildVerifiedEvidenceFallback/);
  assert.match(ui, /preferences\.data_personalization && resourceContext/);
  assert.match(ui, /write_confirmed: allowWorkspaceActions && writeConfirmed/);
  assert.match(ui, /retrievalAttempted: evidence\.attempted/);
});

test('durable writes remain feature-gated and cannot bypass server-owned RLS', () => {
  const ledger = read('../server/eyra-run-ledger.mjs');
  const migration = read('../supabase/migrations/20261115233000_eyra_agent_runs.sql');
  const endpoint = read('../api/eyra.js');
  assert.match(ledger, /EYRA_DURABLE_RUNS_ENABLED === 'true'/);
  assert.match(ledger, /on_conflict: 'user_id,request_id'/);
  assert.match(ledger, /on_conflict: 'run_id,call_id'/);
  assert.match(migration, /create policy eyra_agent_runs_owner_read/);
  assert.match(migration, /create policy eyra_agent_actions_owner_read/);
  assert.match(migration, /revoke all on public\.eyra_agent_runs,public\.eyra_agent_actions from public,anon,authenticated/);
  assert.match(endpoint, /durableRunsEnabled\(\)/);
});

test('scientific quality claims are not conflated with the existence of a citation link', () => {
  const citation = describeEyraCitedEvidence([{ id: 'P1', title: 'Some paper', url: 'https://doi.org/10.1000/abc' }]);
  assert.match(citation.items[0].scope, /claim support not independently verified/);
  const metrics = evaluateEyraResearchQuality([{ id: 'case-a', citations: [{ id: 'P1', matchesRetrievedRecord: true }], claims: [{ supportedBySource: false }], noUsableEvidence: false, disclosedNoEvidence: false, unauthorizedWrites: 0, duplicateWrites: 0 }]);
  assert.equal(metrics.citationIdentifierPrecision.rate, 1);
  assert.equal(metrics.independentlySupportedClaims.rate, 0);
});
