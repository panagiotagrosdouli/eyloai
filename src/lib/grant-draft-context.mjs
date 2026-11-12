export function readGrantDraftForProject(opportunity, projectId) {
  if (!opportunity || !projectId || !opportunity.application_draft) return null;

  const savedProjectId = opportunity.application_project_id || opportunity.project_id;
  if (!savedProjectId || savedProjectId !== projectId) return null;

  try {
    const draft = typeof opportunity.application_draft === 'string'
      ? JSON.parse(opportunity.application_draft)
      : opportunity.application_draft;
    return draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : null;
  } catch {
    return null;
  }
}
