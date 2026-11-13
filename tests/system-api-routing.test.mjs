import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/system.js';

function reply() {
  return {
    statusCode: 200, body: null, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('consolidated API dispatch preserves existing endpoint behavior', async () => {
  const capabilities = reply();
  await handler({ method: 'GET', headers: {}, query: { endpoint: 'capabilities' } }, capabilities);
  assert.equal(capabilities.statusCode, 200);
  assert.equal(typeof capabilities.body.ai, 'boolean');

  const release = reply();
  await handler({ method: 'GET', headers: {}, query: { endpoint: 'deployment-status' } }, release);
  assert.equal(release.statusCode, 200);
  assert.ok(Object.hasOwn(release.body, 'deployment_sha'));

  const contact = reply();
  await handler({ method: 'GET', headers: {}, query: { endpoint: 'contact' } }, contact);
  assert.equal(contact.statusCode, 405);
  assert.equal(contact.headers.allow, 'POST');

  const unknown = reply();
  await handler({ method: 'GET', headers: {}, query: { endpoint: '__proto__' } }, unknown);
  assert.equal(unknown.statusCode, 404);
});
