import { evaluateReleaseReadiness } from './release-readiness.mjs';

// This is the mandatory launch inventory, not a list of implemented features.
// A matrix with 77 arbitrary names is not sufficient.
export const REQUIRED_PRODUCT_NAMES = Object.freeze([
  'EYLO Life', 'EYLO Calendar', 'EYLO Notes', 'EYLO Spaces', 'EYLO Memory',
  'EYLO Notifications', 'EYLO Personal Dashboard', 'EYLO Learn', 'EYLO Study Planner',
  'EYLO Flashcards', 'EYLO Quiz Generator', 'EYLO Skills', 'EYLO Career',
  'EYLO CV Builder', 'EYLO Interview Simulator', 'EYLO Files', 'EYLO Create',
  'EYLO Document Editor', 'EYLO Presentations', 'EYLO Spreadsheets',
  'EYLO Universal Search', 'EYLO Translate', 'EYLO Knowledge Graph', 'EYLO Agent',
  'EYLO Workflow Builder', 'EYLO Automations', 'EYLO Research Radar', 'EYLO Voice',
  'EYLO Smart Import', 'EYLO AI Verification', 'EYLO Export Center', 'EYLO Teams',
  'EYLO Meetings AI', 'EYLO Connect', 'EYLO Community', 'EYLO Discover', 'EYLO Studio',
  'EYLO Activity History', 'EYLO Admin Operations', 'EYLO Feature Health',
  'EYLO Auto-Save', 'EYLO Self-Healing', 'EYLO Offline', 'EYLO Accessibility',
  'EYLO Onboarding', 'EYLO Feedback', 'EYLO AI Workspace Command Center',
  'Evidence Ledger', 'Research Reproducibility Studio', 'Research Collaboration Matcher',
  'Academic Writing Assistant', 'Methodology Coach', 'Peer Review Workspace',
  'Project Intelligence', 'Knowledge Timeline', 'Decision Workspace',
  'Research-to-Product Studio', 'Research Intelligence', 'Thesis Studio',
  'Experiment Lab', 'Business Intelligence', 'Literature Review Studio',
  'Citation Network', 'Research Ethics', 'Scientific Figures', 'Research Journal',
  'Academic Supervisor', 'Conference Hub', 'Publication Tracker', 'Research Budget',
  'Smart Forms', 'Survey Analytics', 'Data Catalog', 'Project Templates',
  'Time Tracker', 'API & Developer Hub', 'Institutional Portal',
]);

export const PRODUCT_ACCEPTANCE = Object.freeze([
  'requirements', 'actual_frontend', 'backend_actions', 'data_persistence',
  'authentication', 'two_user_authorization', 'error_recovery', 'browser_e2e',
  'cross_product_integration', 'responsive_accessibility', 'staging_acceptance',
  'documentation_and_release_evidence',
]);
export const SITE_ACCEPTANCE = Object.freeze([
  'all_public_routes', 'all_private_routes', 'all_buttons_and_forms',
  'auth_and_recovery', 'server_effects_and_persistence', 'mobile_and_keyboard',
  'wcag_22_aa_review', 'accurate_pricing_and_claims', 'privacy_and_contact',
  '404_and_error_states',
]);
export const WORKFLOW_ACCEPTANCE = Object.freeze([
  'real_persistence', 'two_user_permissions', 'cross_product_consistency',
  'network_failure_recovery', 'browser_acceptance',
]);
export const REQUIRED_WORKFLOWS = Object.freeze(['research_to_deliverable', 'document_roundtrip', 'study_to_progress', 'opportunity_to_application', 'team_to_meeting']);
const SHA = /^[0-9a-f]{40}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVIDENCE = /^(?:docs\/release\/evidence\/[A-Za-z0-9_.-]+\.(?:json|md|txt)|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+)$/;
const REF = /^[a-z]{20}$/;
const FORBIDDEN = new Set(['kbzjngpzxpniaumlupaa', 'umzrggayitzfgrrofjnw']);

function recent(value, now) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= now + 300000 && time >= now - 7 * 86400000;
}
function actorsValid(value) {
  return Array.isArray(value) && value.length === 2 && value[0] !== value[1]
    && value.every(id => typeof id === 'string' && UUID.test(id));
}

function verifyReport(report, assertions, { commit, ref, project, now, requireActors = true }) {
  const reasons = [];
  if (report?.status !== 'PASS') reasons.push('A passing hosted acceptance report is missing.');
  if (report?.scope !== 'hosted-staging') reasons.push('Acceptance must run against authorized hosted staging.');
  if (report?.commit !== commit || report?.deployment_sha !== commit) reasons.push('Report and deployment must match exact source SHA.');
  if (report?.supabase_ref !== ref || report?.vercel_project_id !== project) reasons.push('Report targets the wrong environment.');
  if (!recent(report?.executed_at, now)) reasons.push('Report is stale, absent or in the future.');
  if (!EVIDENCE.test(report?.evidence || '')) reasons.push('Sanitized evidence artifact or GitHub run is required.');
  if (typeof report?.reviewed_by !== 'string' || !report.reviewed_by.trim()) reasons.push('Accountable reviewer is required.');
  if (requireActors && !actorsValid(report?.test_user_ids)) reasons.push('Two distinct disposable test-account IDs are required.');
  for (const assertion of assertions) {
    if (report?.assertions?.[assertion] !== true) reasons.push(`Unverified: ${assertion}.`);
  }
  return reasons;
}

