import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { RELEASE_CHECKS } from '../src/lib/release-readiness.mjs';
import {
  evaluateFullPlatformReadiness,
  PRODUCT_ACCEPTANCE, SITE_ACCEPTANCE, REQUIRED_PRODUCT_NAMES,
  REQUIRED_WORKFLOWS, WORKFLOW_ACCEPTANCE,
} from '../src/lib/full-platform-readiness.mjs';

const commit = 'a'.repeat(40);
const ref = 'abcdefghijklmnopqrst';
const project = 'prj_fixture';
const now = Date.parse('2026-11-16T17:00:00Z');
const actors = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
];
const evidence = 'https://github.com/example/fixture/actions/runs/123';
const pass = assertions => ({
  status: 'PASS', scope: 'hosted-staging', commit, deployment_sha: commit,
  supabase_ref: ref, vercel_project_id: project,
  executed_at: '2026-11-16T16:59:00Z',
  evidence, reviewed_by: 'Synthetic unit test only, not independent acceptance',
  test_user_ids: [...actors],
  assertions: Object.fromEntries(assertions.map(key => [key, true])),
});
function fixture() {
  const target = {
    environment: 'staging', supabase_ref: ref, owner_confirmed: true,
    connector_verified: true, vercel_team_id: 'team_fixture', vercel_project_id: project,
    deployment_environment: 'preview', deployment_sha: commit, manifest_sha: commit,
  };
  const workspaceEvidence = {
    schema_version: 1, scope: 'research-workspace-v1', commit, target,
    checks: Object.fromEntries(RELEASE_CHECKS.map(([id, scope, checks]) => [id, {
      ...pass(checks), scope,
      metrics: { queries: 5, covered_queries: 5, human_reviewed_queries: 5 },
      test_mode: true, livemode: false,
    }])),
  };
  const sourceRoutes = {
    public_routes: ['/', '/login', '/register'],
    private_routes: ['/files', '/home', '/notes', '/projects'],
  };
  const inventory = {
    schema_version: 1,
    products: REQUIRED_PRODUCT_NAMES.map((name, i) => ({ id: i + 1, name, status: 'COMPLETE',
      supabase_entities: i === 0 ? ['life_tasks', 'life_goals'] : [],
    })),
    additional_features: [],
    additional_entities: [],
  };
  const fullEvidence = {
    schema_version: 1, scope: 'full-platform-77', commit,
    schema: { ...pass([
      'all_required_tables_present', 'all_rls_enabled',
      'migrations_reconciled', 'storage_policies_reviewed',
    ]), tables: [{ name: 'life_tasks', rls_enabled: true }, { name: 'life_goals', rls_enabled: true }] },
    site: { ...pass(SITE_ACCEPTANCE),
      tested_public_routes: [...sourceRoutes.public_routes],
      tested_private_routes: [...sourceRoutes.private_routes],
      coverage: {
      public_routes_expected: sourceRoutes.public_routes.length, public_routes_tested: sourceRoutes.public_routes.length,
      private_routes_expected: sourceRoutes.private_routes.length, private_routes_tested: sourceRoutes.private_routes.length,
      interactive_controls_expected: 350, interactive_controls_tested: 350,
    } },
    additional_inventory_review: pass([
      'source_routes_audited', 'advertised_features_audited',
      'backend_and_integration_inventory_audited',
    ]),
    products: Object.fromEntries(REQUIRED_PRODUCT_NAMES.map((_, i) => [String(i + 1), pass(PRODUCT_ACCEPTANCE)])),
    additional_features: {},
    workflows: Object.fromEntries(REQUIRED_WORKFLOWS.map(id => [id, pass(WORKFLOW_ACCEPTANCE)])),
  };
  return { inventory, workspaceEvidence, fullEvidence, sourceRoutes };
}
function evaluate(input = fixture()) {
  return evaluateFullPlatformReadiness({ ...input, expectedCommit: commit, now });
}

test('all 77 synthetic matching reports only permit owner review, never production authorization', () => {
  const result = evaluate();
  assert.equal(REQUIRED_PRODUCT_NAMES.length, 77);
  assert.equal(result.products.length, 77);
  assert.equal(result.decision, 'READY_FOR_OWNER_REVIEW');
  assert.equal(result.production_authorized, false);
});

test('a partial product, even with forged PASS acceptance, blocks the full platform', () => {
  const input = fixture();
  input.inventory.products[42].status = 'PARTIAL';
  const result = evaluate(input);
  assert.equal(result.decision, 'NO-GO');
  assert.equal(result.products[42].status, 'BLOCKED');
});

