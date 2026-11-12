import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel SPA fallback excludes every /api path while retaining client routes', () => {
  const supabaseRewrite = config.rewrites.find(rule => rule.source === '/supabase/:path*');
  const spaFallback = config.rewrites.find(rule => rule.destination === '/index.html');
  assert.ok(supabaseRewrite, 'Supabase proxy rewrite remains configured');
  assert.ok(spaFallback, 'SPA fallback remains configured');
  assert.ok(config.rewrites.indexOf(supabaseRewrite) < config.rewrites.indexOf(spaFallback));
  assert.match(spaFallback.source, /\(\?!api\(\?:\/\|\$\)\)/);

  const fallbackPattern = new RegExp(`^${spaFallback.source}$`);
  for (const apiPath of ['/api', '/api/', '/api/deployment-status', '/api/unknown/deep/path']) {
    assert.equal(fallbackPattern.test(apiPath), false, `${apiPath} must not receive index.html`);
  }
  for (const pagePath of ['/', '/discover', '/projects/example', '/apiary']) {
    assert.equal(fallbackPattern.test(pagePath), true, `${pagePath} should retain SPA routing`);
  }
});

test('deployment smoke checks the JSON identity function as well as the static manifest', () => {
  const smoke = readFileSync(new URL('../scripts/smoke-public.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /\/api\/deployment-status/);
  assert.match(smoke, /application\/json/);
  assert.match(smoke, /verifySha\(data\.git_commit/);
  assert.match(smoke, /verifySha\(data\.deployment_sha/);
  assert.match(smoke, /data\.provenance_verified !== true/);
});
