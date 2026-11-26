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
  const allowedSourceIds = new Set(papers.map(paper => String(paper.id)));
  const missingSections = ['research_title', 'abstract', 'background', 'research_gap', 'research_objectives', 'research_questions', 'research_methodology', 'sampling_and_data_sources', 'data_management_reproducibility', 'risk_management', 'research_timeline', 'bibliography']
    .filter(id => !sectionsById.has(id) || sectionsById.get(id)?.status === 'needs_input');
  findings.push({ pass: 'A', label: 'Structural completeness', status: missingSections.length ? 'needs_review' : 'passed', details: missingSections.length ? `Sections requiring researcher input: ${missingSections.join(', ')}.` : 'Core proposal sections are present.' });

  const unknownCitations = sections.flatMap(section => section.claims || []).flatMap(claim => claim.source_ids || []).filter(id => !allowedSourceIds.has(String(id)));
  findings.push({ pass: 'B', label: 'Citation integrity', status: unknownCitations.length ? 'failed' : 'passed', details: unknownCitations.length ? 'One or more citations do not resolve to the selected project records.' : 'Citations resolve to selected project records; this does not verify bibliographic or semantic accuracy.' });
  findings.push({ pass: 'C', label: 'Evidence support', status: 'human_review_required', details: 'AI citation matching does not establish that the source supports each claim. Verify claims against the original publications.' });

  const questionClaims = sectionsById.get('research_questions')?.claims || [];
  const designClaims = [...(sectionsById.get('research_methodology')?.claims || []), ...(sectionsById.get('study_design')?.claims || [])];
  const methodGaps = Object.entries(methodologyPlan).filter(([, field]) => field?.status === 'needs_input').map(([id]) => id);
  const coherenceStatus = questionClaims.length && designClaims.length && !methodGaps.length ? 'needs_review' : 'needs_review';
  findings.push({ pass: 'D', label: 'Methodological coherence', status: coherenceStatus, details: 'Check that each research question, objective, design, sampling plan and analysis method align. This relationship requires researcher review.' });

  const timeline = sectionsById.get('research_timeline')?.claims || [];
  const dateTokens = timeline.flatMap(claim => claim.text.match(/\b(?:20\d{2}|\d{1,2}\s+months?|Q[1-4])\b/gi) || []);
  findings.push({ pass: 'E', label: 'Internal consistency', status: dateTokens.length ? 'needs_review' : 'passed', details: dateTokens.length ? 'Review proposed dates and durations for consistency with institutional and funder requirements.' : 'No conflicting date patterns were detected by the automated check.' });
  findings.push({ pass: 'F', label: 'Language and presentation', status: 'human_review_required', details: 'Review clarity, academic style, discipline terminology and factual meaning before use.' });
  findings.push({ pass: 'G', label: 'Grant compliance', status: requirements ? 'needs_review' : 'not_applicable', details: requirements ? 'Compare every call requirement with the draft and confirm extracted requirements against the official call.' : 'No official funding call was supplied.' });
  return findings;
}
