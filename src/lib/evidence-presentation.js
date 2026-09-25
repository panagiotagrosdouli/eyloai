export function evidenceCoverageFromCount(count) {
  const total = Math.max(0, Number(count) || 0);
  if (total >= 8) return 'BROAD';
  if (total >= 3) return 'MODERATE';
  return 'LIMITED';
}

export const EVIDENCE_COVERAGE_LABELS = Object.freeze({
  BROAD: 'Broad retrieval coverage',
  MODERATE: 'Moderate retrieval coverage',
  LIMITED: 'Limited retrieval coverage',
});

export const FUNDING_RELEVANCE_LABELS = Object.freeze({
  strong: 'Strong relevance',
  moderate: 'Moderate relevance',
  possible: 'Possible relevance',
  unranked: 'Not ranked',
});

export function fundingRelevanceWeight(value) {
  return {
    strong: 3,
    moderate: 2,
    possible: 1,
    unranked: 0,
  }[String(value || '').toLowerCase()] || 0;
}
