export const THESIS_STATUSES = ['planned', 'writing', 'review', 'complete'];
export const blankThesis = () => ({ version: 1, title: '', chapters: [] });
export const blankChapter = () => ({ id: crypto.randomUUID(), title: '', target_words: 1000, status: 'planned', note_id: '', guidance: '' });
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validateThesis(outline) {
  if (!outline || outline.version !== 1 || typeof outline.title !== 'string' || outline.title.length > 200 || !Array.isArray(outline.chapters) || outline.chapters.length > 50) throw new Error('Unsupported thesis format or chapter limit.');
  const ids = new Set(), notes = new Set();
  for (const row of outline.chapters) {
    if (!row || !uuid(row.id) || ids.has(row.id) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 160 || typeof row.guidance !== 'string' || row.guidance.length > 3000 || !Number.isInteger(row.target_words) || row.target_words < 0 || row.target_words > 100000 || !THESIS_STATUSES.includes(row.status)) throw new Error('Each chapter needs a unique ID, title, valid status and target between 0 and 100000 words.');
    ids.add(row.id);
    if (row.note_id !== '' && (!uuid(row.note_id) || notes.has(row.note_id))) throw new Error('Link each authorized note to only one chapter.');
    if (row.note_id) notes.add(row.note_id);
    if (row.status === 'complete' && !row.note_id) throw new Error('Link a saved note before completing a chapter.');
  }
  if (new TextEncoder().encode(JSON.stringify(outline)).length > 262144) throw new Error('Thesis outline exceeds the 256 KiB workspace limit.');
  return outline;
}
export function readThesis(project) { return validateThesis(project.thesis_outline ?? blankThesis()); }
export function whitespaceWordCount(content) { return typeof content === 'string' && content.trim() ? content.trim().split(/\s+/u).length : 0; }
export function thesisProgress(outline, notes, projectId) {
  validateThesis(outline); let words = 0, target = 0, complete = 0; const unavailable = [];
  for (const chapter of outline.chapters) {
    target += chapter.target_words;
    const note = chapter.note_id ? notes[chapter.note_id] : null;
    if (chapter.note_id && (!note || note.id !== chapter.note_id || typeof note.content !== 'string' || note.content.length > 100000 || (note.project_id && note.project_id !== projectId))) { unavailable.push(chapter.id); continue; }
    const count = whitespaceWordCount(note?.content); words += count;
    if (chapter.status === 'complete' && count > 0) complete += 1;
  }
  return { words, target, complete, chapters: outline.chapters.length, unavailable };
}
export function assertThesisNotes(outline, notes, projectId) {
  const progress = thesisProgress(outline, notes, projectId);
  if (progress.unavailable.length) throw new Error('A linked note is unavailable or belongs to another project. Refresh notes and review chapter links.');
  for (const chapter of outline.chapters) if (chapter.status === 'complete' && !whitespaceWordCount(notes[chapter.note_id]?.content)) throw new Error('A complete chapter must have nonempty saved note content.');
  return progress;
}
export function thesisMarkdown(outline, notes, projectId) {
  assertThesisNotes(outline, notes, projectId);
  return `# ${outline.title || 'Thesis draft'}\n\nPrivate draft compiled from saved canonical Notes. Chapter statuses are user-reported; word counts use whitespace. This export does not verify citations or academic acceptance.\n\n` + outline.chapters.map(row => `## ${row.title}\n\nStatus: ${row.status}; target: ${row.target_words} words\n\n${row.guidance ? `Chapter guidance: ${row.guidance}\n\n` : ''}${row.note_id ? `Saved note: ${notes[row.note_id].title || 'Untitled note'} (${row.note_id}); updated ${notes[row.note_id].updated_date || 'unknown'}\n\n${notes[row.note_id].content}` : '[No saved note linked]'}\n`).join('\n');
}
export function thesisComparison(outline) {
  validateThesis(outline);
  return [outline.title || 'Untitled thesis', ...outline.chapters.map(row => `${row.title} | ${row.status} | target ${row.target_words} words\nLinked note: ${row.note_id || 'none'}\n${row.guidance}`)].join('\n\n');
}
