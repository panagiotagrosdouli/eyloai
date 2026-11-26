export async function persistProposalWorkflowCheckpoint({ entities, project, run, ownerId, getSession, maxConflicts = 2 }) {
  if (!entities?.Project || !project?.id || !ownerId || !run?.run_id) {
    throw new Error('A verified project and workflow run are required to save a checkpoint.');
  }
  let current = project;
  for (let attempt = 0; attempt <= maxConflicts; attempt += 1) {
    const session = await getSession(ownerId);
    if (session?.user?.id !== ownerId) throw Object.assign(new Error('The signed-in account changed during proposal generation.'), { code: 'ACCOUNT_CHANGED' });
    const proposal = current.research_proposal && typeof current.research_proposal === 'object' ? current.research_proposal : {};
    let saved;
    try {
      saved = await entities.Project.updateIfUnchanged(current.id, {
        research_proposal: { ...proposal, workflow_run: run },
      }, current.updated_date);
    } catch (failure) {
      if (failure?.code !== 'ENTITY_CONFLICT' || attempt === maxConflicts) throw failure;
      current = await entities.Project.get(current.id);
      continue;
    }
    if (saved?.id !== current.id || saved?.research_proposal?.workflow_run?.run_id !== run.run_id || saved?.research_proposal?.workflow_run?.updated_at !== run.updated_at) {
      throw new Error('The proposal checkpoint could not be verified as saved.');
    }
    return saved;
  }
  throw new Error('The project changed repeatedly while saving a proposal checkpoint. Reload before resuming.');
}
