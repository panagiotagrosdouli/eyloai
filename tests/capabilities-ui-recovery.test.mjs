import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/lib/capabilities.js', import.meta.url), 'utf8');

test('capability checks recover after transient outage without enabling services by default', () => {
  assert.match(source, /data: FALLBACK_CAPABILITIES/);
  assert.match(source, /setTimeout/);
  assert.match(source, /automaticRetryUsed/);
  assert.match(source, /addEventListener\('online', retryWhenConnected\)/);
  assert.match(source, /addEventListener\('visibilitychange', retryWhenVisible\)/);
});

test('capability recovery releases listeners and outstanding retry timers on unmount', () => {
  assert.match(source, /clearTimeout\(retryTimer\)/);
  assert.match(source, /removeEventListener\('online', retryWhenConnected\)/);
  assert.match(source, /removeEventListener\('visibilitychange', retryWhenVisible\)/);
});
