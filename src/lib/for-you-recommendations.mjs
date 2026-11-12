/** Build a small set of explicit, user-authored research signals. */
export function deriveRecommendationQueries(profile, limit = 3) {
  const candidates = [
    ...(Array.isArray(profile?.searches) ? profile.searches : []).map((item) => ({
      query: item?.query,
      reason: 'Based on a recent search',
    })),
    ...(Array.isArray(profile?.activeProjects) ? profile.activeProjects : []).map((project) => ({
      query: [project?.title, project?.goal].filter(Boolean).join(' '),
      reason: `Related to project: ${String(project?.title || 'your project').trim()}`,
    })),
    ...(Array.isArray(profile?.projects) ? profile.projects : []).filter((project) =>
      !['active', 'planning'].includes(project?.status)
    ).map((project) => ({
      query: [project?.title, project?.goal].filter(Boolean).join(' '),
      reason: `Related to project: ${String(project?.title || 'your project').trim()}`,
    })),
    ...(Array.isArray(profile?.user?.research_interests)
      ? profile.user.research_interests
      : String(profile?.user?.research_interests || '').split(/[,;\n]/)
    ).map((interest) => ({ query: interest, reason: 'Based on a saved research interest' })),
  ];

  const seen = new Set();
  return candidates.flatMap(({ query, reason }) => {
    const value = String(query || '').replace(/\s+/g, ' ').trim();
    const key = value.toLocaleLowerCase();
    if (!value || value.length < 3 || seen.has(key)) return [];
    seen.add(key);
    return [{ query: value.slice(0, 180), reason }];
  }).slice(0, Math.max(0, limit));
}

export function recommendationIdentity(paper = {}) {
  const doi = String(paper.doi || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
  if (doi) return `doi:${doi}`;
  const id = String(paper.id || paper.source_id || '').trim().toLowerCase();
  if (id) return `id:${id}`;
  return `title:${String(paper.title || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')}`;
}

export function mergeRecommendationResults(results = []) {
  const merged = new Map();
  for (const result of results) {
    for (const paper of Array.isArray(result?.papers) ? result.papers : []) {
      if (!paper?.title) continue;
      const key = recommendationIdentity(paper);
      if (!key || key === 'title:') continue;
      const existing = merged.get(key);
      const source = result.signal;
      if (existing) {
        existing.alsoRelevantTo.push(source);
        if (!existing.paper.abstract && paper.abstract) existing.paper = { ...existing.paper, abstract: paper.abstract };
      } else {
        merged.set(key, { paper, reason: source.reason, alsoRelevantTo: [], query: source.query });
      }
    }
  }
  return [...merged.values()];
}
