import { applyCors } from '../src/lib/api-cors.mjs';
const SOURCE = 'https://euraxess.ec.europa.eu/jobs/search';
const MAX_QUERY_LENGTH = 180;
const MAX_RESULTS = 12;
const MAX_PAGE = 99;
const TIMEOUT_MS = 10000;

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

function extractJobs(html) {
  const records = [];
  const openers = /<div\b(?=[^>]*\bclass=["'][^"']*\bjob-teaser-content\b)[^>]*>/gi;
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
    const deadlineMatch = raw.match(/Application Deadline:\s*([^|]{3,80}?)(?=\s*(?:Posted on:|Research Field:|Researcher Profile:|$))/i);
    let description = raw;
    for (const remove of [title, plainText(organizationLink?.[2] || ''), countryMatch?.[0] || '', deadlineMatch?.[0] || '']) {
      if (remove) description = description.replace(remove, ' ');
    }
    description = description.replace(/\bJOB\b/g, ' ').replace(/\s+/g, ' ').trim();
    const sourceUrl = new URL(jobLink[1], SOURCE).toString();
    records.push({
      id: sourceUrl,
      title,
      organization: plainText(organizationLink?.[2] || ''),
      country: countryMatch?.[1]?.trim() || '',
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

  try {
    const params = new URLSearchParams();
    params.set('f[0]', 'keywords:' + query);
    params.set('page', String(page));
    const upstream = await fetch(SOURCE + '?' + params.toString(), {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'EYLO research careers search',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) {
      return response.status(502).json({ error: 'EURAXESS is temporarily unavailable. Try again shortly.' });
    }
    const html = await upstream.text();
    if (html.length > 5_000_000) return response.status(502).json({ error: 'EURAXESS returned an unexpectedly large search page.' });
    const items = extractJobs(html);
    response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
    return response.status(200).json({
      query,
      source: 'EURAXESS',
      retrieved_at: new Date().toISOString(),
      source_url: SOURCE + '?' + params.toString(),
      items,
      page,
      has_more: items.length >= MAX_RESULTS,
    });
  } catch (error) {
    console.error('EURAXESS careers search failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return response.status(502).json({ error: 'Could not retrieve research roles from EURAXESS right now.' });
  }
}
