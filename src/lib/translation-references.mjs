/** Conservative integrity check, not verification of translation quality or truth.
 * Numeric bracket citations, DOI identifiers and supplied URLs must survive
 * unchanged (including repeated occurrences); no new reference may be added.
 * Author/year prose citations still require the user's language/source review.
 */
function referenceCounts(text) {
  const counts = new Map();
  const patterns = [
    /\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]/gu,
    /\b10\.\d{4,9}\/[^\s<>"\[\]]+/giu,
    /https?:\/\/[^\s<>"\[\]]+/giu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const reference = match[0].replace(/[.,;:!?]+$/u, '');
      counts.set(reference, (counts.get(reference) || 0) + 1);
    }
  }
  return counts;
}
export function assertTranslationReferences(source, translation) {
  if (typeof source !== 'string' || typeof translation !== 'string' || !translation.trim()) {
    throw new Error('A complete, nonempty translation is required before saving.');
  }
  const original = referenceCounts(source), result = referenceCounts(translation);
  if (original.size !== result.size || [...original].some(([key, count]) => result.get(key) !== count)) {
    throw new Error('Translation reference check failed: numeric citations, DOI identifiers or URLs changed. Review the source and regenerate; this output cannot be saved as reviewed.');
  }
  return true;
}
