import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('activity history migration records minimal metadata for core workspace tables', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261112181000_eylo_activity_history.sql', import.meta.url), 'utf8');
  for (const table of ['notes', 'life_tasks', 'life_goals', 'study_flashcard_decks', 'calendar_events', 'projects']) {
    assert.match(migration, new RegExp(`capture_activity_.* on public\\.${table}`, 'i'));
  }
  assert.match(migration, /'entity_label', entity_label/);
  assert.doesNotMatch(migration, /'content'\s*,\s*record_data/i);
});

test('activity history is owner-readable and supports explicit owner-controlled clearing', async () => {
  const migration = await readFile(new URL('../supabase/migrations/20261112181000_eylo_activity_history.sql', import.meta.url), 'utf8');
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /auth\.uid\(\)\) = user_id/);
  assert.match(migration, /revoke all on public\.activity_events from anon, authenticated/);
  assert.match(migration, /create policy "Users clear own activity" on public\.activity_events for delete to authenticated/i);
  assert.match(migration, /grant select, delete on public\.activity_events to authenticated/i);
  assert.match(migration, /old\.data is not distinct from new\.data/i);
});

test('activity history route is protected and maps a read-only event repository', async () => {
  const [app, repository, page] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/ActivityHistory.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*<Route path="\/activity" element=\{<ActivityHistory \/>\}/);
  assert.match(repository, /ActivityEvent: \{ table: 'activity_events' \}/);
  assert.match(page, /content is not copied into the history/i);
  assert.match(page, /ActivityEvent\.list/);
});

