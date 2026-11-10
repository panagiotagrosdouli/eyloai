/** A stable key for the evidence set currently shown in Research Gap Finder. */
export function getResearchEvidenceContextKey(projectId, paperIds) {
  const project = typeof projectId === 'string' ? projectId : '';
  const ids = [...new Set((Array.isArray(paperIds) ? paperIds : [])
    .filter(id => id != null)
    .map(String))].sort();
  return JSON.stringify([project, ids]);
}
