import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFundingJsonResponse, FundingSourceResponseError,
  MAX_GRANTS_SEARCH_BYTES, MAX_GRANTS_DETAIL_BYTES,
} from '../src/lib/funding-response-guard.mjs';

test('accepted funding JSON is parsed within strict configurable byte limits', async () => {
  const res = new Response(JSON.stringify({ errorcode: 0, data: { oppHits: [] } }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  assert.deepEqual(await readFundingJsonResponse(res, 1000), { errorcode: 0, data: { oppHits: [] } });
  assert.ok(MAX_GRANTS_SEARCH_BYTES > MAX_GRANTS_DETAIL_BYTES);
});

test('a declared overlarge funding response is refused before reading it', async () => {
  const res = new Response('{"valid":true}', {
    headers: { 'content-type': 'application/json', 'content-length': '1000000000' },
  });
  await assert.rejects(readFundingJsonResponse(res, 100), error => (
    error instanceof FundingSourceResponseError && error.code === 'FUNDING_RESPONSE_TOO_LARGE'
  ));
});

test('oversized streamed funding responses fail even without a Content-Length header', async () => {
  let pulls = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls++;
      controller.enqueue(new Uint8Array(55).fill(97));
      if (pulls >= 5) controller.close();
    },
  });
  const res = new Response(body, { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readFundingJsonResponse(res, 100), error => error.code === 'FUNDING_RESPONSE_TOO_LARGE');
  assert.ok(pulls <= 5);
});

test('HTML, malformed JSON and scalar JSON are never treated as zero grants', async () => {
  const html = new Response('<h1>Access blocked</h1>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(readFundingJsonResponse(html, 200), error => error.code === 'FUNDING_INVALID_CONTENT_TYPE');
  const invalid = new Response('{not-json', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readFundingJsonResponse(invalid, 200), error => error.code === 'FUNDING_INVALID_RESPONSE');
  const scalar = new Response('0', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readFundingJsonResponse(scalar, 200), error => error.code === 'FUNDING_INVALID_RESPONSE');
});

test('empty or failed provider streams remain errors, never successful funding searches', async () => {
  const empty = new Response('', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(readFundingJsonResponse(empty, 100), error => error.code === 'FUNDING_INVALID_RESPONSE');
});
