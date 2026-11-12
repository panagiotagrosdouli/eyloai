import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const smokeScript = path.join(root, 'scripts/smoke-public.mjs');
const expectedSha = 'a'.repeat(40);

async function runSmoke({ releaseSha = expectedSha, deploymentSha = expectedSha } = {}) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/release.json') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ release: 'test-release', ...(releaseSha ? { git_commit: releaseSha } : {}) }));
      return;
    }
    if (url.pathname === '/api/deployment-status') {
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({
        deployment_sha: deploymentSha,
        environment: 'preview',
        provenance_verified: Boolean(deploymentSha),
      }));
      return;
    }
    if (url.pathname === '/api/capabilities') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ai: false, contact: false, billing: false, scheduled_monitoring: false, institution_analytics: false }));
      return;
    }
    if (url.pathname === '/robots.txt') {
      response.setHeader('content-type', 'text/plain');
      response.end('User-agent: *\nDisallow:');
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end('<html><body><div id="root"></div></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [smokeScript, `http://127.0.0.1:${address.port}`], {
        cwd: root,
        env: { ...process.env, EYLO_EXPECTED_GIT_SHA: expectedSha },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => child.kill('SIGKILL'), 15_000);
      child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
      child.on('error', reject);
      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        resolve({ status: code, signal, stdout, stderr });
      });
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('deployment smoke accepts only matching manifest and endpoint SHAs', async () => {
  const result = await runSmoke();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('deployment smoke fails when the manifest SHA is missing', async () => {
  const result = await runSmoke({ releaseSha: null });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Release manifest does not contain a valid deployed commit SHA/);
});

test('deployment smoke fails when either deployed SHA mismatches the intended commit', async () => {
  const result = await runSmoke({ deploymentSha: 'b'.repeat(40) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Stale deployment: expected commit/);
});

test('deployment smoke fails when the deployment endpoint SHA is missing', async () => {
  const result = await runSmoke({ deploymentSha: null });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Deployment provenance is not verified/);
});
