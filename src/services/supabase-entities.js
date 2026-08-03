import { requireSupabase } from '@/lib/supabaseClient';

const TABLES = {
  Project: 'projects', Idea: 'ideas', Meeting: 'meetings', SavedPaper: 'saved_papers',
  SavedResearcher: 'saved_researchers', SavedOpportunity: 'saved_opportunities', SearchHistory: 'search_history',
  Watchlist: 'watchlists', MonitoringDiscovery: 'monitoring_discoveries', Notification: 'notifications',
};

const rowToEntity = (row) => row ? ({ id: row.id, created_date: row.created_date, updated_date: row.updated_date, ...row.data }) : null;

async function currentUser() {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Authentication required.');
  return data.user;
}

function sortEntities(items, sort = '-created_date') {
  const descending = sort.startsWith('-'); const field = descending ? sort.slice(1) : sort;
  return [...items].sort((a, b) => {
    const av = a[field] ?? ''; const bv = b[field] ?? '';
    const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return descending ? -result : result;
  });
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
    const { data, error } = await requireSupabase().from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || user.user_metadata?.name || '', ...(data?.data || {}) };
  },
  async updateMe(patch) {
    const user = await currentUser();
    const current = await this.me();
    const { id: _id, email: _email, ...profile } = current;
    const next = { ...profile, ...patch };
    const { data, error } = await requireSupabase().from('profiles').upsert({ user_id: user.id, data: next }, { onConflict: 'user_id' }).select('*').single();
    if (error) throw error;
    await requireSupabase().auth.updateUser({ data: { full_name: next.full_name || user.user_metadata?.full_name } });
    return { id: user.id, email: user.email, ...data.data };
  },
};
