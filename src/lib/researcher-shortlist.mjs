export async function saveResearcherCandidate({ entities, researcher, project = null }) {
  const openalexId = String(researcher?.openalex_id || researcher?.id || '').trim();
  if (!openalexId) throw new Error('This researcher record has no OpenAlex identifier.');

  const matches = await entities.SavedResearcher.filter({ openalex_id: openalexId }, '-created_date', 5);
  const existing = Array.isArray(matches)
    ? matches.find(item => item.openalex_id === openalexId) || null
    : null;

  if (existing) {
    if (project && existing.project_id && existing.project_id !== project.id) {
      return { status: 'already_linked', projectId: existing.project_id };
    }
    if (project && !existing.project_id) {
      await entities.SavedResearcher.update(existing.id, {
        project_id: project.id,
        project_title: project.title || '',
      });
      return { status: 'linked', projectId: project.id };
    }
    return { status: project ? 'already_in_project' : 'already_saved', projectId: existing.project_id || '' };
  }

  await entities.SavedResearcher.create({
    openalex_id: openalexId,
    source: 'OpenAlex',
    name: researcher.name,
    institution: researcher.institution,
    country: researcher.country,
    research_areas: researcher.research_areas,
    works_count: researcher.works_count,
    citation_count: researcher.citation_count,
    profile_url: researcher.profile_url,
    orcid: researcher.orcid || '',
    biography: researcher.biography || '',
    profile_photo_url: researcher.profile_photo_url || '',
    ...(project ? { project_id: project.id, project_title: project.title || '' } : {}),
  });
  return { status: 'saved', projectId: project?.id || '' };
}
