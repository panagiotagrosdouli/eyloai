import { requireSupabase } from '@/lib/supabaseClient';

const TABLES = {
  Project: 'projects', Idea: 'ideas', Meeting: 'meetings', SavedPaper: 'saved_papers',
  SavedResearcher: 'saved_researchers', SavedOpportunity: 'saved_opportunities', SearchHistory: 'search_history',
  Watchlist: 'watchlists', MonitoringDiscovery: 'monitoring_discoveries', Notification: 'notifications',
};

const rowToEntity = (row) => row ? ({ id: row.id, created_date: row.created_date, updated_date: row.updated_date, ...row.data }) : null;

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
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;

  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  if (refreshError) throw refreshError;
  if (!refreshed.session?.user) {
    const error = new Error('Your secure session expired. Sign in again to save workspace changes.');
    error.code = 'AUTH_SESSION_MISSING';
    throw error;
  }
  return refreshed.session.user;
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
  try {
    const capabilityResponse = await fetch('/api/capabilities');
    const capabilities = await capabilityResponse.json();
    if (!capabilities.billing) return;
  } catch {
    return;
  }
  const client = requireSupabase();
  const [{ data: profile, error: profileError }, { count, error: countError }] = await Promise.all([
    client.from('profiles').select('data').eq('user_id', user.id).maybeSingle(),
    client.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);
  if (profileError) throw profileError;
  if (countError) throw countError;
  const plan = profile?.data?.subscription_tier || 'free';
  if (plan === 'free' && Number(count || 0) >= 1) {
    const error = new Error('The free plan includes one project workspace. Upgrade to create another.');
    error.code = 'PLAN_LIMIT_REACHED';
    throw error;
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
      return rowToEntity(data);
    },
    async update(entityId, patch) {
      const existing = await this.get(entityId);
      const { id: _id, created_date: _created, updated_date: _updated, ...current } = existing;
      const { data, error } = await requireSupabase().from(table).update({ data: { ...current, ...patch } }).eq('id', entityId).select('*').single();
      if (error) throw error;
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
