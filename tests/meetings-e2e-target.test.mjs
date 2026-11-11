import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMeetingsStagingTarget } from '../src/lib/meetings-e2e-target.mjs';

test('meeting E2E accepts only explicitly pinned HTTPS preview hostnames', () => {
  const url = validateMeetingsStagingTarget('https://eylo-preview-xyz.vercel.app/', 'eylo-preview-xyz.vercel.app');
  assert.equal(url.origin, 'https://eylo-preview-xyz.vercel.app');
});
test('meeting E2E refuses a missing or mismatched host authorization', () => {
  assert.throws(() => validateMeetingsStagingTarget('https://preview.example.org'), /required/);
  assert.throws(() => validateMeetingsStagingTarget('https://preview.example.org', 'other.example.org'), /non-production/);
});
test('meeting E2E refuses live EYLO, insecure origins and embedded credentials', () => {
  for (const url of [
    'https://eyloai.vercel.app/',
    'https://www.eyloai.vercel.app/',
    'https://eylo.ai/',
    'http://preview.example.org/',
    'https://user:secret@preview.example.org/',
    'https://preview.example.org/path',
    'https://preview.example.org/?q=secret',
    'https://localhost/',
  ]) {
    const host = new URL(url).hostname;
    assert.throws(() => validateMeetingsStagingTarget(url, host), /non-production/);
  }
});
