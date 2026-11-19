import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { restoreEyraConversationMessages } from './eyra-cloud-history-restore.mjs';
import { snapshotPayload } from './eyra-snapshot.mjs';
import { safeEyraCloudHistoryError } from './eyra-cloud-history.mjs';

async function authenticatedClient() {
  const session = await getUsableSession({ required: true, validate: true });
  return { client: requireSupabase(), owner: session.user.id };
}
export async function listEyraConversations() {
  const { client, owner } = await authenticatedClient();
  const { data, error } = await client.from('eyra_conversations').select('id,title,version,updated_date').eq('user_id', owner).order('updated_date', { ascending: false }).order('id', { ascending: false }).limit(20);
  if (error) throw safeEyraCloudHistoryError(error, 'Saved conversations could not be checked right now. Export this tab to keep a local copy.');
  return data;
}
export async function saveEyraConversation(title, messages, snapshotId) {
  const { client } = await authenticatedClient();
  const { data, error } = await client.rpc('save_eyra_conversation_snapshot', { ...snapshotPayload(title, messages), p_snapshot_id: snapshotId });
  if (error) {
    if (['PGRST202', '42883', 'PGRST205', '42P01'].includes(String(error.code || ''))) {
      throw safeEyraCloudHistoryError(error, 'Cloud history is not activated.');
    }
    throw new Error('Save was not confirmed. Retry without editing to reuse the same snapshot ID.');
  }
  if (!data || data.id !== snapshotId) throw new Error('Save confirmation did not match this snapshot. Retry to verify.');
  return data;
}
export async function renameEyraConversation(id, expectedVersion, requestedTitle) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const title = typeof requestedTitle === 'string' ? requestedTitle.trim() : '';
  if (!uuid.test(id || '') || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
    || !title || title.length > 180) {
    throw new Error('A valid saved conversation ID, version and title are required.');
  }
  const { client, owner } = await authenticatedClient();
  const { data, error } = await client.from('eyra_conversations')
    .update({ title })
    .eq('user_id', owner).eq('id', id).eq('version', expectedVersion)
    .select('id,title,version');
  if (error || !Array.isArray(data) || data.length !== 1
    || data[0].id !== id || data[0].title !== title
    || data[0].version !== expectedVersion + 1) {
    throw new Error('Conversation rename was not confirmed. Reload it before retrying.');
  }
  return data[0];
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
  const { data: rows, error: messagesError } = await client.from('eyra_messages').select('role,content,sources,created_date').eq('user_id', owner).eq('conversation_id', id).order('sequence_number', { ascending: false }).limit(30);
  if (messagesError) throw new Error('Conversation messages could not be loaded.');
  return { ...thread, messages: restoreEyraConversationMessages(Array.isArray(rows) ? rows.slice().reverse() : rows) };
}
