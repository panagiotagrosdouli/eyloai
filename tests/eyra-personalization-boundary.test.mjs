import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/eyra/EyraCommandCenter.jsx', import.meta.url), 'utf8');

test('EYRA personalization opt-out prevents private workspace fetch, not just model context use', () => {
  const guard = source.indexOf('if (!preferences.data_personalization) {');
  const load = source.indexOf('    buildUserProfile()', guard);
  assert.ok(guard >= 0 && load > guard);
  const guarded = source.slice(guard, load);
  assert.match(guarded, /setWorkspaceContext\(''\)/);
  assert.match(guarded, /setContextStatus\('disabled'\)/);
  assert.match(guarded, /return undefined/);
});

test('late private profile reads do not repopulate context after opt-out or closing EYRA', () => {
  assert.match(source, /let current = true/);
  assert.match(source, /\.then\(\(profile\) => \{\s*if \(!current\) return;/);
  assert.match(source, /\.catch\(\(\) => \{\s*if \(!current\) return;/);
  assert.match(source, /return \(\) => \{ current = false; \}/);
  assert.match(source, /\[open, preferences\.data_personalization\]/);
});

test('model prompt remains explicitly governed by workspace personalization preference', () => {
  assert.match(source, /preferences\.data_personalization\s*\? \(workspaceContext/);
  assert.match(source, /'Personalization is disabled\. Do not use workspace activity\.'/);
});
