import { normalizeDoi } from './citation-verification.mjs';

export const SCIENTIFIC_DIMENSIONS = Object.freeze([
  'bibliographic_accuracy',
  'evidence_to_claim_support',
  'research_question_coherence',
  'methodological_appropriateness',
  'internal_consistency',
  'uncertainty_disclosure',
  'ethics_and_reproducibility',
  'grant_requirement_coverage',
]);

export const CLAIM_SUPPORT_LABELS = Object.freeze([
  'supported_by_inspected_evidence',
  'partially_supported',
  'unsupported',
  'contradicted',
  'insufficient_accessible_source_material',
  'not_yet_reviewed',
]);

export const EVIDENCE_SCOPES = Object.freeze(['none', 'metadata_only', 'abstract_only', 'full_text', 'official_call']);
export const DIMENSION_VERDICTS = Object.freeze(['adequate', 'needs_revision', 'insufficient_material', 'not_yet_reviewed']);

const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const string = value => typeof value === 'string' ? value.trim() : '';
const unique = items => new Set(items).size === items.length;
const recordId = value => /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(string(value));
const validUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
};

/**
 * Offline, structural scientific review packet validation.
 * NEVER checks a DOI against Crossref and NEVER judges whether a scientific
 * claim is true. An "adequate" human label is not a release approval.
 *
 * Returns only aggregate identifiers and counts; no confidential claim text,
 * reviewer rationale, DOI, access token or source URL is echoed to stdout.
 */
