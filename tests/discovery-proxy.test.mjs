import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/discovery.js';

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
