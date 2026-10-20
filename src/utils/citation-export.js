// Export retrieved scholarly metadata without inventing missing bibliographic fields.
const plain = value => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim();
const escapeBib = value => plain(value).replace(/\\/g, '\\textbackslash{}').replace(/[{}]/g, match => '\\' + match);
const escapeRis = value => plain(value).replace(/\s+-\s+/g, ' - ');
const authorList = value => Array.isArray(value) ? value.map(person => typeof person === 'string' ? person : (person?.name || person?.display_name || '')).filter(Boolean) : plain(value).split(/\s+(?:and|;)\s+/i).filter(Boolean);
const firstNonempty = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim()) || '';
const doiValue = paper => plain(firstNonempty(paper.doi, paper.DOI)).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
const labelFor = (paper, index) => {
  const surname = authorList(paper.authors)[0]?.split(/\s+/).pop()?.replace(/[^a-z0-9]/gi, '') || 'source';
  return (surname + (paper.year || 'nd') + String(index + 1)).toLowerCase();
};
export function toBibTeX(papers) {
  return papers.map((paper, index) => {
    const fields = [['title', paper.title], ['author', authorList(paper.authors).join(' and ')], ['year', paper.year],
      ['doi', doiValue(paper)], ['url', firstNonempty(paper.url, paper.id)]];
    return '@misc{' + labelFor(paper, index) + ',\n' +
      fields.filter(([, value]) => value).map(([key, value]) => '  ' + key + ' = {' + escapeBib(value) + '}').join(',\n') + '\n}';
  }).join('\n\n');
}
export function toRIS(papers) {
  return papers.map(paper => {
    const lines = ['TY  - GEN'];
    const add = (tag, value) => { if (value) lines.push(tag + '  - ' + escapeRis(value)); };
    add('TI', paper.title);
    for (const author of authorList(paper.authors)) add('AU', author);
    add('PY', paper.year);
    add('DO', doiValue(paper));
    add('UR', firstNonempty(paper.url, paper.id));
    lines.push('ER  - ');
    return lines.join('\r\n');
  }).join('\r\n\r\n');
}
