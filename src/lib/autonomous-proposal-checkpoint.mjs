import { stableProposalStringify } from './research-proposal-studio.mjs';

/** Persist only the proposal checkpoint over the latest owner-visible artifact. */
export async function persistAutonomousProposalCheckpoint({ entities, project, run, ownerId, getSession, createArtifact, artifactKey = 'research_proposal', runKey = 'autonomous_run', maxConflicts = 2 }) {
  if (!entities?.Project || !project?.id || !ownerId || !run?.run_id || typeof createArtifact !== 'function') {
    throw new Error('A verified project, account and proposal checkpoint are required.');
  }
  let current = project;
  for (let attempt = 0; attempt <= maxConflicts; attempt += 1) {
    const session = await getSession(ownerId);
    if (session?.user?.id !== ownerId) throw Object.assign(new Error('The signed-in account changed during proposal generation.'), { code: 'ACCOUNT_CHANGED' });
    const previous = current[artifactKey] && typeof current[artifactKey] === 'object' ? current[artifactKey] : {};
    const artifact = createArtifact(previous);
    let saved;
    try {
      saved = await entities.Project.updateIfUnchanged(current.id, { [artifactKey]: artifact }, current.updated_date);
    } catch (failure) {
      if (failure?.code !== 'ENTITY_CONFLICT' || attempt === maxConflicts) throw failure;
      current = await entities.Project.get(current.id);
      if (!current || String(current.id) !== String(project.id)) throw Object.assign(new Error('The project changed and could not be reloaded.'), { code: 'PROJECT_RELOAD_FAILED' });
      continue;
    }
    if (String(saved?.id) !== String(current.id)
      || String(saved?.[artifactKey]?.[runKey]?.run_id) !== String(run.run_id)
      || saved[artifactKey][runKey].updated_at !== run.updated_at
      || stableProposalStringify(saved[artifactKey]) !== stableProposalStringify(artifact)) {
      throw Object.assign(new Error('The proposal checkpoint could not be verified as saved.'), { code: 'CHECKPOINT_UNVERIFIED' });
    }
    return saved;
  }
  throw Object.assign(new Error('The project changed repeatedly while saving a proposal checkpoint.'), { code: 'ENTITY_CONFLICT' });
}
