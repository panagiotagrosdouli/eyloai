import test from 'node:test';
import assert from 'node:assert/strict';
import { scholarlyRetryDelay, fetchWithScholarlyBackoff } from '../src/lib/scholarly-provider-backoff.mjs';

test('does not hammer providers when 429 lacks a permitted short Retry-After', async () => {
  let calls = 0;
  const result = await fetchWithScholarlyBackoff('https://api.openalex.org/test', {}, {
    fetchImpl: async () => { calls++; return new Response('rate limited', { status: 429 }); },
    sleep: async () => { throw new Error('should not sleep'); },
  });
  assert.equal(result.status, 429);
  assert.equal(calls, 1);
  assert.equal(scholarlyRetryDelay(new Response('', { status: 429, headers: { 'retry-after': '60' } })), null);
});

test('retries transient 503 once only when provider explicitly permits a brief delay', async () => {
  let calls = 0;
  let slept = null;
  const result = await fetchWithScholarlyBackoff('https://www.ebi.ac.uk/europepmc/test', {}, {
    fetchImpl: async () => ++calls === 1
      ? new Response('unavailable', { status: 503, headers: { 'retry-after': '0' } })
      : new Response('{"results":[]}', { status: 200 }),
    sleep: async (ms) => { slept = ms; },
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.equal(slept, 0);
});

test('never retries a nonretryable response or invalid Retry-After', async () => {
  const invalid = new Response('', { status: 429, headers: { 'retry-after': 'not a date' } });
  assert.equal(scholarlyRetryDelay(invalid), null);
  let calls = 0;
  const result = await fetchWithScholarlyBackoff('https://test.local', {}, {
    fetchImpl: async () => { calls++; return new Response('', { status: 401, headers: { 'retry-after': '0' } }); },
  });
  assert.equal(result.status, 401);
  assert.equal(calls, 1);
});

test('does not retry after caller aborts', async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(fetchWithScholarlyBackoff('https://test.local', { signal: controller.signal }, {
    fetchImpl: async () => { calls++; return new Response('', { status: 503, headers: { 'retry-after': '0' } }); },
    sleep: async () => { controller.abort(); },
  }));
  assert.equal(calls, 1);
});
