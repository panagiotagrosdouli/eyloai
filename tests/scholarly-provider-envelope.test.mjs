import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/discovery.js';
import { scholarlyResilience } from '../server/scholarly-resilience.mjs';
import { validScholarlyProviderPayload } from '../src/lib/scholarly-provider-envelope.mjs';

beforeEach(() => scholarlyResilience.reset());

const bytes = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    json(value) { this.payload = value; return this; },
    send(value) { this.payload = value; return this; },
  };
}

test('legitimate empty scholarly indexes remain valid results, not false outages', () => {
  const records = [
    ['openalex_works', { results: [] }],
    ['openalex_authors', { results: [] }],
    ['openalex_institutions', { results: [] }],
    ['europe_pmc', { resultList: { result: [] } }],
    ['crossref', { message: { items: [] } }],
    ['semantic_scholar', { data: [] }],
  ];
  for (const [provider, value] of records) {
    assert.equal(validScholarlyProviderPayload(provider, bytes(value)), true, provider);
  }
  assert.equal(validScholarlyProviderPayload('arxiv', bytes('<?xml version="1.0"?><feed></feed>')), true);
  assert.equal(validScholarlyProviderPayload('arxiv',
    bytes('<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Paper</title></entry></feed>')), true);
});

test('successful transport cannot launder error envelopes, junk or malformed feed into research', () => {
  const providers = ['openalex_works', 'openalex_authors', 'openalex_institutions', 'europe_pmc', 'crossref', 'semantic_scholar'];
  for (const provider of providers) {
    for (const content of [
      '{"error":"private upstream failure"}',
      '{"results":{}}',
      '{',
      'null',
      '',
      '<html><body>challenge</body></html>',
    ]) {
      assert.equal(validScholarlyProviderPayload(provider, bytes(content)), false, provider + ' ' + content);
    }
  }
  for (const xml of ['<html>Login</html>', '<error>rate limit</error>', '<feed>broken',
    '<?xml version="1.0"?><feed><error>truncated</error>']) {
    assert.equal(validScholarlyProviderPayload('arxiv', bytes(xml)), false);
  }
});

test('Crossref DOI verification refuses an unrelated source record even with HTTP 200', () => {
  const wanted = '10.1234/example';
  assert.equal(validScholarlyProviderPayload('crossref', bytes({ message: { DOI: '10.1234/EXAMPLE' } }), { exactDoi: wanted }), true);
  assert.equal(validScholarlyProviderPayload('crossref', bytes({ message: { DOI: '10.5678/different' } }), { exactDoi: wanted }), false);
  assert.equal(validScholarlyProviderPayload('crossref', bytes({ message: { items: [] } }), { exactDoi: wanted }), false);
});

test('malformed 200 success is uncached, safe, and followed by a valid provider recovery', async () => {
  const priorFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls++;
    if (upstreamCalls === 1) {
      return new Response('{"error":"private upstream failure"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{"results":[{"id":"https://openalex.org/W1","title":"Verified paper"}]}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const query = { provider: 'openalex_works', q: 'privacy boundary', limit: '1' };
    const first = response();
    await handler({ method: 'GET', query }, first);
    assert.equal(first.statusCode, 502);
    assert.equal(first.payload.code, 'INVALID_SOURCE_RESPONSE');
    assert.equal(first.headers['cache-control'], 'no-store');
    assert.equal(first.headers['x-content-type-options'], 'nosniff');
    assert.doesNotMatch(JSON.stringify(first.payload), /private upstream failure/);

    const recovered = response();
    await handler({ method: 'GET', query }, recovered);
    assert.equal(recovered.statusCode, 200);
    assert.equal(JSON.parse(recovered.payload).results[0].title, 'Verified paper');
    assert.equal(upstreamCalls, 2, 'invalid response must not poison the server cache');

    const cached = response();
    await handler({ method: 'GET', query }, cached);
    assert.equal(cached.statusCode, 200);
    assert.equal(cached.headers['x-eylo-cache'], 'HIT');
    assert.equal(upstreamCalls, 2);
  } finally { globalThis.fetch = priorFetch; }
});

test('invalid 200 Atom and DOI responses are never returned as authenticated scientific evidence', async () => {
  const priorFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('<error>arXiv temporarily blocked</error>', {
      status: 200, headers: { 'content-type': 'application/atom+xml' },
    });
    const atom = response();
    await handler({ method: 'GET', query: { provider: 'arxiv', q: 'climate resilience' } }, atom);
    assert.equal(atom.statusCode, 502);
    assert.equal(atom.payload.code, 'INVALID_SOURCE_RESPONSE');
    assert.equal(atom.headers['cache-control'], 'no-store');

    globalThis.fetch = async () => new Response('{"message":{"DOI":"10.5555/unrelated"}}', {
      status: 200, headers: { 'content-type': 'application/json' },
    });
    const doi = response();
    await handler({ method: 'GET', query: { provider: 'crossref', doi: '10.1234/example' } }, doi);
    assert.equal(doi.statusCode, 502);
    assert.equal(doi.payload.code, 'INVALID_SOURCE_RESPONSE');
    assert.equal(doi.headers['cache-control'], 'no-store');
  } finally { globalThis.fetch = priorFetch; }
});
