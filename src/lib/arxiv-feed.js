function decodeXmlText(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
      const normalized = entity.toLowerCase();
      if (normalized === 'amp') return '&';
      if (normalized === 'lt') return '<';
      if (normalized === 'gt') return '>';
      if (normalized === 'quot') return '"';
      if (normalized === 'apos') return "'";
      const codePoint = normalized.startsWith('#x')
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      try {
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      } catch {
        return match;
      }
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function elementText(xml, name) {
  const tag = `(?:[\\w.-]+:)?${name}`;
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return match ? decodeXmlText(match[1]) : '';
}

function parseWithDomParser(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('arXiv returned invalid XML');
  return Array.from(document.getElementsByTagName('entry')).map(entry => ({
    id: entry.querySelector('id')?.textContent?.trim() || '',
    title: entry.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    authors: Array.from(entry.querySelectorAll('author name'))
      .map(author => author.textContent?.trim())
      .filter(Boolean),
    summary: entry.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    published: entry.querySelector('published')?.textContent?.trim() || '',
  }));
}

export function parseArxivFeed(xml) {
  if (typeof DOMParser !== 'undefined') return parseWithDomParser(xml);
  return Array.from(String(xml).matchAll(/<(?:[\w.-]+:)?entry(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?entry\s*>/gi))
    .map(([, entry]) => ({
      id: elementText(entry, 'id'),
      title: elementText(entry, 'title'),
      authors: Array.from(entry.matchAll(/<(?:[\w.-]+:)?author(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?author\s*>/gi))
        .map(([, author]) => elementText(author, 'name'))
        .filter(Boolean),
      summary: elementText(entry, 'summary'),
      published: elementText(entry, 'published'),
    }));
}