export function evaluateScientificPacket(packet, /** @type {{expectedCommit?: string}} */ { expectedCommit } = {}) {
  const errors = [];
  const warnings = [];
  const fail = code => errors.push(code);
  if (!object(packet) || packet.schema_version !== 1) {
    return { valid: false, gate: 'BLOCKED', errors: ['invalid_schema_version'], warnings: [], totals: null };
  }
  if (!/^[a-f0-9]{40}$/i.test(string(packet.commit_sha))) fail('invalid_exact_commit_sha');
  if (expectedCommit !== undefined && (!/^[a-f0-9]{40}$/i.test(string(expectedCommit)) || String(packet.commit_sha).toLowerCase() !== String(expectedCommit).toLowerCase())) fail('evaluation_commit_does_not_match_reviewed_code');
  if (!recordId(packet.evaluation_id)) fail('invalid_evaluation_id');
  const records = Array.isArray(packet.records) ? packet.records : [];
  const claims = Array.isArray(packet.claims) ? packet.claims : [];
  const claimReviews = Array.isArray(packet.claim_reviews) ? packet.claim_reviews : [];
  const dimensionReviews = Array.isArray(packet.dimension_reviews) ? packet.dimension_reviews : [];
  if (![packet.records, packet.claims, packet.claim_reviews, packet.dimension_reviews].every(Array.isArray)) fail('invalid_packet_collections');
  if (records.length > 200 || claims.length > 1000 || claimReviews.length > 3000 || dimensionReviews.length > 1000) fail('packet_size_limit');
  if (!records.length) fail('no_reference_publications');
  if (!claims.length) warnings.push('no_claims_submitted_for_expert_review');
  const sourceIds = records.map(row => row?.id);
  const sourceSet = new Set(sourceIds);
  const dois = records.map(row => normalizeDoi(row?.doi));
  if (!unique(sourceIds) || !unique(dois.filter(Boolean))) fail('duplicate_publication_identity');
  for (const row of records) {
    if (!object(row) || !recordId(row.id) || !normalizeDoi(row.doi) || !string(row.title) || !Number.isInteger(row.year) || row.year < 1600 || row.year > 2200 || !validUrl(row.primary_url)) fail('invalid_publication_record');
    if (row.metadata_crosschecked !== true) warnings.push('publication_metadata_not_independently_crosschecked');
    if (row.correction_doi && !normalizeDoi(row.correction_doi)) fail('invalid_correction_doi');
  }
  const claimIds = claims.map(row => row?.id);
  const claimSet = new Set(claimIds);
  if (!unique(claimIds)) fail('duplicate_claim_id');
  const claimSourceMap = new Map();
  for (const row of claims) {
    if (!object(row) || !recordId(row.id) || !['factual', 'proposal'].includes(row.kind) || !string(row.text) || !Array.isArray(row.source_ids) || !unique(row.source_ids)) {
      fail('invalid_claim_record');
      continue;
    }
    if (row.source_ids.some(id => !sourceSet.has(id))) fail('unrecognized_source_identifier');
    if (row.kind === 'factual' && !row.source_ids.length) fail('factual_claim_without_traceable_source');
    claimSourceMap.set(row.id, new Set(row.source_ids));
  }
  const reviewedPairs = new Set();
  const byClaim = new Map();
  let abstractOnlySupported = 0;
  let fullTextInspections = 0;
  for (const review of claimReviews) {
    if (!object(review) || !claimSet.has(review.claim_id) || !recordId(review.reviewer_id) || !CLAIM_SUPPORT_LABELS.includes(review.verdict) || !EVIDENCE_SCOPES.includes(review.evidence_scope)) {
      fail('invalid_claim_review');
      continue;
    }
    const key = review.claim_id + '|' + review.reviewer_id;
    if (reviewedPairs.has(key)) fail('duplicate_claim_reviewer');
    reviewedPairs.add(key);
    if (review.verdict === 'not_yet_reviewed') {
      if (review.evidence_scope !== 'none' || string(review.evidence_locator) || string(review.rationale)) fail('premature_evidence_claim');
      continue;
    }
    if (!sourceSet.has(review.source_id) || !claimSourceMap.get(review.claim_id)?.has(review.source_id)) fail('review_source_not_in_claim');
    if (review.evidence_scope === 'none' || review.evidence_scope === 'metadata_only' || string(review.evidence_locator).length < 3 || string(review.rationale).length < 12) fail('unsubstantiated_human_judgment');
    if (review.evidence_scope === 'abstract_only' && review.verdict === 'supported_by_inspected_evidence') abstractOnlySupported += 1;
    if (review.evidence_scope === 'full_text') fullTextInspections += 1;
    const entries = byClaim.get(review.claim_id) || [];
    entries.push(review);
    byClaim.set(review.claim_id, entries);
  }
  const byDimension = new Map(SCIENTIFIC_DIMENSIONS.map(id => [id, []]));
  const dimensionPairs = new Set();
  for (const review of dimensionReviews) {
    if (!object(review) || !SCIENTIFIC_DIMENSIONS.includes(review.dimension) || !recordId(review.reviewer_id) || !DIMENSION_VERDICTS.includes(review.verdict)) {
      fail('invalid_dimension_review');
      continue;
    }
    const key = review.dimension + '|' + review.reviewer_id;
    if (dimensionPairs.has(key)) fail('duplicate_dimension_reviewer');
    dimensionPairs.add(key);
    if (review.verdict !== 'not_yet_reviewed' && string(review.rationale).length < 12) fail('dimension_judgment_without_reason');
    if (review.verdict === 'not_yet_reviewed' && string(review.rationale)) fail('premature_dimension_reason');
    if (review.verdict !== 'not_yet_reviewed') byDimension.get(review.dimension).push(review);
  }
  const factual = claims.filter(c => c?.kind === 'factual');
  const unresolvedClaims = factual.filter(c => new Set((byClaim.get(c.id) || []).map(j => j.reviewer_id)).size < 2).length;
  const unresolvedDimensions = SCIENTIFIC_DIMENSIONS.filter(d => new Set(byDimension.get(d).map(j => j.reviewer_id)).size < 2);
  const contradictoryRatings = factual.filter(c => new Set((byClaim.get(c.id) || []).map(j => j.verdict)).size > 1).length;
  if (abstractOnlySupported) warnings.push('abstract_only_support_is_not_full_text_verification');
  if (contradictoryRatings) warnings.push('independent_reviewer_disagreement_requires_adjudication');
  const complete = claims.length > 0 && unresolvedClaims === 0 && unresolvedDimensions.length === 0;
  return {
    valid: errors.length === 0,
    gate: errors.length ? 'BLOCKED_INVALID' : complete ? 'REVIEW_DATA_COMPLETE_PENDING_INDEPENDENT_ACCEPTANCE' : 'BLOCKED_UNREVIEWED',
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    totals: {
      reference_publications: records.length,
      claims: claims.length,
      factual_claims: factual.length,
      claim_reviews_recorded: claimReviews.length,
      unresolved_factual_claims: unresolvedClaims,
      dimensions: SCIENTIFIC_DIMENSIONS.length,
      unresolved_dimensions: unresolvedDimensions,
      abstract_only_supported_claim_reviews: abstractOnlySupported,
      full_text_inspections_recorded: fullTextInspections,
      claims_with_reviewer_disagreement: contradictoryRatings,
    },
    release_authorized: false,
  };
}
