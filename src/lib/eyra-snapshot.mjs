import { normalizeEyraConversation } from './eyra-conversation.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function snapshotPayload(title, messages) {
  const normalized = normalizeEyraConversation(messages).filter(message => !message.welcome);
  if (!normalized.some(message => message.role === 'user')) throw new Error('Send a message before saving a conversation.');
  if (normalized.some(message => !message.content || message.content.length > 16000)) throw new Error('A message exceeds the canonical conversation text limit.');
  const payload = { p_title: title, p_messages: normalized.map(message => ({ role: message.role === 'eyra' ? 'assistant' : 'user', text: message.content, sources: message.sources })) };
  if (new TextEncoder().encode(JSON.stringify(payload.p_messages)).byteLength > 500000) throw new Error('Conversation sources exceed the snapshot size budget. Start a shorter conversation.');
  return payload;
}
export async function snapshotIdentity(payload, previous) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  return { fingerprint, id: previous?.fingerprint === fingerprint && UUID.test(previous?.id) ? previous.id : crypto.randomUUID() };
}
export function conversationExport(title, messages, exportedAt = new Date().toISOString()) {
  return { schema_version: 1, title: String(title || 'EYRA conversation').slice(0, 180), exported_at: exportedAt,
    notice: 'Private conversation export. Source metadata reflects the saved retrieval, not a fresh verification. This export does not call AI or save records.',
    messages: normalizeEyraConversation(messages) };
}
