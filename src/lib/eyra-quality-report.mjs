import { evaluateEyraResearchQuality } from './eyra-quality-metrics.mjs';

/**
 * Research-quality report over human-adjudicated, consent-safe case labels.
 * The calculated intervals are descriptive, not proof of clinical/statistical
 * validity: individual claims may be correlated within papers and questions.
 */

/** Wilson 95% interval for an observed binomial proportion, or null when unmeasured. */
export function wilson95(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)
    || numerator < 0 || denominator < 0 || numerator > denominator) {
    throw new TypeError('Wilson interval requires valid success and total counts.');
  }
  if (!denominator) return null;
  const z = 1.959963984540054;
  const p = numerator / denominator;
  const zz = z * z;
  const center = (p + zz / (2 * denominator)) / (1 + zz / denominator);
  const half = z * Math.sqrt(p * (1 - p) / denominator + zz / (4 * denominator * denominator))
    / (1 + zz / denominator);
  return { lower: Math.max(0, center - half), upper: Math.min(1, center + half) };
}

const PUBLIC_DOMAINS = new Set(['biomedical', 'engineering', 'computer-science', 'environment', 'social-science', 'interdisciplinary', 'other']);

function describeRatio(fraction) {
  return {
    ...fraction,
    wilson95: wilson95(fraction.numerator, fraction.denominator),
  };
}

/**
 * @param {unknown} payload
 * @returns {object} Privacy-safe aggregate counts and per-domain findings.
 */
export function createEyraQualityReport(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.cases)) {
    throw new TypeError('Expected {cases:[...]} with manually audited, synthetic or consent-cleared labels.');
  }
  const cases = payload.cases;
  const reviewerIds = new Set();
  for (const [index, entry] of cases.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.reviewerId !== 'string' || !entry.reviewerId.trim()
      || typeof entry.domain !== 'string' || !PUBLIC_DOMAINS.has(entry.domain)) {
      throw new TypeError(`Case ${index + 1} requires reviewerId and a predefined broad research domain.`);
    }
    reviewerIds.add(entry.reviewerId.trim());
  }
  const aggregate = evaluateEyraResearchQuality(cases);
  const categories = [...new Set(cases.map(item => item.domain))].sort();
  const byDomain = Object.fromEntries(categories.map(domain => {
    const subset = cases.filter(item => item.domain === domain);
    const scores = evaluateEyraResearchQuality(subset);
    return [domain, {
      reviewedCases: scores.reviewedCases,
      citationIdentifierPrecision: describeRatio(scores.citationIdentifierPrecision),
      independentlySupportedClaims: describeRatio(scores.independentlySupportedClaims),
      noEvidenceDisclosure: describeRatio(scores.noEvidenceDisclosure),
      unauthorizedWrites: scores.unauthorizedWrites,
      duplicateWrites: scores.duplicateWrites,
    }];
  }));
  return {
    status: cases.length ? 'DESCRIPTIVE_HUMAN_AUDIT_ONLY' : 'NOT_MEASURED',
    reviewedCases: aggregate.reviewedCases,
    distinctReviewerIds: reviewerIds.size,
    samplingAdequacy: cases.length >= 50 ? 'REVIEW_SAMPLE_SIZE_ONLY' : 'INSUFFICIENT_FOR_PLANNED_50_CASE_AUDIT',
    overall: {
      citationIdentifierPrecision: describeRatio(aggregate.citationIdentifierPrecision),
      independentlySupportedClaims: describeRatio(aggregate.independentlySupportedClaims),
      noEvidenceDisclosure: describeRatio(aggregate.noEvidenceDisclosure),
      unauthorizedWrites: aggregate.unauthorizedWrites,
      duplicateWrites: aggregate.duplicateWrites,
    },
    byDomain,
    limitations: [
      'All correctness labels are human-supplied; source-link validity is not scientific claim support.',
      'Wilson intervals treat observations as independent and may be optimistic for clustered claims.',
      'No live production accuracy, human usability, authorization audit or statistical superiority is established by these counts.',
    ],
  };
}
