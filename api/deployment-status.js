import { applyCors } from '../src/lib/api-cors.mjs';

// Public, read-only release provenance. No environment secrets are disclosed.
export default function handler(request, response) {
  if (applyCors(request, response, ['GET'])) return;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const commit = String(process.env.VERCEL_GIT_COMMIT_SHA || '');
  const environment = String(process.env.VERCEL_ENV || '');
  const validCommit = /^[a-f0-9]{40}$/i.test(commit);

  return response.status(200).json({
    deployment_sha: validCommit ? commit : null,
    environment: ['production', 'preview', 'development'].includes(environment) ? environment : 'unknown',
    provenance_verified: validCommit,
    note: validCommit
      ? 'Deployment commit identity reported by Vercel. This does not prove backend functionality.'
      : 'Deployment commit identity is unavailable; release provenance has not been verified.',
  });
}
