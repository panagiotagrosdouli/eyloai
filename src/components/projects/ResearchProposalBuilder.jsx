import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Save, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { saveDiscoveredGapPaper } from '@/lib/research-gap-literature-save.mjs';
import { safeResearchSourceUrl } from '@/lib/research-source-url.mjs';
import { cancelProposalWorkflow, createProposalWorkflow, advanceProposalWorkflow, deduplicateProposalSearchResults, failProposalWorkflow, getProposalWorkflowProgress, markProposalResearcherReviewed, planProposalQueries, PROPOSAL_WORKFLOW_BUDGET, PROPOSAL_WORKFLOW_STAGES, reviewProposalDraft, retryProposalWorkflowStage } from '@/lib/research-proposal-orchestrator.mjs';
import {
  bibliographyForProposal, buildResearchProposalPrompt, defaultBibliographyEntry,
  exportResearchProposalMarkdown, hasProposalSaveReceipt, METHODOLOGY_TOPICS,
  PROPOSAL_SECTIONS, PROPOSAL_STATUSES, projectLinkedProposalPapers,
  proposalErrorMessage, RESEARCH_TYPES, RESEARCH_PROPOSAL_SCHEMA, validateResearchProposalDraft,
} from '@/lib/research-proposal-studio.mjs';

function blankProposal() {
  return {
    sections: PROPOSAL_SECTIONS.map(section => ({ section_id: section.id, status: 'needs_input', claims: [] })),
    methodology_plan: Object.fromEntries(METHODOLOGY_TOPICS.map(topic => [topic.id, { status: 'needs_input', claims: [] }])),
  };
}

function readLocalProposalCheckpoint(projectId) {
  try {
    const value = JSON.parse(window.localStorage.getItem(`eylo:proposal-draft:${projectId}`) || 'null');
    return value?.sections && value?.methodology_plan ? value : null;
  } catch { return null; }
}

