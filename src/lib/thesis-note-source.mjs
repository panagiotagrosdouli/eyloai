/** Resolve canonical Notes/history only; an unavailable pin never follows latest. */
export async function loadThesisNoteSource({ repository, chapter, projectId, ownerId }) {
  if (!ownerId || !chapter.note_id) throw new Error('The linked Note source is unavailable.');
  const current = await repository.get(chapter.note_id, ownerId);
  if (current?.id !== chapter.note_id || (current.project_id && current.project_id !== projectId)) throw new Error('The linked Note source is unavailable.');
  if (chapter.note_version == null || current.version === chapter.note_version) return { current, source: current };
  let row;
  try { row = await repository.getVersion(chapter.note_id, chapter.note_version, ownerId); } catch { return { current, source: null }; }
  if (row?.note_id !== chapter.note_id || row?.version !== chapter.note_version || row?.user_id !== ownerId) return { current, source: null };
  const snapshot = row?.snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || typeof snapshot.content !== 'string' || snapshot.content.length > 100000 || (snapshot.project_id && snapshot.project_id !== projectId)) return { current, source: null };
  return { current, source: { id: current.id, title: typeof snapshot.title === 'string' ? snapshot.title : '', content: snapshot.content, project_id: snapshot.project_id || '', version: row.version, updated_date: '', archived_date: row.created_date || '' } };
}
