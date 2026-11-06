import test from 'node:test';
import assert from 'node:assert/strict';
import { assessEyloRelease, LIVE_LAUNCH_GATES, EYLO_PRODUCTION_SUPABASE_REF } from '../src/lib/release-readiness.mjs';

const base = () => ({
  main_sha: 'mainsha', production_sha: 'mainsha', release_candidate_sha: 'candidate',
  intended_supabase_ref: EYLO_PRODUCTION_SUPABASE_REF,
  connected_supabase_refs: ['umzrggayitzfgrrofjnw'],
  production_env_keys: ['OPENAI_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
  accepted_gate_evidence: {},
});
test('the actual observed configuration remains NO-GO even though production responds', () => {
  const output = assessEyloRelease(base());
  assert.equal(output.decision, 'NO-GO');
  assert.equal(output.checks.intended_supabase_accessible, false);
  assert.equal(output.checks.candidate_equals_production, false);
  assert.ok(output.blockers.some(x => x.category === 'deployment_configuration'));
  assert.ok(output.blockers.some(x => x.category === 'unverified_live_acceptance'));
  assert.ok(output.blockers.find(x => x.category === 'deployment_configuration').missing_keys.includes('STRIPE_SECRET_KEY'));
});

test('green code checks and a live Stripe account cannot be treated as acceptance', () => {
  const output = assessEyloRelease({ ...base(), code_ci_green: true, stripe_account_exists: true });
  assert.equal(output.decision, 'NO-GO');
  assert.ok(output.blockers.find(x => x.category === 'unverified_live_acceptance').pending.includes('stripe_sandbox_end_to_end_passed'));
});

test('every independent approval needs a reviewer, evidence URI and review date', () => {
  const evidence = Object.fromEntries(LIVE_LAUNCH_GATES.map(x => [x, {
    status: 'accepted', reviewer: 'named reviewer', evidence_uri: 'https://example.org/private-audit', review_date: '2026-11-06',
  }]));
  const config = base();
  config.main_sha = config.release_candidate_sha;
  config.production_sha = config.release_candidate_sha;
  config.connected_supabase_refs.push(EYLO_PRODUCTION_SUPABASE_REF);
  config.production_env_keys.push(
    'SUPABASE_SECRET_KEY', 'CRON_SECRET', 'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID', 'STRIPE_FOUNDER_PRICE_ID',
  );
  const full = assessEyloRelease({ ...config, accepted_gate_evidence: evidence });
  assert.equal(full.decision, 'REQUIRES_INDEPENDENT_FINAL_SIGNOFF', 'even self-reported complete paperwork is not release authorization');
  const missingEvidence = structuredClone(evidence);
  missingEvidence.two_user_rls_passed.evidence_uri = '';
  assert.equal(assessEyloRelease({ ...config, accepted_gate_evidence: missingEvidence }).decision, 'NO-GO');
});

test('malformed snapshots and duplicate env-key names fail rather than imply readiness', () => {
  assert.throws(() => assessEyloRelease({}), /Snapshot/);
  const snapshot = base();
  snapshot.production_env_keys.push('OPENAI_API_KEY');
  assert.throws(() => assessEyloRelease(snapshot), /Snapshot/);
});
