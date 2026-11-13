// Exercise the candidate handler with real public providers, without deployment.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import handler from '../api/discovery.js';

const server = http.createServer(async (request, response) => {
  request.query = Object.fromEntries(new URL(request.url, 'http://127.0.0.1').searchParams);
  response.status = code => { response.statusCode = code; return response; };
  response.json = body => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); return response; };
  response.send = body => { response.end(body); return response; };
  try { await handler(request, response); }
  catch { if (!response.headersSent) response.statusCode = 500; response.end('Candidate discovery handler failed.'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const child = spawn(process.execPath, ['scripts/benchmark-live-retrieval.mjs'], {
  env: { ...process.env, EYLO_LIVE_BASE_URL: `http://127.0.0.1:${address.port}` }, stdio: 'inherit',
});
try { const [code] = await once(child, 'exit'); process.exitCode = code || 0; }
finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
