/**
 * One EYRA Command Center user-message persistence attempt.
 * Pure, injectable transport so retry/auth behavior is testable without
 * Supabase, an OpenAI key, or a browser.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = value => typeof value === 'string' && UUID.test(value);

export function makePendingEyraUserMessage(content, conversationId, timestamp = Date.now(), uuid = () => crypto.randomUUID()) {
  const text = String(content || '').trim();
  if (!text || text.length > 16000 || !isUuid(conversationId)) {
    throw new Error('Message is empty, too long, or has an invalid conversation ID.');
  }
  return {
    id: uuid(),
    conversationId,
    conversationTitle: text.slice(0, 180),
    role: 'user',
    content: text,
    timestamp,
    persistence: 'saving',
  };
}

function saveError(message, status = 0, code = 'CONVERSATION_SAVE_UNAVAILABLE') {
  return Object.assign(new Error(message), { status, code });
}

async function postWrite(token, body, fetchImpl) {
  const response = await fetchImpl('/api/eyra-conversation-write', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw saveError(
      response.status === 401 ? 'Sign in again to save this message.'
        : response.status === 404 ? 'This conversation is unavailable for your account.'
        : response.status === 409 ? 'This save ID was already used with different content.'
        : response.status === 400 ? 'This message could not be saved because its content was rejected.'
        : 'Saving could not be confirmed. Retry using the same message ID.',
      response.status,
      result?.code || 'CONVERSATION_SAVE_UNAVAILABLE',
    );
  }
  return result;
}

export function eyraPersistenceStatus(error) {
  if (error?.code === 'EYRA_LOCAL_ONLY') return 'local-only';
  if (error?.code === 'EYRA_OWNER_MISMATCH') return 'failed';
  if ([400, 401, 403, 404, 409].includes(error?.status)) return 'failed';
  return 'unconfirmed';
}

export async function saveEyraUserMessage(message, {
  getSession,
  fetchImpl,
  onIdentity = (ownerId) => { void ownerId; },
}) {
  if (message?.role !== 'user' || !isUuid(message.id) || !isUuid(message.conversationId)
      || typeof message.content !== 'string'
      || !message.content.trim() || message.content.length > 16000
      || typeof message.conversationTitle !== 'string'
      || !message.conversationTitle.trim() || message.conversationTitle.length > 180) {
    throw saveError('Invalid message for saving.', 400, 'EYRA_INVALID_MESSAGE');
  }

  // Validation must precede *both* write calls. No bearer means local-only.
  const session = await getSession();
  if (!session?.access_token || !isUuid(session?.user?.id)) {
    throw saveError('Not signed in. This message is available only in this browser session.', 0, 'EYRA_LOCAL_ONLY');
  }
  if (message.ownerId && message.ownerId !== session.user.id) {
    throw saveError('This message belongs to another signed-in account.', 403, 'EYRA_OWNER_MISMATCH');
  }
  onIdentity(session.user.id);

  const created = await postWrite(session.access_token, {
    action: 'create', id: message.conversationId, title: message.conversationTitle,
  }, fetchImpl);
  if (created?.conversation?.id !== message.conversationId) {
    throw saveError('Conversation creation was not confirmed.');
  }

  const saved = await postWrite(session.access_token, {
    action: 'append',
    conversation_id: message.conversationId,
    message_id: message.id,
    role: 'user',
    content: { text: message.content },
  }, fetchImpl);
  if (saved?.message?.id !== message.id
      || saved.message.conversation_id !== message.conversationId
      || saved.message.role !== 'user'
      || saved.message.content?.text !== message.content
      || !Number.isSafeInteger(Number(saved.message.sequence_number))
      || Number(saved.message.sequence_number) < 1) {
    throw saveError('Message saving was not confirmed.');
  }
  return saved.message;
}
