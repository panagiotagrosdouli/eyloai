/**
 * Researcher-authored reporting checklist, not a reproducibility determination.
 * No manuscript is uploaded or sent to an AI model by this feature.
 */
export const REPRODUCIBILITY_ITEMS = Object.freeze([
  ['research_question', 'Research question and hypotheses', 'Record prespecified hypotheses, objectives and deviations.'],
  ['study_design', 'Study design and sampling', 'Describe design, sample-size rationale and recruitment.'],
  ['variables', 'Variables and measures', 'Define outcomes, exposures, instruments and operational definitions.'],
  ['procedure', 'Procedures and experimental conditions', 'Record protocol steps, settings and laboratory conditions.'],
  ['analysis', 'Statistical methods and analysis plan', 'Specify transformations, tests, models and assumptions.'],
  ['data_availability', 'Data availability and access conditions', 'Record repository DOI, data dictionary or access restrictions.'],
  ['code_availability', 'Code and computational environment', 'Record versioned code, package versions, seeds and environment.'],
  ['ethics', 'Ethics, consent and disclosure', 'Describe ethics review, consent and relevant conflicts/disclosures.'],
]);
export const REPRODUCIBILITY_STATUSES = Object.freeze(['not_assessed', 'documented', 'missing', 'not_applicable']);
const validIds = new Set(REPRODUCIBILITY_ITEMS.map(item => item[0]));
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export function emptyReproducibilityReview() {
  return { version: 1, manuscript_reference: '', scope_notes: '', entries: {}, updated_at: '' };
}

export function validateReproducibilityReview(input = {}) {
  const errors = [];
  const entries = {};
  const raw = input?.entries && typeof input.entries === 'object' && !Array.isArray(input.entries) ? input.entries : {};
  if (Object.keys(raw).some(key => !validIds.has(key))) errors.push('Unknown assessment item.');
  for (const [id] of REPRODUCIBILITY_ITEMS) {
    const source = raw[id] || {};
    const status = source.status || 'not_assessed';
    if (!REPRODUCIBILITY_STATUSES.includes(status)) {
      errors.push(`Invalid status for ${id}.`);
      continue;
    }
    const evidence = clean(source.evidence, 1200);
    if (status === 'documented' && !evidence) {
      errors.push(`Provide a source location or explanation for ${id}.`);
    }
    if (status === 'not_applicable' && !evidence) {
      errors.push(`Explain why ${id} is not applicable.`);
    }
    entries[id] = { status, evidence };
  }
  const manuscript_reference = clean(input?.manuscript_reference, 400);
  const scope_notes = clean(input?.scope_notes, 2000);
  if (!manuscript_reference) errors.push('Record the manuscript, protocol, dataset or project materials assessed.');
  return {
    ok: errors.length === 0,
    errors,
    value: {
      version: 1, manuscript_reference, scope_notes, entries,
      updated_at: clean(input?.updated_at, 40),
    },
  };
}

export function reproducibilityDocumentationSummary(review) {
  const raw = review?.entries || {};
  const counts = Object.fromEntries(REPRODUCIBILITY_STATUSES.map(status => [status, 0]));
  for (const [id] of REPRODUCIBILITY_ITEMS) {
    const status = raw?.[id]?.status;
    counts[REPRODUCIBILITY_STATUSES.includes(status) ? status : 'not_assessed'] += 1;
  }
  return {
    counts,
    total: REPRODUCIBILITY_ITEMS.length,
    disclaimer: 'Human-authored reporting inventory. Documented information is not proof that methods or results can be reproduced.',
  };
}

export function reproducibilityReviewSnapshot(project, review, exportedAt) {
  const result = validateReproducibilityReview(review);
  if (!result.ok) throw new Error(result.errors.join(' '));
  return {
    format: 'eylo-reproducibility-documentation', version: 1,
    project_id: String(project?.id || ''), project_title: clean(project?.title, 400),
    exported_at: exportedAt, review: result.value,
    summary: reproducibilityDocumentationSummary(result.value),
    limitation: 'Self-reported source locations have not been independently validated; no rerun or reproducibility verification was performed.',
  };
}
