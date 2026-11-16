import { isSafeEyraSourceUrl } from './eyra-citation-ids.mjs';

const CITATION_ID = /^(?:P|R|I|F)\d+$/;

/**
 * A citation chip means the answer references a retrieved record. It does NOT
 * prove that the linked source supports the surrounding claim or that EYRA
 * inspected full text. Preserve this distinction in UI and saved history.
 *
 * @param {unknown} sources
 * @returns {{items: Array<{id:string,title:string,url:string,kind:string,scope:string,meta:string}>, hiddenCount:number, summary:string}}
 */
export function describeEyraCitedEvidence(sources) {
  const records = Array.isArray(sources) ? sources.slice(0, 80) : [];
  const seen = new Set();
  const items = [];
  let hiddenCount = 0;
  for (const source of records) {
    const id = typeof source?.id === 'string' ? source.id : '';
    const url = typeof source?.url === 'string' ? source.url : '';
    if (!CITATION_ID.test(id) || !isSafeEyraSourceUrl(url) || seen.has(id)) {
      hiddenCount++;
      continue;
    }
    seen.add(id);
    const kind = id[0] === 'P' ? 'Publication' : id[0] === 'F' ? 'Funding record' : id[0] === 'R' ? 'Researcher profile' : 'Institution record';
    const scope = id[0] === 'P'
      ? 'Bibliographic/abstract record only; full text and claim support not independently verified'
      : id[0] === 'F'
        ? 'Retrieved opportunity record; current eligibility and deadline require official confirmation'
        : 'Retrieved profile metadata; identity, affiliation and current status require confirmation';
    items.push({
      id,
      title: String(source.title || kind).replace(/\s+/g, ' ').trim().slice(0, 300),
      url,
      meta: String(source.meta || '').slice(0, 600),
      kind,
      scope,
    });
  }
  if (Array.isArray(sources) && sources.length > records.length) hiddenCount += sources.length - records.length;
  const summary = !items.length
    ? 'No linked retrieved records. Check claims against independent sources.'
    : `${items.length} linked retrieved ${items.length === 1 ? 'record' : 'records'}. Links and citation IDs are checked; scientific claims, full texts, eligibility and metadata accuracy are not independently verified.`;
  return { items, hiddenCount, summary };
}
