import { getBillingStatus } from '@/lib/billing';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { recordActivation, trackEyraFollowthrough } from '@/lib/product-analytics';
import { applyEntityFilters, rowToEntity, splitPayload } from './entity-serialization';

const ENTITY_SCHEMAS = {
  Project: { table: 'projects' },
  Idea: { table: 'ideas' },
  Meeting: { table: 'meetings' },
  SavedPaper: { table: 'saved_papers' },
  SavedResearcher: { table: 'saved_researchers' },
  SavedOpportunity: { table: 'saved_opportunities' },
  SearchHistory: { table: 'search_history' },
  Watchlist: { table: 'watchlists' },
  MonitoringDiscovery: { table: 'monitoring_discoveries' },
  Notification: { table: 'notifications' },
};

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
  return Object.assign(
    new Error(error?.message || 'We could not save your profile. Please try again.'),
    { code: error?.code || 'PROFILE_WRITE_FAILED' },
  );
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
    throw Object.assign(
      new Error('The free plan includes one project workspace. Upgrade to create another.'),
      { code: 'PLAN_LIMIT_REACHED' },
    );
  }
}

function entityRepository({ table }) {
  return {
    async list(sort = '-created_date', limit = 100) {
      const { data, error } = await requireSupabase().from(table).select('*').limit(Math.max(limit || 100, 1));
      if (error) throw error;
      return sortEntities((data || []).map(rowToEntity), sort).slice(0, limit || 100);
    },
    async filter(filters = {}, sort = '-created_date', limit = 100) {
      let query = requireSupabase().from(table).select('*');
      query = applyEntityFilters(query, filters);
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
      const write = splitPayload(payload);
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
      const write = splitPayload({ ...current, ...patch });
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
      .select('data')
      .eq('user_id', user.id)
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

    const storedProfile = pickProfileFields(data?.data || {});
    return {
      id: user.id,
      email: user.email,
      full_name: storedProfile.full_name || authProfile.full_name || user.user_metadata?.name || '',
      ...storedProfile,
      ...authProfile,
    };
  },

  async updateMe(patch) {
    const client = requireSupabase();
    const user = await currentUser();
    const current = await this.me();
    const next = pickProfileFields({ ...current, ...patch });
    const profileRow = { user_id: user.id, data: next };

    const [profileWrite, authWrite] = await Promise.all([
      client
        .from('profiles')
        .upsert(profileRow, { onConflict: 'user_id' })
        .select('data')
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
      ...pickProfileFields(profileWrite.data?.data || {}),
      ...pickProfileFields(authWrite.data?.user?.user_metadata || {}),
    };
  },
};
