import { checkEyraCitationIds } from './eyra-citation-ids.mjs';

/**
 * Validate citations against records retrieved for one actual project analysis
 * request. This checks ID provenance, NOT whether an abstract supports a claim.
 */
export function validateProjectEyraReport(result, { papers = [], researchers = [], opportunities = [], hasLiveEvidence = false } = {}) {
  if (typeof result !== 'string' || !result.trim()) {
    throw new Error('EYRA did not return a valid evidence report; no analysis was saved.');
  }
  const sources = [
    ...papers.slice(0, 10).map((_, index) => ({ id: `P${index + 1}` })),
    ...researchers.slice(0, 8).map((_, index) => ({ id: `R${index + 1}` })),
    ...opportunities.slice(0, 8).map((_, index) => ({ id: `F${index + 1}` })),
  ];
  const check = checkEyraCitationIds(result, sources);
  if (!check.valid) {
    throw new Error('EYRA cited an unverified source ID. No analysis was saved; regenerate before relying on the report.');
  }
  if (hasLiveEvidence && !check.citedIds.length) {
    throw new Error('EYRA omitted source IDs from a report with retrieved evidence. No sourced analysis was saved.');
  }
  return result;
}
