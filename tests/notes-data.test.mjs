import test from 'node:test';
import assert from 'node:assert/strict';
import { exportNoteMarkdown, filterNotes, normalizeNoteInput } from '../src/lib/notes-data.mjs';

test('note input is normalized, deduplicated, and bounded', () => {
  assert.deepEqual(normalizeNoteInput({ title: '  Draft ', notebook: ' Lab ', content: 'x', tags: ' #methods, methods, data ' }), {
    title: 'Draft', notebook: 'Lab', content: 'x', tags: ['methods', 'data'],
  });
});

test('note input rejects invalid title, notebook, and oversized content', () => {
  assert.throws(() => normalizeNoteInput({ title: '', notebook: 'Personal' }), /Title/);
  assert.throws(() => normalizeNoteInput({ title: 'A', notebook: ' ' }), /Notebook/);
  assert.throws(() => normalizeNoteInput({ title: 'A', notebook: 'Personal', content: 'x'.repeat(200001) }), /200,000/);
});

test('note search filters case-insensitively over text, tags, and notebook', () => {
  const notes = [
    { title: 'Methods plan', content: 'sampling', notebook: 'Thesis', tags: ['review'] },
    { title: 'Meeting', content: 'agenda', notebook: 'Lab', tags: ['methods'] },
  ];
  assert.deepEqual(filterNotes(notes, 'SAMPLING').map(note => note.title), ['Methods plan']);
  assert.deepEqual(filterNotes(notes, 'methods').map(note => note.title), ['Methods plan', 'Meeting']);
  assert.deepEqual(filterNotes(notes, '', 'Lab').map(note => note.title), ['Meeting']);
});

test('Markdown export includes real note content and metadata', () => {
  assert.equal(exportNoteMarkdown({ title: 'Plan', notebook: 'Thesis', tags: ['methods'], content: '## Sampling' }),
    '# Plan\n\n_Notebook: Thesis_\n\nTags: `methods`\n\n## Sampling\n');
});
