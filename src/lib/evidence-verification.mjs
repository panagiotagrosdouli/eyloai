/**
 * Evidence review is a conservative, AI-assisted abstract-level check.
 * It does NOT establish scientific truth or substitute for reading full papers.
 * The model may propose verdicts, but only literal excerpts from cited source
 * abstracts can pass this deterministic post-processing gate.
 */
const MAX_PAPERS = 12;
const MIN_QUOTE_LENGTH = 20;

function normalized(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function reviewableClaims(analysis = {}) {
  const result = [];
  for (const [field, contentField, prefix] of [
    ['key_findings', 'finding', 'F'],
    ['trends', 'description', 'T'],
  ]) {
    const items = Array.isArray(analysis[field]) ? analysis[field] : [];
    items.forEach((item, index) => {
      if (!item || typeof item[contentField] !== 'string' || !item[contentField].trim()) return;
      // Only claims with an actual paper reference are reviewable against paper abstracts.
      if (!/\[P\d+\]/.test(String(item.evidence || ''))) return;
      result.push({
        id: prefix + index,
        claim: item[contentField],
        evidence: item.evidence,
      });
    });
  }
  return result;
}

/**
 * Fail closed if the second model omitted, duplicated or invented claim IDs.
 * A complete response is necessary for auditing but NEVER proves that a
 * "supported" semantic judgment is correct.
 */
export function validateEvidenceReviewBatch(candidates, reviews) {
  if (!Array.isArray(candidates) || !Array.isArray(reviews)) {
    return { ok: false, reason: 'missing_review_batch' };
  }
  const ids = new Set();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate.id !== 'string' || !candidate.id || ids.has(candidate.id)) {
      return { ok: false, reason: 'invalid_claim_ids' };
    }
    ids.add(candidate.id);
  }
  if (reviews.length !== ids.size) return { ok: false, reason: 'incomplete_review_batch' };
  const seen = new Set();
  for (const review of reviews) {
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      return { ok: false, reason: 'invalid_review' };
    }
    const { claim_id: claimId, verdict, source_id: sourceId, quote } = review;
    if (typeof claimId !== 'string' || !ids.has(claimId) || seen.has(claimId)) {
      return { ok: false, reason: 'unknown_or_duplicate_claim' };
    }
    if (!['supported', 'partial', 'unsupported', 'insufficient'].includes(verdict)
        || typeof quote !== 'string' || typeof sourceId !== 'string') {
      return { ok: false, reason: 'invalid_verdict' };
    }
    if (verdict !== 'supported' && quote.trim()) {
      return { ok: false, reason: 'non_supported_quote' };
    }
    seen.add(claimId);
  }
  return { ok: true };
}

export function selectExcerptSupportedClaims(analysis = {}, reviews, papers = []) {
  const paperSample = (Array.isArray(papers) ? papers : []).slice(0, MAX_PAPERS);
  const candidates = reviewableClaims(analysis);
  const batch = validateEvidenceReviewBatch(candidates, reviews);
  if (!batch.ok) {
    return {
      key_findings: [],
      trends: [],
      evidence_review: {
        status: 'invalid_batch',
        claims_checked: candidates.length,
        claims_retained: 0,
        limitation: 'Second-model review was incomplete or inconsistent; no AI-reviewed claims were published.',
      },
    };
  }
  const byId = new Map(candidates.map(claim => [claim.id, claim]));
  const accepted = new Map();

  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review || typeof review !== 'object' || review.verdict !== 'supported') continue;
    const original = byId.get(review.claim_id);
    if (!original || accepted.has(review.claim_id)) continue;
    const sourceMatch = /^P([1-9]\d*)$/.exec(String(review.source_id || ''));
    if (!sourceMatch) continue;
    const sourceNumber = Number(sourceMatch[1]);
    const paper = paperSample[sourceNumber - 1];
    if (!paper || typeof paper.summary !== 'string') continue;
    const reference = '[P' + sourceNumber + ']';
    if (!original.evidence.includes(reference)) continue;
    const quote = String(review.quote || '').trim();
    const abstractText = normalized(paper.summary.slice(0, 240));
    const normalizedQuote = normalized(quote);
    if (normalizedQuote.length < MIN_QUOTE_LENGTH || !abstractText.includes(normalizedQuote)) continue;

    accepted.set(review.claim_id, {
      source_id: reference,
      source_url: typeof paper.url === 'string' && /^https:\/\//i.test(paper.url) ? paper.url : '',
      source_excerpt: quote,
      evidence_review_label: 'AI-reviewed excerpt (not independent verification)',
    });
  }

  const filter = (field, prefix) => (Array.isArray(analysis[field]) ? analysis[field] : [])
    .flatMap((item, index) => {
      const finding = accepted.get(prefix + index);
      return finding ? [{ ...item, ...finding }] : [];
    });

  return {
    key_findings: filter('key_findings', 'F'),
    trends: filter('trends', 'T'),
    evidence_review: {
      status: 'model_assessed',
      claims_checked: candidates.length,
      claims_retained: accepted.size,
      limitation: 'Source excerpts were checked against retrieved abstracts and assessed by a model; this is not peer review or independent scientific verification.',
    },
  };
}
