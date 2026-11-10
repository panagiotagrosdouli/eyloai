/** Map model suggestions to retrieved records; those records do not prove a gap exists. */
export function normalizeResearchGapCandidates(candidates, papers) {
  const sourceById = new Map((papers || []).map((paper, index) => [`P${index + 1}`, paper]));
  if (!Array.isArray(candidates)) return [];

  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const question = typeof candidate.question === 'string' ? candidate.question.trim() : '';
    const rationale = typeof candidate.rationale === 'string' ? candidate.rationale.trim() : '';
    const contextIds = [...new Set(Array.isArray(candidate.context_paper_ids) ? candidate.context_paper_ids : [])]
      .filter((id) => typeof id === 'string' && sourceById.has(id));
    if (!question || !contextIds.length) return [];

    const counterevidenceIds = [...new Set(Array.isArray(candidate.counterevidence_paper_ids) ? candidate.counterevidence_paper_ids : [])]
      .filter((id) => typeof id === 'string' && sourceById.has(id));
    return [{
      question,
      rationale,
      context: contextIds.map((id) => ({ id, paper: sourceById.get(id) })),
      counterevidence: counterevidenceIds.map((id) => ({ id, paper: sourceById.get(id) })),
    }];
  });
}
