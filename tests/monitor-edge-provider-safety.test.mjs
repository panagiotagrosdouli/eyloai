import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edgeFunction = readFileSync(new URL(
  '../supabase/functions/scheduled-monitoring/index.ts',
  import.meta.url,
), 'utf8');

test('the deployed Supabase Edge scheduler validates provider bodies before reading records', () => {
  assert.match(edgeFunction, /readMonitorProviderRecords\(response, "openalex"\)/);
  assert.match(edgeFunction, /readMonitorProviderRecords\(response, "grants"\)/);
  assert.match(edgeFunction, /boundedOpenAlexAbstract\(work\.abstract_inverted_index\)/);
  assert.doesNotMatch(edgeFunction, /response\.json\(\)/);
});

test('scheduled watchlists record provider failures and reset the counter after success', () => {
  assert.match(edgeFunction, /lastCheckStatus: "failed"/);
  assert.match(edgeFunction, /lastCheckStatus: "success"/);
  assert.match(edgeFunction, /consecutiveFailures: Number\(watchlist\.consecutiveFailures \|\| 0\) \+ 1/);
  assert.match(edgeFunction, /consecutiveFailures: 0/);
  assert.match(edgeFunction, /failed > 0 \? 503 : 200/);
  assert.match(edgeFunction, /failed_watchlist_ids: failedWatchlistIds/);
});
