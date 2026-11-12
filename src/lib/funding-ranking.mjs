const RANKING_DIFFICULTIES = new Set(['Low', 'Medium', 'High']);

/**
 * Merge untrusted model output into official funding records without allowing
 * model-supplied fields to overwrite source facts.
 */
export function applyFundingRanking(records, ranking) {
  const knownIds = new Set(records.map((record) => record.id));
  const rankedById = new Map();

  for (const candidate of Array.isArray(ranking?.ranked) ? ranking.ranked : []) {
    if (!candidate || typeof candidate !== 'object' || !knownIds.has(candidate.id) || rankedById.has(candidate.id)) continue;
    const score = typeof candidate.match_score === 'number' ? candidate.match_score : Number.NaN;
    rankedById.set(candidate.id, {
      match_score: Number.isFinite(score) && score >= 0 && score <= 100 ? score : null,
      match_reason: typeof candidate.match_reason === 'string' ? candidate.match_reason.trim().slice(0, 500) : '',
      difficulty: RANKING_DIFFICULTIES.has(candidate.difficulty) ? candidate.difficulty : 'Unranked',
    });
  }

  return records
    .map((record, index) => ({
      ...record,
      ...(rankedById.get(record.id) || {
        match_score: null,
        match_reason: '',
        difficulty: 'Unranked',
      }),
      _fundingOriginalOrder: index,
    }))
    .sort((left, right) => (right.match_score ?? -1) - (left.match_score ?? -1) || left._fundingOriginalOrder - right._fundingOriginalOrder)
    .map(({ _fundingOriginalOrder, ...record }) => record);
}
