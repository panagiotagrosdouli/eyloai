import { checkEyraCitationIds } from './eyra-citation-ids.mjs';

/**
 * Check identity of cited retrieved metadata. Does not verify whether a
 * publication or announcement supports the associated scientific claim.
 */
export function assertPitchDeckEvidenceReferences(deck, papers = [], funding = []) {
  if (!deck || !Array.isArray(deck.slides) || deck.slides.length !== 10) {
    throw new Error('Pitch deck must contain exactly ten slides.');
  }
  const availableIds = [
    ...papers.slice(0, 10).map((_, i) => ({ id: 'P' + (i + 1) })),
    ...funding.slice(0, 8).map((_, i) => ({ id: 'F' + (i + 1) })),
  ];
  const sourceIds = new Set(availableIds.map(source => source.id));
  for (const slide of deck.slides) {
    if (!slide || !Array.isArray(slide.bullets) || !Array.isArray(slide.evidence_ids)) {
      throw new Error('Pitch deck slide format was incomplete.');
    }
    if (slide.evidence_ids.some(id => !sourceIds.has(id))) {
      throw new Error('Pitch deck has a citation that does not exist in retrieved sources.');
    }
    const text = [slide.title, slide.headline, ...slide.bullets, slide.speaker_notes].join('\n');
    const citationCheck = checkEyraCitationIds(text, availableIds);
    if (!citationCheck.valid) {
      throw new Error('Pitch deck text refers to a citation that does not exist in retrieved sources.');
    }
    // When text explicitly uses a source reference, include that ID in the
    // slide's displayed evidence manifest. This prevents hidden source claims.
    if (citationCheck.citedIds.some(id => !slide.evidence_ids.includes(id))) {
      throw new Error('Pitch deck citations are missing from the slide evidence list.');
    }
  }
  return deck;
}
