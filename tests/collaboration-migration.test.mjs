import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/20261107120000_collaboration_posts.sql', import.meta.url), 'utf8',
);
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8');

test('collaboration listings require authentication and keep writes owner-scoped in RLS', () => {
  assert.match(migration, /alter table public\.collaboration_posts enable row level security/i);
  assert.match(migration, /create policy "Read open collaboration postings" on public\.collaboration_posts for select to authenticated/i);
  assert.match(migration, /owner_id = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /create policy "Create own collaboration postings" on public\.collaboration_posts for insert to authenticated[\s\S]*?with check \(owner_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(migration, /create policy "Update own collaboration postings" on public\.collaboration_posts for update to authenticated[\s\S]*?using \(owner_id = \(select auth\.uid\(\)\)\) with check \(owner_id = \(select auth\.uid\(\)\)\)/i);
  assert.match(migration, /create policy "Delete own collaboration postings" on public\.collaboration_posts for delete to authenticated[\s\S]*?using \(owner_id = \(select auth\.uid\(\)\)\)/i);
  assert.doesNotMatch(migration, /to anon\b|grant [^;]*\banon\b/i);
});

test('collaboration board is mounted inside protected workspace navigation', () => {
  assert.match(app, /<Route element=\{<ProtectedRoute \/>\}>[\s\S]*?<Route path="\/collaborations" element=\{<Collaborations \/>\} \/>/);
  assert.match(layout, /label: 'Collaborations', path: '\/collaborations'/);
});
