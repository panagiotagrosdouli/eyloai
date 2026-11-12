import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/contact.js';

const envKeys = ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'RESEND_FROM_EMAIL'];
const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const previousFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = previousFetch;
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(body) {
  return {
    method: 'POST',
    headers: { host: 'eyloai.vercel.app', origin: 'https://eyloai.vercel.app' },
    body,
  };
}

function validBody(overrides = {}) {
  return {
    name: 'Researcher',
    email: 'researcher@example.org',
    interest: 'Research & Evidence',
    message: 'I would like to discuss a research collaboration.',
    ...overrides,
  };
}

function configureResend() {
  process.env.RESEND_API_KEY = 're_test_disposable';
  process.env.CONTACT_TO_EMAIL = 'team@example.test';
  process.env.RESEND_FROM_EMAIL = 'EYLO <hello@example.test>';
}

test('contact reports success only after Resend accepts the message', async () => {
  configureResend();
  let deliveredRequest;
  globalThis.fetch = async (url, options) => {
    deliveredRequest = { url: String(url), options };
    return new Response(JSON.stringify({ id: 'email_test_123' }), { status: 200 });
  };
  const res = response();
  await handler(request(validBody()), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(deliveredRequest.url, 'https://api.resend.com/emails');
  assert.equal(deliveredRequest.options.method, 'POST');
  assert.equal(deliveredRequest.options.headers.authorization, 'Bearer re_test_disposable');
  const email = JSON.parse(deliveredRequest.options.body);
  assert.deepEqual(email.to, ['team@example.test']);
  assert.equal(email.reply_to, 'researcher@example.org');
  assert.match(email.html, /I would like to discuss a research collaboration\./);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('contact returns a delivery error when Resend rejects the message', async () => {
  configureResend();
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'provider detail' }), { status: 503 });
  const res = response();
  await handler(request(validBody()), res);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: 'Message could not be delivered. Please try again.' });
});

test('contact does not acknowledge honeypot submissions as delivered', async () => {
  configureResend();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not deliver'); };
  const res = response();
  await handler(request(validBody({ website: 'spam.example' })), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, undefined);
  assert.equal(calls, 0);
});

test('contact rejects invalid input and missing delivery configuration without calling Resend', async () => {
  for (const key of envKeys) delete process.env[key];
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not deliver'); };

  const invalid = response();
  await handler(request(validBody({ email: 'invalid' })), invalid);
  assert.equal(invalid.statusCode, 400);

  const unavailable = response();
  await handler(request(validBody()), unavailable);
  assert.equal(unavailable.statusCode, 503);
  assert.equal(calls, 0);
});
