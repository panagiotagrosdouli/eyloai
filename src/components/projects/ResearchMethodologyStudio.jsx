import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Save, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  projectLinkedProposalPapers,
} from '@/lib/research-proposal-studio.mjs';
import {
  METHODOLOGY_DISCIPLINES, METHODOLOGY_SECTIONS, METHOD_IMPLEMENTATION_STATES,
  METHOD_STATUSES, hasMethodologyDraft, methodologyErrorMessage, methodologyMarkdown, methodologySaveReceipt,
  RESEARCH_METHODOLOGY_SCHEMA, validateMethodologyDraft, buildMethodologyPrompt,
} from '@/lib/research-methodology-studio.mjs';

function emptyTopics() {
  return Object.fromEntries(METHODOLOGY_SECTIONS.map(section => [section.id, {
    status: 'needs_input', implementation_state: 'proposed', implementation_state_origin: 'eyra', claims: [],
  }]));
}

function sourceUrl(paper) {
  try {
    const url = new URL(paper.url);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* use DOI only if its format is valid */ }
  const doi = String(paper.doi || '').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  return /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i.test(doi) ? `https://doi.org/${doi}` : '';
}

export default function ResearchMethodologyStudio({ project, savedPapers, onProjectSaved }) {
  const linkedPapers = useMemo(() => projectLinkedProposalPapers(savedPapers, project.id), [savedPapers, project.id]);
  const stored = project.research_methodology && typeof project.research_methodology === 'object' ? project.research_methodology : {};
  const proposal = project.research_proposal && typeof project.research_proposal === 'object' ? project.research_proposal : {};
  const defaultIds = stored.selected_paper_ids || proposal.selected_paper_ids || project.literature_review?.selected_paper_ids || project.evidence_matrix?.selected_paper_ids || [];
  const [question, setQuestion] = useState(stored.research_question || proposal.research_question || project.evidence_matrix?.research_question || project.literature_review?.research_question || '');
  const [discipline, setDiscipline] = useState(stored.discipline || proposal.research_type || 'other');
  const [selectedIds, setSelectedIds] = useState(() => (Array.isArray(defaultIds) ? defaultIds : []).map(String).filter(id => linkedPapers.some(paper => String(paper.id) === id)));
  const [contextSelection, setContextSelection] = useState({
    project_objectives: stored.context_selection?.project_objectives ?? true,
    evidence_matrix: stored.context_selection?.evidence_matrix ?? Boolean(project.evidence_matrix),
    literature_review: stored.context_selection?.literature_review ?? Boolean(project.literature_review),
    research_proposal: stored.context_selection?.research_proposal ?? Boolean(project.research_proposal),
    researcher_notes: stored.context_selection?.researcher_notes ?? false,
  });
  const [aiDraft, setAiDraft] = useState(stored.ai_draft || null);
  const [topics, setTopics] = useState(stored.edited_topics || stored.ai_draft?.topics || emptyTopics());
  const [topicNotes, setTopicNotes] = useState(stored.topic_notes || {});
  const [researcherEdited, setResearcherEdited] = useState(Boolean(stored.researcher_edited));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  const selectedPapers = linkedPapers.filter(paper => selectedIds.includes(String(paper.id)));
  const sourceMap = useMemo(() => new Map(linkedPapers.map(paper => [String(paper.id), paper])), [linkedPapers]);
  const hasDraft = hasMethodologyDraft({ aiDraft, savedTopics: stored.edited_topics, topics, topicNotes });

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setContext = key => {
    setContextSelection(current => ({ ...current, [key]: !current[key] }));
    setDirty(true);
  };
  const togglePaper = id => {
    setSelectedIds(current => current.includes(String(id)) ? current.filter(value => value !== String(id)) : [...current, String(id)]);
    setDirty(true);
  };

  const generate = async () => {
    setError(''); setMessage('');
    if (!question.trim()) { setError('Enter a research question before drafting a methodology.'); return; }
    const controller = new AbortController(); controllerRef.current = controller; setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: RESEARCH_METHODOLOGY_SCHEMA,
        prompt: buildMethodologyPrompt({ question, discipline, papers: selectedPapers, project, contextSelection }),
        signal: controller.signal,
      });
      const validated = validateMethodologyDraft(result, selectedPapers);
      setAiDraft(validated);
      if (!researcherEdited || !aiDraft) { setTopics(validated.topics); setResearcherEdited(false); }
      setDirty(true);
      setMessage(researcherEdited
        ? 'A new methodology draft is ready. Your researcher edits remain intact; apply the latest draft only if you choose to replace them.'
        : 'EYRA drafted a proposed methodology plan. Review every method and source against the original records.');
    } catch (failure) {
      setError(methodologyErrorMessage(failure, controller.signal.aborted));
    } finally { if (controllerRef.current === controller) controllerRef.current = null; setGenerating(false); }
  };

  const save = async () => {
    if (saving || !hasDraft) return;
    setSaving(true); setError(''); setMessage('');
    const artifact = {
      research_question: question.trim().slice(0, 1200), discipline,
      selected_paper_ids: selectedIds.filter(id => sourceMap.has(id)), context_selection: contextSelection,
      ai_draft: aiDraft, edited_topics: topics, topic_notes: topicNotes,
      researcher_edited: researcherEdited, updated_at: new Date().toISOString(),
    };
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(project.id, { research_methodology: artifact }, project.updated_date);
      if (!methodologySaveReceipt(saved, project.id, artifact)) throw new Error('unverified');
      onProjectSaved(saved); setDirty(false); setMessage('Methodology plan saved to this private research project.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT'
        ? 'This project changed in another session. Your methodology edits remain here; reload the project before saving.'
        : 'The methodology plan could not be verified as saved. Your edits remain here.');
    } finally { setSaving(false); }
  };

  const updateClaim = (sectionId, index, value) => {
    setResearcherEdited(true); setDirty(true);
    setTopics(current => ({ ...current, [sectionId]: { ...current[sectionId], claims: current[sectionId].claims.map((claim, claimIndex) => claimIndex === index ? { ...claim, text: value, origin: 'researcher' } : claim) } }));
  };

  const updateImplementationState = (sectionId, value) => {
    setResearcherEdited(true); setDirty(true);
    setTopics(current => ({ ...current, [sectionId]: { ...current[sectionId], implementation_state: value, implementation_state_origin: 'researcher' } }));
  };

  const updateStatus = (sectionId, value) => {
    setResearcherEdited(true); setDirty(true);
    setTopics(current => ({ ...current, [sectionId]: { ...current[sectionId], status: value } }));
  };

  const addResearcherStatement = sectionId => {
    setResearcherEdited(true); setDirty(true);
    setTopics(current => ({ ...current, [sectionId]: { ...current[sectionId], status: 'drafted', claims: [...current[sectionId].claims, { heading: '', text: '', kind: 'proposal', source_ids: [], origin: 'researcher' }] } }));
  };

  const applyLatest = () => {
    setTopics(aiDraft.topics); setResearcherEdited(false); setDirty(true);
    setMessage('Latest EYRA methodology draft applied. Review the replaced fields before saving.');
  };

  const exportMarkdown = () => {
    const text = methodologyMarkdown({ question, discipline, topics, papers: linkedPapers, topicNotes });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'research-methodology-plan.md';
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };

  return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="research-methodology-studio-title">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Scientific Output Studio · Methodology</p>
      <h3 id="research-methodology-studio-title" className="mt-1 text-xl font-semibold">Design a research methodology</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Build a discipline-aware, editable methods plan from the question and project materials you choose. EYRA receives available metadata and abstracts only. Generated methods stay proposals until a researcher reports implementation or validation.</p>
      <nav aria-label="Research workflow" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <a href="#evidence-matrix-studio-title" className="min-h-8 text-primary hover:underline">Evidence Matrix</a>
        <a href="#literature-review-builder-title" className="min-h-8 text-primary hover:underline">Literature Review</a>
        <a href="#research-proposal-builder-title" className="min-h-8 text-primary hover:underline">Research Proposal</a>
        <span aria-current="step" className="font-semibold">Methodology</span>
        <a href="#research-roadmap-studio-title" className="min-h-8 text-primary hover:underline">Research Roadmap</a>
      </nav>
    </header>
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="block text-sm font-medium">Methodology research question<textarea value={question} onChange={event => { setQuestion(event.target.value); setDirty(true); }} maxLength={1200} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="What question should guide the study design?" /></label>
      <label className="block text-sm font-medium">Discipline or approach<select value={discipline} onChange={event => { setDiscipline(event.target.value); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{METHODOLOGY_DISCIPLINES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="mt-2 block text-xs font-normal text-muted-foreground">Sections can be marked not applicable or left for researcher input.</span></label>
    </div>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Scholarly records ({selectedPapers.length} selected)</legend>
      {!linkedPapers.length ? <p className="p-2 text-sm text-muted-foreground">No papers are linked to this project. EYRA can propose a plan from the question and selected project context, without source-based claims.</p> : <div className="max-h-64 space-y-1 overflow-y-auto">{linkedPapers.map(paper => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary/60"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedIds.includes(String(paper.id))} onChange={() => togglePaper(paper.id)} /><span className="min-w-0 text-sm"><span className="block font-medium leading-5">{paper.title || 'Title unavailable'}</span><span className="mt-1 block text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'} · {paper.year || 'Year unavailable'} · {paper.summary ? 'abstract available' : 'metadata only'}</span></span></label>)}</div>}
    </fieldset>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project materials EYRA may use</legend><div className="grid gap-2 sm:grid-cols-2">
      {[["project_objectives","Project objectives and current workplan"],["evidence_matrix","Evidence Matrix"],["literature_review","Literature Review"],["research_proposal","Research Proposal"],["researcher_notes","Researcher-authored notes"]].map(([key,label]) => <label key={key} className="flex min-h-10 items-start gap-2 text-sm"><input className="mt-1 size-4 accent-primary" type="checkbox" checked={Boolean(contextSelection[key])} onChange={() => setContext(key)} />{label}</label>)}
    </div><p className="mt-2 text-xs text-muted-foreground">Only checked project materials and selected records are sent. Factual claims require source IDs; a matching ID does not prove that a source supports the claim.</p></fieldset>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={generate} disabled={generating} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{generating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{generating ? 'Drafting methodology…' : 'Draft methodology with EYRA'}</button>
      {generating && <button type="button" onClick={() => controllerRef.current?.abort()} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Cancel drafting</button>}
      <button type="button" onClick={save} disabled={saving || !hasDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save methodology'}</button>
      <button type="button" onClick={exportMarkdown} disabled={!hasDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"><Download size={16} aria-hidden="true" />Export Markdown</button>
      {researcherEdited && aiDraft && <button type="button" onClick={applyLatest} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Apply latest EYRA draft</button>}
      <span role="status" className="self-center text-xs text-muted-foreground">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : stored.updated_at ? 'Saved project version' : 'Not saved yet'}</span>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">EYRA cannot mark methods as implemented or validated. Researchers may mark their own reported status below; EYLO does not independently verify it. The plan is an editable scientific draft, not peer reviewed.</p>
    {message && <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{message}</p>}{error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {!hasDraft && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Enter a question and draft a methodology plan. No project data is sent until you choose Draft methodology with EYRA.</p>}
    {hasDraft && <div className="space-y-3" aria-label="Editable methodology sections">{METHODOLOGY_SECTIONS.map(section => {
      const topic = topics[section.id] || emptyTopics()[section.id];
      return <section key={section.id} className="rounded-xl border border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-base font-semibold">{section.label}</h4><p className="mt-1 text-xs text-muted-foreground">{topic.implementation_state === 'researcher_reported_implemented' ? 'Researcher-reported implementation; not verified' : topic.implementation_state === 'researcher_reported_validated' ? 'Researcher-reported validation; not independently verified' : 'Proposed method'}</p></div>
          <div className="flex flex-wrap gap-2"><label className="text-xs text-muted-foreground">Content status<select aria-label={`${section.label} content status`} value={topic.status} onChange={event => updateStatus(section.id,event.target.value)} className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2">{METHOD_STATUSES.map(status => <option key={status} value={status}>{status === 'drafted' ? 'Drafted' : status === 'not_applicable' ? 'Not applicable' : 'Needs input'}</option>)}</select></label><label className="text-xs text-muted-foreground">Researcher report<select aria-label={`${section.label} implementation report`} value={topic.implementation_state || 'proposed'} onChange={event => updateImplementationState(section.id,event.target.value)} className="ml-2 min-h-9 max-w-52 rounded-lg border border-border bg-background px-2">{METHOD_IMPLEMENTATION_STATES.map(state => <option key={state} value={state}>{state === 'proposed' ? 'Proposed' : state === 'researcher_reported_implemented' ? 'Reported implemented' : 'Reported validated'}</option>)}</select></label></div>
        </div>
        {topic.status === 'not_applicable' ? <p className="mt-3 text-sm italic text-muted-foreground">Marked not applicable. Existing text remains stored if you change this choice.</p> : <div className="mt-3 space-y-3">{(topic.claims || []).length ? topic.claims.map((claim,index) => <div key={`${section.id}-${index}`} className="rounded-lg bg-secondary/30 p-3">{claim.heading && <p className="text-sm font-semibold">{claim.heading}</p>}<textarea aria-label={`${section.label} statement ${index + 1}`} value={claim.text} onChange={event => updateClaim(section.id,index,event.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" /><p className="mt-2 text-xs text-muted-foreground">{claim.kind === 'source_fact' ? 'Source fact' : claim.kind === 'interpretation' ? 'Evidence interpretation' : claim.kind === 'proposal' ? 'Proposed activity' : 'Open question'} · {claim.origin === 'researcher' ? 'Researcher edited' : 'EYRA draft'}</p>{claim.source_ids?.length ? <ul className="mt-2 space-y-1">{claim.source_ids.map(id => {const paper=sourceMap.get(String(id));const href=paper&&sourceUrl(paper);return <li key={id} className="text-xs">{paper ? <a className="inline-flex min-h-8 items-center gap-1 text-primary hover:underline" href={href||undefined} target={href?'_blank':undefined} rel={href?'noopener noreferrer':undefined}>{paper.authors||'Authors unavailable'} ({paper.year||'Year unavailable'}) — {paper.title||'Title unavailable'}{href&&<ExternalLink size={12} aria-hidden="true"/>}</a> : <span className="text-destructive">A cited project source is no longer available.</span>}</li>;})}</ul> : <p className="mt-2 text-xs text-muted-foreground">No source citation. Treat this as a proposal or open question.</p>}</div>) : <p className="text-sm italic text-muted-foreground">No drafted statements yet.</p>}<button type="button" onClick={() => addResearcherStatement(section.id)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary/60">Add researcher proposed statement</button></div>}
        <label className="mt-3 block text-xs font-medium text-muted-foreground">Researcher note<textarea value={topicNotes[section.id]||''} onChange={event=>{setTopicNotes(current=>({...current,[section.id]:event.target.value}));setResearcherEdited(true);setDirty(true);}} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal leading-6" placeholder="Record a decision, implementation note, or unresolved question" /></label>
      </section>;
    })}</div>}
  </section>;
}
