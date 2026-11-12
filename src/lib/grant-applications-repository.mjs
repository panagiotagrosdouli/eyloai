const APPLICATION_STATUSES = new Set([
  'researching', 'go_no_go', 'drafting', 'internal_review', 'submitted', 'declined', 'awarded',
]);

export class GrantApplicationConflictError extends Error {
  constructor(message = 'This grant draft changed in another tab. Reload it before saving again.') {
    super(message);
    this.name = 'GrantApplicationConflictError';
    this.code = 'GRANT_APPLICATION_CONFLICT';
  }
}

export function legacyGrantApplication(opportunity, projectId) {
  if (!opportunity || !projectId || !opportunity.application_draft) return null;
  const ownerProjectId = opportunity.application_project_id || opportunity.project_id;
  if (ownerProjectId !== projectId) return null;
  try {
    const draft = typeof opportunity.application_draft === 'string'
      ? JSON.parse(opportunity.application_draft)
      : opportunity.application_draft;
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null;
    return {
      draft,
      status: APPLICATION_STATUSES.has(opportunity.application_status) ? opportunity.application_status : 'researching',
      notes: typeof opportunity.application_notes === 'string' ? opportunity.application_notes : '',
      version: null,
      legacy: true,
    };
  } catch {
    return null;
  }
}

function validatePair(opportunityId, projectId) {
  if (typeof opportunityId !== 'string' || !opportunityId || typeof projectId !== 'string' || !projectId) {
    throw new TypeError('Choose both a saved funding opportunity and a project.');
  }
}

function validatePayload({ status, notes, draft }) {
  if (!APPLICATION_STATUSES.has(status)) throw new TypeError('Choose a valid application status.');
  if (typeof notes !== 'string' || notes.length > 20_000) throw new TypeError('Application notes must be text under 20,000 characters.');
  if (draft != null && (typeof draft !== 'object' || Array.isArray(draft))) throw new TypeError('Grant draft must be a structured object.');
}

export function createGrantApplicationRepository(client, userId) {
  if (!client?.from || typeof userId !== 'string' || !userId) throw new TypeError('An authenticated database client is required.');

  async function get(opportunityId, projectId) {
    validatePair(opportunityId, projectId);
    const { data, error } = await client.from('grant_applications').select('*')
      .eq('user_id', userId).eq('saved_opportunity_id', opportunityId).eq('project_id', projectId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function save({ opportunityId, projectId, status, notes, draft, expectedVersion = null }) {
    validatePair(opportunityId, projectId);
    validatePayload({ status, notes, draft });
    const values = { status, notes, draft };
    if (expectedVersion == null) {
      const { data, error } = await client.from('grant_applications').insert({
        user_id: userId,
        saved_opportunity_id: opportunityId,
        project_id: projectId,
        ...values,
        version: 1,
      }).select('*').single();
      if (error?.code === '23505') throw new GrantApplicationConflictError('This project already has a draft for this opportunity. Reload it before saving.');
      if (error) throw error;
      return data;
    }

    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new TypeError('Reload this grant draft before saving.');
    const { data, error } = await client.from('grant_applications').update({ ...values, version: expectedVersion + 1 })
      .eq('user_id', userId).eq('saved_opportunity_id', opportunityId).eq('project_id', projectId)
      .eq('version', expectedVersion).select('*').maybeSingle();
    if (error) throw error;
    if (!data) throw new GrantApplicationConflictError();
    return data;
  }

  return { get, save };
}
