import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateReleaseReadiness, RELEASE_CHECKS } from '../src/lib/release-readiness.mjs';
const commit = 'a'.repeat(40);
const now = Date.parse('2026-11-13T12:01:00Z');
function reviewedFixture() {
  const target = { environment: 'staging', supabase_ref: 'abcdefghijklmnopqrst', owner_confirmed: true, connector_verified: true, vercel_team_id: 'team_fixture', vercel_project_id: 'prj_fixture', deployment_environment: 'preview', deployment_sha: commit, manifest_sha: commit };
  return { schema_version: 1, scope: 'research-workspace-v1', commit, target,
    checks: Object.fromEntries(RELEASE_CHECKS.map(([id, scope, assertions]) => [id, {
      status: 'PASS', scope, commit, executed_at: '2026-11-13T12:00:00Z', evidence: 'https://github.com/example/fixture/actions/runs/1', reviewed_by: 'Unit-test fixture only, not live evidence',
      assertions: Object.fromEntries(assertions.map(assertion => [assertion, true])),
      supabase_ref: target.supabase_ref, vercel_project_id: target.vercel_project_id,
      test_user_ids: ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'],
      metrics: { queries: 5, covered_queries: 5, human_reviewed_queries: 5 }, test_mode: true, livemode: false,
    }])) };
}
const evaluate = input => evaluateReleaseReadiness(input, { expectedCommit: commit, now });
test('complete compatible synthetic evidence only enables owner review, never production authorization', () => {
  const result = evaluate(reviewedFixture());
  assert.equal(result.decision, 'READY_FOR_OWNER_REVIEW');
  assert.equal(result.production_authorized, false);
});
test('local fixtures and an empty ledger cannot establish hosted acceptance even with green status fields', () => {
  const input = reviewedFixture();
  input.checks.auth.scope = 'local-fixture';
  assert.equal(evaluate(input).decision, 'NO-GO');
  assert.equal(evaluate({}).decision, 'NO-GO');
});
test('live EYLO and unrelated connected database identities are rejected as staging', () => {
  for (const ref of ['kbzjngpzxpniaumlupaa', 'umzrggayitzfgrrofjnw']) {
    const input = reviewedFixture(); input.target.supabase_ref = ref;
    assert.equal(evaluate(input).decision, 'NO-GO');
  }
});
test('stale or future reports, unknown deployment identity and a different commit are rejected', () => {
  for (const date of ['2026-10-01T00:00:00Z', '2026-12-01T00:00:00Z']) {
    const input = reviewedFixture(); input.checks.auth.executed_at = date;
    assert.equal(evaluate(input).decision, 'NO-GO');
  }
  const input = reviewedFixture(); input.target.deployment_sha = 'b'.repeat(40);
  assert.equal(evaluate(input).decision, 'NO-GO');
});
test('same-account isolation fixtures and reports from another project cannot pass', () => {
  const input = reviewedFixture(); input.checks.isolation.test_user_ids = ['a', 'a'];
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.checks.isolation.test_user_ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']; input.checks.isolation.vercel_project_id = 'prj_other';
  assert.equal(evaluate(input).decision, 'NO-GO');
});
test('the current 3/5 retrieval coverage or missing human review cannot be relabeled as release ready', () => {
  const input = reviewedFixture(); input.checks.research.metrics.covered_queries = 3;
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.checks.research.metrics.covered_queries = 5; input.checks.research.metrics.human_reviewed_queries = 0;
  assert.equal(evaluate(input).decision, 'NO-GO');
});
test('live Stripe mode and deletion without revoked sessions are rejected despite PASS labels', () => {
  const input = reviewedFixture(); input.checks.stripe.livemode = true;
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.checks.stripe.livemode = false; input.checks.privacy.assertions.sessions_revoked = false;
  assert.equal(evaluate(input).decision, 'NO-GO');
});
test('missing evidence, unreviewed reports and arbitrary or credential-bearing links cannot satisfy a gate', () => {
  for (const evidence of ['', 'https://user:password@example.org/report', 'docs/release/evidence/../private.json']) {
    const input = reviewedFixture(); input.checks.auth.evidence = evidence;
    assert.equal(evaluate(input).decision, 'NO-GO');
  }
  const input = reviewedFixture(); input.checks.legal_pilot.reviewed_by = '';
  assert.equal(evaluate(input).decision, 'NO-GO');
});

test('CLI fails closed on syntactically valid falsy JSON instead of exiting successfully without a report', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'eylo-release-evidence-'));
  try {
    const path = join(directory, 'evidence.json');
    for (const input of [null, false, 0, '']) {
      await writeFile(path, JSON.stringify(input));
      const result = spawnSync(process.execPath, ['scripts/check-release-readiness.mjs', path], { encoding: 'utf8' });
      assert.equal(result.status, 1);
      assert.equal(JSON.parse(result.stdout).decision, 'NO-GO');
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
