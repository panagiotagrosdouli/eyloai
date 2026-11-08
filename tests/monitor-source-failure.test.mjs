import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import monitor from '../api/monitor.js';

const oldFetch = globalThis.fetch;
const oldCronSecret = process.env.CRON_SECRET;
const oldSupabaseKey = process.env.SUPABASE_SECRET_KEY;

afterEach(() => {
  globalThis.fetch = oldFetch;
  if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = oldCronSecret;
  if (oldSupabaseKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = oldSupabaseKey;
});

function mockResponse() {
  return {
    statusCode: 200, data: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.data = value; return this; },
  };
}
function sourceResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  });
}
function mockDatabase(providerPayload, { type = 'topic' } = {}) {
  process.env.CRON_SECRET = 'monitor-test-cron';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_disposable_test_only';
  const records = [{
    id: 'watchlist-1', user_id: 'test-user',
    data: { query: 'biomedical research', active: true, type },
  }];
  const result = { providerCalls: 0, discoveryWrites: 0, writes: [] };
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(String(url));
    if (target.hostname === 'api.openalex.org' || target.hostname === 'api.grants.gov') {
      result.providerCalls++;
      return typeof providerPayload === 'function' ? providerPayload() : sourceResponse(providerPayload);
    }
    if (target.pathname.endsWith('/watchlists') && options.method === 'PATCH') {
      result.writes.push(JSON.parse(options.body).data);
      return new Response(null, { status: 204 });
    }
    if (target.pathname.endsWith('/watchlists')) {
      return sourceResponse(records);
    }
    if (target.pathname.endsWith('/monitoring_discoveries') && options.method === 'POST') {
      result.discoveryWrites++;
      return new Response(null, { status: 204 });
    }
    if (target.pathname.endsWith('/monitoring_discoveries')) {
      return sourceResponse([]);
    }
    throw Error('Unexpected request in monitor provider failure test: ' + String(url));
  };
  return result;
}
async function run() {
  const reply = mockResponse();
  await monitor({ method: 'GET', headers: { authorization: 'Bearer monitor-test-cron' } }, reply);
  return reply;
}

test('invalid OpenAlex 200 JSON fails the run rather than recording zero matches', async () => {
  const db = mockDatabase({ meta: { count: 10 }, error: 'data truncated' });
  const reply = await run();
  assert.equal(reply.statusCode, 503);
  assert.equal(reply.data.checked, 1);
  assert.equal(reply.data.failed, 1);
  assert.equal(reply.data.partial_failure, true);
  assert.deepEqual(reply.data.failed_watchlist_ids, ['watchlist-1']);
  assert.equal(db.providerCalls, 1);
  assert.equal(db.discoveryWrites, 0);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].lastCheckStatus, 'failed');
  assert.equal(db.writes[0].lastCheckedAt, undefined, 'never record source errors as success');
});

test('invalid Grants.gov success JSON fails the funding watchlist', async () => {
  const db = mockDatabase({ errorcode: 0, data: { oppHits: null } }, { type: 'funding program' });
  const reply = await run();
  assert.equal(reply.statusCode, 503);
  assert.equal(reply.data.failed, 1);
  assert.equal(db.providerCalls, 1);
  assert.equal(db.discoveryWrites, 0);
  assert.equal(db.writes[0].lastCheckStatus, 'failed');
});

test('oversized OpenAlex body returns retryable 503 with zero discoveries', async () => {
  const db = mockDatabase(() => new Response('{"results":[]}', {
    headers: { 'content-type': 'application/json', 'content-length': '99999999' },
  }));
  const reply = await run();
  assert.equal(reply.statusCode, 503);
  assert.equal(reply.data.partial_failure, true);
  assert.equal(db.discoveryWrites, 0);
  assert.equal(db.writes[0].lastCheckStatus, 'failed');
});

test('legitimate empty source results remain a successful monitored check', async () => {
  const db = mockDatabase({ results: [] });
  const reply = await run();
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.data.failed, 0);
  assert.equal(reply.data.checked, 1);
  assert.equal(db.discoveryWrites, 0);
  assert.equal(db.writes[0].lastCheckStatus, 'success');
  assert.equal(db.writes[0].lastResultCount, 0);
});

test('safe OpenAlex abstract decoding is used when inserting a new discovery', async () => {
  const db = mockDatabase({
    results: [{
      id: 'https://openalex.org/WTEST',
      title: 'Research sample',
      doi: 'https://doi.org/10.1234/test',
      abstract_inverted_index: { valid: [0], summary: [1], malicious: [999999999] },
    }],
  });
  const reply = await run();
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.data.inserted, 1);
  assert.equal(db.discoveryWrites, 1);
  assert.equal(db.writes[0].lastCheckStatus, 'success');
});
