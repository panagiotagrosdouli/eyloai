import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/pages/CollaborationTools.jsx', import.meta.url), 'utf8',
);

test('collaboration tools bind each workspace instance to the current account', () => {
  assert.match(source, /const \{ user \} = useAuth\(\)/);
  assert.match(source, /Object\.hasOwn\(TOOLS, tool\) && user\?\.id/);
  assert.match(source, /key=\{\x60\$\{tool\}\/\$\{user\.id\}\x60\}/);
  assert.match(source, /ownerId=\{user\.id\}/);
});

test('collaboration loader rejects an out-of-date session before querying private membership data', () => {
  const guard = source.indexOf('session.user.id !== ownerId');
  const tables = source.indexOf('const tables = [', guard);
  assert.ok(guard > 0 && tables > guard, 'owner guard must precede the first collaboration table read');
  assert.match(source, /\}, \[config, tool, ownerId\]\)/);
  assert.match(source, /alive\.current = false/);
});
