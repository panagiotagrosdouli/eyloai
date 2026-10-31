/**
 * Allow only explicitly cited hypotheses for which every cited index exists
 * in the analysis sample. Citation presence is NOT evidence of scientific truth.
 */
export function traceableGapHypotheses(gaps, paperCount) {
  const available = Math.min(12, Math.max(0, Number(paperCount) || 0));
  if (!Array.isArray(gaps) || available === 0) return [];
  return gaps.filter(gap => {
    if (typeof gap !== 'string' || !gap.trim()) return false;
    const citations = [...gap.matchAll(/\[P(\d+)\]/g)].map(match => Number(match[1]));
    return citations.length > 0 && citations.every(index =>
      Number.isInteger(index) && index >= 1 && index <= available
    );
  });
}

function citedEvidence(text, counts = {}, allowResearchers = false) {
  if (typeof text !== 'string' || !text.trim()) return false;
  const citations = [...text.matchAll(/\[(P|Researcher)\s*(\d+)\]/gi)];
  if (!citations.length) return false;
  return citations.every(([, kind, rawIndex]) => {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 1) return false;
    if (kind.toLowerCase() === 'p') return index <= Math.min(12, Math.max(0, Number(counts.paperCount) || 0));
    return allowResearchers && index <= Math.min(6, Math.max(0, Number(counts.researcherCount) || 0));
  });
}

/** Keep structured EYRA claims only when every cited source exists in its prompt context. */
export function filterUnsupportedEvidenceClaims(analysis, counts = {}) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) return {};
  const citedItems = (items, allowResearchers = false) => Array.isArray(items)
    ? items.filter(item => item && typeof item === 'object'
      && citedEvidence(item.evidence, counts, allowResearchers))
    : [];

  return {
    ...analysis,
    key_findings: citedItems(analysis.key_findings, true),
    trends: citedItems(analysis.trends),
    suggested_roles: citedItems(analysis.suggested_roles, true),
    research_gaps: traceableGapHypotheses(analysis.research_gaps, counts.paperCount),
  };
}
