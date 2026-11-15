import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onboarding = readFileSync(new URL('../src/components/dashboard/GoalOnboarding.jsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/components/dashboard/EyraHome.jsx', import.meta.url), 'utf8');

test('onboarding exposes four optional goal-based paths without gating other tools', () => {
  for (const label of ['Student', 'Researcher', 'Research team', 'Exploring EYLO']) {
    assert.ok(onboarding.includes("label: '" + label + "'"), label + ' remains selectable');
  }
  for (const route of ['/study-planner', '/flashcards', '/search', '/literature-review', '/projects', '/researchers', '/tools']) {
    assert.ok(onboarding.includes("path: '" + route + "'"), route + ' is a real destination');
  }
  assert.match(onboarding, /Your other tools remain available/);
  assert.match(onboarding, /onClick=\{skip\}/);
  assert.match(onboarding, /aria-pressed=\{selected === option\.id\}/);
});

test('onboarding is shown inline only after actual profile load and never writes user records', () => {
  assert.match(home, /loaded && !profileError && <GoalOnboarding/);
  assert.match(home, /existingRole=\{userType\}/);
  assert.doesNotMatch(onboarding, /base44|updateMe|\.create\(|\.delete\(/);
  assert.match(onboarding, /localStorage\.setItem/);
  assert.match(onboarding, /state === 'checking' \|\| state === 'hidden'/);
});
