/**
 * Metadata is calculated from retrieved scholarly records, never from the
 * language model's own estimates. This does not validate semantic findings,
 * study methods, bibliographic accuracy, or abstract-level entailment.
 */
function normalizeWords(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function verifiedResearchKeywords(proposed, papers = [], limit = 8) {
  if (!Array.isArray(proposed) || !Array.isArray(papers)) return [];
  const text = papers.map(paper => (
    ' ' + normalizeWords(`${paper?.title || ''} ${paper?.summary || ''}`) + ' '
  ));
  const verified = [];
  const seen = new Set();
  for (const candidate of proposed) {
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeWords(candidate);
    if (normalized.length < 2 || normalized.length > 100 || seen.has(normalized)) continue;
    if (!text.some(doc => doc.includes(' ' + normalized + ' '))) continue;
    seen.add(normalized);
    verified.push(candidate.trim());
    if (verified.length >= limit) break;
  }
  return verified;
}

export function groundedDiscoveryMetadata(papers = [], researchers = [], proposedKeywords = [], currentYear = new Date().getUTCFullYear()) {
  const records = Array.isArray(papers) ? papers : [];
  const people = Array.isArray(researchers) ? researchers : [];
  const years = records.map(paper => {
    const sourceYear = paper?.year ?? paper?.publication_year;
    if (typeof sourceYear !== 'number' && !/^\d{4}$/.test(String(sourceYear || ''))) return null;
    const year = Number(sourceYear);
    return Number.isInteger(year) && year >= 1700 && year <= currentYear + 1 ? year : null;
  }).filter(year => year !== null);
  const earliest = years.length ? Math.min(...years) : null;
  const latest = years.length ? Math.max(...years) : null;
  const cited = people.filter(person => typeof person?.name === 'string' && person.name.trim()
    && typeof person.citation_count === 'number'
    && Number.isFinite(person.citation_count) && person.citation_count >= 0);
  const mostCited = cited.reduce((best, next) => (
    !best || next.citation_count > best.citation_count ? next : best
  ), null);

  return {
    data_summary: {
      total_papers: records.length,
      total_researchers: people.length,
      date_range: earliest === null ? 'Not available' : (
        earliest === latest ? String(earliest) : `${earliest}–${latest}`
      ),
      top_researcher: mostCited?.name.trim() || '',
    },
    keywords: verifiedResearchKeywords(proposedKeywords, records),
    confidence_overall: records.length >= 8 ? 'HIGH' : records.length >= 3 ? 'MEDIUM' : 'LOW',
  };
}
