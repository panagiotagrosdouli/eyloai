import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import handler from '../server/contact.js';

const KEYS = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'CONTACT_TO_EMAIL', 'CONTACT_PUBLIC_ENABLED'];
const initial = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

afterEach(() => {
  for (const key of KEYS) {
    if (initial[key] === undefined) delete process.env[key];
    else process.env[key] = initial[key];
  }
  globalThis.fetch = originalFetch;
});

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request(body = {}) {
  return {
    method: 'POST',
    headers: { origin: 'https://eyloai.vercel.app', host: 'eyloai.vercel.app' },
    body: {
      name: 'EYLO Visitor',
      email: 'visitor@example.test',
      interest: 'Research & Evidence',
      message: 'I would like to collaborate on a research project.',
      website: '',
      ...body,
    },
  };
}

function configure() {
  process.env.RESEND_API_KEY = 'fixture-only-secret';
  process.env.RESEND_FROM_EMAIL = 'EYLO <onboarding@resend.dev>';
  process.env.CONTACT_TO_EMAIL = 'fixture@example.test';
}

test('Contact rejects missing public release flag even with configured provider', async () => {
  configure();
  delete process.env.CONTACT_PUBLIC_ENABLED;
  let called = 0;
  globalThis.fetch = async () => { called++; throw new Error('should not call email provider'); };
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(called, 0);
  assert.ok(!JSON.stringify(res.body).includes('fixture-only-secret'));
});

test('Contact rejects missing credentials even if public release flag is set', async () => {
  configure();
  process.env.CONTACT_PUBLIC_ENABLED = '1';
  delete process.env.RESEND_FROM_EMAIL;
  let called = false;
  globalThis.fetch = async () => { called = true; };
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(called, false);
});

test('Contact only confirms accepted provider requests and escapes visitor HTML', async () => {
  configure();
  process.env.CONTACT_PUBLIC_ENABLED = '1';
  let payload;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    payload = JSON.parse(options.body);
    return { ok: true, status: 200 };
  };
  const res = response();
  await handler(request({ name: '<script>alert(1)</script>', message: '<img src=x onerror=alert(1)> — research collaboration' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.delivery_status, 'accepted_by_provider');
  assert.equal(payload.to[0], 'fixture@example.test');
  assert.equal(payload.reply_to, 'visitor@example.test');
  assert.ok(payload.html.includes('&lt;script&gt;'));
  assert.ok(payload.html.includes('&lt;img'));
  assert.ok(!payload.html.includes('<script>'));
  assert.ok(!payload.html.includes('<img'));
});

test('Contact reports an upstream provider rejection instead of fake success', async () => {
  configure();
  process.env.CONTACT_PUBLIC_ENABLED = '1';
  const previousError = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = async () => ({ ok: false, status: 403 });
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, undefined);
  } finally {
    console.error = previousError;
  }
});

test('Contact rejects disallowed origins before calling provider', async () => {
  configure();
  process.env.CONTACT_PUBLIC_ENABLED = '1';
  let called = false;
  globalThis.fetch = async () => { called = true; };
  const req = request();
  req.headers.origin = 'https://unrelated.example.test';
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test('Contact never logs arbitrary upstream exceptions containing visitor details', async () => {
  configure();
  process.env.CONTACT_PUBLIC_ENABLED = '1';
  const previousError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.map(String).join(' '));
  globalThis.fetch = async () => { throw new Error('secret user email visitor@example.test provider rejected'); };
  try {
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, undefined);
    assert.equal(logged.length, 1);
    assert.ok(!logged.join(' ').includes('visitor@example.test'));
    assert.ok(!logged.join(' ').includes('secret'));
  } finally {
    console.error = previousError;
  }
});
