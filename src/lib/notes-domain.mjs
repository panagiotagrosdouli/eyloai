export const NOTE_LIMITS = Object.freeze({
  title: 200,
  content: 100_000,
  tags: 30,
  tag: 40,
});

function boundedString(value, limit, label, { required = false } = {}) {
  const normalized = String(value ?? '').trim();
  if (required && !normalized) {
    throw Object.assign(new Error(`${label} is required.`), { code: 'NOTE_VALIDATION' });
  }
  if (normalized.length > limit) {
    throw Object.assign(new Error(`${label} must be ${limit} characters or fewer.`), { code: 'NOTE_VALIDATION' });
  }
  return normalized;
}

export function normalizeNoteTags(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  const seen = new Set();
  const tags = [];
  for (const item of source) {
    const tag = boundedString(item, NOTE_LIMITS.tag, 'Each tag');
    if (!tag) continue;
    const identity = tag.toLowerCase();
    if (seen.has(identity)) continue;
    seen.add(identity);
    tags.push(tag);
    if (tags.length > NOTE_LIMITS.tags) {
      throw Object.assign(new Error(`A note can have at most ${NOTE_LIMITS.tags} tags.`), { code: 'NOTE_VALIDATION' });
    }
  }
  return tags;
}

export function normalizeNote(input = {}) {
  const title = boundedString(input.title, NOTE_LIMITS.title, 'Title', { required: true });
  const content = String(input.content ?? '');
  if (content.length > NOTE_LIMITS.content) {
    throw Object.assign(new Error(`Note content must be ${NOTE_LIMITS.content} characters or fewer.`), { code: 'NOTE_VALIDATION' });
  }
  const projectId = String(input.project_id ?? '').trim();
  return {
    title,
    content,
    tags: normalizeNoteTags(input.tags),
    project_id: projectId || null,
  };
}

export function noteMatchesTag(note, tag) {
  if (!tag) return true;
  return Array.isArray(note.tags) && note.tags.some(value => String(value).toLowerCase() === String(tag).toLowerCase());
}

export function noteToMarkdown(note) {
  const tags = normalizeNoteTags(note.tags);
  const project = String(note.project_title || '').trim();
  const updated = new Date(note.updated_date || '');
  const metadata = [
    !Number.isNaN(updated.getTime()) ? `Updated: ${updated.toISOString()}` : '',
    project ? `Project: ${project}` : '',
    tags.length ? `Tags: ${tags.join(', ')}` : '',
  ].filter(Boolean);
  return `# ${String(note.title || 'Untitled note').trim()}\n\n${metadata.length ? `${metadata.join('\n')}\n\n` : ''}${String(note.content || '')}\n`;
}
