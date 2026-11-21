import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;
const DEFAULT_ORIGIN = 'https://eyloai.vercel.app';
const CAPABILITY_NAMES = Object.freeze(['ai','contact','billing']);
const isPlain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function checkHostedRelease({
  expectedSha, origin = DEFAULT_ORIGIN, fetchImpl = fetch, timeoutMs = 8000,
} = {}) {
  if (!SHA.test(expectedSha || '')) throw new Error('An exact 40-character reviewed commit SHA is required.');
  // Never send secrets, authentication headers or user data to an arbitrary URL.
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Expected a clean HTTPS origin, without credentials, path or query.');
  }
  const report = { target: url.origin, expected_sha: expectedSha, results: {}, decision: 'NO_GO' };
  for (const [label, path] of [['deployment','/api/deployment-status'],['capabilities','/api/capabilities']]) {
    try {
      const response = await fetchImpl(new URL(path,url), {
        method: 'GET',
        redirect: 'error',
        headers: { Accept:'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error('Non-success response');
      if (!String(response.headers?.get?.('content-type') || '').includes('application/json')) {
        throw new Error('Non-JSON response');
      }
      const value = await response.json();
      if (!isPlain(value)) throw new Error('Invalid JSON object');
      if (label === 'deployment') {
        const match = value.deployment_sha === expectedSha &&
          value.environment === 'production' && value.provenance_verified === true;
        report.results.deployment = { ok:match, environment:value.environment === 'production'?'production':'unexpected',
          reported_sha:SHA.test(value.deployment_sha || '')?value.deployment_sha:null };
      } else {
        const flagsValid = CAPABILITY_NAMES.every(name=>typeof value[name] === 'boolean');
        report.results.capabilities = { ok:flagsValid, ai:value.ai === true,
          contact:value.contact === true, billing:value.billing === true };
      }
    } catch {
      report.results[label] = { ok:false, error:'Public endpoint unavailable or returned an invalid response' };
    }
  }
  report.decision = report.results.deployment?.ok && report.results.capabilities?.ok
    ? 'PUBLIC_PROVENANCE_VERIFIED' : 'NO_GO';
  report.note = 'Read-only public health check only. This NEVER verifies live EYRA generation, contact inbox delivery, private data isolation, payments or readiness for external pilots.';
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expectedSha = process.argv[2] || process.env.EYLO_EXPECTED_SHA;
  try {
    const result = await checkHostedRelease({ expectedSha });
    console.log(JSON.stringify(result,null,2));
    if (result.decision !== 'PUBLIC_PROVENANCE_VERIFIED') process.exitCode = 1;
  } catch {
    console.error('Hosted release probe failed safely. Supply an exact reviewed commit SHA.');
    process.exitCode = 1;
  }
}
