import { normalizeDoi } from './citation-verification.mjs';
// A successful HTTP status is not proof of a valid scholarly record set.
// Do not cache upstream error envelopes, truncated JSON, or login/challenge
// responses as if they were genuine papers, authors or institutions.
const OPENALEX = new Set(['openalex_works', 'openalex_authors', 'openalex_institutions']);

function validAtomFeed(content) {
  const xml = content.trim().replace(/^\uFEFF/, '');
  // arXiv serves Atom, not HTML; accept a standard XML declaration and
  // optional namespace prefix, but require an actual closing feed element.
  const start = /^(?:<\?xml\s[^>]*\?>\s*)?<(?:[A-Za-z][\w.-]*:)?feed(?=[\s>])[^>]*>/i.exec(xml);
  if (!start) return false;
  const prefix = /<([A-Za-z][\w.-]*):feed\b/i.exec(start[0])?.[1];
  const closing = prefix
    ? new RegExp('</' + prefix + ':feed\\s*>\\s*$', 'i')
    : /<\/feed\s*>\s*$/i;
  return closing.test(xml);
}

export function validScholarlyProviderPayload(provider, bytes, { exactDoi = '' } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return false;
  const raw = bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (provider === 'arxiv') return validAtomFeed(raw);
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return false; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;

  if (OPENALEX.has(provider)) return Array.isArray(parsed.results);
  if (provider === 'europe_pmc') return Array.isArray(parsed.resultList?.result);
  if (provider === 'semantic_scholar') return Array.isArray(parsed.data);
  if (provider === 'crossref') {
    const message = parsed.message;
    if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
    if (exactDoi) return normalizeDoi(message.DOI) === exactDoi;
    return Array.isArray(message.items);
  }
  return false;
}
