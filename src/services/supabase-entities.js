import { getBillingStatus } from '@/lib/billing';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { recordActivation, trackEyraFollowthrough } from '@/lib/product-analytics';

const ENTITY_SCHEMAS = {
  Project: {
    table: 'projects',
    columns: ['title', 'goal', 'description', 'milestones', 'tasks', 'notes', 'status', 'eyra_analysis', 'twin_report'],
  },
  Idea: {
    table: 'ideas',
    columns: ['title', 'description', 'status', 'eyra_notes'],
  },
  Meeting: {
    table: 'meetings',
    columns: [
      'project_id', 'project_title', 'title', 'call_type', 'date', 'time',
      'duration_minutes', 'participants', 'agenda', 'meeting_link', 'notes',
      'status', 'eyra_prep', 'transcription',
    ],
  },
  SavedPaper: {
    table: 'saved_papers',
    columns: ['title', 'authors', 'summary', 'year', 'source', 'url'],
  },
  SavedResearcher: {
    table: 'saved_researchers',
    columns: ['name', 'institution', 'research_areas', 'works_count', 'citation_count', 'profile_url'],
  },
  SavedOpportunity: {
    table: 'saved_opportunities',
    columns: ['title', 'type', 'description', 'source', 'url'],
  },
  SearchHistory: {
    table: 'search_history',
    columns: ['query', 'results_summary'],
  },
  Watchlist: { table: 'watchlists', columns: [] },
  MonitoringDiscovery: { table: 'monitoring_discoveries', columns: [] },
  Notification: { table: 'notifications', columns: [] },
};

const RESERVED_FIELDS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 'created_date', 'updated_date', 'data',
]);

function rowToEntity(row) {
  if (!row) return null;
  const {
    id, user_id: _userId, created_at: createdAt, updated_at: updatedAt,
    created_date: createdDate, updated_date: updatedDate, data, ...columns
  } = row;
  return {
    ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
    ...columns,
    id,
    created_date: createdDate || createdAt || '',
    updated_date: updatedDate || updatedAt || createdDate || createdAt || '',
  };
}

function splitPayload(payload = {}, columns = []) {
  const nativeColumns = new Set(columns);
  const row = {};
  const extras = {};

  Object.entries(payload || {}).forEach(([field, value]) => {
    if (value === undefined || RESERVED_FIELDS.has(field)) return;
    if (nativeColumns.has(field)) row[field] = value;
    else extras[field] = value;
  });

  return { ...row, data: extras };
}

function containsSavedEyraOutput(value = {}) {
  return Boolean(value.eyra_analysis || value.eyra_notes || value.eyra_output);
}

const PROFILE_FIELDS = [
  'full_name', 'user_type', 'bio', 'research_interests', 'skills',
  'organization', 'country', 'career_goal', 'startup_interest',
];

function pickProfileFields(value = {}) {
  return Object.fromEntries(
    PROFILE_FIELDS
      .filter((field) => value[field] !== undefined)
      .map((field) => [field, value[field]]),
  );
}

function profileWriteError(error) {
  const wrapped = new Error(error?.message || 'We could not save your profile. Please try again.');
  wrapped.code = error?.code || 'PROFILE_WRITE_FAILED';
  return wrapped;
}

async function currentUser() {
  const session = await getUsableSession({
    required: true,
    validate: true,
  });
  return session.user;
}

function sortEntities(items, sort = '-created_date') {
  const descending = sort.startsWith('-'); const field = descending ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const av = a[field] ?? ''; const bv = b[field] ?? '';
    const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return descending ? -result : result;
  });
}

async function assertCreateAllowed(table, user) {
  if (table !== 'projects') return;

  const billing = await getBillingStatus();
  if (!billing.billing_configured || billing.plan !== 'free') return;

  const { count, error } = await requireSupabase()
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (error) throw error;

  if (Number(count || 0) >= 1) {
    const limitError = new Error('The free plan includes one project workspace. Upgrade to create another.');
    limitError.code = 'PLAN_LIMIT_REACHED';
    throw limitError;
  }
}

