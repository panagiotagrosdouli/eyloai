import { protectedApiFetch } from '@/lib/protected-api';

export class FundingRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FundingRequestError';
    this.status = status;
  }
}


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
    const score = Number(candidate.match_score);
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

export async function searchFundingOpportunities(query, limit = 12, options = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new FundingRequestError('Describe the funding you want to find.', 400);

  const params = new URLSearchParams({
    q: cleanQuery,
    limit: String(Math.min(15, Math.max(1, Number(limit) || 12))),
  });

  const response = await protectedApiFetch(`/api/opportunities?${params}`, options);
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new FundingRequestError(
      result.error || 'The official funding search did not complete.',
      response.status,
    );
  }

  return {
    ...result,
    items: Array.isArray(result.items) ? result.items : [],
  };
}
