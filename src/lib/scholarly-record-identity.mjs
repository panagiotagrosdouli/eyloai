const textKey = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function scholarlyDoi(value) {
  let doi = String(value || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '');
  try { doi = decodeURIComponent(doi); } catch { /* Opaque malformed encodings are not repaired by guessing. */ }
  return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi.toLowerCase() : '';
}
const hasSummary = value => typeof value === 'string' && Boolean(value.trim());
function sourceRecord(paper) {
  const provider = String(paper.source_index || paper.source || '').slice(0, 100);
  if (!provider) return [];
  let record_url = '';
  try {
    const url = new URL(paper.url);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) record_url = url.href;
  } catch { /* A provider label alone is not a verified link. */ }
  return [{ provider, record_url }];
}

/** Preserve provider provenance without converting co-indexing into independent studies. */
export function mergeScholarlyRecords(records) {
  const unique = new Map();
  for (const paper of records) {
    const doi = scholarlyDoi(paper.doi) || scholarlyDoi(paper.url);
    const key = doi ? `doi:${doi}` : `title:${textKey(paper.title)}|year:${paper.year || ''}|authors:${textKey(paper.authors)}`;
    const provenance = sourceRecord(paper);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, { ...paper, _dedupeKey: key, identity_basis: doi ? 'doi' : 'title_author_year_metadata',
        indexed_by: provenance.map(source => source.provider), source_records: provenance,
        summary_source: hasSummary(paper.summary) ? (provenance[0]?.provider || '') : '' });
      continue;
    }
    for (const source of provenance) {
      if (!existing.source_records.some(item => item.provider === source.provider && item.record_url === source.record_url)) existing.source_records.push(source);
      if (!existing.indexed_by.includes(source.provider)) existing.indexed_by.push(source.provider);
    }
    const sameTitle = textKey(existing.title) === textKey(paper.title);
    if (!sameTitle) existing.metadata_conflict = true;
    // Only fill a missing abstract for matching DOI AND title. Never splice
    // abstracts, overwrite conflicting text, or enrich a title-only identity.
    if (doi && sameTitle && !hasSummary(existing.summary) && hasSummary(paper.summary)) {
      existing.summary = paper.summary;
      existing.summary_source = provenance[0]?.provider || '';
    }
  }
  return [...unique.values()];
}
