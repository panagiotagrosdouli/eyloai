import { getBillingStatus } from '@/lib/billing';
import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { recordActivation, trackEyraFollowthrough } from '@/lib/product-analytics';

const TABLES = {
  Project: 'projects', Idea: 'ideas', Meeting: 'meetings', SavedPaper: 'saved_papers',
  SavedResearcher: 'saved_researchers', SavedOpportunity: 'saved_opportunities', SearchHistory: 'search_history',
  Watchlist: 'watchlists', MonitoringDiscovery: 'monitoring_discoveries', Notification: 'notifications',
};

const rowToEntity = (row) => row ? ({ id: row.id, created_date: row.created_date, updated_date: row.updated_date, ...row.data }) : null;

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

function entityRepository(table) {
  return {
    async list(sort = '-created_date', limit = 100) {
      const { data, error } = await requireSupabase().from(table).select('*').limit(Math.max(limit || 100, 1));
      if (error) throw error;
      return sortEntities((data || []).map(rowToEntity), sort).slice(0, limit || 100);
    },
    async filter(filters = {}, sort = '-created_date', limit = 100) {
      const { data, error } = await requireSupabase().from(table).select('*').contains('data', filters).limit(Math.max(limit || 100, 1));
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
      const { data, error } = await requireSupabase().from(table).insert({ user_id: user.id, data: payload || {} }).select('*').single();
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
      const { data, error } = await requireSupabase().from(table).update({ data: { ...current, ...patch } }).eq('id', entityId).select('*').single();
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

export const supabaseEntities = Object.fromEntries(Object.entries(TABLES).map(([name, table]) => [name, entityRepository(table)]));

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
