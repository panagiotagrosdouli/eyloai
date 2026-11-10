export async function savePaperSummary({ entities, paper, sourceText, summary }) {
  const sourceId = paper.source_id || paper.id || paper.doi || paper.url || paper.title;
  if (!sourceId) throw new Error('This paper has no stable identifier to save.');

  // A failed lookup is not equivalent to an empty result. Creating after a
  // read failure can silently add a duplicate to the user's Library.
  const matches = await entities.SavedPaper.filter({ source_id: sourceId }, '-created_date', 1);
  const existing = (Array.isArray(matches) ? matches : []).find((record) => record.source_id === sourceId);
  const savedRecord = {
    source_id: sourceId,
    title: paper.title,
    authors: paper.authors || '',
    doi: paper.doi || '',
    year: paper.year || null,
    url: paper.url || '',
    summary: sourceText,
    eyra_summary: summary,
  };

  if (existing) return entities.SavedPaper.update(existing.id, { eyra_summary: summary });
  return entities.SavedPaper.create(savedRecord);
}
