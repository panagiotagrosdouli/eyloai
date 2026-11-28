import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateReleaseCandidateManifest, hashGitBlob } from '../scripts/verify-release-candidate-manifest.mjs';

const manifest = JSON.parse(readFileSync(new URL('../docs/release/candidates/pr626-2026-11-27.json', import.meta.url), 'utf8'));
const lockfile = readFileSync(new URL('../package-lock.json', import.meta.url));

test('frozen release candidate is reproducibly bound to its exact lockfile bytes', () => {
  assert.equal(hashGitBlob(lockfile), '7d232c6c4f93e156dca171dda11aac019b3f90c5');
  assert.deepEqual(validateReleaseCandidateManifest(manifest, { lockfileBytes: lockfile }), { valid: true, errors: [] });
});

test('release preflight rejects substituted lockfile and purported preview for a different SHA', () => {
  const modified = structuredClone(manifest);
  modified.preview.commit_sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.ok(validateReleaseCandidateManifest(modified, { lockfileBytes: lockfile }).errors.includes('preview_commit_not_frozen'));
  assert.ok(validateReleaseCandidateManifest(manifest, { lockfileBytes: Buffer.from('{}') }).errors.includes('lockfile_bytes_changed'));
});

test('CI pass cannot be promoted into human/hosted approval or production GO', () => {
  for (const change of [
    data => { data.preview.authenticated_two_account_acceptance = 'PASS'; },
    data => { data.gates.find(g => g.name === 'independent_scientific_quality').status = 'PASS'; },
    data => { data.gates.find(g => g.name === 'hosted_auth_rls_storage').status = 'PASS'; },
    data => { data.production_authorized = true; data.decision = 'GO'; },
    data => { data.gates.find(g => g.name === 'owner_signoff').status = 'PASS'; },
  ]) {
    const candidate = structuredClone(manifest);
    change(candidate);
    assert.equal(validateReleaseCandidateManifest(candidate, { lockfileBytes: lockfile }).valid, false);
  }
});

test('missing required code CI workflow or wrong preview host is rejected', () => {
  const missing = structuredClone(manifest);
  missing.workflows.pop();
  assert.equal(validateReleaseCandidateManifest(missing, { lockfileBytes: lockfile }).valid, false);
  const wrong = structuredClone(manifest);
  wrong.preview.url = 'https://eyloai.vercel.app';
  assert.ok(validateReleaseCandidateManifest(wrong, { lockfileBytes: lockfile }).errors.includes('unexpected_preview_url'));
});
