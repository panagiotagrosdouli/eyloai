import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Real browser/HTTP streaming, synthetic relay payloads. No Auth or provider calls.
const source = await readFile(new URL('../src/lib/eyra-stream.mjs', import.meta.url), 'utf8');
const active = new Set();
let closedStreams = 0;
const server = createServer((request, response) => {
  if (request.url === '/eyra-stream.mjs') {
    response.writeHead(200, { 'content-type': 'application/javascript' });
    return response.end(source);
  }
  if (!request.url.startsWith('/stream/')) {
    response.writeHead(200, { 'content-type': 'text/html' });
    return response.end('<!doctype html><title>EYRA streaming fixture</title>');
  }
  active.add(response);
  response.once('close', () => { active.delete(response); closedStreams++; });
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
  const send = event => response.write(`data: ${JSON.stringify(event)}\n\n`);
  send({ type: 'delta', delta: 'Unconfirmed draft.' });
  if (request.url === '/stream/partial') return response.end();
  send({ type: 'done', text: request.url === '/stream/invalid' ? '' : 'Confirmed final answer.' });
  if (request.url === '/stream/disconnect') {
    const timer = setTimeout(() => response.destroy(), 100);
    response.once('close', () => clearTimeout(timer));
  }
  // All other responses deliberately remain open after their terminal event.
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin);
  const results = await page.evaluate(async () => {
    const { readEyraReply } = await import('/eyra-stream.mjs');
    const results = [];
    for (const path of ['open', 'disconnect', 'partial', 'invalid', 'cancel']) {
      const controller = new AbortController();
      const response = await fetch(`/stream/${path}`, { signal: controller.signal });
      const deltas = [];
      const deadline = setTimeout(() => controller.abort(), 1500);
      try {
        const text = await readEyraReply(response.body, { signal: controller.signal, onDelta: delta => {
          deltas.push(delta);
          if (path === 'cancel') controller.abort();
        } });
        results.push({ path, text, deltas, unlocked: !response.body.locked });
      } catch (error) { results.push({ path, error: error.name, message: error.message, unlocked: !response.body.locked }); }
      finally { clearTimeout(deadline); }
    }
    return results;
  });
  for (const path of ['open', 'disconnect']) {
    const result = results.find(row => row.path === path);
    assert.equal(result.text, 'Confirmed final answer.', path);
    assert.deepEqual(result.deltas, ['Unconfirmed draft.']);
    assert.equal(result.unlocked, true);
  }
  for (const path of ['partial', 'invalid']) {
    const result = results.find(row => row.path === path);
    assert.match(result.message, /did not confirm/);
    assert.equal(result.unlocked, true);
  }
  assert.equal(results.find(row => row.path === 'cancel').error, 'AbortError');
  for (let attempt = 0; attempt < 50 && active.size; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(active.size, 0, 'terminal replies and rejections release their actual HTTP connections');
  assert.equal(closedStreams, 5);
  console.log('PASS browser HTTP streaming: open-after-done, post-completion disconnect, partial/invalid rejection, cancellation and connection cleanup. Synthetic relay payloads; no live provider acceptance.');
} finally {
  await browser?.close();
  for (const response of active) response.destroy();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
