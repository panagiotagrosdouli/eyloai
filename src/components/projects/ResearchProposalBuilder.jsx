import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Save, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { safeResearchSourceUrl } from '@/lib/research-source-url.mjs';
import { saveDiscoveredGapPaper } from '@/lib/research-gap-literature-save.mjs';
import { verifyCitation } from '@/lib/citation-verification.mjs';
import {
  autonomousProposalErrorMessage, autonomousProposalProgress, PROPOSAL_DISCIPLINES, PROPOSAL_LANGUAGES,
  runAutonomousProposal,
} from '@/lib/autonomous-proposal-engine.mjs';
import {
  bibliographyForProposal, defaultBibliographyEntry,
  exportResearchProposalMarkdown, hasProposalSaveReceipt, METHODOLOGY_TOPICS,
  PROPOSAL_SECTIONS, PROPOSAL_STATUSES, projectLinkedProposalPapers, RESEARCH_TYPES,
} from '@/lib/research-proposal-studio.mjs';

function blankProposal() {
  return {
    sections: PROPOSAL_SECTIONS.map(section => ({ section_id: section.id, status: 'needs_input', claims: [] })),
    methodology_plan: Object.fromEntries(METHODOLOGY_TOPICS.map(topic => [topic.id, { status: 'needs_input', claims: [] }])),
  };
}

