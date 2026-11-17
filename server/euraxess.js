import { applyCors } from '../src/lib/api-cors.mjs';
const SOURCE = 'https://euraxess.ec.europa.eu/jobs/search';
// EURAXESS country portals are official mirrors, not third-party job aggregators.
// Use only a fixed allowlist, never a URL derived from the user's query.
const SEARCH_SOURCES = [SOURCE, 'https://www.euraxess.se/jobs/search'];
const MAX_QUERY_LENGTH = 180;
const MAX_RESULTS = 50;
const MAX_PAGE = 99;
const TIMEOUT_MS = 6000;

function decodeEntities(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function plainText(value = '') {
  return decodeEntities(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')).trim();
}

function matchingDivEnd(html, start) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tags.exec(html))) {
    if (/^<\/div/i.test(match[0])) depth -= 1;
    else if (!/\/>$/.test(match[0])) depth += 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
}

function extractJobs(html, sourcePage = SOURCE) {
  const records = [];
  // EURAXESS changed this wrapper from a class to an id. Accept both forms so
  // a markup-only upstream change does not turn a successful search into an
  // empty result set.
  const openers = /<div\b(?=[^>]*(?:\bid=["'][^"']*\bjob-teaser-content\b|\bclass=["'][^"']*\bjob-teaser-content\b))[^>]*>/gi;
  let opener;
  while ((opener = openers.exec(html)) && records.length < MAX_RESULTS) {
    const end = matchingDivEnd(html, opener.index);
    if (end < 0) continue;
    const block = html.slice(opener.index, end);
    openers.lastIndex = end;
    const links = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const jobLink = links.find(item => /\/jobs\/\d+/.test(item[1]));
    if (!jobLink) continue;
    const organizationLink = links.find(item => /\/partnering\/organisations\/profile\//.test(item[1]));
    const title = plainText(jobLink[2]);
    if (!title) continue;
    const raw = plainText(block);
    const countryMatch = raw.match(/\bJOB\s+([A-Z][A-Z -]{1,35})\b/);
    const labels = [...block.matchAll(/<li\b[^>]*class=["'][^"']*\becl-content-block__label-item\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi)]
      .map(match => plainText(match[1]));
    const country = labels.find(label => label && !/^JOB$/i.test(label)) || countryMatch?.[1]?.trim() || '';
    const deadlineMatch = raw.match(/Application Deadline:\s*([^|]{3,80}?)(?=\s*(?:Posted on:|Research Field:|Researcher Profile:|$))/i);
    const descriptionMatch = block.match(/<div\b(?=[^>]*class=["'][^"']*\becl-content-block__description\b)[^>]*>([\s\S]*?)<\/div>/i);
    let description = descriptionMatch ? plainText(descriptionMatch[1]) : raw;
    for (const remove of [title, plainText(organizationLink?.[2] || ''), countryMatch?.[0] || '', ...labels, deadlineMatch?.[0] || '']) {
      if (remove) description = description.replace(remove, ' ');
    }
    description = description.replace(/\bJOB\b/g, ' ').replace(/\s+/g, ' ').trim();
    const posting = new URL(jobLink[1], sourcePage);
    if (posting.protocol !== 'https:'
        || !new Set(['euraxess.ec.europa.eu', 'www.euraxess.se']).has(posting.hostname)
        || !/^\/jobs\/\d+\/?$/.test(posting.pathname)
        || posting.username || posting.password) continue;
    // The same official job ID may be served on national mirrors.
    const sourceUrl = new URL(posting.pathname, SOURCE).toString();
    if (records.some(record => record.source_url === sourceUrl)) continue;
    records.push({
      id: sourceUrl,
      title,
      organization: plainText(organizationLink?.[2] || ''),
      country,
      description: description.slice(0, 700),
      deadline: deadlineMatch?.[1]?.trim() || '',
      source: 'EURAXESS',
      source_url: sourceUrl,
    });
  }
  return records;
}

export default async function handler(request, response) {
  if (applyCors(request, response, ['GET'])) return;
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const query = String(request.query?.q || '').trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) return response.status(400).json({ error: 'Enter at least two characters to search research roles.' });
  const page = Number(request.query?.page || 0);
  if (!Number.isInteger(page) || page < 0 || page > MAX_PAGE) return response.status(400).json({ error: 'Invalid result page.' });

  const params = new URLSearchParams();
  params.set('f[0]', 'keywords:' + query);
  params.set('page', String(page));

  // Fail over only to the official EURAXESS country mirror. A 200 maintenance
  // or challenge page is never treated as an empty job search.
  for (const [index, source] of SEARCH_SOURCES.entries()) {
    try {
      const upstream = await fetch(source + '?' + params.toString(), {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'EYLO research careers search',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!upstream.ok) {
        // Log only fixed source index and HTTP status, never query or response HTML.
        console.warn('EURAXESS upstream HTTP failure', {
          source_index: index, status: upstream.status,
        });
        continue;
      }
      const html = await upstream.text();
      if (html.length > 5_000_000) {
        console.warn('EURAXESS upstream size failure', { source_index: index });
        continue;
      }
      const items = extractJobs(html, source);
      const explicitEmpty = /class=["'][^"']*\bview-empty\b[^"']*["'][^>]*>[\s\S]{0,2000}?(?:no results|no jobs|no result|no content|no matching|your search yielded no)/i.test(html);
      if (!items.length && !explicitEmpty) {
        console.warn('EURAXESS upstream markup unrecognized', { source_index: index });
        continue;
      }

      response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
      return response.status(200).json({
        query,
        source: 'EURAXESS',
        retrieved_at: new Date().toISOString(),
        source_url: source + '?' + params.toString(),
        ...(index > 0 ? { source_mirror: true } : {}),
        items,
        page,
        has_more: /rel=["']next["']|class=["'][^"']*\bpager__item--next\b/i.test(html),
      });
    } catch (error) {
      // Never log the full requested URL: search terms can be private.
      console.warn('EURAXESS request failed', {
        source_index: index,
        reason: error?.name === 'TimeoutError' ? 'timeout' : 'upstream_error',
      });
    }
  }

  response.setHeader('Cache-Control', 'no-store');
  return response.status(502).json({
    error: 'EURAXESS research listings are temporarily unavailable. Open the original source or retry.',
    code: 'EURAXESS_UPSTREAM_UNAVAILABLE',
    source_url: SOURCE,
  });
}
