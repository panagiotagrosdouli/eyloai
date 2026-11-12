const RANKING_DIFFICULTIES = new Set(['Low', 'Medium', 'High']);

/**
 * Merge untrusted model output into official funding records without allowing
 * model-supplied fields to overwrite source facts.
 */
export function applyFundingRanking(records, ranking) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const knownIds = new Set(sourceRecords
    .filter((record) => record && typeof record.id === 'string' && record.id.length > 0)
    .map((record) => record.id));
  const rankedById = new Map();

  for (const candidate of Array.isArray(ranking?.ranked) ? ranking.ranked : []) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
      || typeof candidate.id !== 'string' || !knownIds.has(candidate.id) || rankedById.has(candidate.id)) continue;
    const score = typeof candidate.match_score === 'number' ? candidate.match_score : Number.NaN;
    const validScore = Number.isFinite(score) && score >= 0 && score <= 100;
    const reason = typeof candidate.match_reason === 'string'
      ? candidate.match_reason.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 500)
      : '';
    rankedById.set(candidate.id, {
      match_score: validScore ? score : null,
      match_reason: validScore ? reason : '',
      difficulty: validScore && RANKING_DIFFICULTIES.has(candidate.difficulty) ? candidate.difficulty : 'Unranked',
    });
  }

  return sourceRecords
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
