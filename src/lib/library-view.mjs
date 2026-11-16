const COLLECTIONS = ['SavedPaper', 'SavedResearcher', 'SavedOpportunity'];
const NAMES = ['papers', 'researchers', 'opportunities'];
export const LIBRARY_LOAD_LIMIT = 1000;

/** Resolve explicit private targets before loading a bounded Library view.
 * Repository reads verify the expected owner. Project filtering happens before LIMIT.
 */
export async function loadLibraryView({ entities, ownerId, projectId = '', paperId = '' }) {
  if (!ownerId) throw new Error('Sign in to load your Library.');
  const project = projectId ? await entities.Project.get(projectId, ownerId) : null;
  if (projectId && project?.id !== projectId) throw new Error('The requested project could not be verified.');
  const readCollection = async (name, index) => {
    if (index === 0 && paperId) {
      const paper = await entities.SavedPaper.get(paperId, ownerId);
      if (paper?.id !== paperId || (projectId && paper.project_id !== projectId)) {
        throw new Error('The requested publication is unavailable in this view.');
      }
      return [paper];
    }
    const rows = projectId
      ? await entities[name].filter({ project_id: projectId }, '-created_date', LIBRARY_LOAD_LIMIT, ownerId)
      : await entities[name].list('-created_date', LIBRARY_LOAD_LIMIT, ownerId);
    if (!Array.isArray(rows) || (projectId && rows.some(row => row.project_id !== projectId))) {
      throw new Error('The Library collection could not be verified for this project.');
    }
    return rows;
  };
  const results = await Promise.allSettled([
    ...COLLECTIONS.map(readCollection),
    entities.Project.list('-updated_date', LIBRARY_LOAD_LIMIT, ownerId),
  ]);
  const rows = results.slice(0, 3).map(result => result.status === 'fulfilled' ? result.value : []);
  const failedCollections = NAMES.filter((_, index) => results[index].status === 'rejected');
  const projectResult = results[3];
  const projectsLoaded = projectResult.status === 'fulfilled';
  const recentProjects = projectResult.status === 'fulfilled' ? projectResult.value : [];
  const projects = project && !recentProjects.some(item => item.id === project.id) ? [project, ...recentProjects] : recentProjects;
  const notices = [];
  if (failedCollections.length) notices.push(`${failedCollections.length} saved collection${failedCollections.length === 1 ? '' : 's'} could not be loaded`);
  if (!projectsLoaded) notices.push('project links could not be loaded');
  return {
    papers: rows[0], researchers: rows[1], opportunities: rows[2], projects, project, projectsLoaded, failedCollections,
    notice: notices.length ? `${notices.join('; ')}. Available records remain usable. Please retry when the connection recovers.` : '',
  };
}
