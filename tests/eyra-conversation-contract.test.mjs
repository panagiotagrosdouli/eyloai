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

test('EYRA uses account-scoped session state and the canonical conversation contract', () => {
  assert.match(commandCenter, /eyraConversationKey\(user\?\.id\)/);
  assert.match(commandCenter, /saveEyraConversation/);
  assert.doesNotMatch(commandCenter, /source: 'eyra_conversation'/);
  const history = read('../src/lib/eyra-history.js');
  assert.match(history, /from\('eyra_conversations'\)/);
  assert.match(history, /save_eyra_conversation_snapshot/);
  assert.doesNotMatch(history, /Idea/);
});

test('canonical entity reads remain owner-filtered and do not authorize conversation reads', () => {
  const list = entities.slice(entities.indexOf('async list('), entities.indexOf('async filter('));
  const get = entities.slice(entities.indexOf('async get('), entities.indexOf('async create('));
  for (const query of [list, get]) {
    assert.match(query, /await currentUser\(\)/);
    assert.match(query, /\.eq\('user_id', user\.id\)/);
  }
});
