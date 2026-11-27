import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const allowedStatus = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const expectedNames = ['Build', 'EYLO Quality Gate', 'Product quality'];

export function hashGitBlob(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash('sha1').update(Buffer.from('blob ' + buf.length + '\0')).update(buf).digest('hex');
}

/** Offline reproducibility only. It cannot query GitHub/Vercel, establish
 * actual deployment access or turn CI status into hosted/security acceptance. */
export function validateReleaseCandidateManifest(data, { lockfileBytes } = {}) {
  const errors = [];
  const check = (condition, code) => { if (!condition) errors.push(code); };
  check(data?.schema_version === 1, 'invalid_manifest_schema');
  check(data?.source_repository === 'panagiotagrosdouli/eyloai', 'wrong_repository');
  const candidate = data?.frozen_candidate || {};
  check(candidate.pull_request === 626 && isSha(candidate.commit_sha), 'invalid_frozen_candidate');
  check(candidate.git_ref === 'codex/eylo-scientific-safe-integration-20261127', 'invalid_candidate_ref');
  check(isSha(candidate.base_main_sha), 'invalid_main_base');
  check(candidate.lockfile?.path === 'package-lock.json' && isSha(candidate.lockfile?.git_blob_sha), 'invalid_lockfile_reference');
  if (lockfileBytes !== undefined) check(hashGitBlob(lockfileBytes) === candidate.lockfile?.git_blob_sha, 'lockfile_bytes_changed');

  const workflows = data?.workflows;
  check(Array.isArray(workflows) && workflows.length === expectedNames.length, 'incomplete_workflow_evidence');
  if (Array.isArray(workflows)) for (const expected of expectedNames) {
    const matches = workflows.filter(row => row?.name === expected);
    check(matches.length === 1 && Number.isSafeInteger(matches[0]?.run_id) && matches[0].run_id > 0
      && matches[0].result === 'PASS' && isSha(matches[0].workflow_blob_sha)
      && /^\.github\/workflows\/[a-z-]+\.yml$/.test(matches[0].workflow_path), 'unverified_workflow_' + expected.replaceAll(' ', '_'));
  }
  const preview = data?.preview || {};
  check(preview.commit_sha === candidate.commit_sha && preview.git_ref === candidate.git_ref, 'preview_commit_not_frozen');
  check(/^dpl_[a-zA-Z0-9]+$/.test(preview.deployment_id || '') && preview.deployment_target === 'preview'
    && preview.build_state === 'READY', 'invalid_preview_identity');
  check(preview.vercel_project_id === 'prj_yiujFufSKIRnlmZUr9WG7jgf7qKL'
    && preview.vercel_team_id === 'team_IUkyJtLhpTRBaUikmCSYHBDn', 'invalid_preview_project');
  try {
    const url = new URL(preview.url);
    check(url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === '/' && url.hostname === 'eyloai-npqm1075s-panagiotagrosdoulis-projects.vercel.app',
      'unexpected_preview_url');
  } catch { errors.push('invalid_preview_url'); }
  check(preview.authenticated_two_account_acceptance === 'NOT_RUN', 'unverified_hosted_acceptance_must_be_not_run');

  const gates = data?.gates;
  check(Array.isArray(gates) && gates.length >= 10, 'release_gates_missing');
  if (Array.isArray(gates)) {
    const names = gates.map(row => row.name);
    check(new Set(names).size === names.length, 'duplicate_release_gate');
    check(gates.every(row => allowedStatus.has(row.status)), 'invalid_gate_status');
    check(gates.some(row => row.name === 'independent_scientific_quality' && row.status === 'NOT_RUN'), 'fabricated_scientific_approval');
    check(gates.some(row => row.name === 'hosted_auth_rls_storage' && row.status === 'BLOCKED'), 'fabricated_hosted_approval');
    check(gates.some(row => row.name === 'deployment_controls' && row.status === 'BLOCKED'), 'production_control_unreviewed');
    check(gates.some(row => row.name === 'owner_signoff' && row.status === 'NOT_RUN'), 'owner_signoff_not_recorded');
  }
  check(data?.production_reference?.main_sha === candidate.base_main_sha
    && data?.production_reference?.github_main_protected === false
    && data?.production_reference?.owner_control_confirmed === false, 'production_status_misrepresented');
  check(data?.decision === 'NO-GO' && data?.production_authorized === false, 'inappropriate_go_decision');
  return { valid: errors.length === 0, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const manifest = JSON.parse(readFileSync(resolve(root, 'docs/release/candidates/pr626-2026-11-27.json'), 'utf8'));
  const result = validateReleaseCandidateManifest(manifest, { lockfileBytes: readFileSync(resolve(root, 'package-lock.json')) });
  if (!result.valid) { console.error('Release candidate reproducibility preflight FAILED: ' + result.errors.join(', ')); process.exitCode = 2; }
  else console.log('Frozen PR #626 manifest is structurally consistent and package-lock bytes match. Independent hosted acceptance still BLOCKED; production NO-GO.');
}
