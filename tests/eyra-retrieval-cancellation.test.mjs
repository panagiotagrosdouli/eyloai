import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchAllPapersWithStatus } from '../src/lib/eyra-api.js';

const component = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('EYRA forwards its request AbortSignal to papers, authors, institutions and funding', () => {
  assert.match(component, /retrieveEvidence\(content, mode, workspaceContext, signal\)/);
  assert.match(component, /searchAllPapersWithStatus\(query, \{ limit: 16, signal \}\)/);
  assert.match(component, /searchOpenAlexAuthors\(query, 6, \{ signal, throwOnError: true \}\)/);
  assert.match(component, /searchOpenAlexInstitutions\(query, 4, \{ signal, throwOnError: true \}\)/);
  assert.match(component, /searchFundingOpportunities\(query, 10, \{ signal \}\)/);
  assert.match(component, /const settled = await Promise\.allSettled\(tasks\);\s*signal\?\.throwIfAborted\(\)/);
  assert.match(component, /preferences\.data_personalization \? workspaceContext : '',\s*controller\.signal/);
});

test('stopping a workspace action clears consent, not just a visual spinner', () => {
  const stop = component.slice(
    component.indexOf('const stopGeneration = () => {'),
    component.indexOf('const sendMessage = async ('),
  );
  assert.match(stop, /activeRequestRef\.current\.abort\(\)/);
  assert.match(stop, /setPendingWriteReview\(null\)/);
  assert.match(stop, /setAllowWorkspaceActions\(false\)/);
  assert.match(stop, /server-side workspace action may still finish/);
});

test('aborting scholarly retrieval cancels all outgoing in-flight provider fetches', async () => {
  const saved = globalThis.fetch;
  const controller = new AbortController();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), signal: options.signal });
    // Do not return a real result. Simulate providers that remain pending
    // until their passed transport signal is actually aborted.
    return new Promise((_resolve, reject) => {
      const signal = options.signal;
      if (!signal) {
        reject(new Error('Missing provider cancellation signal'));
        return;
      }
      const cancel = () => reject(signal.reason || new Error('Provider request aborted'));
      if (signal.aborted) cancel();
      else signal.addEventListener('abort', cancel, { once: true });
    });
  };
  try {
    const pending = searchAllPapersWithStatus('bounded academic literature search', {
      limit: 6, signal: controller.signal,
    });
    controller.abort(new DOMException('User stopped retrieval.', 'AbortError'));
    const result = await pending;
    assert.ok(calls.length >= 3, 'Multiple live research sources must share cancellation');
    assert.ok(calls.every(call => call.signal?.aborted), 'No fetch should continue after stop');
    assert.ok(result.source_status.every(source => source.status === 'unavailable'));
    assert.equal(result.available_source_count, 0);
    assert.equal(result.papers.length, 0);
  } finally {
    globalThis.fetch = saved;
  }
});
