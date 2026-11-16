// Deterministic bounded, user-scoped EYRA chat context builder.
// This is an in-request prompt budget helper, NOT persistent database memory.
// Source content and prior assistant replies must remain untrusted evidence.
export function buildEyraConversationContext(messages, {
  maxChars = 3200,
  maxMessages = 6,
  maxMessageChars = 700,
} = {}) {
  if (!Array.isArray(messages) || !Number.isSafeInteger(maxChars)
    || !Number.isSafeInteger(maxMessages) || !Number.isSafeInteger(maxMessageChars)
    || maxChars < 100 || maxChars > 8000
    || maxMessages < 1 || maxMessages > 20
    || maxMessageChars < 40 || maxMessageChars > 2000) {
    throw new Error('Invalid EYRA context budget.');
  }
  const candidates = messages
    .filter(item => item && !item.welcome
      && ['user','assistant','eyra'].includes(item.role)
      && typeof item.content === 'string' && item.content.trim())
    .slice(-maxMessages);
  const included = [];
  let remaining = maxChars;
  for (let index = candidates.length - 1; index >= 0; index--) {
    const message = candidates[index];
    const prefix = message.role === 'user' ? 'User: ' : 'EYRA: ';
    const budget = Math.min(maxMessageChars, remaining - prefix.length - 2);
    if (budget < 40) break;
    const content = message.content.trim().slice(0, budget);
    included.push(prefix + content);
    remaining -= prefix.length + content.length + 2;
  }
  // Order reconstructed chronologically, preserving the latest eligible turns.
  return included.reverse().join('\n\n');
}