export default function ResearchProposalBuilder({ project, savedPapers, onProjectSaved, onPapersChanged }) {
  const linkedPapers = useMemo(() => projectLinkedProposalPapers(savedPapers, project.id), [savedPapers, project.id]);
  const stored = project.research_proposal && typeof project.research_proposal === 'object' ? project.research_proposal : {};
  const resumableRun = stored.autonomous_run && ['failed', 'paused', 'running'].includes(stored.autonomous_run.status) ? stored.autonomous_run : null;
  const initialIds = stored.selected_paper_ids || (resumableRun ? stored.autonomous_run?.selected_paper_ids : null) || project.literature_review?.selected_paper_ids || project.evidence_matrix?.selected_paper_ids || [];
  const [question, setQuestion] = useState(resumableRun?.idea || stored.research_question || stored.autonomous_run?.planning?.research_question || project.evidence_matrix?.research_question || project.literature_review?.research_question || '');
  const [researchType, setResearchType] = useState(stored.research_type || 'other');
  const [discipline, setDiscipline] = useState(stored.discipline || 'interdisciplinary');
  const [language, setLanguage] = useState(stored.language || 'en');
  const [selectedIds, setSelectedIds] = useState(() => initialIds.map(String).filter(id => linkedPapers.some(paper => String(paper.id) === id)));
  const [contextSelection, setContextSelection] = useState({
    project_objectives: stored.context_selection?.project_objectives ?? true,
    evidence_matrix: stored.context_selection?.evidence_matrix ?? Boolean(project.evidence_matrix),
    literature_review: stored.context_selection?.literature_review ?? Boolean(project.literature_review),
    researcher_notes: stored.context_selection?.researcher_notes ?? false,
  });
  const [aiDraft, setAiDraft] = useState(stored.ai_draft || null);
  const [sections, setSections] = useState(stored.edited_sections || stored.ai_draft?.sections || blankProposal().sections);
  const [methodology, setMethodology] = useState(stored.edited_methodology || stored.ai_draft?.methodology_plan || blankProposal().methodology_plan);
  const [sectionNotes, setSectionNotes] = useState(stored.section_notes || {});
  const [bibliographyEntries, setBibliographyEntries] = useState(stored.bibliography_entries || {});
  const [researcherEdited, setResearcherEdited] = useState(Boolean(stored.researcher_edited));
  const [generationRun, setGenerationRun] = useState(stored.autonomous_run || null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const controllerRef = useRef(null);
  const projectRef = useRef(project);
  const localEditRevisionRef = useRef(0);
  const researcherEditedRef = useRef(Boolean(stored.researcher_edited));
  const linkedById = useMemo(() => new Map(linkedPapers.map(paper => [String(paper.id), paper])), [linkedPapers]);
  const selectedPapers = linkedPapers.filter(paper => selectedIds.includes(String(paper.id)));
  const hasDraft = Boolean(aiDraft || stored.edited_sections || Object.values(sectionNotes).some(value => String(value || '').trim()));
  const citedIds = [...sections, ...Object.values(methodology)].flatMap(section => (section?.claims || []).flatMap(claim => claim.source_ids || []));
  const bibliography = useMemo(() => bibliographyForProposal(linkedPapers, [...selectedIds, ...citedIds]), [linkedPapers, selectedIds.join('|'), citedIds.join('|')]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const toggle = id => {
    localEditRevisionRef.current += 1;
    setSelectedIds(current => current.includes(String(id)) ? current.filter(item => item !== String(id)) : [...current, String(id)]);
    setDirty(true);
  };
  const toggleContext = key => {
    localEditRevisionRef.current += 1;
    setContextSelection(current => ({ ...current, [key]: !current[key] }));
    setDirty(true);
  };

  const markResearcherEdit = () => {
    localEditRevisionRef.current += 1;
    researcherEditedRef.current = true;
    setResearcherEdited(true); setDirty(true);
  };

  const generateCompleteProposal = async (resume = false) => {
    setError(''); setMessage('');
    const idea = question.trim();
    if (idea.length < 8) { setError('Describe the research idea in at least 8 characters.'); return; }
    if (!discipline || !language) { setError('Choose a discipline and output language before generation.'); return; }
    const controller = new AbortController(); controllerRef.current = controller; setGenerating(true);
    const revisionAtStart = localEditRevisionRef.current;
    try {
      await runAutonomousProposal({
        idea, discipline, researchType, language, project: projectRef.current, savedPapers,
        contextSelection, resumeRun: resume ? generationRun : null,
        invoke: request => base44.integrations.Core.InvokeLLM(request),
        search: (query, options) => searchAllPapersWithStatus(query, { limit: options.limit, signal: options.signal }),
        verifySource: (record, signal) => verifyCitation(record, (url, options) => fetch(url, { ...options, signal })),
        savePaper: async (paper, targetProject) => {
          const saved = await saveDiscoveredGapPaper({ entities: base44.entities, paper, project: targetProject });
          if (!saved?.id || String(saved.project_id) !== String(targetProject.id)) throw new Error('no_sources_saved');
          onPapersChanged?.(previous => previous.some(item => String(item.id) === String(saved.id))
            ? previous.map(item => String(item.id) === String(saved.id) ? saved : item)
            : [saved, ...previous]);
          return saved;
        },
        checkpoint: async run => {
          const currentProject = projectRef.current;
          const previous = currentProject.research_proposal && typeof currentProject.research_proposal === 'object' ? currentProject.research_proposal : {};
          const artifact = {
            ...previous,
            autonomous_run: run,
            updated_at: new Date().toISOString(),
            ...(run.status === 'complete' ? {
              research_question: run.planning.research_question,
              research_type: run.research_type,
              discipline: run.discipline,
              language: run.language,
              ...(localEditRevisionRef.current === revisionAtStart ? { selected_paper_ids: run.selected_paper_ids } : {}),
              ai_draft: run.proposal_draft,
            } : {}),
          };
          const saved = await base44.entities.Project.updateIfUnchanged(currentProject.id, { research_proposal: artifact }, currentProject.updated_date);
          if (!hasProposalSaveReceipt(saved, currentProject.id, artifact)) throw Object.assign(new Error('unverified'), { code: 'CHECKPOINT_UNVERIFIED' });
          projectRef.current = saved; onProjectSaved(saved); setGenerationRun(run);
          if (run.status === 'complete') {
            setAiDraft(run.proposal_draft); setGenerationRun(run);
            const preserveEdits = researcherEditedRef.current || localEditRevisionRef.current !== revisionAtStart;
            if (!preserveEdits) {
              setQuestion(run.planning.research_question); setSelectedIds(run.selected_paper_ids);
              setSections(run.proposal_draft.sections); setMethodology(run.proposal_draft.methodology_plan);
              researcherEditedRef.current = false; setResearcherEdited(false);
              setMessage('Complete proposal saved as an editable draft. Review the evidence, uncertainties and proposed milestones before use.');
            } else {
              setMessage('Complete proposal saved. Your edits remain intact; choose “Apply latest draft” only if you want to replace them.');
            }
            setDirty(preserveEdits);
          }
          return saved;
        },
        onProgress: run => setGenerationRun(run),
        signal: controller.signal,
      });
    } catch (failure) {
      if (failure.run) setGenerationRun(failure.run);
      setError(autonomousProposalErrorMessage(failure.message));
    } finally { if (controllerRef.current === controller) controllerRef.current = null; setGenerating(false); }
  };

  const save = async () => {
    if (saving || !hasDraft) return;
    setSaving(true); setError(''); setMessage('');
    const proposal = {
      ...(projectRef.current.research_proposal || {}),
      research_question: question.trim().slice(0, 1200), research_type: researchType, discipline, language,
      selected_paper_ids: selectedIds.filter(id => linkedById.has(id)), context_selection: contextSelection,
      ai_draft: aiDraft, edited_sections: sections, edited_methodology: methodology,
      section_notes: sectionNotes, bibliography_entries: bibliographyEntries, autonomous_run: generationRun,
      researcher_edited: researcherEdited, updated_at: new Date().toISOString(),
    };
    try {
      const currentProject = projectRef.current;
      const saved = await base44.entities.Project.updateIfUnchanged(currentProject.id, { research_proposal: proposal }, currentProject.updated_date);
      if (!hasProposalSaveReceipt(saved, project.id, proposal)) throw new Error('unverified');
      projectRef.current = saved; onProjectSaved(saved); setDirty(false); setMessage('Proposal saved to this private research project.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT'
        ? 'This project changed in another session. Your proposal edits remain here; reload the project before saving.'
        : 'The proposal could not be verified as saved. Your edits remain here.');
    } finally { setSaving(false); }
  };

  const updateClaim = (sectionId, index, value, methodTopic = null) => {
    markResearcherEdit();
    if (methodTopic) setMethodology(current => ({ ...current, [methodTopic]: { ...current[methodTopic], claims: current[methodTopic].claims.map((claim, item) => item === index ? { ...claim, text: value, origin: 'researcher' } : claim) } }));
    else setSections(current => current.map(section => section.section_id !== sectionId ? section : ({ ...section, claims: section.claims.map((claim, item) => item === index ? { ...claim, text: value, origin: 'researcher' } : claim) })));
  };

  const updateStatus = (sectionId, status, methodTopic = null) => {
    markResearcherEdit();
    if (methodTopic) setMethodology(current => ({ ...current, [methodTopic]: { ...current[methodTopic], status } }));
    else setSections(current => current.map(section => section.section_id === sectionId ? { ...section, status } : section));
  };

  const applyLatest = () => {
    localEditRevisionRef.current += 1; researcherEditedRef.current = false;
    setSections(aiDraft.sections); setMethodology(aiDraft.methodology_plan); setResearcherEdited(false); setDirty(true);
    setMessage('Latest EYRA draft applied. Review the replaced sections before saving.');
  };

  const exportMarkdown = () => {
    const markdown = exportResearchProposalMarkdown({
      question, researchType, discipline: PROPOSAL_DISCIPLINES.find(item => item.id === discipline)?.label || 'Interdisciplinary',
      language, sections, methodologyPlan: methodology, bibliography, bibliographyEntries, sectionNotes,
      milestones: generationRun?.milestones || [],
    });
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
      <h3 id="research-proposal-builder-title" className="mt-1 text-xl font-semibold">Build a research proposal</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Start from a research idea. EYRA searches scholarly indexes, selects project-linked records and drafts a complete proposal for your review. It can use bibliographic metadata and available abstracts; full text is not assumed.</p>
      <nav aria-label="Research workflow" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm"><a href="#evidence-matrix-studio-title" className="min-h-8 text-primary underline-offset-2 hover:underline">Evidence Matrix</a><a href="#literature-review-builder-title" className="min-h-8 text-primary underline-offset-2 hover:underline">Literature Review</a><span aria-current="step" className="font-semibold">Research Proposal</span><a href="#research-methodology-studio-title" className="min-h-8 text-primary underline-offset-2 hover:underline">Methodology</a><a href="#research-roadmap-studio-title" className="min-h-8 text-primary underline-offset-2 hover:underline">Roadmap</a></nav>
    </header>
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="block text-sm font-medium">Research idea<textarea value={question} onChange={event => { localEditRevisionRef.current += 1; setQuestion(event.target.value); setDirty(true); }} maxLength={1200} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="What scientific problem would you like to investigate?" /></label>
      <label className="block text-sm font-medium">Discipline<select value={discipline} onChange={event => { localEditRevisionRef.current += 1; setDiscipline(event.target.value); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{PROPOSAL_DISCIPLINES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="block text-sm font-medium">Proposal language<select value={language} onChange={event => { localEditRevisionRef.current += 1; setLanguage(event.target.value); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{PROPOSAL_LANGUAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="mt-2 block text-xs font-normal text-muted-foreground">Proposal sections can be marked not applicable or left for researcher input.</span></label>
      <label className="block text-sm font-medium">Study approach<select value={researchType} onChange={event => { localEditRevisionRef.current += 1; setResearchType(event.target.value); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{RESEARCH_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
    </div>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project publications ({selectedPapers.length} selected)</legend>
      {!linkedPapers.length ? <p className="p-2 text-sm text-muted-foreground">No saved project sources yet. The complete proposal workflow will search scholarly indexes for candidate records.</p> : <><p className="mb-2 text-xs text-muted-foreground">Optionally include these records in discovery and selection.</p><div className="max-h-64 space-y-1 overflow-y-auto">{linkedPapers.map(paper => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary/60"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedIds.includes(String(paper.id))} onChange={() => toggle(paper.id)} /><span className="min-w-0 text-sm"><span className="block font-medium leading-5">{paper.title || 'Title unavailable'}</span><span className="mt-1 block text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'} · {paper.year || 'Year unavailable'} · {paper.summary ? 'abstract available' : 'metadata only'}</span></span></label>)}</div></>}
    </fieldset>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project context EYRA may use</legend><div className="grid gap-2 sm:grid-cols-2">
      {[['project_objectives','Project objectives and plan'],['evidence_matrix','Evidence Matrix'],['literature_review','Literature Review'],['researcher_notes','Researcher-authored matrix notes']].map(([key,label]) => <label key={key} className="flex min-h-10 items-start gap-2 text-sm"><input className="mt-1 size-4 accent-primary" type="checkbox" checked={Boolean(contextSelection[key])} onChange={() => toggleContext(key)} />{label}</label>)}
    </div><p className="mt-2 text-xs text-muted-foreground">Only selected papers and selected project outputs are sent to EYRA. Source facts and interpretations require citations; proposed methods and contributions are not validated outcomes.</p></fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => generateCompleteProposal(false)} disabled={generating || question.trim().length < 8} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{generating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{generating ? 'Generating complete proposal…' : 'Generate Complete Proposal'}</button>
      {generating && <button type="button" onClick={() => controllerRef.current?.abort()} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Cancel generation</button>}
      {generationRun && ['failed', 'paused'].includes(generationRun.status) && <button type="button" onClick={() => generateCompleteProposal(true)} disabled={generating || question.trim() !== generationRun.idea || discipline !== generationRun.discipline || researchType !== (generationRun.research_type || 'other') || language !== generationRun.language} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">Resume saved run</button>}
      <button type="button" onClick={save} disabled={saving || !hasDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save to project'}</button>
      <button type="button" onClick={exportMarkdown} disabled={!hasDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"><Download size={16} aria-hidden="true" />Export Markdown</button>
      {researcherEdited && aiDraft && <button type="button" onClick={applyLatest} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Apply latest draft</button>}
      <span role="status" className="self-center text-xs text-muted-foreground">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : stored.updated_at ? 'Saved project version' : 'Not saved yet'}</span>
    </div>
    {generationRun && <div className="rounded-xl border border-border bg-secondary/20 p-3" aria-label="Complete proposal generation progress">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium" role="status" aria-live="polite">{generationRun.status === 'complete' ? 'Saved draft ready for researcher review' : generationRun.status === 'running' ? autonomousProposalProgress(generationRun).label : generationRun.status === 'paused' ? 'Generation paused at a saved checkpoint' : `Generation stopped at: ${autonomousProposalProgress(generationRun).label}`}</p><span className="text-xs text-muted-foreground">{generationRun.status === 'complete' ? 'Draft · not scientifically validated' : `${autonomousProposalProgress(generationRun).percent}%`}</span></div>
      {generationRun.status !== 'complete' && <progress className="mt-2 h-2 w-full accent-primary" max="100" value={autonomousProposalProgress(generationRun).percent} aria-label="Proposal generation progress" />}
      {generationRun.error_code && <p className="mt-2 text-xs text-muted-foreground">Last checkpoint: {generationRun.stage.replaceAll('_', ' ')}. {generationRun.saved_sources ? `${Object.keys(generationRun.saved_sources).length} source record(s) verified in this project.` : ''}</p>}
    </div>}
    <p className="text-xs leading-5 text-muted-foreground">Editable scientific draft requiring researcher evaluation; not peer reviewed. Citation validation checks selected source IDs, not whether each claim is semantically supported. Where full text is unavailable, EYRA can use only metadata and available abstracts.</p>
    {message && <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{message}</p>}{error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {!hasDraft && <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Enter a research idea, choose a discipline and language, then generate the complete 18-section proposal. EYRA runs only after you choose Generate Complete Proposal.</div>}
    {generationRun?.status === 'complete' && generationRun.milestones?.length > 0 && <section className="rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label="Proposed research milestones"><h4 className="font-semibold">Proposed research milestones</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">These are generated activities for review. They have not been approved or added to the project workplan.</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{generationRun.milestones.map(task => <li key={task.task_key}><span className="font-medium">{task.phase}: {task.title}</span>{task.deliverable && <span className="block text-xs text-muted-foreground">Deliverable: {task.deliverable}</span>}</li>)}</ol></section>}
    {generationRun?.status === 'complete' && <>
      {generationRun.source_assessments?.length > 0 && <section className="rounded-xl border border-border p-4" aria-label="Selected scholarly evidence"><h4 className="font-semibold">Selected scholarly records</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">EYRA performed a relevance triage from supplied metadata and available abstracts. This does not establish study quality or that a source supports each claim.</p><ul className="mt-3 space-y-3">{generationRun.source_assessments.map(assessment => {
        const record = generationRun.candidates?.find(candidate => candidate.key === assessment.source_key)?.record;
        const verification = generationRun.source_verifications?.find(item => item.source_key === assessment.source_key);
        const href = record && safeResearchSourceUrl(record);
        return <li key={assessment.source_key} className="rounded-lg bg-secondary/25 p-3 text-sm"><p className="font-medium">{href ? <a className="text-primary underline-offset-2 hover:underline" href={href} target="_blank" rel="noopener noreferrer">{record.title} <ExternalLink size={12} className="inline" aria-hidden="true" /></a> : record?.title || 'Selected project record'}</p><p className="mt-1 text-xs text-muted-foreground">{record?.authors || 'Authors unavailable'}{record?.year ? ` · ${record.year}` : ''}{record?.doi ? ` · DOI ${record.doi}` : ''}</p><p className="mt-2 text-xs"><span className="font-semibold">Why selected:</span> {assessment.reason || 'No additional rationale provided.'}</p><p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold">Limit:</span> {assessment.limitation}</p><p className="mt-2 text-xs"><span className="font-semibold">DOI metadata check:</span> {verification?.status || 'Not run'}{verification?.source ? ` · ${verification.source}` : ''}. Matching metadata supports record identity only, not scientific claim support.</p>{verification?.fields?.map(field => <p key={field.label} className="mt-1 text-xs text-muted-foreground">{field.label}: {field.status}{field.status === 'mismatch' ? ` (${field.saved_value || 'unavailable'} / ${field.source_value || 'unavailable'})` : ''}</p>)}{verification?.retraction_status && verification.retraction_status !== 'No Crossref update notice listed' && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Crossref notice: {verification.retraction_status}. Check the publisher record.</p>}</li>;
      })}</ul></section>}
      {generationRun.planning?.open_questions?.length > 0 && <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" aria-label="Unresolved scientific questions"><h4 className="font-semibold">Open scientific questions</h4><p className="mt-1 text-xs text-muted-foreground">These questions were not answered by the planning step and require researcher judgment or further evidence.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{generationRun.planning.open_questions.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></section>}
    </>}
    {hasDraft && sections.length > 0 && <div className="space-y-3" aria-label="Editable research proposal draft">{PROPOSAL_SECTIONS.map(definition => {
      const section = sections.find(item => item.section_id === definition.id) || { section_id: definition.id, status: 'needs_input', claims: [] };
      return <section key={definition.id} className="rounded-xl border border-border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-base font-semibold">{definition.label}</h4><label className="text-xs text-muted-foreground">Section status<select aria-label={`${definition.label} status`} value={section.status} onChange={event => updateStatus(definition.id, event.target.value)} className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2 text-xs">{PROPOSAL_STATUSES.map(status => <option key={status} value={status}>{status === 'drafted' ? 'Drafted' : status === 'not_applicable' ? 'Not applicable' : 'Needs input'}</option>)}</select></label></div>
        {definition.id === 'bibliography' ? <ol className="mt-3 space-y-3 pl-5 text-sm leading-6">{bibliography.map(source => <li key={source.id}><textarea aria-label={`Bibliography entry for ${source.title}`} value={bibliographyEntries[source.id] ?? defaultBibliographyEntry(source)} onChange={event => { markResearcherEdit(); setBibliographyEntries(current => ({ ...current, [source.id]: event.target.value })); }} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" />{source.doi && <p className="text-xs text-muted-foreground">DOI: {source.doi}</p>}{safeResearchSourceUrl(source) && <a className="inline-flex min-h-8 items-center gap-1 text-xs text-primary" href={safeResearchSourceUrl(source)} target="_blank" rel="noopener noreferrer">Open verified project record <ExternalLink size={12} aria-hidden="true" /></a>}</li>)}{!bibliography.length && <li className="list-none italic text-muted-foreground">No selected scholarly records.</li>}</ol> : section.status === 'not_applicable' ? <p className="mt-2 text-sm italic text-muted-foreground">Marked not applicable. Existing draft text is preserved in case you change this status.</p> : renderClaims(section.claims, definition.id)}
        {definition.id === 'research_methodology' && <div className="mt-4 space-y-3 rounded-lg bg-secondary/20 p-3"><h5 className="text-sm font-semibold">Proposed methodology plan</h5>{METHODOLOGY_TOPICS.map(topic => { const field = methodology[topic.id] || { status: 'needs_input', claims: [] }; return <div key={topic.id} className="border-t border-border/70 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><h6 className="text-sm font-medium">{topic.label}</h6><label className="text-xs text-muted-foreground">Status<select aria-label={`${topic.label} status`} value={field.status} onChange={event => updateStatus('', event.target.value, topic.id)} className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2">{PROPOSAL_STATUSES.map(status => <option key={status} value={status}>{status === 'drafted' ? 'Proposed' : status === 'not_applicable' ? 'Not applicable' : 'Needs input'}</option>)}</select></label></div>{field.status === 'not_applicable' ? <p className="mt-2 text-sm italic text-muted-foreground">Marked not applicable. Existing draft text is preserved.</p> : renderClaims(field.claims, '', topic.id)}</div>; })}</div>}
        {definition.id !== 'bibliography' && <label className="mt-3 block text-xs font-medium text-muted-foreground">Researcher-authored addition<textarea value={sectionNotes[definition.id] || ''} onChange={event => { markResearcherEdit(); setSectionNotes(current => ({ ...current, [definition.id]: event.target.value })); }} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal leading-6" placeholder="Add your own notes without replacing the generated draft" /></label>}
      </section>;
    })}</div>}
  </section>;
}
