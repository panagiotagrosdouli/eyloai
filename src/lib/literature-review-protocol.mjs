// Human-authored protocol, not an AI-generated claim of PRISMA compliance.
// Persisted as a user-owned Project JSONB field through existing Supabase RLS.
export const REVIEW_PROTOCOL_VERSION = 1;
export const REVIEW_TYPES = Object.freeze(['scoping', 'systematic', 'narrative']);
export const SCREENING_DECISIONS = Object.freeze(['undecided', 'include', 'exclude']);

function clean(value, limit = 6000) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function emptyReviewProtocol() {
  return {
    version: REVIEW_PROTOCOL_VERSION,
    question: '',
    review_type: 'scoping',
    search_databases: 'OpenAlex, Crossref, Europe PMC, arXiv',
    search_strings: '',
    search_date: '',
    inclusion_criteria: '',
    exclusion_criteria: '',
    methods_notes: '',
    screening: [],
  };
}

/**
 * @param {Record<string, any>} input
 * @param {string[]} authorizedPaperIds IDs actually returned by the user's
 *   authenticated SavedPaper repository. Never accept arbitrary paper IDs.
 */
export function validateReviewProtocol(input = {}, authorizedPaperIds = []) {
  const errors = [];
  const validIds = new Set(authorizedPaperIds.map(String));
  const result = {
    version: REVIEW_PROTOCOL_VERSION,
    question: clean(input.question, 500),
    review_type: REVIEW_TYPES.includes(input.review_type) ? input.review_type : 'scoping',
    search_databases: clean(input.search_databases, 1000),
    search_strings: clean(input.search_strings, 6000),
    search_date: clean(input.search_date, 20),
    inclusion_criteria: clean(input.inclusion_criteria, 4000),
    exclusion_criteria: clean(input.exclusion_criteria, 4000),
    methods_notes: clean(input.methods_notes, 4000),
    screening: [],
  };
  if (!result.question) errors.push('Enter a research question.');
  if (!result.search_strings) errors.push('Record at least one reproducible search string.');
  if (!result.inclusion_criteria || !result.exclusion_criteria) {
    errors.push('Record both inclusion and exclusion criteria.');
  }
  if (result.search_date && !/^\d{4}-\d{2}-\d{2}$/.test(result.search_date)) {
    errors.push('Use YYYY-MM-DD for the search date.');
  }
  if (result.search_date && /^\d{4}-\d{2}-\d{2}$/.test(result.search_date)) {
    const parsed = new Date(result.search_date + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result.search_date) {
      errors.push('The search date is not a valid calendar date.');
    }
  }

  const seen = new Set();
  const records = Array.isArray(input.screening) ? input.screening : [];
  if (records.length > 100) errors.push('Screen a maximum of 100 saved papers per protocol.');
  for (const item of records.slice(0, 100)) {
    const paperId = clean(item?.paper_id, 150);
    if (!paperId || !validIds.has(paperId)) {
      errors.push('One screening record is not in your authorized saved Library.');
      continue;
    }
    if (seen.has(paperId)) {
      errors.push('A publication has duplicate screening decisions.');
      continue;
    }
    seen.add(paperId);
    const decision = SCREENING_DECISIONS.includes(item?.decision) ? item.decision : 'undecided';
    const reason = clean(item?.reason, 500);
    if (decision === 'exclude' && !reason) errors.push('Record a reason for each excluded study.');
    result.screening.push({ paper_id: paperId, decision, reason });
  }

  return { ok: errors.length === 0, errors, protocol: result };
}

export function screeningCounts(protocol) {
  const records = Array.isArray(protocol?.screening) ? protocol.screening : [];
  return {
    considered: records.length,
    included: records.filter(item => item.decision === 'include').length,
    excluded: records.filter(item => item.decision === 'exclude').length,
    undecided: records.filter(item => item.decision === 'undecided').length,
  };
}

/** Export only human-reviewed records and known saved publication metadata. */
export function reviewProtocolSnapshot(project, protocol, savedPapers, exportedAt) {
  const indexed = new Map(savedPapers.map(paper => [String(paper.id), paper]));
  const screening = (protocol.screening || []).flatMap(record => {
    const paper = indexed.get(String(record.paper_id));
    if (!paper) return [];
    return [{
      paper_id: record.paper_id,
      title: paper.title || '',
      doi: paper.doi || '',
      url: paper.url || '',
      year: paper.year || null,
      decision: record.decision,
      reason: record.reason,
    }];
  });
  return {
    format: 'eylo-literature-review-protocol',
    version: REVIEW_PROTOCOL_VERSION,
    exported_at: exportedAt,
    project_id: project.id,
    project_title: project.title || '',
    protocol: { ...protocol, screening },
    counts: screeningCounts({ screening }),
    reporting_note: 'Researcher-authored protocol and screening log. Not a PRISMA-compliant systematic review or evidence-synthesis certification.',
  };
}
