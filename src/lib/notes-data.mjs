export function normalizeNoteInput(input = {}) {
  const title = String(input.title || '').trim();
  const notebook = String(input.notebook || '').trim();
  const content = String(input.content || '');
  const tags = [...new Set((Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(','))
    .map(tag => String(tag).trim().replace(/^#/, '').slice(0, 40))
    .filter(Boolean))].slice(0, 20);
  if (!title || title.length > 200) throw new Error('Title must contain 1–200 characters.');
  if (!notebook || notebook.length > 100) throw new Error('Notebook must contain 1–100 characters.');
  if (content.length > 200_000) throw new Error('Note content must be under 200,000 characters.');
  return { title, notebook, content, tags };
}

export function filterNotes(notes, query = '', notebook = 'All notebooks') {
  const needle = String(query).trim().toLocaleLowerCase();
  return (notes || []).filter(note => (notebook === 'All notebooks' || note.notebook === notebook)
    && (!needle || [note.title, note.content, note.notebook, ...(note.tags || [])]
      .join(' ').toLocaleLowerCase().includes(needle)));
}

export function exportNoteMarkdown(note) {
  const normalized = normalizeNoteInput(note);
  return `# ${normalized.title}\n\n_Notebook: ${normalized.notebook}_\n\n${normalized.tags.length ? `Tags: ${normalized.tags.map(tag => `\`${tag}\``).join(', ')}\n\n` : ''}${normalized.content}\n`;
}
