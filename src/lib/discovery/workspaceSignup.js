const MAX_RESEARCH_IDEA_LENGTH = 500;

export function buildResearchWorkspacePath(query) {
  const idea = String(query || '').trim().slice(0, MAX_RESEARCH_IDEA_LENGTH);
  const projectParams = new URLSearchParams({ new: '1' });
  if (idea) projectParams.set('idea', idea);
  return `/projects?${projectParams.toString()}`;
}

export function buildResearchWorkspaceSignupHref(query) {
  const registrationParams = new URLSearchParams({ from: buildResearchWorkspacePath(query) });
  return `/register?${registrationParams.toString()}`;
}

export function getResearchIdeaForNewProject(searchParams) {
  return String(searchParams.get('idea') || '').trim().slice(0, MAX_RESEARCH_IDEA_LENGTH);
}
