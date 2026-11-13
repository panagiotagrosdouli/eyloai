import { getUsableSession, requireSupabase } from '@/lib/supabaseClient';
import { normalizeEyraConversation } from './eyra-conversation.mjs';

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
export async function saveEyraConversation(title, messages) {
  const { client } = await authenticatedClient();
  const normalized = normalizeEyraConversation(messages).filter(message => !message.welcome);
  if (normalized.some(message => !message.content || message.content.length > 16000)) throw new Error('A message exceeds the canonical conversation text limit.');
  const { data, error } = await client.rpc('save_eyra_conversation_snapshot', {
    p_title: title, p_messages: normalized.map(message => ({ role: message.role === 'eyra' ? 'assistant' : 'user', text: message.content, sources: message.sources })),
  });
  if (error) throw new Error('Conversation snapshot was not saved. Check staging configuration and try again.');
  return data;
}
export async function loadEyraConversation(id) {
  const { client, owner } = await authenticatedClient();
  const { data: thread, error } = await client.from('eyra_conversations').select('id,title,version,updated_date').eq('user_id', owner).eq('id', id).single();
  if (error || !thread) throw new Error('Conversation not found.');
  const { data: rows, error: messagesError } = await client.from('eyra_messages').select('role,content,sources,created_date').eq('user_id', owner).eq('conversation_id', id).order('sequence_number', { ascending: true }).limit(30);
  if (messagesError) throw new Error('Conversation messages could not be loaded.');
  return { ...thread, messages: normalizeEyraConversation(rows.map(row => ({ role: row.role === 'assistant' ? 'eyra' : row.role, content: row.content.text, sources: row.sources, mode: 'saved', timestamp: Date.parse(row.created_date) }))) };
}
