import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('core destructive meeting action does not use a native browser confirm dialog', () => {
  const detail = source('src/components/meetings/MeetingDetail.jsx');
  assert.doesNotMatch(detail, /\bwindow\.confirm\s*\(|\bconfirm\s*\(/);
  assert.match(detail, /AlertDialogTitle>Delete this meeting\?/);
});

test('pricing avoids unsourced popularity marketing', () => {
  const pricing = source('src/pages/Pricing.jsx');
  assert.doesNotMatch(pricing, /Most popular/i);
});

test('settings avoid unsupported reasoning, local-processing, and learning claims', () => {
  const settings = source('src/pages/Settings.jsx');
  assert.doesNotMatch(settings, /full reasoning/i);
  assert.doesNotMatch(settings, /processed locally/i);
  assert.doesNotMatch(settings, /learn from your activity/i);
});

test('profile stays professional instead of gamified', () => {
  const profile = source('src/pages/Profile.jsx');
  for (const badge of ['Grant Hunter', 'Power User', 'Knowledge Builder', 'First Discovery']) {
    assert.doesNotMatch(profile, new RegExp(badge, 'i'));
  }
  assert.match(profile, /Exact saved-item counts/);
});
