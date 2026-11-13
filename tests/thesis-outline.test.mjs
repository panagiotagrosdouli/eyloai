import test from 'node:test';
import assert from 'node:assert/strict';
import { blankChapter, blankThesis, validateThesis, readThesis, whitespaceWordCount, thesisProgress, assertThesisNotes, thesisMarkdown } from '../src/lib/thesis-outline.mjs';
const noteId = '30000000-0000-4000-8000-000000000001';
const chapter = patch => ({ ...blankChapter(), title: 'Introduction', ...patch });
const outline = rows => ({ ...blankThesis(), title: 'Thesis fixture', chapters: rows });
test('thesis links canonical notes, counts saved content and requires real content for complete status', () => {
 const doc = outline([chapter({ note_id: noteId, target_words: 100, status: 'complete' }), chapter({ target_words: 50 })]);
 const notes = { [noteId]: { id: noteId, content: '  Two\n saved words\t here. ', project_id: 'project-A' } };
 assert.equal(whitespaceWordCount(''), 0); assert.equal(whitespaceWordCount(notes[noteId].content), 4);
 assert.deepEqual(thesisProgress(doc, notes, 'project-A'), { words: 4, target: 150, complete: 1, chapters: 2, unavailable: [] });
 assert.throws(() => assertThesisNotes(doc, { [noteId]: { ...notes[noteId], content: ' ' } }, 'project-A'), /nonempty/);
});
test('missing or cross-project note links cannot produce a successful compile or complete progress', () => {
 const doc = outline([chapter({ note_id: noteId, status: 'complete' })]);
 for (const notes of [{}, { [noteId]: { id: noteId, content: { invalid: true } } }, { [noteId]: { id: noteId, content: 'private', project_id: 'project-B' } }, { [noteId]: { id: 'wrong', content: 'wrong' } }]) {
  assert.equal(thesisProgress(doc, notes, 'project-A').complete, 0);
  assert.throws(() => thesisMarkdown(doc, notes, 'project-A'), /unavailable/);
 }
});
test('outline validates IDs, targets, statuses, duplicate note usage and resource limits', () => {
 assert.deepEqual(readThesis({}), blankThesis());
 for (const patch of [{ target_words: 1.5 }, { target_words: -1 }, { target_words: 100001 }, { title: '' }, { status: 'verified' }, { status: 'complete' }, { note_id: 'bad' }]) assert.throws(() => validateThesis(outline([chapter(patch)])));
 const row = chapter({ note_id: noteId });
 for (const rows of [[row,row], [row,chapter({ note_id: noteId })], Array.from({ length: 51 }, () => chapter())]) assert.throws(() => validateThesis(outline(rows)));
 assert.throws(() => readThesis({ thesis_outline: { version: 2, chapters: [] } }));
});
test('compiled draft follows chapter order and exports saved Notes without inventing source content', () => {
 const doc = outline([chapter({ title: 'Methods', note_id: noteId }), chapter({ title: 'Discussion' })]);
 const md = thesisMarkdown(doc, { [noteId]: { id: noteId, title: 'Canonical methods', content: 'User authored methods.', updated_date: '2026-11-13' } }, 'project-A');
 assert.ok(md.indexOf('## Methods') < md.indexOf('## Discussion'));
 assert.match(md, /User authored methods\./); assert.match(md, /No saved note linked/); assert.match(md, /does not verify citations/);
 assert.equal(doc.chapters.length, 2);
});

test('canonical PostgreSQL note UUIDs do not require a generated UUID version nibble', () => {
 const legacyId = '30000000-0000-0000-0000-000000000001';
 const doc = outline([chapter({ note_id: legacyId, status: 'complete' })]);
 assert.doesNotThrow(() => assertThesisNotes(doc, { [legacyId]: { id: legacyId, content: 'Canonical existing content' } }, 'project-A'));
});
