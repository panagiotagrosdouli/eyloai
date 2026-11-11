// AI relevance labels are advisory. The official provider remains authoritative
// for opportunity identity, title, deadlines, eligibility and source URL.
export function applyVerifiedChallengeRanking(officialRecords, rankedRecords) {
  const explanations = new Map();
  const knownIds = new Set(officialRecords.map(record => String(record.id)));
  for (const suggestion of Array.isArray(rankedRecords) ? rankedRecords : []) {
    const id = String(suggestion?.id || '');
    if (!knownIds.has(id) || explanations.has(id)) continue;
    if (typeof suggestion.match_reason !== 'string') continue;
    explanations.set(id, suggestion.match_reason.trim().slice(0, 500));
  }
  return officialRecords.map(record => ({
    ...record,
    match_reason: explanations.get(String(record.id)) || '',
  }));
}

export function savedChallengeKey(record) {
  const sourceId = String(record?.source_id || '').trim();
  const source = String(record?.source || record?.organizer || record?.agency || '').trim().toLowerCase();
  if (sourceId && source) return `source:${source}:${sourceId}`;
  const url = String(record?.url_hint || record?.url || '').trim();
  if (/^https?:\/\//i.test(url)) return `url:${url.toLowerCase()}`;
  return '';
}
