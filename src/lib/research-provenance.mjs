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
