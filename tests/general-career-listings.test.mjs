import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/general-jobs.js';

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; return this; },
  };
}

test('general listings remove HTML and encoded markup from descriptions', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => ({
    ok: true,
    json: async () => {
      if (String(url).includes('raw.githubusercontent.com')) {
        return {
          source: 'Remotive',
          retrieved_at: '2026-11-07T00:00:00.000Z',
          items: [{
            id: 'remotive-789',
            title: 'Global researcher',
            organization: 'Remote Lab',
            country: 'Worldwide',
            description: 'Global data work.',
            source_url: 'https://remotive.com/remote-jobs/research/789',
          }],
        };
      }
      return {
        data: [{
          id: 123,
          title: 'Research analyst',
          company_name: 'Example employer',
          location: 'Remote',
          url: 'https://www.arbeitnow.com/jobs/example/role-123',
          description: '&lt;p&gt;Build careful models &amp; reports&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
        }],
      };
    },
  });
  const response = createResponse();

  try {
    await handler({ method: 'GET', headers: {}, query: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.items.length > 0);
    assert.equal(response.body.items[0].description, 'Build careful models & reports');
    assert.equal(response.body.items[0].source, 'Arbeitnow Europe');
    const remote = response.body.items.find(item => item.source === 'Remotive');
    assert.equal(remote.title, 'Global researcher');
    assert.equal(response.body.remotive_provider_delay_hours, 24);
    assert.equal(response.body.remotive_attribution_url, 'https://remotive.com/remote-jobs/api');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('general listings disclose a provider failure while serving the available feed', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes('arbeitnow.co.uk')) throw new Error('temporary outage');
    if (String(url).includes('raw.githubusercontent.com')) {
      return { ok: true, json: async () => ({ source: 'Remotive', retrieved_at: '2026-11-07T00:00:00.000Z', items: [] }) };
    }
    return {
      ok: true,
      json: async () => ({
        data: [{
          id: 456,
          title: 'Data scientist',
          company_name: 'Example employer',
          location: 'Berlin',
          url: 'https://www.arbeitnow.com/jobs/example/data-scientist-456',
          description: 'Analyze trustworthy data.',
        }],
      }),
    };
  };
  const response = createResponse();

  try {
    await handler({ method: 'GET', headers: { origin: 'https://panagiotagrosdouli.github.io' }, query: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.items.length, 1);
    assert.deepEqual(response.body.failed_sources, ['Arbeitnow UK', 'Remotive']);
    assert.equal(response.headers['Access-Control-Allow-Origin'], 'https://panagiotagrosdouli.github.io');
    assert.match(response.headers['Cache-Control'], /s-maxage/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('general listings return an error when every provider fails', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('temporary outage'); };
  const response = createResponse();

  try {
    await handler({ method: 'GET', headers: {}, query: {} }, response);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.body.failed_sources, ['Arbeitnow Europe', 'Arbeitnow UK', 'Remotive']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
