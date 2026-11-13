import { checkEyraCitationIds, isSafeEyraSourceUrl } from './eyra-citation-ids.mjs';

export function eyraConversationKey(userId) {
  return typeof userId === 'string' && userId.trim() && userId.length <= 200
    ? `eyra:conversation:v3:${encodeURIComponent(userId)}` : null;
}

export function normalizeEyraConversation(value) {
  if (!Array.isArray(value)) throw new Error('Conversation history must be a list.');
  let characters = 0;
  return value.slice(-30).map(message => {
    if (!['user', 'eyra'].includes(message?.role) || typeof message.content !== 'string' || message.content.length > 24_000) throw new Error('Conversation contains an unsupported message.');
    characters += message.content.length;
    if (characters > 120_000) throw new Error('Conversation is too large to save. Start a new conversation.');
    const sources = (Array.isArray(message.sources) ? message.sources : []).slice(0, 30).filter(source => /^[PRIF]\d{1,3}$/.test(source?.id) && isSafeEyraSourceUrl(source?.url)).map(source => ({
      id: source.id, url: source.url.slice(0, 2000), title: String(source.title || '').slice(0, 1000), type: String(source.type || '').slice(0, 40), meta: String(source.meta || '').slice(0, 2000),
    }));
    if (message.role === 'eyra' && !checkEyraCitationIds(message.content, sources).valid) throw new Error('Conversation contains a citation outside its saved source set.');
    return { role: message.role, content: message.content, timestamp: Number.isFinite(message.timestamp) ? message.timestamp : Date.now(), mode: String(message.mode || 'research').slice(0, 40), sources, ...(message.welcome ? { welcome: true } : {}) };
  });
}
