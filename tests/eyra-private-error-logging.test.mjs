import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/eyra.js';

test('EYRA does not leak raw upstream exception messages into server logs', async () => {
  const originals = {
    fetch: globalThis.fetch,
    error: console.error,
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
    vercel: process.env.VERCEL_ENV,
  };
  const lines = [];
  const privateText = 'PRIVATE_RESEARCH_SECRET_TOKEN_DO_NOT_LOG';
  process.env.VITE_SUPABASE_URL = 'https://eylo-test.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  delete process.env.VERCEL_ENV;
  globalThis.fetch = async () => { throw new Error(privateText); };
  console.error = (...args) => lines.push(args);
  const res = {
    code: 200, body: null,
    setHeader() { return this; },
    status(value) { this.code = value; return this; },
    json(value) { this.body = value; return this; },
  };
  try {
    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer simulated-disposable-token' },
      body: { prompt: privateText },
    }, res);
    assert.equal(res.code, 500);
    assert.equal(JSON.stringify(lines).includes(privateText), false);
    assert.equal(JSON.stringify(res.body).includes(privateText), false);
  } finally {
    globalThis.fetch = originals.fetch;
    console.error = originals.error;
    if (originals.url === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originals.url;
    if (originals.key === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originals.key;
    if (originals.vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originals.vercel;
  }
});
