/**
 * Interpret only explicit, bounded research-goal phrases.
 * This helper never performs retrieval, sends AI requests or writes user records.
 * Unrecognized questions pass through unchanged to discovery.
 */
const GOAL_PATTERNS = [
  {
    goal: 'review',
    pattern: /^(?:(?:i\s+(?:want|would\s+like|need|plan)\s+to|please|help\s+me\s+to|help\s+me)\s+)?(?:prepare|write|start|create|conduct|do|develop)\s+(?:(?:a|an|my)\s+)?(?:(?:systematic|scoping|narrative)\s+)?literature\s+review\s+(?:on|about|of|for)\s+(.+)$/i,
  },
  {
    goal: 'thesis',
    pattern: /^(?:(?:i\s+(?:want|would\s+like|need)\s+to|please|help\s+me)\s+)?(?:find|identify|explore|investigate)\s+(?:(?:a|the)\s+)?research\s+gap\s+(?:in|on|about)\s+(.+)$/i,
  },
  {
    goal: 'understand',
    pattern: /^(?:(?:i\s+(?:want|would\s+like|need)\s+to|please|help\s+me)\s+)?(?:understand|explore|learn\s+about)\s+(?:the\s+research\s+on\s+|the\s+field\s+of\s+)?(.+)$/i,
  },
];

/**
 * @param {unknown} input
 * @returns {{topic: string, goal: 'review'|'thesis'|'understand'} | null}
 */
export function interpretResearchGoal(input) {
  if (typeof input !== 'string') return null;
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text || text.length > 2000) return null;
  for (const { goal, pattern } of GOAL_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const topic = match[1].replace(/[.!?]+$/, '').trim();
    if (topic.length < 3 || !/[\p{L}\p{N}]/u.test(topic)) return null;
    return { topic, goal };
  }
  return null;
}