function entityRepository({ table, columns }) {
  return {
    async list(sort = '-created_date', limit = 100) {
      const { data, error } = await requireSupabase().from(table).select('*').limit(Math.max(limit || 100, 1));
      if (error) throw error;
      return sortEntities((data || []).map(rowToEntity), sort).slice(0, limit || 100);
    },
    async filter(filters = {}, sort = '-created_date', limit = 100) {
      const nativeColumns = new Set(columns);
      const nativeFilters = Object.fromEntries(Object.entries(filters).filter(([field]) => nativeColumns.has(field)));
      const dataFilters = Object.fromEntries(Object.entries(filters).filter(([field]) => !nativeColumns.has(field)));
      let query = requireSupabase().from(table).select('*');
      Object.entries(nativeFilters).forEach(([field, value]) => { query = query.eq(field, value); });
      if (Object.keys(dataFilters).length) query = query.contains('data', dataFilters);
      const { data, error } = await query.limit(Math.max(limit || 100, 1));
      if (error) throw error;
      return sortEntities((data || []).map(rowToEntity), sort).slice(0, limit || 100);
    },
    async get(entityId) {
      const { data, error } = await requireSupabase().from(table).select('*').eq('id', entityId).single();
      if (error) throw error;
      return rowToEntity(data);
    },
    async create(payload) {
      const user = await currentUser();
      await assertCreateAllowed(table, user);
      const write = splitPayload(payload, columns);
      const { data, error } = await requireSupabase().from(table).insert({ user_id: user.id, ...write }).select('*').single();
      if (error) throw error;
      const entity = rowToEntity(data);
      if (table === 'saved_papers') recordActivation('paper');
      if (table === 'projects') {
        recordActivation('project');
        if (containsSavedEyraOutput(payload)) trackEyraFollowthrough('project');
      }
      return entity;
    },
    async update(entityId, patch) {
      const existing = await this.get(entityId);
      const { id: _id, created_date: _created, updated_date: _updated, ...current } = existing;
      const write = splitPayload({ ...current, ...patch }, columns);
      const { data, error } = await requireSupabase().from(table).update(write).eq('id', entityId).select('*').single();
      if (error) throw error;
      if (table === 'projects' && containsSavedEyraOutput(patch)) {
        trackEyraFollowthrough('project');
      }
      return rowToEntity(data);
    },
    async delete(entityId) {
      const { error } = await requireSupabase().from(table).delete().eq('id', entityId);
      if (error) throw error;
      return { id: entityId };
    },
  };
}

export const supabaseEntities = Object.fromEntries(
  Object.entries(ENTITY_SCHEMAS).map(([name, schema]) => [name, entityRepository(schema)]),
);

export const supabaseProfile = {
  async me() {
    const user = await currentUser();
    const authProfile = pickProfileFields(user.user_metadata || {});
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Profile table read failed; using authenticated metadata', { code: error.code });
      return {
        id: user.id,
        email: user.email,
        full_name: authProfile.full_name || user.user_metadata?.name || '',
        ...authProfile,
      };
    }

    return {
      id: user.id,
      email: user.email,
      full_name: data?.full_name || authProfile.full_name || user.user_metadata?.name || '',
      ...pickProfileFields(data || {}),
      ...authProfile,
    };
  },

  async updateMe(patch) {
    const client = requireSupabase();
    const user = await currentUser();
    const current = await this.me();
    const next = pickProfileFields({ ...current, ...patch });
    const profileRow = { id: user.id, email: user.email, ...next };

    const [profileWrite, authWrite] = await Promise.all([
      client
        .from('profiles')
        .upsert(profileRow, { onConflict: 'id' })
        .select('*')
        .maybeSingle(),
      client.auth.updateUser({ data: next }),
    ]);

    if (profileWrite.error && authWrite.error) {
      throw profileWriteError(profileWrite.error || authWrite.error);
    }
    if (profileWrite.error) {
      console.warn('Profile table write failed; profile persisted in authenticated metadata', {
        code: profileWrite.error.code,
      });
    }
    if (authWrite.error) {
      console.warn('Auth metadata write failed; profile persisted in the profile table', {
        code: authWrite.error.code,
      });
    }

    return {
      id: user.id,
      email: user.email,
      ...next,
      ...pickProfileFields(profileWrite.data || {}),
      ...pickProfileFields(authWrite.data?.user?.user_metadata || {}),
    };
  },
};