function inventoryProblems(inventory) {
  const issues = [];
  const products = inventory?.products;
  if (!Array.isArray(products) || products.length !== 77) {
    issues.push('Canonical matrix must contain exactly 77 product records.');
    return issues;
  }
  const ids = new Set();
  for (const product of products) {
    if (!Number.isInteger(product?.id) || product.id < 1 || product.id > 77 || ids.has(product.id)) {
      issues.push('Duplicate, missing or out-of-range product ID.');
      continue;
    }
    ids.add(product.id);
    if (product.name !== REQUIRED_PRODUCT_NAMES[product.id - 1]) {
      issues.push(`Canonical name mismatch for product ${product.id}.`);
    }
  }
  if (ids.size !== 77) issues.push('At least one mandatory product ID is missing.');
  if (!Array.isArray(inventory?.additional_features)) {
    issues.push('Additional existing and advertised feature inventory must be explicitly audited.');
  }
  return issues;
}

/**
 * Compatibility validator, not an attestation of test execution.
 * A READY_FOR_OWNER_REVIEW result can never authorize a production release.
 */
export function evaluateFullPlatformReadiness({
  inventory, workspaceEvidence, fullEvidence, expectedCommit, now = Date.now(),
} = {}) {
  const workspace = evaluateReleaseReadiness(workspaceEvidence, { expectedCommit, now });
  const issues = inventoryProblems(inventory);
  const staging = workspaceEvidence?.target || {};
  const context = {
    commit: expectedCommit, ref: staging.supabase_ref,
    project: staging.vercel_project_id, now,
  };
  if (!SHA.test(expectedCommit || '') || fullEvidence?.commit !== expectedCommit) {
    issues.push('Full-platform evidence must match exact source SHA.');
  }
  if (fullEvidence?.schema_version !== 1 || fullEvidence?.scope !== 'full-platform-77') {
    issues.push('Invalid full-platform evidence schema or scope.');
  }
  if (workspace.decision !== 'READY_FOR_OWNER_REVIEW') {
    issues.push('The underlying research-workspace, security and operations gates have not passed.');
  }
  if (staging.environment !== 'staging' || !REF.test(staging.supabase_ref || '') || FORBIDDEN.has(staging.supabase_ref)
    || staging.owner_confirmed !== true || staging.connector_verified !== true) {
    issues.push('An independently verified nonproduction Supabase staging identity is required.');
  }
  const ids = new Set((inventory?.products || []).map(product => product?.id));
  const perProduct = REQUIRED_PRODUCT_NAMES.map((name, index) => {
    const id = index + 1;
    const row = inventory?.products?.find(product => product?.id === id);
    const report = fullEvidence?.products?.[String(id)];
    const reasons = [];
    if (!ids.has(id) || row?.name !== name) reasons.push('Required product inventory entry missing or mismatched.');
    if (String(row?.status || '').trim().toUpperCase() !== 'COMPLETE') {
      reasons.push('Current implementation matrix has not marked the product complete.');
    }
    reasons.push(...verifyReport(report, PRODUCT_ACCEPTANCE, context));
    return { id, name, status: reasons.length ? 'BLOCKED' : 'VERIFIED', reasons };
  });
  const fullSiteReasons = verifyReport(fullEvidence?.site, SITE_ACCEPTANCE, context);
  const siteCoverage = fullEvidence?.site?.coverage || {};
  for (const type of ['public_routes', 'private_routes', 'interactive_controls']) {
    const expected = siteCoverage[`${type}_expected`];
    const tested = siteCoverage[`${type}_tested`];
    if (!Number.isSafeInteger(expected) || expected < 1 || tested !== expected) {
      fullSiteReasons.push(`Complete measured ${type} coverage is required.`);
    }
  }
  const workflows = REQUIRED_WORKFLOWS.map(id => {
    const reasons = verifyReport(fullEvidence?.workflows?.[id], WORKFLOW_ACCEPTANCE, context);
    return { id, status: reasons.length ? 'BLOCKED' : 'VERIFIED', reasons };
  });
  const reviewReasons = verifyReport(fullEvidence?.additional_inventory_review, [
    'source_routes_audited', 'advertised_features_audited',
    'backend_and_integration_inventory_audited',
  ], { ...context, requireActors: false });
  const extras = Array.isArray(inventory?.additional_features) ? inventory.additional_features : [];
  const extraReports = extras.map(name => {
    const reasons = typeof name === 'string' && name.trim()
      ? verifyReport(fullEvidence?.additional_features?.[name], PRODUCT_ACCEPTANCE, context)
      : ['Invalid additional-feature name in inventory.'];
    return { name, status: reasons.length ? 'BLOCKED' : 'VERIFIED', reasons };
  });
  const suppliedExtras = Object.keys(fullEvidence?.additional_features || {});
  if (suppliedExtras.some(name => !extras.includes(name))) reviewReasons.push('Uninventoried additional-feature report found.');
  if (extras.length !== new Set(extras).size) reviewReasons.push('Duplicate additional-feature inventory entries.');
  const ready = issues.length === 0 && !fullSiteReasons.length && !reviewReasons.length
    && perProduct.every(report => report.status === 'VERIFIED')
    && workflows.every(report => report.status === 'VERIFIED')
    && extraReports.every(report => report.status === 'VERIFIED');
  return {
    schema_version: 1, scope: 'full-platform-77', commit: expectedCommit || null,
    decision: ready ? 'READY_FOR_OWNER_REVIEW' : 'NO-GO',
    production_authorized: false,
    underlying_workspace_decision: workspace.decision,
    identity_issues: issues, products: perProduct,
    site: { status: fullSiteReasons.length ? 'BLOCKED' : 'VERIFIED', reasons: fullSiteReasons },
    workflows,
    additional_inventory: { status: reviewReasons.length ? 'BLOCKED' : 'VERIFIED', reasons: reviewReasons },
    additional_features: extraReports,
    note: 'This validator checks report compatibility, not actual evidence truth. Human inspection and separate owner production authorization are mandatory.',
  };
}
