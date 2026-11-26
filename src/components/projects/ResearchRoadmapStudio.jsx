import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { projectLinkedProposalPapers } from '@/lib/research-proposal-studio.mjs';
import { safeResearchSourceUrl } from '@/lib/research-source-url.mjs';
import { ROADMAP_TASK_SCHEMA, buildResearchRoadmapPrompt, roadmapErrorMessage, roadmapMarkdown, validateRoadmapDraft } from '@/lib/research-roadmap-studio.mjs';

export default function ResearchRoadmapStudio({ project, savedPapers, onApproveTasks }) {
  const linkedPapers = useMemo(() => projectLinkedProposalPapers(savedPapers, project.id), [savedPapers, project.id]);
  const proposal = project.research_proposal || {};
  const methodology = project.research_methodology || {};
  const questionDefault = proposal.research_question || methodology.research_question || project.evidence_matrix?.research_question || project.literature_review?.research_question || '';
  const idsDefault = methodology.selected_paper_ids || proposal.selected_paper_ids || project.evidence_matrix?.selected_paper_ids || project.literature_review?.selected_paper_ids || [];
  const [question, setQuestion] = useState(questionDefault);
  const [selectedIds, setSelectedIds] = useState(() => (Array.isArray(idsDefault) ? idsDefault : []).map(String).filter(id => linkedPapers.some(paper => String(paper.id) === id)));
  const [contextSelection, setContextSelection] = useState({
    project_objectives: true, evidence_matrix: Boolean(project.evidence_matrix), literature_review: Boolean(project.literature_review),
    research_proposal: Boolean(project.research_proposal), research_methodology: Boolean(project.research_methodology), researcher_notes: false,
  });
  const [draft, setDraft] = useState(null);
  const [aiDraft, setAiDraft] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [researcherEdited, setResearcherEdited] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const controllerRef = useRef(null);
  const selectedPapers = linkedPapers.filter(paper => selectedIds.includes(String(paper.id)));
  const paperMap = useMemo(() => new Map(linkedPapers.map(paper => [String(paper.id), paper])), [linkedPapers]);
  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (!researcherEdited) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [researcherEdited]);

  const updateTask = (taskKey, patch) => {
    setResearcherEdited(true);
    setDraft(current => ({ tasks: current.tasks.map(task => task.task_key === taskKey ? { ...task, ...patch } : task) }));
  };
  const generate = async () => {
    setError(''); setNotice('');
    if (!question.trim()) { setError('Enter a research question before drafting a roadmap.'); return; }
    const controller = new AbortController(); controllerRef.current = controller; setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: ROADMAP_TASK_SCHEMA,
        prompt: buildResearchRoadmapPrompt({ question, papers: selectedPapers, project, contextSelection }),
        signal: controller.signal,
      });
      const allowedDates = contextSelection.project_objectives && Array.isArray(project.plan_items) ? project.plan_items.slice(0, 30).map(item => String(item?.due_date || '')).filter(Boolean) : [];
      const validated = validateRoadmapDraft(result, selectedPapers, { allowedDates });
      setAiDraft(validated);
      if (!researcherEdited || !draft) {
        setDraft(validated); setSelectedTasks(validated.tasks.map(task => task.task_key)); setResearcherEdited(false);
        setNotice('EYRA suggested a draft roadmap. Review the phases, dependencies, dates, risks, and references before approval.');
      } else {
        setNotice('A new EYRA roadmap is ready. Your edits are preserved; apply the latest draft only if you choose to replace them.');
      }
    } catch (failure) { setError(roadmapErrorMessage(failure, controller.signal.aborted)); }
    finally { if (controllerRef.current === controller) controllerRef.current = null; setGenerating(false); }
  };
  const applyLatest = () => {
    setDraft(aiDraft); setSelectedTasks(aiDraft.tasks.map(task => task.task_key)); setResearcherEdited(false);
    setNotice('Latest EYRA roadmap applied. Review its replaced fields before approving tasks.');
  };
  const approve = () => {
    setError(''); setNotice('');
    try {
      const validated = validateRoadmapDraft({ tasks: draft.tasks }, selectedPapers, { allowResearcherEnteredDates: true });
      const result = onApproveTasks?.(validated.tasks, selectedTasks);
      if (!result) { setError('The selected roadmap tasks could not be added to the current workplan draft. Review dependencies and task limits.'); return; }
      setDraft(null); setSelectedTasks([]);
      setNotice('Selected tasks were added to the existing workplan draft. Review them there and choose Save workplan to persist.');
    } catch (failure) { setError(failure?.message || 'Review the roadmap before adding tasks.'); }
  };
  const toggleTask = key => setSelectedTasks(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const togglePaper = id => setSelectedIds(current => current.includes(String(id)) ? current.filter(value => value !== String(id)) : [...current, String(id)]);
  const toggleContext = key => setContextSelection(current => ({ ...current, [key]: !current[key] }));
  const exportMarkdown = () => {
    const text = roadmapMarkdown({ question, tasks: draft?.tasks || [], papers: linkedPapers });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'research-execution-roadmap.md';
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };

  return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="research-roadmap-studio-title">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Scientific Output Studio · Execution</p>
      <h3 id="research-roadmap-studio-title" className="mt-1 text-xl font-semibold">Plan the research work</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Turn the research question, proposal, and methodology you choose into proposed phases and tasks. EYRA does not claim completion, assign estimated dates, or save tasks. Approval adds selected tasks to the existing workplan draft; Save workplan remains a separate action.</p>
      <nav aria-label="Research workflow" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a href="#evidence-matrix-studio-title" className="min-h-8 text-primary hover:underline">Evidence Matrix</a>
        <a href="#literature-review-builder-title" className="min-h-8 text-primary hover:underline">Literature Review</a>
        <a href="#research-proposal-builder-title" className="min-h-8 text-primary hover:underline">Research Proposal</a>
        <a href="#research-methodology-studio-title" className="min-h-8 text-primary hover:underline">Methodology</a>
        <span aria-current="step" className="font-semibold">Roadmap</span>
      </nav>
    </header>
    <label className="block text-sm font-medium">Roadmap research question<textarea value={question} onChange={event => setQuestion(event.target.value)} maxLength={1200} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="What work is needed to investigate this question?" /></label>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Scholarly records ({selectedPapers.length} selected)</legend>
      {!linkedPapers.length ? <p className="p-2 text-sm text-muted-foreground">No scholarly records are linked. EYRA can propose non-evidence claims from selected project context only.</p> : <div className="max-h-56 space-y-1 overflow-y-auto">{linkedPapers.map(paper => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary/60"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedIds.includes(String(paper.id))} onChange={() => togglePaper(paper.id)} /><span className="min-w-0 text-sm"><span className="block font-medium">{paper.title || 'Title unavailable'}</span><span className="text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'} · {paper.year || 'Year unavailable'} · {paper.summary ? 'abstract available' : 'metadata only'}</span></span></label>)}</div>}
    </fieldset>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project context EYRA may use</legend><div className="grid gap-2 sm:grid-cols-2">
      {[[ 'project_objectives', 'Objectives and existing workplan' ],['evidence_matrix','Evidence Matrix'],['literature_review','Literature Review'],['research_proposal','Research Proposal'],['research_methodology','Methodology'],['researcher_notes','Researcher-authored notes']].map(([key,label]) => <label key={key} className="flex min-h-10 items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={contextSelection[key]} onChange={() => toggleContext(key)} />{label}</label>)}
    </div><p className="mt-2 text-xs text-muted-foreground">Only checked project material and selected source records are sent. Factual evidence summaries require exact selected source references.</p></fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={generate} disabled={generating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{generating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{generating ? 'Drafting roadmap…' : 'Draft roadmap with EYRA'}</button>
      {generating && <button type="button" onClick={() => controllerRef.current?.abort()} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Cancel drafting</button>}
      {draft && <button type="button" onClick={exportMarkdown} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold"><Download size={16} aria-hidden="true" />Export Markdown</button>}
      {researcherEdited && aiDraft && <button type="button" onClick={applyLatest} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Apply latest EYRA roadmap</button>}
      {draft && <button type="button" onClick={approve} disabled={!selectedTasks.length} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Approve selected tasks into workplan draft</button>}
    </div>
    {notice && <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {!draft && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No roadmap draft yet. Generation is fixture-tested through the authenticated EYRA integration; no task changes occur until you approve them.</p>}
    {draft && <div className="space-y-3" aria-label="Editable roadmap tasks">
      {draft.tasks.map((task,index) => <article key={task.task_key} className="rounded-xl border border-border p-4 sm:p-5">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedTasks.includes(task.task_key)} onChange={() => toggleTask(task.task_key)} /><span className="text-xs font-semibold text-muted-foreground">Select task {index + 1}</span></label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">Phase<input value={task.phase} onChange={event => updateTask(task.task_key,{ phase: event.target.value })} maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Proposed task<input value={task.title} onChange={event => updateTask(task.task_key,{ title: event.target.value })} maxLength={500} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Deliverable<textarea value={task.deliverable} onChange={event => updateTask(task.task_key,{ deliverable: event.target.value })} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Proposed date (optional)<input type="date" value={task.due_date} onChange={event => updateTask(task.task_key,{ due_date: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Risk<textarea value={task.risk} onChange={event => updateTask(task.task_key,{ risk: event.target.value })} maxLength={1500} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Researcher notes<textarea value={task.researcher_notes} onChange={event => updateTask(task.task_key,{ researcher_notes: event.target.value })} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Evidence summary<textarea value={task.evidence_summary} onChange={event => updateTask(task.task_key,{ evidence_summary: event.target.value })} maxLength={3000} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          <label className="text-xs font-medium text-muted-foreground">Evidence type<select value={task.evidence_kind} onChange={event => updateTask(task.task_key,{ evidence_kind: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="source_fact">Source fact</option><option value="interpretation">Evidence interpretation</option><option value="proposal">Proposed activity</option><option value="open_question">Open question</option><option value="none">No source claim</option></select></label>
        </div>
        <fieldset className="mt-3 rounded-lg border border-border p-3"><legend className="px-1 text-xs font-semibold">Evidence references</legend>{selectedPapers.length ? <div className="space-y-2">{selectedPapers.map(paper => <label key={paper.id} className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={task.source_ids.includes(String(paper.id))} onChange={() => updateTask(task.task_key,{ source_ids: task.source_ids.includes(String(paper.id)) ? task.source_ids.filter(id => id !== String(paper.id)) : [...task.source_ids, String(paper.id)] })} /><span>{paper.authors || 'Authors unavailable'} ({paper.year || 'Year unavailable'}) — {paper.title || 'Title unavailable'}{safeResearchSourceUrl(paper) && <a href={safeResearchSourceUrl(paper)} target="_blank" rel="noopener noreferrer" aria-label={`Open source: ${paper.title || 'scholarly record'}`} className="ml-1 inline-flex min-h-8 items-center gap-1 text-primary hover:underline">Inspect <ExternalLink size={12} aria-hidden="true" /></a>}</span></label>)}</div> : <p className="text-xs text-muted-foreground">No selected records are available for citation.</p>}</fieldset>
        <fieldset className="mt-3 rounded-lg border border-border p-3"><legend className="px-1 text-xs font-semibold">Prerequisites</legend><div className="grid gap-2 sm:grid-cols-2">{draft.tasks.filter(candidate => candidate.task_key !== task.task_key).map(candidate => <label key={candidate.task_key} className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={task.depends_on.includes(candidate.task_key)} onChange={() => updateTask(task.task_key,{ depends_on: task.depends_on.includes(candidate.task_key) ? task.depends_on.filter(id => id !== candidate.task_key) : [...task.depends_on, candidate.task_key] })} />{candidate.title}</label>)}</div>{!draft.tasks.some(candidate => candidate.task_key !== task.task_key) && <p className="text-xs text-muted-foreground">No prerequisite candidates.</p>}</fieldset>
      </article>)}
    </div>}
    <p className="text-xs text-muted-foreground">Generated schedules are not approved. Dates are omitted unless the selected project context supplied them or a researcher edits them. No work is marked in progress or complete.</p>
  </section>;
}

