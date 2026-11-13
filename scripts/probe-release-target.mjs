import { execFileSync } from 'node:child_process';
import { probeReleaseTarget } from '../src/lib/deployment-probe.mjs';
try {
  const baseUrl = process.argv[2] || 'https://eyloai.vercel.app';
  const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const result = await probeReleaseTarget({ baseUrl, expectedCommit });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === 'PROBE_PASSED' ? 0 : 1;
} catch { console.error('Read-only deployment probe failed. No operation or release is authorized.'); process.exitCode = 1; }
