import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/discovery.js';
import { MAX_SCHOLARLY_RESPONSE_BYTES, readBoundedScholarlyResponse } from '../src/lib/discovery-response-limit.mjs';

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    json(value) {
      this.payload = value;
      return this;
    },
    send(value) {
      this.payload = value;
      return this;
    },
  };
}

test('discovery proxy rejects unknown providers before fetching upstream', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('must not be called');
  };

  try {
    const response = createResponse();
    await handler(
      { method: 'GET', query: { provider: 'https://example.com', q: 'test', limit: '10' } },
      response,
    );

    assert.equal(response.statusCode, 400);
    assert.equal(called, false);
    assert.match(response.payload.error, /Unknown discovery provider/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discovery proxy bounds provider limits and emits cache/source headers', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';

  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = createResponse();
    await handler(
      {
        method: 'GET',
        query: {
          provider: 'openalex_works',
          q: 'federated learning privacy',
          limit: '9999',
          sort: 'recent',
        },
      },
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.match(requestedUrl, /^https:\/\/api\.openalex\.org\/works\?/);
    assert.match(requestedUrl, /per_page=30/);
    assert.match(requestedUrl, /sort=publication_date%3Adesc/);
    assert.equal(response.headers['x-eylo-source'], 'openalex_works');
    assert.equal(response.headers['cache-control'], 'public, s-maxage=300, stale-while-revalidate=600');
    assert.ok(Buffer.isBuffer(response.payload));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OpenAlex proxy uses a server-side API key without returning it to the browser', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENALEX_API_KEY;
  process.env.OPENALEX_API_KEY = 'test-openalex-server-secret';
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENALEX_API_KEY;
    else process.env.OPENALEX_API_KEY = originalApiKey;
  });

  const response = createResponse();
  await handler({
    method: 'GET',
    query: { provider: 'openalex_works', q: 'CRISPR gene editing', limit: '5' },
  }, response);

  assert.equal(new URL(requestedUrl).searchParams.get('api_key'), 'test-openalex-server-secret');
  assert.doesNotMatch(String(response.payload), /test-openalex-server-secret/);
});

test('Semantic Scholar proxy sends an optional server-side API key in its header only', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  process.env.SEMANTIC_SCHOLAR_API_KEY = 'test-semantic-scholar-server-secret';
  let requestedUrl = '';
  let requestedHeaders;
  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.SEMANTIC_SCHOLAR_API_KEY;
    else process.env.SEMANTIC_SCHOLAR_API_KEY = originalApiKey;
  });

  const response = createResponse();
  await handler({
    method: 'GET',
    query: { provider: 'semantic_scholar', q: 'CRISPR gene editing', limit: '5' },
  }, response);

  assert.match(requestedUrl, /^https:\/\/api\.semanticscholar\.org\/graph\/v1\/paper\/search\?/);
  assert.equal(requestedHeaders['x-api-key'], 'test-semantic-scholar-server-secret');
  assert.doesNotMatch(requestedUrl, /test-semantic-scholar-server-secret/);
  assert.doesNotMatch(String(response.payload), /test-semantic-scholar-server-secret/);
});