export default function ResearchProposalBuilder({ project, savedPapers, onProjectSaved, onPapersChanged }) {
  const linkedPapers = useMemo(() => projectLinkedProposalPapers(savedPapers, project.id), [savedPapers, project.id]);
  const stored = project.research_proposal && typeof project.research_proposal === 'object' ? project.research_proposal : {};
  const localDraft = readLocalProposalCheckpoint(project.id);
  const initialIds = stored.selected_paper_ids || project.literature_review?.selected_paper_ids || project.evidence_matrix?.selected_paper_ids || [];
  const [question, setQuestion] = useState(stored.research_question || project.evidence_matrix?.research_question || project.literature_review?.research_question || '');
  const [discipline, setDiscipline] = useState(stored.discipline || '');
  const [purpose, setPurpose] = useState(stored.purpose || 'academic');
  const [language, setLanguage] = useState(stored.language || 'English');
  const [researchType, setResearchType] = useState(stored.research_type || 'other');
  const [selectedIds, setSelectedIds] = useState(() => initialIds.map(String).filter(id => linkedPapers.some(paper => String(paper.id) === id)));
  const [contextSelection, setContextSelection] = useState({
    project_objectives: stored.context_selection?.project_objectives ?? true,
    evidence_matrix: stored.context_selection?.evidence_matrix ?? Boolean(project.evidence_matrix),
    literature_review: stored.context_selection?.literature_review ?? Boolean(project.literature_review),
    researcher_notes: stored.context_selection?.researcher_notes ?? false,
  });
  const [aiDraft, setAiDraft] = useState(stored.ai_draft || localDraft || null);
  const [sections, setSections] = useState(stored.edited_sections || stored.ai_draft?.sections || localDraft?.sections || blankProposal().sections);
  const [methodology, setMethodology] = useState(stored.edited_methodology || stored.ai_draft?.methodology_plan || localDraft?.methodology_plan || blankProposal().methodology_plan);
  const [sectionNotes, setSectionNotes] = useState(stored.section_notes || {});
  const [bibliographyEntries, setBibliographyEntries] = useState(stored.bibliography_entries || {});
  const [researcherEdited, setResearcherEdited] = useState(Boolean(stored.researcher_edited));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [workflowRun, setWorkflowRun] = useState(() => {
    const saved = stored.workflow_run;
    if (saved?.schema_version === 1) return saved;
    try {
      const local = JSON.parse(window.localStorage.getItem(`eylo:proposal-workflow:${project.id}`) || 'null');
      return local?.schema_version === 1 && local?.input?.question ? local : null;
    } catch { return null; }
  });
  const [qualityFindings, setQualityFindings] = useState(stored.quality_findings || []);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const controllerRef = useRef(null);
  const linkedById = useMemo(() => new Map(linkedPapers.map(paper => [String(paper.id), paper])), [linkedPapers]);
  const selectedPapers = linkedPapers.filter(paper => selectedIds.includes(String(paper.id)));
  const hasDraft = Boolean(aiDraft || stored.edited_sections || Object.values(sectionNotes).some(value => String(value || '').trim()));
  const citedIds = [...sections, ...Object.values(methodology)].flatMap(section => (section?.claims || []).flatMap(claim => claim.source_ids || []));
  const bibliography = useMemo(() => bibliographyForProposal(linkedPapers, [...selectedIds, ...citedIds]), [linkedPapers, selectedIds.join('|'), citedIds.join('|')]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const toggle = id => {
    setSelectedIds(current => current.includes(String(id)) ? current.filter(item => item !== String(id)) : [...current, String(id)]);
    setDirty(true);
  };
  const toggleContext = key => {
    setContextSelection(current => ({ ...current, [key]: !current[key] }));
    setDirty(true);
  };

  const runCompleteProposal = async ({ resume = false } = {}) => {
    setError(''); setMessage(''); setWorkflowBusy(true);
    const controller = new AbortController(); controllerRef.current = controller;
    let activeRun = workflowRun;
    const checkpoint = nextRun => {
      activeRun = nextRun;
      setWorkflowRun(nextRun);
      try { window.localStorage.setItem(`eylo:proposal-workflow:${project.id}`, JSON.stringify(nextRun)); } catch { /* Draft generation remains available when local storage is disabled. */ }
    };
    const timeout = () => {
      const timer = window.setTimeout(() => controller.abort(), PROPOSAL_WORKFLOW_BUDGET.timeoutMs);
      return () => window.clearTimeout(timer);
    };
    try {
      let run = activeRun;
      if (!resume || !run) {
        run = createProposalWorkflow({ projectId: project.id, question, discipline, purpose, language });
        run.stage_attempts = { INTAKE: 1 };
        checkpoint(run);
      } else if (run.status === 'failed') {
        run = retryProposalWorkflowStage(run);
        checkpoint(run);
      } else if (run.status === 'cancelled') {
        run = { ...run, status: 'running', error_code: '', updated_at: new Date().toISOString() };
        checkpoint(run);
      } else if (run.status !== 'running') {
        run = createProposalWorkflow({ projectId: project.id, question, discipline, purpose, language });
        run.stage_attempts = { INTAKE: 1 };
        checkpoint(run);
      }
      setQuestion(run.input.question); setDiscipline(run.input.discipline); setPurpose(run.input.purpose); setLanguage(run.input.language);

      if (run.stage === 'INTAKE') { run = advanceProposalWorkflow(run, 'REQUIREMENTS'); checkpoint(run); }
      if (run.stage === 'REQUIREMENTS') {
        const queries = planProposalQueries(run.input);
        run = advanceProposalWorkflow(run, 'SOURCE_DISCOVERY', { source_queries: queries }); checkpoint(run);
      }
      let sourcePapers = linkedPapers.filter(paper => (run.selected_source_ids || []).includes(String(paper.id)));
      if (run.stage === 'SOURCE_DISCOVERY' && selectedPapers.length) {
        sourcePapers = selectedPapers.slice(0, PROPOSAL_WORKFLOW_BUDGET.maximumSelectedRecords);
        setSelectedIds(sourcePapers.map(paper => String(paper.id)));
        run = advanceProposalWorkflow(run, 'EVIDENCE_ANALYSIS', {
          selected_source_ids: sourcePapers.map(paper => String(paper.id)),
          discovered_count: 0,
          linked_count: 0,
          source_reuse: 'selected_project_records',
        }); checkpoint(run);
      }
      if (run.stage === 'SOURCE_DISCOVERY') {
        const found = [];
        const statuses = [];
        for (const query of run.source_queries.slice(0, PROPOSAL_WORKFLOW_BUDGET.searchStrategies)) {
          const clear = timeout();
          try {
            const result = await searchAllPapersWithStatus(query, { limit: PROPOSAL_WORKFLOW_BUDGET.recordsPerStrategy, signal: controller.signal });
            found.push(result);
            statuses.push({ query, query_status: 'available', available_source_count: result.available_source_count, unavailable_source_count: result.unavailable_source_count, source_status: result.source_status });
          } catch (failure) {
            if (controller.signal.aborted) throw failure;
            statuses.push({ query, query_status: 'unavailable', error_code: String(failure?.code || 'SEARCH_FAILED'), available_source_count: 0, unavailable_source_count: 0, source_status: [] });
          } finally { clear(); }
        }
        const discovered = deduplicateProposalSearchResults(found);
        const candidates = discovered.slice(0, Math.max(0, PROPOSAL_WORKFLOW_BUDGET.maximumSelectedRecords - selectedPapers.length));
        const saved = [];
        for (const paper of candidates) {
          if (controller.signal.aborted) throw Object.assign(new Error('Workflow cancelled.'), { name: 'AbortError' });
          try {
            const record = await saveDiscoveredGapPaper({ entities: base44.entities, paper, project });
            if (record?.id && record.project_id === project.id) saved.push(record);
          } catch (failure) {
            if (failure?.code !== 'PAPER_PROJECT_CONFLICT') throw failure;
          }
        }
        if (saved.length) onPapersChanged?.(previous => {
          const byId = new Map(previous.map(paper => [String(paper.id), paper]));
          for (const paper of saved) byId.set(String(paper.id), paper);
          return [...byId.values()];
        });
        sourcePapers = [...new Map([...selectedPapers, ...saved].map(paper => [String(paper.id), paper])).values()]
          .slice(0, PROPOSAL_WORKFLOW_BUDGET.maximumSelectedRecords);
        if (!sourcePapers.length) throw Object.assign(new Error('No eligible scholarly records were retrieved for this topic.'), { code: 'NO_SOURCES' });
        setSelectedIds(sourcePapers.map(paper => String(paper.id)));
        run = advanceProposalWorkflow(run, 'EVIDENCE_ANALYSIS', {
          source_status: statuses,
          selected_source_ids: sourcePapers.map(paper => String(paper.id)),
          discovered_count: discovered.length,
          linked_count: saved.length,
        }); checkpoint(run);
      }
      if (run.stage === 'EVIDENCE_ANALYSIS') { run = advanceProposalWorkflow(run, 'PROPOSAL_PLANNING'); checkpoint(run); }
      if (run.stage === 'PROPOSAL_PLANNING') { run = advanceProposalWorkflow(run, 'SECTION_GENERATION'); checkpoint(run); }
      let generatedDraft = aiDraft || stored.ai_draft;
      if (run.stage === 'SECTION_GENERATION') {
        if (run.generation_calls >= PROPOSAL_WORKFLOW_BUDGET.generationCalls) throw Object.assign(new Error('The proposal generation retry budget has been used.'), { code: 'GENERATION_BUDGET_EXHAUSTED' });
        const clear = timeout();
        run = { ...run, generation_calls: run.generation_calls + 1, updated_at: new Date().toISOString() }; checkpoint(run);
        try {
          const response = await base44.integrations.Core.InvokeLLM({
            response_json_schema: RESEARCH_PROPOSAL_SCHEMA,
            prompt: buildResearchProposalPrompt({ question: run.input.question, researchType, papers: sourcePapers, project, evidenceMatrix: project.evidence_matrix, literatureReview: project.literature_review, contextSelection, discipline: run.input.discipline, purpose: run.input.purpose, language: run.input.language }),
            signal: controller.signal,
          });
          const validated = validateResearchProposalDraft(response, sourcePapers);
          generatedDraft = validated;
          try { window.localStorage.setItem(`eylo:proposal-draft:${project.id}`, JSON.stringify(validated)); } catch { /* A successful in-memory draft remains usable without a local checkpoint. */ }
          setAiDraft(validated);
          if (!researcherEdited || !aiDraft) { setSections(validated.sections); setMethodology(validated.methodology_plan); setResearcherEdited(false); }
          run = advanceProposalWorkflow(run, 'QUALITY_REVIEW'); checkpoint(run);
        } finally { clear(); }
      }
      if (run.stage === 'QUALITY_REVIEW') {
        const findings = reviewProposalDraft({ sections: generatedDraft?.sections || sections, methodologyPlan: generatedDraft?.methodology_plan || methodology, papers: sourcePapers });
        setQualityFindings(findings);
        run = advanceProposalWorkflow(run, 'REVISION', { quality_summary: findings.map(item => ({ pass: item.pass, status: item.status })) }); checkpoint(run);
      }
      if (run.stage === 'REVISION') { run = advanceProposalWorkflow(run, 'RESEARCHER_REVIEW', { revision_summary: 'No automated rewrite was applied. Researcher edits and accept/reject decisions remain in control.' }); checkpoint(run); }
      if (run.stage === 'RESEARCHER_REVIEW' && run.status === 'running') {
        run = { ...run, status: 'awaiting_researcher', updated_at: new Date().toISOString() };
        checkpoint(run);
      }
      setDirty(true);
      setMessage('The proposal draft is ready for your review. Check the linked sources and quality findings, then enable exports when satisfied.');
    } catch (failure) {
      const failedRun = controller.signal.aborted && failure?.name === 'AbortError'
        ? cancelProposalWorkflow(activeRun)
        : failProposalWorkflow(activeRun, failure?.code || 'WORKFLOW_FAILED');
      checkpoint(failedRun);
      if (failure?.name === 'AbortError' || controller.signal.aborted) setMessage('Workflow cancelled. Retrieved records remain linked to this project; resume when ready.');
      else setError(failure?.code === 'NO_SOURCES' ? 'No usable scholarly sources were found. Refine the topic and retry.' : proposalErrorMessage(failure, false));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setWorkflowBusy(false);
    }
  };

  const save = async () => {
    if (saving || !hasDraft) return;
    setSaving(true); setError(''); setMessage('');
    const proposal = {
      research_question: question.trim().slice(0, 1200), research_type: researchType, discipline, purpose, language,
      selected_paper_ids: selectedIds.filter(id => linkedById.has(id)), context_selection: contextSelection,
      ai_draft: aiDraft, edited_sections: sections, edited_methodology: methodology,
      section_notes: sectionNotes, bibliography_entries: bibliographyEntries,
      researcher_edited: researcherEdited, workflow_run: workflowRun, quality_findings: qualityFindings, updated_at: new Date().toISOString(),
    };
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(project.id, { research_proposal: proposal }, project.updated_date);
      if (!hasProposalSaveReceipt(saved, project.id, proposal)) throw new Error('unverified');
      onProjectSaved(saved); setDirty(false); setMessage('Proposal saved to this private research project.');
      try { window.localStorage.removeItem(`eylo:proposal-draft:${project.id}`); } catch { /* Saved server version remains authoritative. */ }
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT'
        ? 'This project changed in another session. Your proposal edits remain here; reload the project before saving.'
        : 'The proposal could not be verified as saved. Your edits remain here.');
    } finally { setSaving(false); }
  };

  const finishResearcherReview = () => {
    try {
      const reviewed = markProposalResearcherReviewed(workflowRun);
      setWorkflowRun(reviewed);
      setDirty(true);
      setMessage('Researcher review recorded for this draft. This is not institutional approval or submission. Save the proposal to the project to keep this status.');
      try { window.localStorage.setItem(`eylo:proposal-workflow:${project.id}`, JSON.stringify(reviewed)); } catch { /* The review state remains in this session. */ }
    } catch (failure) { setError(proposalErrorMessage(failure, false)); }
  };

  const updateClaim = (sectionId, index, value, methodTopic = null) => {
    setResearcherEdited(true); setDirty(true);
    if (methodTopic) setMethodology(current => ({ ...current, [methodTopic]: { ...current[methodTopic], claims: current[methodTopic].claims.map((claim, item) => item === index ? { ...claim, text: value, origin: 'researcher' } : claim) } }));
    else setSections(current => current.map(section => section.section_id !== sectionId ? section : ({ ...section, claims: section.claims.map((claim, item) => item === index ? { ...claim, text: value, origin: 'researcher' } : claim) })));
  };

  const updateStatus = (sectionId, status, methodTopic = null) => {
    setDirty(true); setResearcherEdited(true);
    if (methodTopic) setMethodology(current => ({ ...current, [methodTopic]: { ...current[methodTopic], status } }));
    else setSections(current => current.map(section => section.section_id === sectionId ? { ...section, status } : section));
  };

  const applyLatest = () => {
    setSections(aiDraft.sections); setMethodology(aiDraft.methodology_plan); setResearcherEdited(false); setDirty(true);
    setMessage('Latest EYRA draft applied. Review the replaced sections before saving.');
  };

  const exportMarkdown = () => {
    const markdown = exportResearchProposalMarkdown({ question, researchType, sections, methodologyPlan: methodology, bibliography, bibliographyEntries, sectionNotes });
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'research-proposal-draft.md';
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };

  const sourceMap = new Map(bibliography.map(source => [source.id, source]));
  const renderClaims = (claims, sectionId, methodTopic = null) => claims.length ? <div className="mt-3 space-y-4">{claims.map((claim, index) => <div key={`${sectionId}-${index}`} className="rounded-lg bg-secondary/30 p-3">
    {claim.heading && <p className="text-sm font-semibold">{claim.heading}</p>}
    <textarea aria-label={`${methodTopic ? METHODOLOGY_TOPICS.find(topic => topic.id === methodTopic)?.label : PROPOSAL_SECTIONS.find(section => section.id === sectionId)?.label} statement ${index + 1}`} value={claim.text} onChange={event => updateClaim(sectionId, index, event.target.value, methodTopic)} rows={3} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" />
    <p className="mt-2 text-xs text-muted-foreground">{claim.kind === 'source_fact' ? 'Source fact' : claim.kind === 'interpretation' ? 'EYRA interpretation' : claim.kind === 'proposal' ? 'Proposed plan' : 'Open question'} · {claim.origin === 'researcher' ? 'Researcher edited' : 'EYRA draft'}</p>
    {claim.source_ids?.length ? <ul className="mt-2 space-y-1">{claim.source_ids.map(id => { const source = sourceMap.get(String(id)); const href = source && safeResearchSourceUrl(source); return <li key={id} className="text-xs">{source ? <a href={href || undefined} target={href ? '_blank' : undefined} rel={href ? 'noopener noreferrer' : undefined} className="inline-flex min-h-8 items-center gap-1 text-primary underline-offset-2 hover:underline">{source.authors} ({source.year}) — {source.title}{href && <ExternalLink size={12} aria-hidden="true" />}</a> : <span className="text-destructive">Linked project source unavailable</span>}</li>; })}</ul> : <p className="mt-2 text-xs text-muted-foreground">No source citation. This is a proposal or open question, not a validated finding.</p>}
  </div>)}</div> : <p className="mt-2 text-sm italic text-muted-foreground">No draft content. Use “Needs researcher input” or add content after generation.</p>;

  return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="research-proposal-builder-title">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Scientific Output Studio · Research Proposal</p>
      <h3 id="research-proposal-builder-title" tabIndex={-1} className="mt-1 scroll-mt-4 text-xl font-semibold">Build a research proposal</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Create an editable scientific draft from selected project sources. EYRA receives available metadata and abstracts, plus only the project outputs you choose. Full text is not assumed.</p>
    </header>
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="block text-sm font-medium">Research topic or question<textarea value={question} onChange={event => { setQuestion(event.target.value); setDirty(true); }} maxLength={1200} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="What would you like to investigate?" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">Scientific discipline<input required value={discipline} onChange={event => { setDiscipline(event.target.value); setDirty(true); }} maxLength={120} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="e.g. environmental science" /></label>
        <label className="block text-sm font-medium">Proposal purpose<select value={purpose} onChange={event => { setPurpose(event.target.value); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="academic">Academic research</option><option value="undergraduate">Undergraduate</option><option value="masters">Master’s</option><option value="doctoral">Doctoral</option><option value="institutional">Institutional research</option></select></label>
        <label className="block text-sm font-medium">Preferred language<input value={language} onChange={event => { setLanguage(event.target.value); setDirty(true); }} maxLength={40} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="English" /></label>
        <label className="block text-sm font-medium">Research design<select value={researchType} onChange={event => { setResearchType(event.target.value); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{RESEARCH_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
      </div>
    </div>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project publications ({selectedPapers.length} selected)</legend>
      {!linkedPapers.length ? <p className="p-2 text-sm text-muted-foreground">Link scholarly records to this project in the Evidence Matrix before generating a proposal.</p> : <div className="max-h-64 space-y-1 overflow-y-auto">{linkedPapers.map(paper => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary/60"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedIds.includes(String(paper.id))} onChange={() => toggle(paper.id)} /><span className="min-w-0 text-sm"><span className="block font-medium leading-5">{paper.title || 'Title unavailable'}</span><span className="mt-1 block text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'} · {paper.year || 'Year unavailable'} · {paper.summary ? 'abstract available' : 'metadata only'}</span></span></label>)}</div>}
    </fieldset>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project context EYRA may use</legend><div className="grid gap-2 sm:grid-cols-2">
      {[['project_objectives','Project objectives and plan'],['evidence_matrix','Evidence Matrix'],['literature_review','Literature Review'],['researcher_notes','Researcher-authored matrix notes']].map(([key,label]) => <label key={key} className="flex min-h-10 items-start gap-2 text-sm"><input className="mt-1 size-4 accent-primary" type="checkbox" checked={Boolean(contextSelection[key])} onChange={() => toggleContext(key)} />{label}</label>)}
    </div><p className="mt-2 text-xs text-muted-foreground">Only selected papers and selected project outputs are sent to EYRA. Source facts and interpretations require citations; proposed methods and contributions are not validated outcomes.</p></fieldset>
    <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs leading-5 text-muted-foreground">Generate reuses selected project evidence when available; otherwise it searches scholarly indexes, links eligible records to this private project, and makes one EYRA draft call. Search is limited to {PROPOSAL_WORKFLOW_BUDGET.searchStrategies} strategies and {PROPOSAL_WORKFLOW_BUDGET.maximumSelectedRecords} records. Explicit stage retries are bounded. Review and save the draft yourself; no grant submission or external action occurs.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => runCompleteProposal()} disabled={workflowBusy || question.trim().length < 8 || !discipline.trim() || !language.trim() || !purpose.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{workflowBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{workflowBusy ? 'Generating complete proposal…' : 'Generate Complete Proposal'}</button>
      {workflowBusy && <button type="button" onClick={() => controllerRef.current?.abort()} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Cancel workflow</button>}
      {!workflowBusy && ['running', 'cancelled'].includes(workflowRun?.status) && <button type="button" onClick={() => runCompleteProposal({ resume: true })} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Resume workflow</button>}
      {!workflowBusy && workflowRun?.status === 'failed' && <button type="button" onClick={() => runCompleteProposal({ resume: true })} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Retry current stage</button>}
      {workflowRun?.status === 'awaiting_researcher' && <button type="button" onClick={finishResearcherReview} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Mark review complete and enable export</button>}
      <button type="button" onClick={save} disabled={saving || !hasDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save to project'}</button>
      <button type="button" onClick={exportMarkdown} disabled={!hasDraft || (workflowRun?.stage === 'RESEARCHER_REVIEW' && workflowRun.status !== 'complete')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"><Download size={16} aria-hidden="true" />Export Markdown</button>
      {researcherEdited && aiDraft && <button type="button" onClick={applyLatest} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Apply latest draft</button>}
      <span role="status" className="self-center text-xs text-muted-foreground">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : stored.updated_at ? 'Saved project version' : 'Not saved yet'}</span>
    </div>
    {workflowRun && <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Proposal workflow progress" aria-live="polite">
      <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">Workflow progress · {workflowRun.stage?.replaceAll('_', ' ')}</h4><span className="text-sm tabular-nums">{getProposalWorkflowProgress(workflowRun)}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={getProposalWorkflowProgress(workflowRun)}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${getProposalWorkflowProgress(workflowRun)}%` }} /></div>
      <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{PROPOSAL_WORKFLOW_STAGES.map(stage => { const done = workflowRun.completed_stages?.includes(stage) || (workflowRun.status === 'complete' && stage === 'EXPORT_READY'); const active = workflowRun.stage === stage && workflowRun.status !== 'complete'; return <li key={stage} className={`rounded-md px-2 py-1 text-xs ${active ? 'bg-primary/10 font-semibold text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>{done ? '✓ ' : active ? '• ' : '○ '}{stage.replaceAll('_', ' ')}</li>; })}</ol>
      {workflowRun.source_queries?.length > 0 && <p className="text-xs text-muted-foreground">{workflowRun.discovered_count ?? 0} deduplicated records found · {workflowRun.linked_count ?? 0} linked to this project. Failed or unavailable indexes are listed only when they return search status.</p>}
      {workflowRun.source_status?.length > 0 && <ul className="space-y-1 text-xs text-muted-foreground">{workflowRun.source_status.flatMap(search => (search.source_status || []).map(source => <li key={`${search.query}-${source.id}`}>{source.label}: {source.status} · {source.count} records</li>))}</ul>}
      {workflowRun.status === 'cancelled' && <p className="text-xs text-muted-foreground">Cancelled. Resume restarts the interrupted stage within the same search and generation limits.</p>}
    </section>}
    {qualityFindings.length > 0 && <section className="space-y-2 rounded-xl border border-border p-4" aria-label="Proposal quality review"><h4 className="font-semibold">Quality review</h4><p className="text-xs leading-5 text-muted-foreground">Automated checks report structural and traceability issues. They do not establish that a publication supports a claim or that the proposal is scientifically valid.</p><ul className="space-y-2">{qualityFindings.map(finding => <li key={finding.pass} className="rounded-lg bg-secondary/30 p-3 text-sm"><span className="font-semibold">Pass {finding.pass} · {finding.label}</span><span className="ml-2 text-xs text-muted-foreground">{finding.status.replaceAll('_', ' ')}</span><p className="mt-1 text-xs leading-5 text-muted-foreground">{finding.details}</p></li>)}</ul></section>}
    <p className="text-xs leading-5 text-muted-foreground">Editable scientific draft requiring researcher evaluation; not peer reviewed. Citation validation checks selected source IDs, not whether each claim is semantically supported. Where full text is unavailable, EYRA can use only metadata and available abstracts.</p>
    {message && <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{message}</p>}{error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {!hasDraft && <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Enter the topic, discipline, proposal purpose and language, then generate the editable 23-section proposal. EYRA will not search or generate until you choose Generate Complete Proposal.</div>}
    {hasDraft && sections.length > 0 && <div className="space-y-3" aria-label="Editable research proposal draft">{PROPOSAL_SECTIONS.map(definition => {
      const section = sections.find(item => item.section_id === definition.id) || { section_id: definition.id, status: 'needs_input', claims: [] };
      return <section key={definition.id} className="rounded-xl border border-border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-base font-semibold">{definition.label}</h4><label className="text-xs text-muted-foreground">Section status<select aria-label={`${definition.label} status`} value={section.status} onChange={event => updateStatus(definition.id, event.target.value)} className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2 text-xs">{PROPOSAL_STATUSES.map(status => <option key={status} value={status}>{status === 'drafted' ? 'Drafted' : status === 'not_applicable' ? 'Not applicable' : 'Needs input'}</option>)}</select></label></div>
        {definition.id === 'bibliography' ? <ol className="mt-3 space-y-3 pl-5 text-sm leading-6">{bibliography.map(source => <li key={source.id}><textarea aria-label={`Bibliography entry for ${source.title}`} value={bibliographyEntries[source.id] ?? defaultBibliographyEntry(source)} onChange={event => { setBibliographyEntries(current => ({ ...current, [source.id]: event.target.value })); setDirty(true); setResearcherEdited(true); }} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" />{source.doi && <p className="text-xs text-muted-foreground">DOI: {source.doi}</p>}{safeResearchSourceUrl(source) && <a className="inline-flex min-h-8 items-center gap-1 text-xs text-primary" href={safeResearchSourceUrl(source)} target="_blank" rel="noopener noreferrer">Open verified project record <ExternalLink size={12} aria-hidden="true" /></a>}</li>)}{!bibliography.length && <li className="list-none italic text-muted-foreground">No selected scholarly records.</li>}</ol> : section.status === 'not_applicable' ? <p className="mt-2 text-sm italic text-muted-foreground">Marked not applicable. Existing draft text is preserved in case you change this status.</p> : renderClaims(section.claims, definition.id)}
        {definition.id === 'research_methodology' && <div className="mt-4 space-y-3 rounded-lg bg-secondary/20 p-3"><h5 className="text-sm font-semibold">Proposed methodology plan</h5>{METHODOLOGY_TOPICS.map(topic => { const field = methodology[topic.id] || { status: 'needs_input', claims: [] }; return <div key={topic.id} className="border-t border-border/70 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><h6 className="text-sm font-medium">{topic.label}</h6><label className="text-xs text-muted-foreground">Status<select aria-label={`${topic.label} status`} value={field.status} onChange={event => updateStatus('', event.target.value, topic.id)} className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2">{PROPOSAL_STATUSES.map(status => <option key={status} value={status}>{status === 'drafted' ? 'Proposed' : status === 'not_applicable' ? 'Not applicable' : 'Needs input'}</option>)}</select></label></div>{field.status === 'not_applicable' ? <p className="mt-2 text-sm italic text-muted-foreground">Marked not applicable. Existing draft text is preserved.</p> : renderClaims(field.claims, '', topic.id)}</div>; })}</div>}
        {definition.id !== 'bibliography' && <label className="mt-3 block text-xs font-medium text-muted-foreground">Researcher-authored addition<textarea value={sectionNotes[definition.id] || ''} onChange={event => { setSectionNotes(current => ({ ...current, [definition.id]: event.target.value })); setDirty(true); setResearcherEdited(true); }} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal leading-6" placeholder="Add your own notes without replacing the generated draft" /></label>}
      </section>;
    })}</div>}
  </section>;
}
