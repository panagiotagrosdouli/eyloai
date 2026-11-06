/**
 * Offline, independently adjudicated EYRA claim evaluation.
 * This code uses exactly the runtime claim post-processing path.
 * It cannot attest that user-provided judges were truly independent.
 */
import { reviewableClaims, selectExcerptSupportedClaims, validateEvidenceReviewBatch } from './evidence-verification.mjs';

const LABELS = new Set(['supported', 'partial', 'unsupported', 'insufficient']);
export const HUMAN_REVIEW_PROTOCOL = 'eyra-abstract-claim-v1';
export const MINIMUM_EVALUATION_DOMAINS = 4;
export const MINIMUM_NEGATIVES_PER_DOMAIN = 75;
export const MINIMUM_POSITIVES_PER_DOMAIN = 20;
export const MINIMUM_EXACT_ANNOTATOR_AGREEMENT = 0.80;

export function wilson95(positive, total) {
  if (!Number.isInteger(positive) || !Number.isInteger(total) || total < 0 || positive < 0 || positive > total) {
    throw new RangeError('Invalid binomial metric counts.');
  }
  if (!total) return { lower: null, upper: null };
  const z = 1.959963984540054;
  const p = positive / total;
  const denom = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denom;
  const margin = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
  };
}

/**
 * Cohen's unweighted kappa on the four adjudication categories.
 * Report observed agreement as well: kappa is undefined when both
 * annotators always select the same single category (chance = 100%).
 */
export function interRaterAgreement(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0
      || pairs.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(label => !LABELS.has(label)))) {
    throw new Error('Two valid independent annotation labels per case are required.');
  }
  const n = pairs.length;
  const matches = pairs.filter(([a, b]) => a === b).length;
  const observed = matches / n;
  const labels = [...LABELS];
  const chance = labels.reduce((sum, label) => (
    sum + pairs.filter(pair => pair[0] === label).length / n
      * (pairs.filter(pair => pair[1] === label).length / n)
  ), 0);
  return {
    cases: n,
    agreements: matches,
    disagreements: n - matches,
    exact_agreement: observed,
    expected_agreement_by_chance: chance,
    cohen_kappa: chance < 1 ? (observed - chance) / (1 - chance) : null,
    note: chance === 1 ? 'Kappa undefined because both annotators used one category exclusively.' : null,
  };
}

function confusion(rows, field) {
  const counts = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const row of rows) {
    const expected = row.expected;
    const observed = row[field];
    if (expected) counts[observed ? 'tp' : 'fn']++;
    else counts[observed ? 'fp' : 'tn']++;
  }
  const positives = counts.tp + counts.fn;
  const negatives = counts.tn + counts.fp;
  return {
    ...counts,
    positive_cases: positives,
    negative_cases: negatives,
    precision: counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null,
    recall: positives ? counts.tp / positives : null,
    false_acceptance_rate: negatives ? counts.fp / negatives : null,
    false_acceptance_95ci: wilson95(counts.fp, negatives),
  };
}

