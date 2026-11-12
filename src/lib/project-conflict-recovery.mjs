export const PROJECT_EDIT_FIELDS = Object.freeze([
  ['title', 'Title'], ['goal', 'Research goal'], ['description', 'Description'],
  ['milestones', 'Milestones'], ['tasks', 'Next actions'],
  ['notes', 'Research notes'], ['status', 'Project status'],
]);

const normalize = value => String(value ?? '');

export function projectEditableValues(project = {}) {
  return Object.fromEntries(PROJECT_EDIT_FIELDS.map(([field]) => [
    field, normalize(project?.[field]) || (field === 'status' ? 'planning' : ''),
  ]));
}

/**
 * Three-way, field-level reconciliation of the last displayed project (base),
 * unsaved human edits (local) and freshly fetched database state (remote).
 * No network write occurs here, and overlapping edits require an explicit choice.
 */
export function planProjectReconciliation(base, local, remote) {
  if (!base?.id || !remote?.id || base.id !== remote.id) {
    throw new Error('Project identity changed; cannot reconcile drafts.');
  }
  const initial = projectEditableValues(base);
  const draft = projectEditableValues(local);
  const current = projectEditableValues(remote);
  const fields = PROJECT_EDIT_FIELDS.map(([id, label]) => {
    const localChanged = draft[id] !== initial[id];
    const remoteChanged = current[id] !== initial[id];
    return {
      id, label, base: initial[id], mine: draft[id], latest: current[id],
      localChanged, remoteChanged,
      conflict: localChanged && remoteChanged && draft[id] !== current[id],
    };
  });
  return {
    fields: fields.filter(row => row.localChanged || row.remoteChanged),
    conflicts: fields.filter(row => row.conflict),
    localChanges: fields.filter(row => row.localChanged).length,
    remoteChanges: fields.filter(row => row.remoteChanged).length,
  };
}

/**
 * Never silently favor either edit when both changed the same field.
 * "mine" and "latest" are explicit, human-controlled conflict resolutions.
 */
export function resolveProjectReconciliation(base, local, remote, choices = {}) {
  const plan = planProjectReconciliation(base, local, remote);
  const resolved = projectEditableValues(remote);
  for (const field of plan.fields) {
    if (!field.localChanged) continue;
    if (!field.conflict) {
      resolved[field.id] = field.mine;
      continue;
    }
    if (choices[field.id] !== 'mine' && choices[field.id] !== 'latest') {
      throw new Error('Choose which version to keep for every conflicting field.');
    }
    resolved[field.id] = choices[field.id] === 'mine' ? field.mine : field.latest;
  }
  return resolved;
}
