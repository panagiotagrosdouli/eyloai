import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const api = new URL('../api/', import.meta.url);
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel Hobby deployment stays below the twelve-function maximum', () => {
  const entries = readdirSync(api).filter(path => /\.[cm]?js$/.test(path));
  assert.ok(entries.length <= 12, 'Found ' + entries.length + ' API functions; Hobby limit is 12.');
  assert.ok(!entries.includes('general-jobs.js'));
  assert.ok(!entries.includes('euraxess.js'));
  assert.ok(entries.includes('system.js'));
});

test('public career URLs retain exact rewrites and route to their original verified handlers', async () => {
  const entry = (source) => config.rewrites.find(rule => rule.source === source);
  assert.equal(entry('/api/general-jobs')?.destination, '/api/system?endpoint=general-jobs');
  assert.equal(entry('/api/euraxess')?.destination, '/api/system?endpoint=euraxess');
  assert.ok(existsSync(new URL('../server/general-jobs.js', import.meta.url)));
  assert.ok(existsSync(new URL('../server/euraxess.js', import.meta.url)));
  const gateway = (await import('../api/system.js')).default;
  const response = () => ({
    statusCode: 200, headers: {}, body: undefined,
    setHeader(k,v) { this.headers[k.toLowerCase()] = v; return this; },
    status(n) { this.statusCode = n; return this; },
    json(v) { this.body = v; return this; },
  });
  for (const endpoint of ['general-jobs','euraxess']) {
    const res = response();
    await gateway({ method: 'POST', headers: {}, query: { endpoint } }, res);
    assert.equal(res.statusCode, 405, endpoint + ' must continue rejecting POST');
  }
  const unknown = response();
  await gateway({ method: 'GET', headers: {}, query: { endpoint: 'constructor' } }, unknown);
  assert.equal(unknown.statusCode, 404, 'untrusted endpoint cannot access prototype members');
});