test('Crossref proxy requests the work type needed to exclude non-paper records', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ message: { items: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = createResponse();
    await handler({
      method: 'GET',
      query: { provider: 'crossref', q: 'CRISPR gene editing', limit: '8' },
    }, response);

    const params = new URL(requestedUrl).searchParams;
    assert.equal(params.get('select').split(',').includes('type'), true);
    assert.equal(response.statusCode, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Crossref proxy performs exact DOI lookups through its fixed provider host', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ message: { DOI: '10.1234/example' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const response = createResponse();
    await handler({
      method: 'GET',
      query: { provider: 'crossref', doi: 'https://doi.org/10.1234%2FExample' },
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(requestedUrl, /^https:\/\/api\.crossref\.org\/works\/10\.1234%2Fexample$/);
    assert.equal(new URL(requestedUrl).hostname, 'api.crossref.org');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('exact DOI lookup rejects malformed identifiers and non-Crossref providers without fetching', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('must not be called'); };
  try {
    const invalid = createResponse();
    await handler({ method: 'GET', query: { provider: 'crossref', doi: 'https://example.com/doi/10.1234/x' } }, invalid);
    assert.equal(invalid.statusCode, 400);

    const wrongProvider = createResponse();
    await handler({ method: 'GET', query: { provider: 'openalex_works', doi: '10.1234/example' } }, wrongProvider);
    assert.equal(wrongProvider.statusCode, 400);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discovery proxy rejects overlong research queries', async () => {
  const response = createResponse();
  await handler(
    {
      method: 'GET',
      query: {
        provider: 'crossref',
        q: 'x'.repeat(501),
      },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.error, /valid research query/);
});

test('discovery proxy only accepts GET', async () => {
  const response = createResponse();
  await handler({ method: 'POST', query: {} }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, 'GET');
});

test('discovery proxy never caches upstream errors or provider rate limits', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'rate limited' }), {
    status: 429,
    headers: { 'content-type': 'application/json' },
  });
  try {
    const response = createResponse();
    await handler({ method: 'GET', query: { provider: 'openalex_works', q: 'trajectory prediction' } }, response);
    assert.equal(response.statusCode, 429);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-eylo-source'], 'openalex_works');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discovery proxy gives uncached 502 when a research source is unreachable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network failure'); };
  try {
    const response = createResponse();
    await handler({ method: 'GET', query: { provider: 'crossref', q: 'robotics' } }, response);
    assert.equal(response.statusCode, 502);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.payload.error, /temporarily unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discovery proxy preserves Greek topic queries when searching researchers', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async url => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const response = createResponse();
    await handler({ method: 'GET', query: { provider: 'openalex_authors', q: 'τεχνητή νοημοσύνη', page: '2', limit: '12', country: 'gr' } }, response);
    const upstream = new URL(requestedUrl);
    assert.equal(response.statusCode, 200);
    assert.equal(upstream.hostname, 'api.openalex.org');
    assert.equal(upstream.pathname, '/authors');
    assert.equal(upstream.searchParams.get('search'), 'τεχνητή νοημοσύνη');
    assert.equal(upstream.searchParams.get('page'), '2');
    assert.equal(upstream.searchParams.get('per_page'), '12');
    assert.equal(upstream.searchParams.get('filter'), 'last_known_institutions.country_code:GR');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('discovery proxy rejects malformed paging and country filters without upstream calls', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('unexpected call'); };
  try {
    for (const query of [
      { provider: 'openalex_authors', q: 'robotics', page: '0' },
      { provider: 'openalex_authors', q: 'robotics', page: '2.5' },
      { provider: 'openalex_authors', q: 'robotics', page: '201' },
      { provider: 'openalex_authors', q: 'robotics', country: 'GR|US' },
    ]) {
      const response = createResponse();
      await handler({ method: 'GET', query }, response);
      assert.equal(response.statusCode, 400);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('scholarly byte reader accepts a small valid provider response', async () => {
  const value = JSON.stringify({ results: [{ title: 'Paper A' }] });
  const response = new Response(value, { headers: { 'content-type': 'application/json' } });
  const bytes = await readBoundedScholarlyResponse(response, 1024);
  assert.equal(bytes.toString(), value);
});

test('discovery proxy rejects oversized Content-Length without returning provider content', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response('small actual body', {
    status: 200,
    headers: {
      'content-length': String(MAX_SCHOLARLY_RESPONSE_BYTES + 1),
      'content-type': 'text/html',
    },
  });
  try {
    const res = createResponse();
    await handler({ method: 'GET', query: { provider: 'crossref', q: 'AI safety' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.payload.code, 'SOURCE_RESPONSE_TOO_LARGE');
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    globalThis.fetch = before;
  }
});

test('discovery proxy refuses oversized chunked responses even with a fake small length header', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_SCHOLARLY_RESPONSE_BYTES - 32));
      controller.enqueue(new Uint8Array(128));
      controller.close();
    },
  }), { status: 200, headers: { 'content-length': '32' } });
  try {
    const res = createResponse();
    await handler({ method: 'GET', query: { provider: 'openalex_works', q: 'pedestrian trajectories' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.payload.code, 'SOURCE_RESPONSE_TOO_LARGE');
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    globalThis.fetch = before;
  }
});

test('proxy does not reflect upstream HTML media types into its own origin', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response('<script>alert("unsafe")</script>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  try {
    const res = createResponse();
    await handler({ method: 'GET', query: { provider: 'openalex_works', q: 'test' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.payload.code, 'INVALID_SOURCE_RESPONSE');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  } finally {
    globalThis.fetch = before;
  }
});

test('arXiv proxy still returns Atom XML content type with nosniff protection', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response('<?xml version="1.0"?><feed></feed>', {
    status: 200,
    headers: { 'content-type': 'application/atom+xml' },
  });
  try {
    const res = createResponse();
    await handler({ method: 'GET', query: { provider: 'arxiv', q: 'transformers' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/atom+xml; charset=utf-8');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(res.payload.toString(), /<feed>/);
  } finally {
    globalThis.fetch = before;
  }
});

test('discovery does not cache a successful upstream HTML challenge disguised as JSON', async () => {
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!DOCTYPE html><html><body>Bot challenge</body></html>', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  try {
    const res = createResponse();
    await handler({ method: 'GET', query: { provider: 'crossref', q: 'climate adaptation' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.payload.code, 'INVALID_SOURCE_RESPONSE');
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    globalThis.fetch = before;
  }
});
