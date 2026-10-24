#!/usr/bin/env node
// Lightweight public smoke checks. This is not a substitute for authenticated QA.
const raw = process.argv[2] || process.env.EYLO_SMOKE_URL;
if (!raw) {
  console.error('Usage: node scripts/smoke-public.mjs https://your-reviewed-preview.example');
  process.exit(2);
}
let base;
try {
  base = new URL(raw);
  const isLocal = ['localhost', '127.0.0.1'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash ||
      (base.protocol !== 'https:' && !(isLocal && base.protocol === 'http:'))) {
    throw new Error('Use an HTTPS origin (HTTP allowed for localhost only), without credentials or query parameters');
  }
  base = new URL(base.origin);
} catch (err) {
  console.error('Invalid smoke target:', err.message);
  process.exit(2);
}

const checks = [
  { path: '/', type: 'html', label: 'Landing HTML' },
  { path: '/release.json', type: 'json', label: 'Release manifest' },
  { path: '/robots.txt', type: 'text', label: 'Robots policy' },
];

let failed = false;
for (const check of checks) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const url = new URL(check.path, base);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { Accept: check.type === 'json' ? 'application/json' : '*/*' },
    });
    if (response.status !== 200) throw new Error(`HTTP ${response.status} (expected 200)`);
    const body = await response.text();
    if (!body.trim()) throw new Error('Empty response');
    if (check.type === 'html' && (!/<html[\s>]/i.test(body) || !/<div[^>]+id=["']root["']/i.test(body))) {
      throw new Error('Not the expected React application HTML');
    }
    if (check.type === 'json') {
      const data = JSON.parse(body);
      if (typeof data.release !== 'string' || !data.release.trim()) {
        throw new Error('Missing release identifier');
      }
      console.log(`  release: ${data.release}`);
    }
    console.log(`PASS ${check.label}: ${url.pathname}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${check.label}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}
console.log('NOTE: These checks do NOT test auth, RLS, AI accuracy, billing or live data integrity.');
process.exitCode = failed ? 1 : 0;
