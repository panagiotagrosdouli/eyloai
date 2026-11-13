import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { normalizeEyraConversation } from './eyra-conversation.mjs';
import { snapshotPayload } from './eyra-snapshot.mjs';

async function authenticatedClient() {
  const session = await getUsableSession({ required: true, validate: true });
  return { client: requireSupabase(), owner: session.user.id };
}
export async function listEyraConversations() {
  const { client, owner } = await authenticatedClient();
  const { data, error } = await client.from('eyra_conversations').select('id,title,version,updated_date').eq('user_id', owner).order('updated_date', { ascending: false }).order('id', { ascending: false }).limit(20);
  if (error) throw new Error('Saved conversations are unavailable. Separate staging migrations may still be required.');
  return data;
}
export async function saveEyraConversation(title, messages, snapshotId) {
  const { client } = await authenticatedClient();
  const { data, error } = await client.rpc('save_eyra_conversation_snapshot', { ...snapshotPayload(title, messages), p_snapshot_id: snapshotId });
  if (error) throw new Error('Save was not confirmed. Retry without editing to reuse the same snapshot ID.');
  if (!data || data.id !== snapshotId) throw new Error('Save confirmation did not match this snapshot. Retry to verify.');
  return data;
}
export async function deleteEyraConversation(id, expectedVersion) {
  if (!id || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new Error('Reload the snapshot before deleting it.');
  const { client, owner } = await authenticatedClient();
  const { data, error } = await client.from('eyra_conversations').delete().eq('user_id', owner).eq('id', id).eq('version', expectedVersion).select('id');
  if (error || data?.length !== 1 || data[0].id !== id) throw new Error('Deletion was not confirmed. Reload saved conversations before retrying.');
}
export async function loadEyraConversation(id) {
  const { client, owner } = await authenticatedClient();
  const { data: thread, error } = await client.from('eyra_conversations').select('id,title,version,updated_date').eq('user_id', owner).eq('id', id).single();
  if (error || !thread) throw new Error('Conversation not found.');
  const { data: rows, error: messagesError } = await client.from('eyra_messages').select('role,content,sources,created_date').eq('user_id', owner).eq('conversation_id', id).order('sequence_number', { ascending: true }).limit(30);
  if (messagesError) throw new Error('Conversation messages could not be loaded.');
  return { ...thread, messages: normalizeEyraConversation(rows.map(row => ({ role: row.role === 'assistant' ? 'eyra' : row.role, content: row.content.text, sources: row.sources, mode: 'saved', timestamp: Date.parse(row.created_date) }))) };
}
