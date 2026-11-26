import { PROPOSAL_SECTIONS } from './research-proposal-studio.mjs';

/** Deterministic structural and citation-ID checks; semantic claim support remains human review. */
export function reviewProposalDraft({ sections = [], methodologyPlan = {}, papers = [], requirements = null } = {}) {
  const findings = [];
  const sectionsById = new Map(sections.map(section => [section.section_id, section]));
  const allowedSourceIds = new Set(papers.map(paper => String(paper.id)));
  const sourceById = new Map(papers.filter(paper => paper?.id).map(paper => [String(paper.id), paper]));
  const claims = [
    ...sections.flatMap(section => (section.claims || []).map(claim => ({ ...claim, section_id: section.section_id }))),
    ...Object.entries(methodologyPlan).flatMap(([topic, field]) => (field?.claims || []).map(claim => ({ ...claim, section_id: topic }))),
  ];
  const add = (pass, label, status, details, action) => findings.push({ pass, label, status, details, action });
  const missingSections = PROPOSAL_SECTIONS.filter(({ id }) => !sectionsById.has(id) || sectionsById.get(id)?.status === 'needs_input').map(({ id }) => id);
  add('A', 'Required-section completeness', missingSections.length ? 'needs_review' : 'passed', missingSections.length ? `Sections requiring researcher input: ${missingSections.join(', ')}.` : 'All proposal sections have a recorded state.', 'Complete, remove or mark each section not applicable with a rationale.');

  const objectiveText = (sectionsById.get('research_objectives')?.claims || []).map(claim => claim.text || '').join(' ');
  const questionText = (sectionsById.get('research_questions')?.claims || []).map(claim => claim.text || '').join(' ');
  const stopWords = new Set(['about','after','also','among','and','are','does','for','from','how','into','is','its','more','not','of','on','or','our','the','their','this','through','to','using','what','when','which','with']);
  const terms = value => new Set(String(value).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)?.filter(word => !stopWords.has(word)) || []);
  const objectiveOverlap = [...terms(objectiveText)].filter(word => terms(questionText).has(word));
  add('B', 'Question and objective alignment', 'human_review_required', objectiveText && questionText ? `A lexical screen found ${objectiveOverlap.length} shared substantive term(s); this cannot establish conceptual alignment.` : 'A research question or objective needs researcher input.', 'Map each objective to one or more research questions and planned outcomes.');

  const methodGaps = Object.entries(methodologyPlan).filter(([, field]) => field?.status === 'needs_input').map(([id]) => id);
  add('C', 'Methodological coherence', 'human_review_required', methodGaps.length ? `Methodology topics requiring input: ${methodGaps.join(', ')}.` : 'Automated checks cannot establish whether the design, sampling, measures and analysis answer the questions.', 'Trace every question and objective through design, sampling, measures, analysis and planned interpretation.');

  const unresolvedCitations = claims.flatMap(claim => (claim.source_ids || []).filter(id => !sourceById.has(String(id))));
  const weakIdentityRecords = [...sourceById.values()].filter(paper => !String(paper.source_id || paper.doi || paper.url || '').trim());
  add('D', 'Citation identity', unresolvedCitations.length || weakIdentityRecords.length ? 'failed' : 'passed', unresolvedCitations.length ? `${unresolvedCitations.length} citation reference(s) do not resolve to selected project records.` : weakIdentityRecords.length ? `${weakIdentityRecords.length} selected record(s) lack a stable source identifier, DOI or URL.` : 'Citation IDs resolve to selected project records with an available identity field. This does not validate bibliographic correctness or evidence support.', 'Verify each source identity against its publisher or a trusted registry.');

  const evidenceClaims = claims.filter(claim => ['source_fact', 'interpretation', 'finding', 'conclusion'].includes(String(claim.kind || '').toLowerCase()));
  const unsupportedEvidenceLabels = evidenceClaims.filter(claim => !(claim.source_ids || []).length);
  add('E', 'Evidence and source support', 'human_review_required', `${evidenceClaims.length} source-sensitive claim(s) were classified; ${unsupportedEvidenceLabels.length} have no linked source ID. A linked citation does not show that it supports a claim.`, 'Check each original source for the claim, context, population, result and limitation; link evidence or rewrite unsupported statements.');

  const timeline = sectionsById.get('research_timeline')?.claims || [];
  const dateTokens = timeline.flatMap(claim => claim.text.match(/\b(?:20\d{2}|\d{1,2}\s+months?|Q[1-4])\b/gi) || []);
  const negationPattern = /\b(no|not|never|without|increase|decrease|improve|worsen|effective|ineffective|significant|non-significant)\b/i;
  const potentialContradiction = claims.some((left, index) => claims.slice(index + 1).some(right => {
    const shared = [...terms(left.text)].filter(word => terms(right.text).has(word));
    const negative = text => /\b(no|not|never|without|decrease|worsen|ineffective|non-significant)\b/i.test(text || '');
    return shared.length >= 3 && negationPattern.test(left.text || '') && negationPattern.test(right.text || '') && negative(left.text) !== negative(right.text);
  }));
  add('F', 'Internal consistency', potentialContradiction || dateTokens.length ? 'needs_review' : 'human_review_required', potentialContradiction ? 'A lexical screen found overlapping claims with opposing polarity markers.' : dateTokens.length ? 'Timeline dates or durations need comparison with the full plan and any funding call.' : 'No simple contradiction rule fired; this does not show the proposal is internally consistent.', 'Compare claims, populations, outcomes, quantities, dates and assumptions across sections.');

  const ethicsMissing = !sectionsById.has('ethical_considerations') || sectionsById.get('ethical_considerations')?.status === 'needs_input';
  const reproducibilityMissing = !sectionsById.has('data_management_reproducibility') || sectionsById.get('data_management_reproducibility')?.status === 'needs_input';
  add('G', 'Ethics and reproducibility', ethicsMissing || reproducibilityMissing ? 'needs_review' : 'human_review_required', `Ethics section ${ethicsMissing ? 'needs input' : 'is present'}; data management and reproducibility section ${reproducibilityMissing ? 'needs input' : 'is present'}. Presence does not establish adequacy or approval.`, 'Review consent, risk, inclusion, privacy, data access, preregistration, materials, analysis code and retention as applicable.');
  add('H', 'Conclusions and uncertainty', 'human_review_required', 'Automated classification cannot establish whether conclusions exceed the evidence, design or available source text.', 'Check each conclusion against cited results, uncertainty, study design and limitations.');
  add('I', 'Language and presentation', 'human_review_required', 'Review clarity, academic style, discipline terminology, factual meaning and accessibility.', 'Edit for the target audience while preserving uncertainty and limitations.');
  add('J', 'Funding-call requirements', requirements ? 'needs_review' : 'not_applicable', requirements ? 'Compare each documented requirement and its provenance with the draft; ambiguous requirements need researcher confirmation.' : 'No official funding call was supplied; no compliance assessment was performed.', 'Use the official call text and confirm eligibility, format, limits, dates and annexes.');
  return findings;
}
