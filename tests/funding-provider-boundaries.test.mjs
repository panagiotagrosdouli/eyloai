import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/opportunities.js';

const priorEnv = process.env.VITE_SUPABASE_ANON_KEY;
const priorFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = priorFetch;
  if (priorEnv === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
  else process.env.VITE_SUPABASE_ANON_KEY = priorEnv;
});

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const sourceSearch = (hits = []) => ({ errorcode: 0, data: { hitCount: hits.length, oppHits: hits } });
function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(n) { this.statusCode = n; return this; },
    json(data) { this.body = data; return this; },
  };
}
function request() {
  return { method: 'GET', headers: { authorization: 'Bearer unit-test-token' }, query: { q: 'cancer research', limit: '2' } };
}
function setFetcher(fetchGrant) {
  process.env.VITE_SUPABASE_ANON_KEY = 'public-test-key';
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/auth/v1/user')) {
      assert.equal(options.headers.authorization, 'Bearer unit-test-token');
      return json({ id: 'disposable-test-user' });
    }
    return fetchGrant(String(url), options);
  };
}

test('a legitimate search and detail return sourced, verified funding fields', async () => {
  let detailCalls = 0;
  setFetcher(async url => {
    if (url.includes('/search2')) return json(sourceSearch([
      { id: '101', title: 'Official research call', closeDate: '2099-12-31', agency: 'Agency A' },
    ]));
    if (url.includes('/fetchOpportunity')) {
      detailCalls++;
      return json({ errorcode: 0, data: {
        synopsis: {
          synopsisDesc: 'Validated detailed announcement',
          applicantTypes: [{ description: 'Universities' }],
          fundingInstruments: [{ description: 'Grants' }],
        },
      } });
    }
    throw Error('Unexpected fetch: ' + url);
  });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(detailCalls, 1);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].detail_status, 'verified');
  assert.equal(res.body.items[0].eligibility, 'Universities');
  assert.equal(res.body.partial_results, false);
  assert.equal(res.body.detail_unavailable_count, 0);
});

test('a search HTTP error is a source outage, not a truthful empty search', async () => {
  setFetcher(async () => json({ errorcode: 9 }, 503));
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.items, undefined);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('non-JSON, missing hits and malformed funding search data return source error', async () => {
  for (const source of [
    () => new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } }),
    () => json({ errorcode: 0, data: { oppHits: null } }),
    () => json({ errorcode: 0, data: { oppHits: [{ title: 'No official identifier' }] } }),
  ]) {
    setFetcher(async () => source());
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.items, undefined);
  }
});

test('an actual overlarge streaming search gets HTTP 502 and a stable error code', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024 + 200).fill(97));
      controller.enqueue(new Uint8Array(1024 * 1024 + 200).fill(97));
      controller.close();
    },
  });
  setFetcher(async () => new Response(body, { headers: { 'content-type': 'application/json' } }));
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'FUNDING_RESPONSE_TOO_LARGE');
  assert.equal(res.body.items, undefined);
});

test('failed or oversized detail is surfaced as partial source data, never fabricated eligibility', async () => {
  setFetcher(async url => url.includes('/search2')
    ? json(sourceSearch([{ id: '101', title: 'Official listing', closeDate: '' }]))
    : new Response('<h1>Bad upstream</h1>', { headers: { 'content-type': 'text/html' } }));
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.partial_results, true);
  assert.equal(res.body.detail_unavailable_count, 1);
  assert.equal(res.body.items[0].detail_status, 'unavailable');
  assert.equal(res.body.items[0].eligibility, '');
  assert.equal(res.body.items[0].description, '');
});

test('anonymous or non-GET requests are never served from public caches', async () => {
  globalThis.fetch = async () => { throw Error('Unauthenticated request must not be proxied'); };
  process.env.VITE_SUPABASE_ANON_KEY = 'public-test-key';
  const res = response();
  await handler({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  const reject = response();
  await handler({ method: 'POST', headers: {} }, reject);
  assert.equal(reject.statusCode, 405);
  assert.equal(reject.headers['Cache-Control'], 'private, no-store');
});
