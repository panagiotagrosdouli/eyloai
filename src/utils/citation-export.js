// Export available scholarly metadata without inventing missing fields.
const plain = value => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim();

// Escape one character at a time: a blanket second-pass brace escape would
// corrupt macros introduced for literal backslashes, tildes and carets.
const bibTeXSpecial = Object.freeze({
  '\\': '\\textbackslash{}',
  '{': '\\{', '}': '\\}',
  '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_',
  '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
});
export const escapeBibTeXText = value =>
  Array.from(plain(value), character => bibTeXSpecial[character] ?? character).join('');

const escapeRis = value => plain(value).replace(/\s+-\s+/g, ' - ');
const authorList = value => Array.isArray(value)
  ? value.map(person => typeof person === 'string' ? person : (person?.name || person?.display_name || '')).map(plain).filter(Boolean)
  : plain(value).split(/\s+(?:and|;)\s+/i).filter(Boolean);
const firstNonempty = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim()) || '';
const doiValue = paper => {
  const doi = plain(firstNonempty(paper.doi, paper.DOI)).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi : '';
};

const privateHostname = hostname => {
  const name = hostname.toLowerCase().replace(/\.$/, '');
  if (['localhost', '0.0.0.0', '::1'].includes(name)) return true;
  if (name.endsWith('.localhost') || name.endsWith('.local') || name.endsWith('.internal') || name.endsWith('.lan')) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  if (match) {
    const octets = match.slice(1).map(Number);
    if (octets.some(value => value > 255)) return true;
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }
  return name.startsWith('[') && (name.includes('::1') || name.includes('fc') || name.includes('fd') || name.includes('fe80'));
};

// Do not export signed URLs, tokens, internal app routes, or tenant-local
// storage assets as if they were public bibliographic provenance.
export function publicBibliographyUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || !url.hostname || privateHostname(url.hostname)) return '';
    if (url.hostname.toLowerCase() === 'eyloai.vercel.app'
      || /^kbzjngpzxpniaumlupaa\.supabase\.co$/i.test(url.hostname)
      || /\.supabase\.co$/i.test(url.hostname) && url.pathname.startsWith('/storage/')) return '';
    if (/^\/(?:api|workspace|login|projects|library)(?:\/|$)/i.test(url.pathname)) return '';
    let sensitiveQuery = false;
    url.searchParams.forEach((_, key) => {
      if (/^(token|access_token|refresh_token|jwt|signature|sig|api_key|key|x-amz-signature|x-amz-credential|se)$/i.test(key)) sensitiveQuery = true;
    });
    if (sensitiveQuery) return '';
    if (url.hash) url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}
const labelFor = (paper, index) => {
  const surname = authorList(paper.authors)[0]?.split(/\s+/).pop()?.replace(/[^a-z0-9]/gi, '') || 'source';
  return (surname + (paper.year || 'nd') + String(index + 1)).toLowerCase();
};
const yearValue = value => {
  const year = plain(value);
  return /^\d{4}$/.test(year) ? year : '';
};

export function toBibTeX(papers) {
  return papers.map((paper, index) => {
    const fields = [['title', paper.title], ['author', authorList(paper.authors).join(' and ')],
      ['year', yearValue(paper.year)], ['doi', doiValue(paper)], ['url', publicBibliographyUrl(paper.url)]];
    return '@misc{' + labelFor(paper, index) + ',\n'
      + fields.filter(([, value]) => value).map(([key, value]) =>
        '  ' + key + ' = {' + (key === 'url' || key === 'doi' ? plain(value) : escapeBibTeXText(value)) + '}').join(',\n') + '\n}';
  }).join('\n\n');
}
export function toRIS(papers) {
  return papers.map(paper => {
    const lines = ['TY  - GEN'];
    const add = (tag, value) => { if (value) lines.push(tag + '  - ' + escapeRis(value)); };
    add('TI', paper.title);
    for (const author of authorList(paper.authors)) add('AU', author);
    add('PY', yearValue(paper.year));
    add('DO', doiValue(paper));
    add('UR', publicBibliographyUrl(paper.url));
    lines.push('ER  - ');
    return lines.join('\r\n');
  }).join('\r\n\r\n');
}
