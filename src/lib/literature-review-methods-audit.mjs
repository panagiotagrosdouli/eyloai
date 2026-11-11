/**
 * A documentation inventory, not a quality score, reporting guideline
 * certification or a claim that a review is exhaustive.
 */
export function auditReviewMethods(protocol = {}, { libraryRowsShown = 0, listLimit = 100 } = {}) {
  const has = key => typeof protocol?.[key] === 'string' && protocol[key].trim().length > 0;
  const entries = [
    { id: 'question', label: 'Research question recorded', recorded: has('question') },
    { id: 'databases', label: 'Actual databases or sources recorded', recorded: has('search_databases') },
    { id: 'queries', label: 'Exact search strings recorded', recorded: has('search_strings') },
    { id: 'date', label: 'Date of executed search recorded', recorded: has('search_date') },
    { id: 'criteria', label: 'Inclusion and exclusion criteria recorded', recorded: has('inclusion_criteria') && has('exclusion_criteria') },
    { id: 'limitations', label: 'Method limitations and deviations documented', recorded: has('methods_notes') },
  ];
  const screenings = Array.isArray(protocol?.screening) ? protocol.screening : [];
  const decisions = screenings.filter(row => row?.decision === 'include' || row?.decision === 'exclude');
  const excludedWithoutReason = screenings.filter(row => row?.decision === 'exclude' && !String(row?.reason || '').trim()).length;
  const warnings = [];
  if (libraryRowsShown >= listLimit) warnings.push('The saved Library reached the current loading limit; screening may omit older publications.');
  if (excludedWithoutReason) warnings.push('Some excluded records are missing a researcher-authored reason.');
  if (!decisions.length) warnings.push('No include or exclude decisions have been documented.');
  return {
    entries,
    recorded: entries.filter(entry => entry.recorded).length,
    requiredDocumentation: entries.length,
    screenedDecisions: decisions.length,
    warnings,
    note: 'Documentation inventory only. This does not establish review completeness, reproducibility, evidence quality, or PRISMA compliance.',
  };
}
