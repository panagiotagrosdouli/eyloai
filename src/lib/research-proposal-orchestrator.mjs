import { mergeScholarlyRecords } from './scholarly-record-identity.mjs';

export const PROPOSAL_WORKFLOW_STAGES = [
  'INTAKE', 'REQUIREMENTS', 'SOURCE_DISCOVERY', 'EVIDENCE_ANALYSIS',
  'PROPOSAL_PLANNING', 'SECTION_GENERATION', 'QUALITY_REVIEW', 'REVISION',
  'RESEARCHER_REVIEW', 'EXPORT_READY',
];

export const PROPOSAL_WORKFLOW_BUDGET = Object.freeze({
  searchStrategies: 3,
  recordsPerStrategy: 8,
  maximumSelectedRecords: 20,
  generationCalls: 3,
  retriesPerStage: 2,
  timeoutMs: 45_000,
});

const TERMINAL = new Set(['EXPORT_READY']);

export function planProposalQueries({ question, discipline = '' }) {
  const topic = String(question || '').trim().replace(/\s+/g, ' ').slice(0, 1200);
  const field = String(discipline || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (topic.length < 8) throw new Error('Enter a focused research topic or question (at least 8 characters).');
  const queries = [topic];
  if (field) queries.push(`${topic} ${field}`);
  const stopWords = new Set(['a', 'an', 'and', 'are', 'does', 'for', 'how', 'in', 'is', 'of', 'on', 'the', 'to', 'what', 'when', 'which', 'with']);
  const focusedTerms = topic.replace(/[?.,;:()\[\]{}]/g, ' ').split(/\s+/).filter(term => term && !stopWords.has(term.toLowerCase()));
  const focused = focusedTerms.slice(0, 8).join(' ');
  if (focused.length >= 8 && focused.toLowerCase() !== topic.toLowerCase()) queries.push(focused);
  return [...new Set(queries)].slice(0, PROPOSAL_WORKFLOW_BUDGET.searchStrategies);
}

export function deduplicateProposalSearchResults(results, limit = PROPOSAL_WORKFLOW_BUDGET.maximumSelectedRecords) {
  const papers = (Array.isArray(results) ? results : []).flatMap(result => Array.isArray(result?.papers) ? result.papers : []);
  return mergeScholarlyRecords(papers).slice(0, Math.max(0, Math.min(limit, PROPOSAL_WORKFLOW_BUDGET.maximumSelectedRecords)));
}

export function createProposalWorkflow({ projectId, question, discipline = '', purpose = 'academic', language = 'English', now = new Date().toISOString(), runId = '' }) {
  if (!projectId) throw new Error('A saved research project is required to start this workflow.');
  if (String(question || '').trim().length < 8) throw new Error('Enter a focused research topic or question (at least 8 characters).');
  if (!String(discipline || '').trim()) throw new Error('Add the scientific discipline before generating a proposal.');
  if (!String(purpose || '').trim() || !String(language || '').trim()) throw new Error('Choose a proposal purpose and preferred language.');
  return {
    schema_version: 1,
    run_id: runId || `${projectId}:${Date.parse(now) || Date.now()}`,
    status: 'running',
    stage: 'INTAKE',
    started_at: now,
    updated_at: now,
    completed_at: null,
    input: { question: String(question).trim().slice(0, 1200), discipline: String(discipline).trim().slice(0, 120), purpose: String(purpose).slice(0, 80), language: String(language).slice(0, 40) },
    completed_stages: ['INTAKE'],
    stage_attempts: {},
    source_queries: [],
    source_status: [],
    selected_source_ids: [],
    generation_calls: 0,
    error_code: '',
  };
}

export function advanceProposalWorkflow(run, nextStage, patch = {}, now = new Date().toISOString()) {
  if (!run || run.status !== 'running' || TERMINAL.has(run.stage)) throw new Error('This proposal workflow cannot advance.');
  const currentIndex = PROPOSAL_WORKFLOW_STAGES.indexOf(run.stage);
  const nextIndex = PROPOSAL_WORKFLOW_STAGES.indexOf(nextStage);
  if (nextIndex !== currentIndex + 1) throw new Error(`Invalid proposal workflow transition: ${run.stage} → ${nextStage}.`);
  return {
    ...run,
    ...patch,
    stage: nextStage,
    updated_at: now,
    completed_stages: [...new Set([...(run.completed_stages || []), run.stage])],
  };
}

export function failProposalWorkflow(run, errorCode = 'WORKFLOW_FAILED', now = new Date().toISOString()) {
  if (!run || run.status !== 'running') return run;
  return { ...run, status: 'failed', error_code: String(errorCode).slice(0, 80), updated_at: now };
}

export function cancelProposalWorkflow(run, now = new Date().toISOString()) {
  if (!run || run.status !== 'running') return run;
  return { ...run, status: 'cancelled', updated_at: now };
}

export function markProposalResearcherReviewed(run, now = new Date().toISOString()) {
  if (!run || run.status !== 'awaiting_researcher' || run.stage !== 'RESEARCHER_REVIEW') {
    throw new Error('The proposal can be marked reviewed only after the researcher review stage is ready.');
  }
  return {
    ...run,
    status: 'complete',
    stage: 'EXPORT_READY',
    completed_at: now,
    updated_at: now,
    completed_stages: [...new Set([...(run.completed_stages || []), 'RESEARCHER_REVIEW', 'EXPORT_READY'])],
  };
}

export function retryProposalWorkflowStage(run, now = new Date().toISOString()) {
  if (!run || run.status !== 'failed') throw new Error('Only a failed proposal workflow can be retried.');
  const attempts = Number(run.stage_attempts?.[run.stage] || 0);
  if (attempts >= PROPOSAL_WORKFLOW_BUDGET.retriesPerStage) throw new Error('The retry limit for this stage has been reached.');
  return {
    ...run,
    status: 'running',
    error_code: '',
    updated_at: now,
    stage_attempts: { ...run.stage_attempts, [run.stage]: attempts + 1 },
  };
}

export function getProposalWorkflowProgress(run) {
  const index = PROPOSAL_WORKFLOW_STAGES.indexOf(run?.stage);
  return Math.max(0, Math.min(100, Math.round(((index + (run?.status === 'complete' ? 1 : 0)) / PROPOSAL_WORKFLOW_STAGES.length) * 100)));
}

export function reviewProposalDraft({ sections = [], methodologyPlan = {}, papers = [], requirements = null }) {
  const findings = [];
  const sectionsById = new Map(sections.map(section => [section.section_id, section]));
  const sourceById = new Map(papers.filter(paper => paper?.id).map(paper => [String(paper.id), paper]));
  const claims = sections.flatMap(section => (section.claims || []).map(claim => ({ ...claim, section_id: section.section_id })));
  const add = (pass, label, status, details, actions) => findings.push({ pass, label, status, details, actions });
  const missingSections = ['research_title', 'abstract', 'background', 'research_gap', 'research_objectives', 'research_questions', 'research_methodology', 'sampling_and_data_sources', 'data_management_reproducibility', 'risk_management', 'research_timeline', 'bibliography']
    .filter(id => !sectionsById.has(id) || sectionsById.get(id)?.status === 'needs_input');
  add('A', 'Required-section completeness', missingSections.length ? 'needs_review' : 'passed', missingSections.length ? `Sections requiring researcher input: ${missingSections.join(', ')}.` : 'Core proposal sections are present.', missingSections.length ? ['Complete, remove or mark each listed section not applicable with a rationale.'] : ['Confirm that this structure matches the intended study or call.']);

  const objectiveText = (sectionsById.get('research_objectives')?.claims || []).map(claim => claim.text || '').join(' ');
  const questionText = (sectionsById.get('research_questions')?.claims || []).map(claim => claim.text || '').join(' ');
  const stopWords = new Set(['about','after','also','among','and','are','does','for','from','how','into','is','its','more','not','of','on','or','our','the','their','this','through','to','using','what','when','which','with']);
  const terms = value => new Set(String(value).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)?.filter(word => !stopWords.has(word)) || []);
  const objectiveOverlap = [...terms(objectiveText)].filter(word => terms(questionText).has(word));
  add('B', 'Research question and objective alignment', objectiveText && questionText ? 'needs_review' : 'needs_review', !objectiveText || !questionText ? 'A research question or objective needs researcher input.' : `A lexical screen found ${objectiveOverlap.length} shared substantive term${objectiveOverlap.length === 1 ? '' : 's'}; this cannot establish conceptual alignment.`, ['Map every objective to one or more research questions and planned outcomes; revise mismatches.']);

  const methodGaps = Object.entries(methodologyPlan).filter(([, field]) => field?.status === 'needs_input').map(([id]) => id);
  add('C', 'Methodological coherence', methodGaps.length ? 'needs_review' : 'human_review_required', methodGaps.length ? `Methodology topics requiring input: ${methodGaps.join(', ')}.` : 'Automated checks cannot validate whether design, sampling, measures and analysis answer the stated questions.', ['Trace each question and objective through design, sampling, measures, analysis and planned interpretation.']);

  const unresolvedCitations = claims.flatMap(claim => (claim.source_ids || []).filter(id => !sourceById.has(String(id))));
  const weakIdentityRecords = [...sourceById.values()].filter(paper => !String(paper.source_id || paper.doi || paper.url || '').trim());
  add('D', 'Citation identity', unresolvedCitations.length || weakIdentityRecords.length ? 'failed' : 'passed', unresolvedCitations.length ? `${unresolvedCitations.length} citation reference(s) do not resolve to the selected project records.` : weakIdentityRecords.length ? `${weakIdentityRecords.length} selected record(s) lack a stable source identifier, DOI or URL.` : 'Cited source IDs resolve to selected project records with an available identity field.', ['Resolve missing records and verify author, title, year, DOI and publication identity against the publisher or registry.']);

  const evidenceClaims = claims.filter(claim => ['source_fact', 'finding', 'conclusion'].includes(String(claim.kind || '').toLowerCase()));
  const unsupportedEvidenceLabels = evidenceClaims.filter(claim => !(claim.source_ids || []).length);
  add('E', 'Evidence and source-level verification', 'human_review_required', `${evidenceClaims.length} source-sensitive claim(s) were classified; ${unsupportedEvidenceLabels.length} have no linked source ID. A linked citation does not show that a source supports the claim.`, ['Open each original source and verify the exact claim, context, population, result and limitation; link evidence or rewrite unsupported statements.']);

  const dateTokens = (sectionsById.get('research_timeline')?.claims || []).flatMap(claim => String(claim.text || '').match(/\b(?:20\d{2}|\d{1,2}\s+months?|Q[1-4])\b/gi) || []);
  const negationPattern = /\b(no|not|never|without|increase|decrease|improve|worsen|effective|ineffective|significant|non-significant)\b/i;
  const potentialContradiction = claims.some((left, index) => claims.slice(index + 1).some(right => {
    const shared = [...terms(left.text)].filter(word => terms(right.text).has(word));
    return shared.length >= 3 && negationPattern.test(left.text || '') && negationPattern.test(right.text || '') && /\b(no|not|never|without|decrease|worsen|ineffective|non-significant)\b/i.test(left.text || '') !== /\b(no|not|never|without|decrease|worsen|ineffective|non-significant)\b/i.test(right.text || '');
  }));
  add('F', 'Internal contradictions', potentialContradiction || dateTokens.length ? 'needs_review' : 'human_review_required', potentialContradiction ? 'A lexical screen found claims with overlapping terms and opposing polarity markers.' : dateTokens.length ? 'Timeline dates or durations require consistency review against the full plan and call.' : 'No simple contradiction rule fired; this is not evidence that the proposal is internally consistent.', ['Compare claims, quantities, dates, populations, outcomes and assumptions across all sections.']);

  const ethicsMissing = !sectionsById.has('ethical_considerations') || sectionsById.get('ethical_considerations')?.status === 'needs_input';
  const reproducibilityMissing = !sectionsById.has('data_management_reproducibility') || sectionsById.get('data_management_reproducibility')?.status === 'needs_input';
  add('G', 'Ethics and reproducibility', ethicsMissing || reproducibilityMissing ? 'needs_review' : 'human_review_required', `Ethics section ${ethicsMissing ? 'needs input' : 'is present'}; data-management and reproducibility section ${reproducibilityMissing ? 'needs input' : 'is present'}. Presence does not establish adequacy or approval.`, ['Review consent, risk, inclusion, privacy, data access, preregistration, materials, analysis code and retention requirements as applicable.']);
  add('H', 'Unsubstantiated conclusions', 'human_review_required', 'Automated classification cannot establish whether conclusions exceed the evidence, design or available source text.', ['Check every conclusion against the cited results, uncertainty, study design and stated limitations.']);
  add('I', 'Language and presentation', 'human_review_required', 'Review clarity, academic style, discipline terminology, factual meaning and accessibility before use.', ['Edit for the target audience and verify that uncertainty and limitations remain visible.']);
  add('J', 'Funding-call requirements', requirements ? 'needs_review' : 'not_applicable', requirements ? 'Compare each documented call requirement and its provenance with the draft; ambiguous requirements need researcher confirmation.' : 'No official funding call was supplied.', ['Use the official call text and confirm eligibility, format, limits, dates and required annexes directly.']);
  return findings;
}
