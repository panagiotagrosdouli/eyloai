import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Execute the actual exported capability client with only its React hook and
// Vite alias imports replaced by inert test adapters. No network or credentials.
const source = readFileSync(new URL('../src/lib/capabilities.js', import.meta.url), 'utf8')
  .replace(/^import \{ apiUrl \} from .*;\n/m, '')
  .replace(/^import \{ useEffect, useState \} from .*;\n/m, '');
const runtime = await import('data:text/javascript,' + encodeURIComponent(
  'const apiUrl = path => path; const useEffect = () => {}; const useState = () => [];\n' + source
));
const nativeFetch = globalThis.fetch;
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;

test('capability client returns only explicitly enabled services and recovers after a failed request', async () => {
  try {
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(runtime.getCapabilities({ refresh: true }), /offline/);
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ ai: true, billing: 'true', contact: false }),
    });
    const flags = await runtime.getCapabilities();
    assert.equal(flags.ai, true);
    assert.equal(flags.billing, false);
    assert.equal(flags.contact, false);
    assert.equal(flags.scheduled_monitoring, false);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('a stale failed request cannot clear a newer successful capability refresh', async () => {
  try {
    let failOlder;
    globalThis.fetch = () => new Promise((resolve, reject) => { failOlder = reject; });
    const older = runtime.getCapabilities({ refresh: true });
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ai: true }) });
    const newer = runtime.getCapabilities({ refresh: true });
    assert.equal((await newer).ai, true);
    failOlder(new Error('stale network failure'));
    await assert.rejects(older, /stale network failure/);
    assert.equal((await runtime.getCapabilities()).ai, true);
  } finally {
    globalThis.fetch = nativeFetch;
  }
});

test('a permanently hung endpoint times out and aborts without a false enabled state', async () => {
  try {
    let signal;
    globalThis.fetch = (_, options) => {
      signal = options.signal;
      return new Promise(() => {});
    };
    globalThis.setTimeout = callback => {
      queueMicrotask(callback);
      return 1;
    };
    globalThis.clearTimeout = () => {};
    await assert.rejects(runtime.getCapabilities({ refresh: true }), /timed out/);
    assert.equal(signal.aborted, true);
  } finally {
    globalThis.fetch = nativeFetch;
    globalThis.setTimeout = nativeSetTimeout;
    globalThis.clearTimeout = nativeClearTimeout;
  }
});
