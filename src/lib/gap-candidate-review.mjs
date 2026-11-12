// Human-reviewed status updates for project-linked candidate research questions.
// The owner-scoped Project repository performs the real RLS-protected write.
export const GAP_REVIEW_STATUSES = Object.freeze([
  'candidate_needs_human_review',
  'needs_more_evidence',
  'selected_for_followup',
  'rejected_after_review',
]);

const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
function assertProject(project, projectId) {
  if (!project || project.id !== projectId) throw new Error('Authorized project was not found.');
  if (!Array.isArray(project.gap_candidates)) throw new Error('No saved research candidates were found.');
}
function assertCandidate(list, index, expected) {
  if (!Number.isInteger(index) || index < 0 || index >= list.length) throw new Error('Saved candidate no longer exists.');
  const entry = list[index];
  if (!entry || entry.question !== expected?.question || entry.recorded_at !== expected?.recorded_at) {
    throw new Error('Candidate changed since it was shown. Reload before editing.');
  }
  return entry;
}
export async function reviewSavedGapCandidate({ entities, projectId, index, expected, status, note, reviewedAt }) {
  if (!GAP_REVIEW_STATUSES.includes(status)) throw new Error('Unsupported review decision.');
  const reviewNote = clean(note, 2000);
  if (status !== 'candidate_needs_human_review' && !reviewNote) {
    throw new Error('Document the reasoning for this research decision.');
  }
  if (typeof reviewedAt !== 'string' || !Number.isFinite(Date.parse(reviewedAt))) throw new Error('Review timestamp missing.');
  const project = await entities.Project.get(projectId);
  assertProject(project, projectId);
  const current = assertCandidate(project.gap_candidates, index, expected);
  const candidates = [...project.gap_candidates];
  candidates[index] = {
    ...current,
    review_status: status,
    reviewer_note: reviewNote,
    reviewed_at: reviewedAt,
  };
  const saved = await entities.Project.updateIfUnchanged(projectId, { gap_candidates: candidates }, project.updated_date);
  return saved;
}
export async function removeSavedGapCandidate({ entities, projectId, index, expected }) {
  const project = await entities.Project.get(projectId);
  assertProject(project, projectId);
  assertCandidate(project.gap_candidates, index, expected);
  const candidates = project.gap_candidates.filter((_, i) => i !== index);
  return entities.Project.updateIfUnchanged(projectId, { gap_candidates: candidates }, project.updated_date);
}