export function evaluateAdjudicatedEvidence(data, { requireHuman = true } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid evaluation dataset.');
  if (data.protocol !== HUMAN_REVIEW_PROTOCOL) throw new Error('Unknown evaluation protocol.');
  if (requireHuman && data.label_origin !== 'independent_human_adjudication') {
    throw new Error('No independent human adjudication provenance supplied; cannot score as a human evaluation.');
  }
  if (!Array.isArray(data.cases) || !data.cases.length) throw new Error('No adjudicated evaluation cases supplied.');
  const ids = new Set();
  const rows = [];
  for (const item of data.cases) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)
      || typeof item.domain !== 'string' || !item.domain.trim()
      || typeof item.claim !== 'string' || !item.claim.trim()
      || typeof item.paper?.title !== 'string' || !item.paper.title.trim()
      || typeof item.paper?.abstract !== 'string' || item.paper.abstract.trim().length < 20
      || typeof item.paper?.url !== 'string' || !/^https:\/\//i.test(item.paper.url)
      || !LABELS.has(item.adjudicated_verdict)
      || typeof item.adjudication_rationale !== 'string' || item.adjudication_rationale.trim().length < 10
      || !Array.isArray(item.independent_labels) || item.independent_labels.length !== 2) {
      throw new Error('Case missing stable ID, source, independent annotations, or adjudicated reason.');
    }
    const reviewerIds = new Set();
    for (const label of item.independent_labels) {
      if (!label || typeof label.reviewer_id !== 'string' || !label.reviewer_id.trim()
        || reviewerIds.has(label.reviewer_id) || !LABELS.has(label.verdict)) {
        throw new Error('Case has duplicated, missing or invalid independent reviewer labels.');
      }
      reviewerIds.add(label.reviewer_id);
    }
    const [first, second] = item.independent_labels;
    const needsResolution = first.verdict !== second.verdict
      || item.adjudicated_verdict !== first.verdict;
    if (needsResolution && (typeof item.adjudication_resolution !== 'string'
      || item.adjudication_resolution.trim().length < 15)) {
      throw new Error('Conflicting independent annotations require a documented adjudication resolution.');
    }
    if (!item.model_review || typeof item.model_review !== 'object' || Array.isArray(item.model_review)) {
      throw new Error('Missing reviewer model output; incomplete cases cannot be scored as negatives.');
    }
    ids.add(item.id);
    const analysis = { key_findings: [{ finding: item.claim, evidence: '[P1]' }], trends: [] };
    const paper = [{ title: item.paper.title, summary: item.paper.abstract, url: item.paper.url }];
    const candidate = reviewableClaims(analysis);
    if (!validateEvidenceReviewBatch(candidate, [item.model_review]).ok) {
      throw new Error('Malformed reviewer output; cannot score incomplete review as correct rejection.');
    }
    const retained = selectExcerptSupportedClaims(analysis, [item.model_review], paper).key_findings.length > 0;
    rows.push({
      domain: item.domain.trim(),
      independent_verdicts: [first.verdict, second.verdict],
      expected: item.adjudicated_verdict === 'supported',
      reviewer: item.model_review.verdict === 'supported',
      retained,
    });
  }
  const domainNames = [...new Set(rows.map(r => r.domain))].sort();
  const domains = Object.fromEntries(domainNames.map(name => {
    const subset = rows.filter(r => r.domain === name);
    return [name, {
      n: subset.length,
      agreement: interRaterAgreement(subset.map(r => r.independent_verdicts)),
      reviewer: confusion(subset, 'reviewer'),
      published: confusion(subset, 'retained'),
    }];
  }));
  const overall = {
    agreement: interRaterAgreement(rows.map(r => r.independent_verdicts)),
    reviewer: confusion(rows, 'reviewer'),
    published: confusion(rows, 'retained'),
  };
  const domainsAdequate = domainNames.length >= MINIMUM_EVALUATION_DOMAINS
    && domainNames.every(name => {
      const c = domains[name].published;
      return c.positive_cases >= MINIMUM_POSITIVES_PER_DOMAIN
        && domains[name].agreement.exact_agreement >= MINIMUM_EXACT_ANNOTATOR_AGREEMENT
        && c.negative_cases >= MINIMUM_NEGATIVES_PER_DOMAIN
        && c.false_acceptance_95ci.upper !== null && c.false_acceptance_95ci.upper <= 0.05;
    });
  const recallAdequate = overall.published.recall !== null && overall.published.recall >= 0.75;
  return {
    dataset_id: typeof data.dataset_id === 'string' ? data.dataset_id : 'unidentified',
    label_origin: data.label_origin || 'synthetic_or_unattested',
    cases: rows.length,
    domains,
    overall,
    screening_passed: requireHuman && domainsAdequate && recallAdequate && overall.published.fp === 0,
    limitation: 'An offline screening diagnostic, not evidence of deployment quality, clinical validity, independent review authenticity, or permission to launch.',
  };
}
