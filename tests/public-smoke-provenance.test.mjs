import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const expected = 'a'.repeat(40);
const stale = 'b'.repeat(40);

test('public smoke requires both browser and server release identity when given a SHA', async (t) => {
  let manifest = expected;
  let deployment = expected;
  let verified = true;
  const server = createServer((request, response) => {
    switch (request.url) {
      case '/release.json':
        return response.end(JSON.stringify({ release: 'fixture', git_commit: manifest }));
      case '/api/deployment-status':
        return response.end(JSON.stringify({ deployment_sha: deployment, provenance_verified: verified }));
      case '/api/capabilities':
        return response.end(JSON.stringify({
          ai: true, contact: false, billing: false,
          scheduled_monitoring: false, institution_analytics: false,
        }));
      case '/robots.txt':
        return response.end('User-agent: *');
      default:
        return response.end('<html><div id="root"></div></html>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  const run = (sha = expected) => exec(process.execPath, ['scripts/smoke-public.mjs', url], {
    env: { ...process.env, EYLO_EXPECTED_GIT_SHA: sha },
  });

  assert.match((await run()).stdout, /PASS Server deployment commit/);
  deployment = stale;
  await assert.rejects(run(), /Server provenance does not identify expected commit/);
  deployment = expected;
  manifest = stale;
  await assert.rejects(run(), /Release manifest does not identify expected commit/);
  manifest = expected;
  verified = false;
  await assert.rejects(run(), /Server provenance does not identify expected commit/);
  await assert.rejects(run('main'), /must be a 40-character commit SHA/);
  assert.doesNotMatch((await run('')).stdout, /Server deployment commit/);
});
