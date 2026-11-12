export const LIFE_TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);
export const LIFE_TASK_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);

function text(value, max, name, required = false) {
  const result = String(value ?? '').trim();
  if (required && !result) {
    throw Object.assign(new Error(`${name} is required.`), { code: 'LIFE_TASK_VALIDATION' });
  }
  if (result.length > max) {
    throw Object.assign(new Error(`${name} must be ${max} characters or fewer.`), { code: 'LIFE_TASK_VALIDATION' });
  }
  return result;
}

export function normalizeLifeTask(input = {}) {
  const title = text(input.title, 160, 'Title', true);
  const description = text(input.description, 5000, 'Description');
  const status = LIFE_TASK_STATUSES.includes(input.status) ? input.status : 'todo';
  const priority = LIFE_TASK_PRIORITIES.includes(input.priority) ? input.priority : 'normal';
  const dueDate = text(input.due_date, 10, 'Due date');
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))
    || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate)) {
    throw Object.assign(new Error('Due date must be a valid calendar date.'), { code: 'LIFE_TASK_VALIDATION' });
  }
  const projectId = text(input.project_id, 64, 'Project ID');
  return {
    title,
    description,
    status,
    priority,
    due_date: dueDate || null,
    project_id: projectId || null,
  };
}

export function isOverdueLifeTask(task, today = new Date().toISOString().slice(0, 10)) {
  return task.status !== 'done' && Boolean(task.due_date) && task.due_date < today;
}

export function sortLifeTasks(tasks) {
  const statusOrder = { in_progress: 0, todo: 1, done: 2 };
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  return [...tasks].sort((left, right) => {
    const date = (left.due_date || '9999-12-31').localeCompare(right.due_date || '9999-12-31');
    if (date) return date;
    const priority = (priorityOrder[left.priority] ?? 2) - (priorityOrder[right.priority] ?? 2);
    if (priority) return priority;
    const status = (statusOrder[left.status] ?? 1) - (statusOrder[right.status] ?? 1);
    if (status) return status;
    return String(right.updated_date || '').localeCompare(String(left.updated_date || ''));
  });
}
