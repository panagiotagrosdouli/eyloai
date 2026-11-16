/** Recover retained screening sources beyond the recent Library window.
 * getPaper must be the authenticated repository's owner-checking get(id, ownerId).
 * An absent source stays explicit; transport/authorization errors never become absence.
 */
export async function loadReviewScreeningPapers({ recentPapers, protocol, ownerId, getPaper }) {
  if (!ownerId) throw new Error('A signed-in owner is required to load review sources.');
  const records = Array.isArray(protocol?.screening) ? protocol.screening : [];
  if (records.length > 100) throw new Error('The saved protocol exceeds the 100-source screening limit.');
  const ids = new Set();
  for (const record of records) {
    const id = record?.paper_id;
    if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 150) {
      throw new Error('The saved protocol contains an invalid source identifier.');
    }
    ids.add(id);
  }
  const indexed = new Map(recentPapers.map(paper => [String(paper.id), paper]));
  const missing = [...ids].filter(id => !indexed.has(id));
  const unavailableIds = [];
  // Bound concurrent authenticated reads rather than issuing 100 at once.
  for (let start = 0; start < missing.length; start += 5) {
    const results = await Promise.all(missing.slice(start, start + 5).map(async id => {
      try {
        const paper = await getPaper(id, ownerId);
        if (!paper) return { id, paper: null };
        if (String(paper.id) !== id) throw new Error('A retained source identifier could not be verified.');
        return { id, paper };
      } catch (error) {
        if (error?.code === 'PGRST116') return { id, paper: null };
        throw error;
      }
    }));
    for (const { id, paper } of results) {
      if (paper) indexed.set(id, paper);
      else unavailableIds.push(id);
    }
  }
  return { papers: [...indexed.values()], unavailableIds };
}
