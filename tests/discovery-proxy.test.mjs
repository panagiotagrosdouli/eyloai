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
