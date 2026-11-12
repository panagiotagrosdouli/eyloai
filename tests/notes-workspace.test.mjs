import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeNote, normalizeNoteTags, noteMatchesTag, noteToMarkdown,
} from '../src/lib/notes-domain.mjs';
import { splitPayload } from '../src/services/entity-serialization.js';

const migration = readFileSync(new URL('../supabase/migrations/20261112154425_private_notes.sql', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/services/supabase-entities.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/pages/Notes.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('note normalization trims the title, bounds content and normalizes project links', () => {
  assert.deepEqual(normalizeNote({ title: '  Field notes  ', content: 'raw notes', project_id: '' }), {
    title: 'Field notes', content: 'raw notes', tags: [], project_id: null,
  });
  assert.throws(() => normalizeNote({ title: '', content: '' }), error => error.code === 'NOTE_VALIDATION');
  assert.throws(() => normalizeNote({ title: 'x'.repeat(201), content: '' }), error => error.code === 'NOTE_VALIDATION');
  assert.throws(() => normalizeNote({ title: 'long', content: 'x'.repeat(100_001) }), error => error.code === 'NOTE_VALIDATION');
});

test('note tags are bounded, case-insensitively deduplicated and searchable as exact tags', () => {
  assert.deepEqual(normalizeNoteTags('Methods, reading, methods, , DATA'), ['Methods', 'reading', 'DATA']);
  assert.equal(noteMatchesTag({ tags: ['Methods'] }, 'methods'), true);
  assert.equal(noteMatchesTag({ tags: ['Methods'] }, 'method'), false);
  assert.throws(() => normalizeNoteTags(Array.from({ length: 31 }, (_, index) => `tag${index}`)), error => error.code === 'NOTE_VALIDATION');
  assert.throws(() => normalizeNoteTags(['x'.repeat(41)]), error => error.code === 'NOTE_VALIDATION');
});

test('Markdown export preserves note text and includes tags and project provenance', () => {
  assert.equal(noteToMarkdown({
    title: 'Study plan', content: 'First line\nSecond line', tags: ['methods'], project_title: 'Climate study',
  }), '# Study plan\n\nProject: Climate study\nTags: methods\n\nFirst line\nSecond line\n');
});

test('database migration enforces private notes, owned project links, full text and bounded history', () => {
  assert.match(migration, /alter table public\.notes enable row level security/i);
  assert.match(migration, /revoke all on schema private from public, anon, authenticated/i);
  assert.match(migration, /auth\.uid\(\).*user_id/i);
  assert.match(migration, /notes_search_idx[\s\S]*to_tsvector\('simple'/i);
  assert.match(migration, /p\.id = project_text::uuid and p\.user_id = new\.user_id/i);
  assert.match(migration, /auth\.uid\(\)[\s\S]*is distinct from new\.user_id/i);
  assert.match(migration, /insert into public\.note_versions/i);
  assert.match(migration, /old\.version - 50/i);
  assert.match(migration, /projects_unlink_deleted_notes after delete on public\.projects/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /grant execute on function public\.search_notes\(text, integer\) to authenticated/i);
  assert.match(migration, /revoke insert, update, delete on public\.note_versions/i);
  assert.match(migration, /create or replace function private\.capture_note_version\(\)[\s\S]*security definer/i);
  assert.match(migration, /revoke all on function private\.capture_note_version\(\) from public, anon, authenticated/i);
});

test('authenticated Notes repository uses the private search RPC and owner-scoped version reads', () => {
  assert.match(repository, /Note: \{ table: 'notes' \}/);
  assert.match(repository, /rpc\('search_notes'/);
  assert.match(repository, /from\('note_versions'\)[\s\S]*\.eq\('user_id', user\.id\)/);
  assert.match(repository, /updateIfUnchanged\(entityId, patch, expectedUpdatedDate\)/);
  assert.deepEqual(splitPayload({ title: 'Example', version: 99 }), { data: { title: 'Example' } });
});

test('Notes page exposes saved CRUD, project links, full-text search, history and export', () => {
  assert.match(page, /base44\.entities\.Note\.create/);
  assert.match(page, /base44\.entities\.Note\.updateIfUnchanged/);
  assert.match(page, /base44\.entities\.Note\.delete/);
  assert.match(page, /base44\.entities\.Note\.search/);
  assert.match(page, /base44\.entities\.Note\.versions/);
  assert.match(page, /Export Markdown/);
  assert.match(page, /Link to a project/);
  assert.match(page, /ownerRef\.current = user\?\.id \|\| null/);
  assert.match(app, /path="\/notes" element=\{<Notes \/>\}/);
});
