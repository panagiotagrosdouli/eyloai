import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8');

function methodBody(start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a !== -1 && b !== -1, `Cannot locate entity method boundary: ${start}`);
  return source.slice(a, b);
}

test('entity list and filter queries require the authenticated owner', () => {
  const list = methodBody('async list(', 'async filter(');
  const filter = methodBody('async filter(', 'async get(');
  for (const [name, body] of [['list', list], ['filter', filter]]) {
    assert.match(body, /await currentUser\(\)/, `${name} must authenticate`);
    assert.match(body, /\.eq\('user_id', user\.id\)/, `${name} must filter by owner`);
  }
});

test('entity read, update, and delete queries require the authenticated owner', () => {
  const get = methodBody('async get(', 'async create(');
  const update = methodBody('async update(', 'async delete(');
  const del = methodBody('async delete(', '\n  };');
  for (const [name, body] of [['get', get], ['update', update], ['delete', del]]) {
    assert.match(body, /await currentUser\(\)/, `${name} must authenticate`);
    assert.match(body, /\.eq\('user_id', user\.id\)/, `${name} must filter by owner`);
  }
  assert.match(del, /!data\?\.some\(row => row\.id === entityId\)/,
    'Deletion must fail if the database did not delete the requested record');
});

test('entity creation derives owner from validated session, not caller payload', () => {
  const create = methodBody('async create(', 'async update(');
  assert.match(create, /await currentUser\(\)/);
  assert.match(create, /splitPayload\(payload\)/);
  assert.match(create, /insert\(\{ user_id: user\.id, \.\.\.write \}\)/);
});
