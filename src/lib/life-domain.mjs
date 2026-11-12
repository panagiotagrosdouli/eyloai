export const LIFE_TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);
export const LIFE_TASK_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);
export const LIFE_TASK_RECURRENCES = Object.freeze(['none', 'daily', 'weekly', 'monthly']);
export const LIFE_AREAS = Object.freeze(['personal', 'research', 'study', 'work']);
export const LIFE_TASK_KINDS = Object.freeze(['task', 'study', 'syllabus', 'exam']);

function text(value, max, name, required = false, code = 'LIFE_TASK_VALIDATION') {
  const result = String(value ?? '').trim();
  if (required && !result) {
    throw Object.assign(new Error(`${name} is required.`), { code });
  }
  if (result.length > max) {
    throw Object.assign(new Error(`${name} must be ${max} characters or fewer.`), { code });
  }
  return result;
}

export function normalizeLifeTask(input = {}) {
  const title = text(input.title, 160, 'Title', true);
  const description = text(input.description, 5000, 'Description');
  const status = LIFE_TASK_STATUSES.includes(input.status) ? input.status : 'todo';
  const priority = LIFE_TASK_PRIORITIES.includes(input.priority) ? input.priority : 'normal';
  const recurrence = LIFE_TASK_RECURRENCES.includes(input.recurrence) ? input.recurrence : 'none';
  const area = LIFE_AREAS.includes(input.area) ? input.area : 'personal';
  const kind = LIFE_TASK_KINDS.includes(input.kind) ? input.kind : 'task';
  const dueDate = text(input.due_date, 10, 'Due date');
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))
    || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate)) {
    throw Object.assign(new Error('Due date must be a valid calendar date.'), { code: 'LIFE_TASK_VALIDATION' });
  }
  if (recurrence !== 'none' && !dueDate) {
    throw Object.assign(new Error('A due date is required for a recurring task.'), { code: 'LIFE_TASK_VALIDATION' });
  }
  const projectId = text(input.project_id, 64, 'Project ID');
  return {
    title,
    description,
    status,
    priority,
    recurrence,
    area,
    kind,
    course: text(input.course, 160, 'Course'),
    syllabus_item: text(input.syllabus_item, 200, 'Syllabus item'),
    due_date: dueDate || null,
    project_id: projectId || null,
  };
}

export function nextLifeTaskDate(dueDate, recurrence) {
  const parsed = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) {
    throw Object.assign(new Error('A valid due date is required to schedule the next occurrence.'), { code: 'LIFE_TASK_VALIDATION' });
  }
  if (recurrence === 'daily') parsed.setUTCDate(parsed.getUTCDate() + 1);
  else if (recurrence === 'weekly') parsed.setUTCDate(parsed.getUTCDate() + 7);
  else if (recurrence === 'monthly') {
    const day = parsed.getUTCDate();
    parsed.setUTCDate(1);
    parsed.setUTCMonth(parsed.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).getUTCDate();
    parsed.setUTCDate(Math.min(day, lastDay));
  } else {
    throw Object.assign(new Error('Choose a supported recurrence frequency.'), { code: 'LIFE_TASK_VALIDATION' });
  }
  return parsed.toISOString().slice(0, 10);
}

export function normalizeLifeGoal(input = {}) {
  const title = text(input.title, 160, 'Goal title', true, 'LIFE_GOAL_VALIDATION');
  const description = text(input.description, 5000, 'Goal description', false, 'LIFE_GOAL_VALIDATION');
  const status = ['active', 'paused', 'completed'].includes(input.status) ? input.status : 'active';
  const area = LIFE_AREAS.includes(input.area) ? input.area : 'personal';
  const targetDate = text(input.target_date, 10, 'Target date');
  if (targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    || Number.isNaN(Date.parse(`${targetDate}T00:00:00Z`))
    || new Date(`${targetDate}T00:00:00Z`).toISOString().slice(0, 10) !== targetDate)) {
    throw Object.assign(new Error('Target date must be a valid calendar date.'), { code: 'LIFE_GOAL_VALIDATION' });
  }
  if (!Array.isArray(input.milestones) || input.milestones.length > 50) {
    throw Object.assign(new Error('A goal can have at most 50 milestones.'), { code: 'LIFE_GOAL_VALIDATION' });
  }
  if (input.milestones.some(item => item?.complete !== undefined && typeof item.complete !== 'boolean')) {
    throw Object.assign(new Error('Milestone completion must be true or false.'), { code: 'LIFE_GOAL_VALIDATION' });
  }
  const milestones = input.milestones.map(milestone => {
    const milestoneTitle = text(milestone?.title, 160, 'Milestone title', true, 'LIFE_GOAL_VALIDATION');
    const dueDate = text(milestone?.due_date, 10, 'Milestone date', false, 'LIFE_GOAL_VALIDATION');
    if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
      || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))
      || new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate)) {
      throw Object.assign(new Error('Milestone date must be a valid calendar date.'), { code: 'LIFE_GOAL_VALIDATION' });
    }
    const id = text(milestone?.id, 64, 'Milestone ID', true, 'LIFE_GOAL_VALIDATION');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw Object.assign(new Error('Milestone ID is invalid.'), { code: 'LIFE_GOAL_VALIDATION' });
    }
    return { id, title: milestoneTitle, due_date: dueDate || null, complete: Boolean(milestone?.complete) };
  });
  if (new Set(milestones.map(item => item.id.toLowerCase())).size !== milestones.length) {
    throw Object.assign(new Error('Milestone IDs must be unique within a goal.'), { code: 'LIFE_GOAL_VALIDATION' });
  }
  const projectId = text(input.project_id, 64, 'Project ID', false, 'LIFE_GOAL_VALIDATION');
  return {
    title,
    description,
    status,
    area,
    target_date: targetDate || null,
    project_id: projectId || null,
    milestones,
  };
}

export function lifeGoalProgress(goal) {
  const milestones = Array.isArray(goal?.milestones) ? goal.milestones : [];
  if (!milestones.length) return 0;
  return Math.round((milestones.filter(item => item.complete).length / milestones.length) * 100);
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
