import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchResearchProvider } from '../api/monitor.js';

test('research monitoring retries a transient 429 and succeeds', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('', { status: calls === 1 ? 429 : 200 });
  };
  try {
    const response = await fetchResearchProvider('https://provider.example/search');
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('research monitoring does not retry permanent 4xx failures', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('', { status: 400 }); };
  try {
    const response = await fetchResearchProvider('https://provider.example/search');
    assert.equal(response.status, 400);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('research monitoring bounds repeated upstream 5xx errors', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('', { status: 503 }); };
  try {
    const response = await fetchResearchProvider('https://provider.example/search');
    assert.equal(response.status, 503);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('research monitoring retries a transient connection failure', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('temporary network disconnect');
    return new Response('', { status: 200 });
  };
  try {
    const response = await fetchResearchProvider('https://provider.example/search');
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('research monitoring reports repeated network failures', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new TypeError('provider unavailable');
  };
  try {
    await assert.rejects(fetchResearchProvider('https://provider.example/search'), /provider unavailable/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
