import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readMonitorProviderRecords, MonitorProviderResponseError,
  boundedOpenAlexAbstract, MAX_MONITOR_PROVIDER_BYTES,
} from '../supabase/functions/_shared/monitor-provider-response.mjs';

const json = data => new Response(JSON.stringify(data), {
  headers: { 'content-type': 'application/json' },
});

test('well-formed provider responses distinguish zero results from provider failure', async () => {
  assert.deepEqual(await readMonitorProviderRecords(json({ results: [] }), 'openalex'), []);
  assert.deepEqual(await readMonitorProviderRecords(json({ errorcode: 0, data: { oppHits: [] } }), 'grants'), []);
  const paper = { id: 'https://openalex.org/W123', title: 'Paper title' };
  assert.deepEqual(await readMonitorProviderRecords(json({ results: [paper] }), 'openalex'), [paper]);
  assert.ok(MAX_MONITOR_PROVIDER_BYTES <= 2 * 1024 * 1024);
});

test('provider JSON must contain results array and correct response semantics', async () => {
  for (const [provider, payload] of [
    ['openalex', {}], ['openalex', { results: null }],
    ['openalex', { results: {} }],
    ['openalex', { results: [{ title: 'No ID' }] }],
    ['grants', { data: { oppHits: [] } }],
    ['grants', { errorcode: 12, data: { oppHits: [] } }],
    ['grants', { errorcode: 0 }],
    ['grants', { errorcode: 0, data: { oppHits: [{ id: '' }] } }],
  ]) {
    await assert.rejects(readMonitorProviderRecords(json(payload), provider), MonitorProviderResponseError);
  }
});

test('HTML challenge and invalid or scalar JSON never count as empty results', async () => {
  const html = new Response('<html>blocked</html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(readMonitorProviderRecords(html, 'openalex'), error => error.code === 'MONITOR_NON_JSON_SOURCE');
  const malformed = new Response('{bad json', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readMonitorProviderRecords(malformed, 'openalex'), error => error.code === 'MONITOR_INVALID_JSON');
  const scalar = new Response('null', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readMonitorProviderRecords(scalar, 'openalex'), error => error.code === 'MONITOR_INVALID_RESULT_STRUCTURE');
});

test('declared oversized provider bodies reject before parsing', async () => {
  const res = new Response('{"results":[]}', { headers: {
    'content-type': 'application/json', 'content-length': '200000000',
  } });
  await assert.rejects(readMonitorProviderRecords(res, 'openalex', 100),
    error => error.code === 'MONITOR_SOURCE_TOO_LARGE');
});

test('streamed oversized provider bodies reject even without Content-Length', async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(70).fill(97));
      controller.enqueue(new Uint8Array(70).fill(97));
      controller.close();
    },
  });
  const res = new Response(stream, { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readMonitorProviderRecords(res, 'grants', 100),
    error => error.code === 'MONITOR_SOURCE_TOO_LARGE');
});

test('records exceeding the requested per-page cap reject rather than expand work', async () => {
  const overLimit = Array.from({ length: 6 }, (_, index) => ({ id: 'https://openalex.org/W' + index }));
  await assert.rejects(readMonitorProviderRecords(json({ results: overLimit }), 'openalex'),
    error => error.code === 'MONITOR_INVALID_RESULT_STRUCTURE');
});

test('inverted abstracts cannot allocate sparse arrays using arbitrary source offsets', () => {
  const decoded = boundedOpenAlexAbstract({
    safe: [0],
    evidence: [1],
    exploit: [1_000_000_000],
    negative: [-1],
    invalid: ['3'],
  });
  assert.equal(decoded, 'safe evidence');
  assert.equal(boundedOpenAlexAbstract({}), '');
  assert.equal(boundedOpenAlexAbstract({ safe: [0, 0, 0], long: [499] }), 'safe long');
  const many = Object.fromEntries(Array.from({ length: 400 }, (_, i) => ['word' + i, [i]]));
  assert.ok(boundedOpenAlexAbstract(many).length <= 500);
});
