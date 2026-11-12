import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { LEARNING_KINDS } from '@/lib/learning-workspace.mjs';

async function userId() {
  const session = await getUsableSession({ required: true, validate: true });
  return session.user.id;
}

export const learningWorkspace = {
  async list() {
    const owner = await userId();
    const { data, error } = await requireSupabase().from('learning_records')
      .select('id,user_id,kind,parent_id,data,created_date,updated_date')
      .eq('user_id', owner).order('updated_date', { ascending: false }).limit(1000);
    if (error) throw error;
    return data || [];
  },
  async create(kind, data = {}, parentId = null) {
    if (!LEARNING_KINDS.includes(kind)) throw new Error('Unsupported learning record type.');
    const owner = await userId();
    const { data: row, error } = await requireSupabase().from('learning_records')
      .insert({ user_id: owner, kind, parent_id: parentId, data }).select('*').single();
    if (error) throw error;
    return row;
  },
  async update(id, patch) {
    const owner = await userId();
    const { data: current, error: readError } = await requireSupabase().from('learning_records')
      .select('data').eq('id', id).eq('user_id', owner).single();
    if (readError) throw readError;
    const { data: row, error } = await requireSupabase().from('learning_records')
      .update({ data: { ...current.data, ...patch } }).eq('id', id).eq('user_id', owner).select('*').single();
    if (error) throw error;
    return row;
  },
  async remove(id) {
    const owner = await userId();
    const { data, error } = await requireSupabase().from('learning_records')
      .delete().eq('id', id).eq('user_id', owner).select('id');
    if (error) throw error;
    if (!data?.length) throw Object.assign(new Error('Record was not found or access was denied.'), { code: 'LEARNING_RECORD_NOT_FOUND' });
  },
};
