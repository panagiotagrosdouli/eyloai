import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/i;

export function stampReleaseManifest(manifestPath, commit) {
  if (!SHA_PATTERN.test(String(commit || ''))) {
    throw new Error('Release commit must be a 40-character Git SHA');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
      typeof manifest.release !== 'string' || !manifest.release.trim()) {
    throw new Error('Release manifest is missing its release identifier');
  }

  manifest.git_commit = commit.toLowerCase();
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function run() {
  // On Vercel, accept only Vercel's Git integration metadata. Falling back to
  // an unrelated GITHUB_SHA in a Vercel build could stamp the wrong release.
  const commit = process.env.VERCEL === '1'
    ? process.env.VERCEL_GIT_COMMIT_SHA
    : process.env.GITHUB_SHA;
  if (!commit) {
    if (process.env.VERCEL === '1') {
      throw new Error('VERCEL_GIT_COMMIT_SHA is required to build a verifiable production artifact');
    }
    console.log('Release commit is unavailable; leaving the local manifest unstamped.');
    return;
  }

  const manifestPath = path.resolve('dist/release.json');
  stampReleaseManifest(manifestPath, commit);
  console.log(`Stamped release manifest with ${commit.toLowerCase()}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
