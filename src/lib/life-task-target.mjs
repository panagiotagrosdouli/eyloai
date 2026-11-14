export const TASK_TARGET_ERROR = 'The requested private task could not be loaded. Check access and retry.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loadExactLifeTask({ repository, id, ownerId }) {
  if (!UUID.test(String(id || '')) || typeof ownerId !== 'string' || !ownerId.trim()) throw new Error(TASK_TARGET_ERROR);
  try {
    const task = await repository.get(id, ownerId);
    if (task?.id !== id) throw new Error(TASK_TARGET_ERROR);
    return task;
  } catch { throw new Error(TASK_TARGET_ERROR); }
}
