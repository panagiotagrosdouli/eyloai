import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const core = read('../supabase/migrations/20260803_eylo_core_entities.sql');
const ideas = read('../src/pages/IdeaVault.jsx');
const commandCenter = read('../src/components/eyra/EyraCommandCenter.jsx');
const entities = read('../src/services/supabase-entities.js');

test('canonical Ideas records retain their dedicated product semantics', () => {
  assert.match(core, /'projects','ideas','meetings','saved_papers'/);
  assert.match(core, /create policy "Users manage own rows"[\s\S]*?authenticated using \(\(select auth\.uid\(\)\) = user_id\)/);
  assert.match(ideas, /base44\.entities\.Idea\.list/);
  assert.match(ideas, /base44\.entities\.Idea\.create/);
  assert.match(ideas, /base44\.entities\.Idea\.update/);
  assert.match(ideas, /base44\.entities\.Idea\.delete/);
  assert.match(ideas, /monitoringStore\.addWatchlist/);
});

test('EYRA browser session messages are not misrepresented as server-backed history', () => {
  assert.match(commandCenter, /sessionStorage\.getItem\('eyra_command_conversation_v2'\)/);
  assert.match(commandCenter, /sessionStorage\.setItem\('eyra_command_conversation_v2'/);
  assert.match(commandCenter, /messages\.slice\(-30\)/);
  assert.doesNotMatch(entities, /Conversation:\s*\{\s*table:/);
});

test('canonical entity reads remain owner-filtered and do not authorize conversation reads', () => {
  const list = entities.slice(entities.indexOf('async list('), entities.indexOf('async filter('));
  const get = entities.slice(entities.indexOf('async get('), entities.indexOf('async create('));
  for (const query of [list, get]) {
    assert.match(query, /await currentUser\(\)/);
    assert.match(query, /\.eq\('user_id', user\.id\)/);
  }
});
