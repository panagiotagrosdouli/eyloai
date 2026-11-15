import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { localApiPlugin } from '../scripts/dev/local-api.mjs';

test('local Vite APIs preserve routing, JSON, raw webhook and error contracts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eylo-local-api-'));
  let server;
  try {
    await mkdir(join(root, 'api'));
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await writeFile(join(root, 'vercel.json'), JSON.stringify({ rewrites: [
      { source: '/api/capabilities', destination: '/api/system?endpoint=capabilities' },
    ] }));
    await writeFile(join(root, 'api/system.js'), `export default function (req, res) {
      res.status(200).json({ query: req.query, body: req.body ?? null });
    }`);
    await writeFile(join(root, 'api/webhook.js'), `
      export const config = { api: { bodyParser: false } };
      export default async function (req, res) {
        let raw = ''; for await (const chunk of req) raw += chunk;
        res.status(200).json({ raw });
      }
    `);
    server = await createServer({ root, configFile: false, plugins: [localApiPlugin()],
      server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const call = (path, options) => fetch(origin + path, options);
    const alias = await call('/api/capabilities?endpoint=developer&other=1');
    assert.equal(alias.status, 200);
    assert.deepEqual((await alias.json()).query, { endpoint: 'capabilities', other: '1' });
    const options = body => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const parsed = await call('/api/system', options('{"message":"hello"}'));
    assert.deepEqual((await parsed.json()).body, { message: 'hello' });
    const malformed = await call('/api/system', options('{'));
    assert.equal(malformed.status, 400);
    const raw = '{ "signed": true }\n';
    const webhook = await call('/api/webhook', options(raw));
    assert.equal((await webhook.json()).raw, raw);
    const missing = await call('/api/not-a-handler');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /application\/json/);
    assert.equal((await missing.json()).error, 'API endpoint not found.');
    const oversized = await call('/api/system', options('a'.repeat(1024 * 1024 + 1)));
    assert.equal(oversized.status, 413);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
