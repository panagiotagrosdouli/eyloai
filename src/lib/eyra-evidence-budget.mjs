// EYRA receives source-linked excerpts, not unbounded provider metadata.
// Bound only *retrieved* context; the researcher's actual question is neither
// shortened nor rewritten. IDs stay aligned with the displayed paper order.
const MAX_PAPERS = 12;
const MAX_RESEARCHERS = 6;
const MAX_INSTITUTIONS = 4;
export const EYRA_GENERATED_PROMPT_LIMIT = 20_000;

function asText(value, limit) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value
    : typeof value === 'number' && Number.isFinite(value) ? String(value)
    : Array.isArray(value) ? value.map(item => typeof item === 'string' ? item : '').join(', ')
    : '';
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function sourceUrl(value) {
  const text = asText(value, 180);
  // Source URLs are evidence pointers, never dynamic instructions.
  return /^https:\/\//i.test(text) ? text : 'Not provided';
}

export function buildEyraAnalysisEvidence(papers = [], researchers = [], institutions = []) {
  const selectedPapers = (Array.isArray(papers) ? papers : []).slice(0, MAX_PAPERS);
  const selectedResearchers = (Array.isArray(researchers) ? researchers : []).slice(0, MAX_RESEARCHERS);
  const selectedInstitutions = (Array.isArray(institutions) ? institutions : []).slice(0, MAX_INSTITUTIONS);
  const paperContext = selectedPapers.map((p, i) => {
    const paper = p && typeof p === 'object' ? p : {};
    const indexedBy = asText(paper.indexed_by, 60) || 'not supplied';
    return `[P${i + 1}] "${asText(paper.title, 140) || 'Untitled'}" by ${asText(paper.authors, 75) || 'Unknown'} (${asText(paper.year, 8) || 'n/a'}) — ${asText(paper.cited_by_count, 12) || '0'} citations — Index: ${asText(paper.source_index || paper.source, 45) || 'not supplied'} — Co-indexed by: ${indexedBy} (one publication, not independent studies) — Abstract source: ${asText(paper.summary_source, 35) || 'not supplied'} — Metadata conflict: ${paper.metadata_conflict ? 'YES; verify source' : 'not detected; not independently verified'} — Type: ${asText(paper.discovery_category, 40) || 'not supplied'} — Record: ${sourceUrl(paper.url)}\nAbstract excerpt: ${asText(paper.summary, 180) || 'Not available'}`;
  }).join('\n\n');
  const researcherContext = selectedResearchers.map((r, i) => {
    const person = r && typeof r === 'object' ? r : {};
    return `[Researcher ${i + 1}] ${asText(person.name, 70) || 'Unnamed'} — ${asText(person.institution, 75) || 'Institution unknown'} — ${asText(person.works_count, 12) || 'n/a'} works, ${asText(person.citation_count, 12) || 'n/a'} citations — Areas: ${asText(person.research_areas, 100) || 'not supplied'}`;
  }).join('\n');
  const institutionContext = selectedInstitutions.map((inst, i) => {
    const institution = inst && typeof inst === 'object' ? inst : {};
    return `[Institution ${i + 1}] ${asText(institution.name, 85) || 'Unnamed'} (${asText(institution.country, 40) || 'unknown country'}) — ${asText(institution.works_count, 12) || 'n/a'} works, ${asText(institution.cited_by_count, 12) || 'n/a'} citations`;
  }).join('\n');
  const contextSize = paperContext.length + researcherContext.length + institutionContext.length;
  if (contextSize > 14_000) throw new Error('EYRA evidence context exceeds its bounded safety budget.');
  return { paperContext, researcherContext, institutionContext, paperCount: selectedPapers.length };
}

export function buildEyraReviewEvidence(papers = [], claims = []) {
  const snippets = (Array.isArray(papers) ? papers : []).slice(0, MAX_PAPERS).map((paper, i) =>
    `[P${i + 1}] Title: ${asText(paper?.title, 180) || 'Untitled'}\nAbstract excerpt: ${asText(paper?.summary, 260) || 'Unavailable'}`
  ).join('\n\n');
  const safeClaims = (Array.isArray(claims) ? claims : []).slice(0, 12)
    .filter(claim => /^[FT]\d+$/.test(claim?.id || ''))
    .map(claim => ({
      id: claim.id,
      claim: asText(claim.claim, 450),
      evidence: asText(claim.evidence, 250),
    }));
  return { snippets, claimsJson: JSON.stringify(safeClaims), reviewedCandidates: safeClaims.length };
}

export function assertEyraGeneratedPromptWithinBudget(prompt) {
  if (typeof prompt !== 'string' || prompt.length > EYRA_GENERATED_PROMPT_LIMIT) {
    throw new Error('EYRA source excerpts exceeded the analysis budget. Narrow the evidence selection and retry.');
  }
  return prompt;
}
