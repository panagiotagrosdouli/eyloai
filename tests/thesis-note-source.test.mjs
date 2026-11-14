import test from 'node:test';
import assert from 'node:assert/strict';
import { loadThesisNoteSource } from '../src/lib/thesis-note-source.mjs';
import { assertThesisNotes, blankChapter, blankThesis, thesisMarkdown, validateThesis } from '../src/lib/thesis-outline.mjs';
const id = '30000000-0000-4000-8000-000000000001';
const chapter = { ...blankChapter(), title: 'Methods', note_id: id, note_version: 1 };
const current = { id, title: 'Current title', content: 'Later revised content', version: 2, project_id: 'project-a' };
const history = { id: 'history-id', user_id: 'owner-a', note_id: id, version: 1, snapshot: { title: 'Original methods', content: 'Original saved source', project_id: 'project-a', id: 'spoofed-id', user_id: 'spoofed-owner', version: 999 }, created_date: '2026-11-14T00:00:00Z' };
const args = repository => ({ repository, chapter, projectId: 'project-a', ownerId: 'owner-a' });
test('a pinned chapter uses the exact canonical history, never new content or snapshot metadata overrides', async () => {
  const calls = [];
  const result = await loadThesisNoteSource(args({ get: async (...a) => { calls.push(a); return current; }, getVersion: async (...a) => { calls.push(a); return history; } }));
  assert.deepEqual(calls, [[id, 'owner-a'], [id, 1, 'owner-a']]);
  assert.equal(result.current.content, current.content);
  assert.equal(result.source.id, id); assert.equal(result.source.version, 1);
  assert.equal(result.source.content, 'Original saved source'); assert.equal(result.source.updated_date, '');
  const doc = { ...blankThesis(), chapters: [chapter] };
  const md = thesisMarkdown(doc, { [id]: result.source }, 'project-a');
  assert.match(md, /pinned version 1/); assert.match(md, /Original saved source/); assert.doesNotMatch(md, /Later revised content/);
});
test('legacy latest chapters and current-version pins do not request history', async () => {
  const repository = { get: async () => current, getVersion: async () => { throw new Error('should not call'); } };
  for (const note_version of [undefined, null, 2]) {
    const result = await loadThesisNoteSource({ ...args(repository), chapter: { ...chapter, note_version } });
    assert.equal(result.source, current);
  }
});
test('pruned, unavailable, foreign-owner, wrong-note or cross-project history cannot fall back to latest', async () => {
  for (const row of [null, { ...history, user_id: 'owner-b' }, { ...history, note_id: 'other' }, { ...history, version: 3 }, { ...history, snapshot: { ...history.snapshot, project_id: 'project-b' } }, { ...history, snapshot: { content: 5 } }]) {
    const result = await loadThesisNoteSource(args({ get: async () => current, getVersion: async () => row }));
    assert.equal(result.source, null); assert.equal(result.current, current);
    assert.throws(() => assertThesisNotes({ ...blankThesis(), chapters: [chapter] }, { [id]: result.source }, 'project-a'), /unavailable/);
  }
  const result = await loadThesisNoteSource(args({ get: async () => current, getVersion: async () => { throw new Error('private detail'); } }));
  assert.equal(result.source, null);
});
test('deleted, mismatched and moved current Notes cannot authorize historical content', async () => {
  for (const value of [null, { ...current, id: 'other' }, { ...current, project_id: 'project-b' }]) {
    let calls = 0;
    await assert.rejects(loadThesisNoteSource(args({ get: async () => value, getVersion: async () => { calls++; return history; } })), /unavailable/);
    assert.equal(calls, 0);
  }
});
test('outline pins require an exact positive integer version and cannot compile a mismatched source', () => {
  for (const note_version of [0, -1, 1.5, '1', 2147483648]) assert.throws(() => validateThesis({ ...blankThesis(), chapters: [{ ...chapter, note_version }] }), /pin/);
  assert.throws(() => validateThesis({ ...blankThesis(), chapters: [{ ...chapter, note_id: '' }] }), /pin/);
  assert.throws(() => thesisMarkdown({ ...blankThesis(), chapters: [chapter] }, { [id]: current }, 'project-a'), /unavailable/);
});
