const MAX_ITEMS = 100;
const MAX_TEXT = 500;
const STATUSES = new Set(['todo', 'in_progress', 'blocked', 'done']);

const cleanText = (value, limit = MAX_TEXT) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function normalizeWorkplan(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.slice(0, MAX_ITEMS).flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const id = cleanText(item.id, 80);
    const title = cleanText(item.title);
    if (!id || !title || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      title,
      deliverable: cleanText(item.deliverable),
      due_date: isDate(item.due_date) ? item.due_date : '',
      status: STATUSES.has(item.status) ? item.status : 'todo',
      depends_on: Array.isArray(item.depends_on) ? [...new Set(item.depends_on.map(value => cleanText(value, 80)).filter(Boolean))].slice(0, MAX_ITEMS) : [],
    }];
  }).map(item => ({ ...item, depends_on: item.depends_on.filter(dependency => seen.has(dependency)) }));
}

export function validateWorkplan(items) {
  const normalized = normalizeWorkplan(items);
  if (!Array.isArray(items) || items.length !== normalized.length) return { valid: false, message: 'Each task needs a unique ID and a title; at most 100 tasks are supported.' };
  const ids = new Set(normalized.map(item => item.id));
  const byId = new Map(normalized.map(item => [item.id, item]));
  for (const item of normalized) {
    if (Array.isArray(items.find(raw => raw?.id === item.id)?.depends_on) && items.find(raw => raw?.id === item.id).depends_on.some(dependency => !ids.has(dependency))) {
      return { valid: false, message: 'A dependency points to a task that is not in this workplan.' };
    }
    if (item.depends_on.includes(item.id)) return { valid: false, message: 'A task cannot depend on itself.' };
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of byId.get(id)?.depends_on || []) if (!visit(dependency)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if (normalized.some(item => !visit(item.id))) return { valid: false, message: 'Dependencies cannot form a cycle.' };
  return { valid: true, items: normalized };
}

export function getWorkplanProgress(items) {
  const normalized = normalizeWorkplan(items);
  const done = normalized.filter(item => item.status === 'done').length;
  return { total: normalized.length, done, percent: normalized.length ? Math.round(done * 100 / normalized.length) : 0 };
}

export function canStartWorkplanTask(task, items) {
  const byId = new Map(normalizeWorkplan(items).map(item => [item.id, item]));
  return (task?.depends_on || []).every(id => byId.get(id)?.status === 'done');
}
