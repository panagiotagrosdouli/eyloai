import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const API_URL = 'https://remotive.com/api/remote-jobs?limit=500';
const SOURCE_URL = 'https://remotive.com/remote-jobs/api';
const REQUEST_TIMEOUT_MS = 12000;

function plainText(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, number) => {
      const codePoint = Number(number);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => {
      const codePoint = parseInt(number, 16);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : ' ';
    })
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safePostingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)remotive\.com$/i.test(url.hostname)
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

export function normalizeRemotivePayload(payload, retrievedAt = new Date().toISOString()) {
  if (!Array.isArray(payload?.jobs)) {
    throw new Error('Remotive returned an invalid jobs payload.');
  }

  const items = payload.jobs.map((job) => {
    const sourceUrl = safePostingUrl(job?.url);
    const title = plainText(job?.title || '');
    const id = String(job?.id || '').trim();
    if (!sourceUrl || !title || !id) return null;
    return {
      id: 'remotive-' + id,
      title: title.slice(0, 240),
      organization: plainText(job?.company_name || '').slice(0, 180),
      country: plainText(job?.candidate_required_location || 'Remote').slice(0, 180),
      description: plainText(job?.description || '').slice(0, 1200),
      salary: plainText(job?.salary || '').slice(0, 120),
      category: plainText(job?.category || '').slice(0, 100),
      job_type: plainText(job?.job_type || '').slice(0, 60),
      published_at: String(job?.publication_date || '').slice(0, 40),
      deadline: '',
      source: 'Remotive',
      source_url: sourceUrl,
    };
  }).filter(Boolean);

  if (!items.length) {
    throw new Error('Remotive returned no usable listings; preserving the previous snapshot.');
  }

  return {
    source: 'Remotive',
    source_url: SOURCE_URL,
    retrieved_at: retrievedAt,
    provider_delay_hours: 24,
    items,
  };
}

export async function fetchRemotiveSnapshot({ fetchImpl = fetch, retrievedAt } = {}) {
  const response = await fetchImpl(API_URL, {
    headers: { accept: 'application/json', 'user-agent': 'EYLO free remote-career snapshot' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('Remotive returned ' + response.status);
  const payload = await response.json();
  return normalizeRemotivePayload(payload, retrievedAt || new Date().toISOString());
}

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('Provide the output path for the snapshot JSON.');
  const snapshot = await fetchRemotiveSnapshot();
  await writeFile(resolve(outputPath), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Could not refresh Remotive snapshot.');
    process.exitCode = 1;
  });
}
