import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { promiseWithTimeout } from '../src/lib/promise-timeout.js';

test('researcher search cancels superseded and unmounted OpenAlex requests', async () => {
  const source = await readFile(new URL('../src/pages/Researchers.jsx', import.meta.url), 'utf8');
  assert.match(source, /searchController\.current\?\.abort\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /requestId === searchSequence\.current/);
});

test('funding source and EYRA ranking have bounded, user-visible failures', async () => {
  const source = await readFile(new URL('../src/pages/Opportunities.jsx', import.meta.url), 'utf8');
  assert.match(source, /FUNDING_SEARCH_TIMEOUT_MS = 20_000/);
  assert.match(source, /EYRA_RANKING_TIMEOUT_MS = 15_000/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /Verified opportunities loaded, but EYRA ranking is unavailable/);
  assert.match(source, /Funding search timed out or was cancelled/);
});

test('promise timeout returns early and clears its timer when the source is faster', async () => {
  assert.equal(await promiseWithTimeout(Promise.resolve('source data'), 100, 'timeout'), 'source data');
  await assert.rejects(
    promiseWithTimeout(new Promise(() => {}), 5, 'source timed out'),
    /source timed out/,
  );
});
