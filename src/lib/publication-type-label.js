const RECORD_TYPE_LABELS = new Map([
  ['article', 'Article record'],
  ['article-journal', 'Journal article record'],
  ['journal-article', 'Journal article record'],
  ['journalarticle', 'Journal article record'],
  ['review', 'Review record'],
  ['review-article', 'Review article record'],
  ['reviewarticle', 'Review article record'],
  ['preprint', 'Preprint'],
  ['posted-content', 'Posted content'],
  ['postedcontent', 'Posted content'],
  ['proceedings-article', 'Conference paper record'],
  ['conferencepaper', 'Conference paper record'],
]);

export function publicationTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return RECORD_TYPE_LABELS.get(normalized) || 'Record type not reported';
}
