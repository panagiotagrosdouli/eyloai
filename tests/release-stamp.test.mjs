import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stampReleaseManifest } from '../scripts/stamp-release.mjs';

test('release stamping records the build SHA and preserves existing manifest fields', () => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), 'test-tmp-eylo-release-'));
  const manifestPath = path.join(directory, 'release.json');
  const commit = 'A'.repeat(40);
  fs.writeFileSync(manifestPath, JSON.stringify({ release: 'release-1', includes: ['discovery'] }));

  try {
    const stamped = stampReleaseManifest(manifestPath, commit);
    assert.equal(stamped.git_commit, commit.toLowerCase());
    assert.equal(stamped.release, 'release-1');
    assert.deepEqual(stamped.includes, ['discovery']);
    assert.deepEqual(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), stamped);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('release stamping rejects malformed commit identities', () => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), 'test-tmp-eylo-release-'));
  const manifestPath = path.join(directory, 'release.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ release: 'release-1' }));

  try {
    assert.throws(() => stampReleaseManifest(manifestPath, 'not-a-sha'), /40-character Git SHA/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('Vercel builds require Vercel Git metadata and do not borrow GITHUB_SHA', () => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), 'test-tmp-eylo-release-'));
  const manifestPath = path.join(directory, 'dist', 'release.json');
  fs.mkdirSync(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, JSON.stringify({ release: 'release-1' }));
  const before = fs.readFileSync(manifestPath, 'utf8');
  const result = spawnSync(process.execPath, [new URL('../scripts/stamp-release.mjs', import.meta.url).pathname], {
    cwd: directory,
    env: { ...process.env, VERCEL: '1', VERCEL_GIT_COMMIT_SHA: '', GITHUB_SHA: 'a'.repeat(40) },
    encoding: 'utf8',
  });

  try {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /VERCEL_GIT_COMMIT_SHA is required/);
    assert.equal(fs.readFileSync(manifestPath, 'utf8'), before);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
