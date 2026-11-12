function sourceKey(paper = {}) {
  const key = paper.id || paper.doi || paper.url || paper.title;
  return typeof key === 'string' ? key.trim() : '';
}

export async function saveDiscoveredGapPaper({ entities, paper, project = null }) {
  if (!entities?.SavedPaper || !paper || typeof paper.title !== 'string' || !paper.title.trim()) {
    throw new Error('The scholarly source record is incomplete.');
  }
  const sourceId = sourceKey(paper);
  if (!sourceId) throw new Error('The source record has no stable identifier.');

  const matches = await entities.SavedPaper.filter({ source_id: sourceId }, '-created_date', 1);
  const existing = Array.isArray(matches)
    ? matches.find((record) => record.source_id === sourceId)
    : null;
  if (existing) {
    if (project && existing.project_id && existing.project_id !== project.id) {
      throw new Error('This source is already linked to another project; its existing association was preserved.');
    }
    if (project && !existing.project_id) {
      return entities.SavedPaper.update(existing.id, { project_id: project.id, project_title: project.title || '' });
    }
    return existing;
  }

  return entities.SavedPaper.create({
    source_id: sourceId,
    title: paper.title.trim().slice(0, 1000),
    authors: typeof paper.authors === 'string' ? paper.authors : '',
    summary: typeof paper.summary === 'string' ? paper.summary : '',
    year: paper.year || null,
    doi: typeof paper.doi === 'string' ? paper.doi : '',
    source: paper.source_index || paper.source || '',
    source_index: paper.source_index || paper.source || '',
    url: typeof paper.url === 'string' ? paper.url : '',
    cited_by_count: Number.isFinite(paper.cited_by_count) ? paper.cited_by_count : null,
    open_access: typeof paper.open_access === 'boolean' ? paper.open_access : null,
    ...(project ? { project_id: project.id, project_title: project.title || '' } : {}),
  });
}
