import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCors, isAllowedBrowserOrigin } from '../src/lib/api-cors.mjs';

function response() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    ended: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
}

test('only the public EYLO origin receives CORS permission', () => {
  const res = response();
  const handled = applyCors({
    method: 'GET',
    headers: { origin: 'https://panagiotagrosdouli.github.io', host: 'eyloai.vercel.app' },
  }, res, ['GET']);
  assert.equal(handled, false);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://panagiotagrosdouli.github.io');
  assert.equal(res.headers.Vary, 'Origin');
  assert.equal(res.headers['Access-Control-Allow-Credentials'], undefined);
});

test('an authorization preflight from GitHub Pages is accepted', () => {
  const res = response();
  const handled = applyCors({
    method: 'OPTIONS',
    headers: {
      origin: 'https://panagiotagrosdouli.github.io',
      host: 'eyloai.vercel.app',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type',
    },
  }, res, ['POST']);
  assert.equal(handled, true);
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.match(res.headers['Access-Control-Allow-Headers'], /Authorization/);
});

test('untrusted origins cannot pass the contact origin check or preflight', () => {
  assert.equal(isAllowedBrowserOrigin('https://attacker.example', 'eyloai.vercel.app'), false);
  const res = response();
  applyCors({
    method: 'OPTIONS',
    headers: {
      origin: 'https://attacker.example',
      host: 'eyloai.vercel.app',
      'access-control-request-method': 'POST',
    },
  }, res, ['POST']);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Invalid cross-origin request.');
});

test('same-origin preview deployments remain usable without broad Vercel wildcards', () => {
  assert.equal(isAllowedBrowserOrigin('https://eyloai-git-feature-panagiotagrosdoulis-projects.vercel.app', 'eyloai-git-feature-panagiotagrosdoulis-projects.vercel.app'), true);
  assert.equal(isAllowedBrowserOrigin('https://other-project.vercel.app', 'eyloai.vercel.app'), false);
});

test('same-host HTTP origins cannot access HTTPS preview APIs', () => {
  assert.equal(isAllowedBrowserOrigin('http://eyloai-git-preview.vercel.app', 'eyloai-git-preview.vercel.app'), false);
  assert.equal(isAllowedBrowserOrigin('https://eyloai-git-preview.vercel.app', 'eyloai-git-preview.vercel.app'), true);
  assert.equal(isAllowedBrowserOrigin('https://eyloai-git-preview.vercel.app.attacker.example', 'eyloai-git-preview.vercel.app'), false);
});

test('authenticated API responses default to non-cacheable', () => {
  const res = response();
  applyCors({ method: 'GET', headers: { host: 'eyloai.vercel.app' } }, res, ['GET']);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
