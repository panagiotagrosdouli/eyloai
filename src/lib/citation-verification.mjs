export function normalizeDoi(value) {
  let doi = String(value || '').trim();
  doi = doi.replace(/^doi:\s*/i, '');
  doi = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  try {
    doi = decodeURIComponent(doi);
  } catch {
    return '';
  }
  return /^10\.\d{4,9}\/[^\s<>]{1,200}$/i.test(doi) ? doi.toLowerCase() : '';
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function firstSurname(value) {
  const firstAuthor = String(value || '').split(',')[0] || '';
  const nameParts = normalizeText(firstAuthor).split(' ').filter(part => part.length > 1);
  return nameParts.at(-1) || '';
}

function crossrefYear(record) {
  const date = record?.published?.['date-parts']?.[0]
    || record?.['published-print']?.['date-parts']?.[0]
    || record?.['published-online']?.['date-parts']?.[0];
  const year = Number(date?.[0]);
  return Number.isInteger(year) && year >= 1000 && year <= 9999 ? year : null;
}

function field(label, status, savedValue, sourceValue, detail = '') {
  return { label, status, savedValue, sourceValue, detail };
}

export function compareCitationMetadata(saved, record) {
  const savedDoi = normalizeDoi(saved?.doi);
  const sourceDoi = normalizeDoi(record?.DOI);
  if (!savedDoi || !sourceDoi || savedDoi !== sourceDoi) {
    return {
      status: 'Unverified',
      note: 'Crossref did not return a record with the same DOI.',
      fields: [field('DOI', 'mismatch', saved?.doi || 'Not provided', record?.DOI || 'Not returned')],
    };
  }

  const fields = [field('DOI', 'match', saved?.doi, record.DOI)];
  const savedTitle = String(saved?.title || '').trim();
  const sourceTitle = String(record?.title?.[0] || '').trim();
  if (savedTitle && sourceTitle) {
    fields.push(field('Title', normalizeText(savedTitle) === normalizeText(sourceTitle) ? 'match' : 'mismatch', savedTitle, sourceTitle));
  } else {
    fields.push(field('Title', 'unavailable', savedTitle || 'Not saved', sourceTitle || 'Not returned'));
  }

  const savedYear = Number(saved?.year) || null;
  const sourceYear = crossrefYear(record);
  if (savedYear && sourceYear) {
    fields.push(field('Publication year', savedYear === sourceYear ? 'match' : 'mismatch', savedYear, sourceYear));
  } else {
    fields.push(field('Publication year', 'unavailable', savedYear || 'Not saved', sourceYear || 'Not returned'));
  }

  const savedSurname = firstSurname(saved?.authors);
  const sourceSurname = normalizeText(record?.author?.[0]?.family || '').split(' ').filter(Boolean).at(-1) || '';
  if (savedSurname && sourceSurname) {
    fields.push(field('First author surname', savedSurname === sourceSurname ? 'match' : 'mismatch', savedSurname, sourceSurname));
  } else {
    fields.push(field('First author surname', 'unavailable', savedSurname || 'Not saved', sourceSurname || 'Not returned'));
  }

  const hasMismatch = fields.some(item => item.status === 'mismatch');
  const hasUnavailable = fields.some(item => item.status === 'unavailable');
  return {
    status: hasMismatch || hasUnavailable ? 'Partially verified' : 'Verified',
    note: 'Crossref metadata comparison only; a valid DOI or matching record does not establish scientific correctness or rule out retraction.',
    fields,
    source: 'Crossref',
    sourceUrl: 'https://api.crossref.org/works/' + encodeURIComponent(sourceDoi),
    journal: record?.['container-title']?.[0] || '',
  };
}

export async function verifyCitation(saved, fetchImpl = fetch) {
  const doi = normalizeDoi(saved?.doi);
  if (!doi) return { status: 'Unverified', note: 'A valid DOI is not available in this saved record.', fields: [] };

  const params = new URLSearchParams({ provider: 'crossref', doi });
  const response = await fetchImpl('/api/discovery?' + params.toString(), {
    headers: { accept: 'application/json' },
  });
  if (response.status === 404) {
    return { status: 'Unverified', note: 'Crossref did not return a record for this DOI.', fields: [] };
  }
  if (!response.ok) throw new Error(response.status === 429
    ? 'Crossref rate limited the check. Please retry later.'
    : 'Crossref verification failed (' + response.status + ').');

  const data = await response.json();
  if (!data?.message || typeof data.message !== 'object') {
    throw new Error('Crossref returned an unreadable metadata response.');
  }
  return compareCitationMetadata(saved, data.message);
}
