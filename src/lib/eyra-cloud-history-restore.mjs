import { normalizeEyraConversation } from './eyra-conversation.mjs';

// Treat database row payloads as untrusted. Do not silently drop malformed
// saved messages or expose raw database contents in a client error.
export function restoreEyraConversationMessages(rows) {
  if (!Array.isArray(rows)) {
    throw new Error('Saved conversation messages could not be verified. Reload before retrying.');
  }
  const messages = rows.map(row => {
    const role = row?.role === 'assistant' ? 'eyra' : row?.role;
    const content = row?.content?.text;
    const timestamp = Date.parse(row?.created_date);
    if (!['user', 'eyra'].includes(role) || typeof content !== 'string'
      || !Number.isFinite(timestamp) || (row.sources !== null && row.sources !== undefined && !Array.isArray(row.sources))) {
      throw new Error('Saved conversation contains invalid message data. No messages were loaded.');
    }
    return { role, content, sources: row.sources || [], mode: 'saved', timestamp };
  });
  try {
    return normalizeEyraConversation(messages);
  } catch {
    throw new Error('Saved conversation could not be verified. No messages were loaded.');
  }
}
