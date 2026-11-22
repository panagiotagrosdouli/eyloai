import { execFileSync } from 'node:child_process';
import { probeReleaseTarget } from '../src/lib/deployment-probe.mjs';
try {
  const args = process.argv.slice(2);
  const billingRequired = !args.includes('--without-billing');
  const positional = args.filter(arg => arg !== '--without-billing');
  if (positional.length > 1 || positional.some(arg => arg.startsWith('--'))) throw new Error('Unsupported probe arguments.');
  const baseUrl = positional[0] || 'https://eyloai.vercel.app';
  const expectedCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const result = await probeReleaseTarget({ baseUrl, expectedCommit, billingRequired });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === 'PROBE_PASSED' ? 0 : 1;
} catch { console.error('Read-only deployment probe failed. No operation or release is authorized.'); process.exitCode = 1; }
