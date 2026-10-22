const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function normalizeDoi(value) {
  let doi = cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '');

  try {
    doi = decodeURIComponent(doi);
  } catch {
    // Preserve provider text when percent-encoding is malformed.
  }

  return DOI_PATTERN.test(doi) ? doi : '';
}

export function normalizeScholarlyTitle(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeYear(value) {
  const year = Number(value);
  const maxYear = new Date().getFullYear() + 2;
  return Number.isInteger(year) && year >= 1500 && year <= maxYear ? year : null;
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : text;
}

function sourceLabel(record) {
  return cleanText(record?.source_index || record?.provider || record?.source || 'Unknown source');
}

function normalizeArxivId(record) {
  const direct = cleanText(record?.arxiv_id);
  const fromId = cleanText(record?.id).match(/arxiv\.org\/(?:abs|pdf)\/([^?#]+)/i)?.[1] || '';
  const candidate = direct || fromId;
  return candidate.replace(/\.pdf$/i, '').replace(/v\d+$/i, '').toLowerCase();
}

function normalizeType(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return 'unknown';
  if (/retract/.test(text)) return 'retraction';
  if (/correct|errat/.test(text)) return 'correction';
  if (/preprint|posted-content|working paper/.test(text)) return 'preprint';
  if (/systematic review/.test(text)) return 'systematic-review';
  if (/meta.?analysis/.test(text)) return 'meta-analysis';
  if (/review/.test(text)) return 'review';
  if (/conference|proceeding/.test(text)) return 'conference-paper';
  if (/dataset/.test(text)) return 'dataset';
  if (/book.?chapter/.test(text)) return 'book-chapter';
  if (/journal|article/.test(text)) return 'journal-article';
  return text.replace(/\s+/g, '-');
}

function inferPublicationStatus(record, type) {
  const explicit = cleanText(record?.publication_status).toLowerCase();
  if (explicit) return explicit;
  if (record?.is_retracted || type === 'retraction') return 'retracted';
  if (type === 'correction') return 'correction';
  const source = sourceLabel(record).toLowerCase();
  const url = cleanText(record?.url).toLowerCase();
  if (type === 'preprint' || source === 'arxiv' || url.includes('arxiv.org/')) return 'preprint';
  if (['journal-article', 'conference-paper', 'review', 'systematic-review', 'meta-analysis', 'book-chapter'].includes(type)) {
    return 'published';
  }
  return 'unknown';
}

function firstAuthorKey(authors) {
  const first = cleanText(authors).split(/,|;|\band\b/i)[0] || '';
  const tokens = normalizeScholarlyTitle(first).split(' ').filter(Boolean);
  return tokens[tokens.length - 1] || '';
}

function metadataCompleteness(record) {
  return [
    record.doi,
    record.title && record.title !== 'Untitled',
    record.authors,
    record.year,
    record.publication_date,
    record.source,
    record.url,
    record.summary,
    record.type && record.type !== 'unknown',
  ].filter(Boolean).length;
}

function canonicalRecord(record) {
  const doi = normalizeDoi(record?.doi || record?.url);
  const year = normalizeYear(record?.year);
  const publicationDate = normalizeDate(record?.publication_date);
  const type = normalizeType(record?.type || record?.publication_type);
  const publicationStatus = inferPublicationStatus(record, type);
  const title = cleanText(record?.title);
  const source = sourceLabel(record);
  const arxivId = normalizeArxivId(record);

  let dedupeKey = '';
  if (doi) {
    dedupeKey = `doi:${doi}`;
  } else if (arxivId) {
    dedupeKey = `arxiv:${arxivId}`;
  } else {
    const normalizedTitle = normalizeScholarlyTitle(title);
    const authorKey = firstAuthorKey(record?.authors);
    const fallbackYear = year || 'unknown';
    dedupeKey = normalizedTitle
      ? `title:${normalizedTitle}::${authorKey || fallbackYear}`
      : `id:${cleanText(record?.id) || source || 'unknown-record'}`;
  }

  return {
    ...record,
    title,
    doi,
    year,
    publication_date: publicationDate,
    type,
    publication_status: publicationStatus,
    arxiv_id: arxivId || record?.arxiv_id || '',
    _dedupeKey: dedupeKey,
    _metadataCompleteness: metadataCompleteness({
      ...record,
      doi,
      title,
      year,
      publication_date: publicationDate,
      type,
    }),
    _providerLabel: source,
  };
}

function preferredRecord(records) {
  return [...records].sort((a, b) => {
    const completeness = b._metadataCompleteness - a._metadataCompleteness;
    if (completeness) return completeness;
    const publishedPreference = Number(b.publication_status === 'published') - Number(a.publication_status === 'published');
    if (publishedPreference) return publishedPreference;
    return a._providerLabel.localeCompare(b._providerLabel);
  })[0];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function mergeGroup(records) {
  const base = preferredRecord(records);
  const dois = unique(records.map(record => record.doi));
  const conceptDoi = dois.find(doi => !/\.v\d+$/i.test(doi) && dois.some(candidate => candidate.startsWith(`${doi}.v`)));
  const doi = conceptDoi || dois[0] || '';
  const versionDois = conceptDoi ? dois.filter(candidate => candidate !== conceptDoi) : [];
  const yearCandidates = unique(records.map(record => record.year)).sort((a, b) => Number(a) - Number(b));
  const dateCandidates = unique(records.map(record => record.publication_date)).sort();
  const sources = unique(records.map(record => record._providerLabel)).sort();
  const statuses = unique(records.map(record => record.publication_status));

  let publicationStatus = base.publication_status;
  if (statuses.includes('retracted')) publicationStatus = 'retracted';
  else if (statuses.includes('correction')) publicationStatus = 'correction';
  else if (statuses.includes('published') && statuses.includes('preprint')) publicationStatus = 'published_with_preprint';

  const yearConflict = yearCandidates.length > 1;
  const dateConflict = dateCandidates.length > 1;
  const bestSummary = [...records].sort((a, b) => cleanText(b.summary).length - cleanText(a.summary).length)[0]?.summary || base.summary || '';
  const bestAuthors = [...records].sort((a, b) => cleanText(b.authors).length - cleanText(a.authors).length)[0]?.authors || base.authors || '';

  const metadataNote = yearConflict
    ? 'Publication year differs across sources; provenance is retained for review.'
    : sources.length > 1
      ? `Metadata matched across ${sources.length} scholarly indexes.`
      : doi
        ? `DOI supplied by ${sources[0] || 'the scholarly source'}.`
        : `Metadata from ${sources[0] || 'the scholarly source'}; DOI unavailable.`;

  return {
    ...base,
    doi,
    version_dois: versionDois,
    url: doi ? `https://doi.org/${doi}` : base.url,
    authors: bestAuthors,
    summary: bestSummary,
    year: yearConflict ? (base.year || null) : (yearCandidates[0] || base.year || null),
    publication_date: dateConflict ? (base.publication_date || '') : (dateCandidates[0] || base.publication_date || ''),
    publication_status: publicationStatus,
    is_retracted: records.some(record => Boolean(record.is_retracted) || record.publication_status === 'retracted'),
    is_correction: records.some(record => Boolean(record.is_correction) || record.publication_status === 'correction'),
    year_conflict: yearConflict,
    publication_date_conflict: dateConflict,
    year_candidates: yearCandidates,
    publication_date_candidates: dateCandidates,
    record_sources: sources,
    metadata_note: metadataNote,
    doi_status: doi ? (sources.length > 1 ? 'cross_source_match' : 'source_supplied') : 'missing',
    metadata_provenance: records.map(record => ({
      source: record._providerLabel,
      id: cleanText(record.id),
      doi: record.doi,
      year: record.year,
      publication_date: record.publication_date,
      type: record.type,
      publication_status: record.publication_status,
    })),
  };
}

export function reconcileScholarlyRecords(input) {
  const groups = new Map();
  const records = (input || []).filter(Boolean).map(canonicalRecord);
  const doiRecords = new Map(records.filter(record => record.doi).map(record => [record.doi, record]));

  records.forEach(record => {
    let groupKey = record._dedupeKey;
    const versionMatch = record.doi.match(/^(10\.\d{4,9}\/.+)\.v\d+$/i);

    if (versionMatch) {
      const conceptRecord = doiRecords.get(versionMatch[1]);
      const sameTitle = conceptRecord
        && normalizeScholarlyTitle(conceptRecord.title) === normalizeScholarlyTitle(record.title);
      if (sameTitle) groupKey = `doi:${versionMatch[1]}`;
    }

    const current = groups.get(groupKey) || [];
    current.push(record);
    groups.set(groupKey, current);
  });

  return [...groups.values()].map(mergeGroup);
}