test('missing product, duplicate ID and swapped name each deny release', () => {
  for (const modification of [
    input => input.inventory.products.pop(),
    input => { input.inventory.products[30].id = 29; },
    input => { input.inventory.products[0].name = 'Not EYLO Life'; },
  ]) {
    const input = fixture();
    modification(input);
    assert.equal(evaluate(input).decision, 'NO-GO');
  }
});

test('must have full end-to-end evidence for every product and two independent accounts', () => {
  const input = fixture();
  delete input.fullEvidence.products['77'];
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.products['77'] = pass(PRODUCT_ACCEPTANCE);
  input.fullEvidence.products['77'].test_user_ids = [actors[0], actors[0]];
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.products['77'].test_user_ids = [...actors];
  input.fullEvidence.products['77'].assertions.data_persistence = false;
  assert.equal(evaluate(input).decision, 'NO-GO');
});

test('browser route/control incompleteness and a missing research workflow prevent false readiness', () => {
  const input = fixture();
  input.fullEvidence.site.coverage.interactive_controls_tested = 349;
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.site.coverage.interactive_controls_tested = 350;
  input.fullEvidence.site.tested_private_routes = ['/home', '/files', '/notes', '/fake-route'];
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.site.tested_private_routes = [...input.sourceRoutes.private_routes];
  delete input.fullEvidence.workflows.team_to_meeting;
  assert.equal(evaluate(input).decision, 'NO-GO');
});

test('database inventory requires all declared tables and RLS in isolated staging', () => {
  const input = fixture();
  input.fullEvidence.schema.tables.pop();
  assert.equal(evaluate(input).database_schema.status, 'BLOCKED');
  input.fullEvidence.schema.tables.push({ name: 'life_goals', rls_enabled: false });
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.schema.tables[1].rls_enabled = true;
  assert.equal(evaluate(input).decision, 'READY_FOR_OWNER_REVIEW');
  delete input.inventory.additional_entities;
  assert.equal(evaluate(input).decision, 'NO-GO');
});

test('additional features require explicit audited inventory and independently accepted reports', () => {
  const input = fixture();
  delete input.inventory.additional_features;
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.inventory.additional_features = ['Extra published research feature'];
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.additional_features['Extra published research feature'] = pass(PRODUCT_ACCEPTANCE);
  assert.equal(evaluate(input).decision, 'READY_FOR_OWNER_REVIEW');
  input.fullEvidence.additional_features['Made up feature'] = pass(PRODUCT_ACCEPTANCE);
  assert.equal(evaluate(input).decision, 'NO-GO');
});

test('stale reports, wrong SHA and wrong staging environment never pass', () => {
  const input = fixture();
  input.fullEvidence.products['1'].executed_at = '2026-10-31T00:00:00Z';
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.products['1'] = pass(PRODUCT_ACCEPTANCE);
  input.fullEvidence.products['1'].deployment_sha = 'b'.repeat(40);
  assert.equal(evaluate(input).decision, 'NO-GO');
  input.fullEvidence.products['1'] = pass(PRODUCT_ACCEPTANCE);
  input.workspaceEvidence.target.supabase_ref = 'kbzjngpzxpniaumlupaa';
  assert.equal(evaluate(input).decision, 'NO-GO');
});

test('research workspace must itself pass scientific, security and billing gates', () => {
  const input = fixture();
  input.workspaceEvidence.checks.research.metrics.human_reviewed_queries = 0;
  const result = evaluate(input);
  assert.equal(result.decision, 'NO-GO');
  assert.equal(result.underlying_workspace_decision, 'NO-GO');
});

test('malformed inventory and evidence fail closed instead of throwing', () => {
  for (const inventory of [undefined, {}, { products: {} }, { products: null }, { products: [] }]) {
    const result = evaluate({ ...fixture(), inventory });
    assert.equal(result.decision, 'NO-GO');
  }
  assert.equal(evaluateFullPlatformReadiness().decision, 'NO-GO');
});

test('default full-platform evidence is intentionally NOT_RUN and the CLI returns NO-GO', async () => {
  const raw = JSON.parse(await readFile('docs/release/full-platform-readiness-evidence.json', 'utf8'));
  assert.equal(Object.keys(raw.products).length, 77);
  assert.ok(Object.values(raw.products).every(report => report.status === 'NOT_RUN'));
  const cli = spawnSync(process.execPath, ['scripts/check-full-platform-readiness.mjs'], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout).decision, 'NO-GO');
});
