import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { createGrantApplicationRepository } from './grant-applications-repository.mjs';

async function repository() {
  const session = await getUsableSession({ required: true, validate: true });
  return createGrantApplicationRepository(requireSupabase(), session.user.id);
}

export async function getProjectGrantApplication(opportunityId, projectId) {
  return (await repository()).get(opportunityId, projectId);
}

export async function saveProjectGrantApplication(application) {
  return (await repository()).save(application);
}
