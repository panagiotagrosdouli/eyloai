import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Loader2, Save, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getUsableSession } from '@/lib/supabaseClient';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { saveDiscoveredGapPaper } from '@/lib/research-gap-literature-save.mjs';
import { verifyCitation } from '@/lib/citation-verification.mjs';
import { safeResearchSourceUrl } from '@/lib/research-source-url.mjs';
import { extractGrantCallDocument, GRANT_DOCUMENT_LIMITS } from '@/lib/grant-call-document.mjs';
import { persistAutonomousProposalCheckpoint } from '@/lib/autonomous-proposal-checkpoint.mjs';
import { autonomousProposalErrorMessage, autonomousProposalProgress, PROPOSAL_DISCIPLINES, PROPOSAL_LANGUAGES, runAutonomousProposal } from '@/lib/autonomous-proposal-engine.mjs';
import { stableProposalStringify, projectLinkedProposalPapers } from '@/lib/research-proposal-studio.mjs';
import {
  buildGrantProposalPrompt, extractGrantCallRequirements, exportGrantProposalMarkdown,
  GRANT_PROPOSAL_SCHEMA, mergeResearcherGrantEdits, reviewGrantProposal, safeOfficialCallUrl, validateGrantProposalDraft,
  validateGrantProposalInputs,
} from '@/lib/grant-proposal.mjs';

function readArtifact(project) { return project.grant_proposal && typeof project.grant_proposal === 'object' ? project.grant_proposal : {}; }
function editedDraftRevision(snapshot) { return stableProposalStringify(snapshot); }

export default function GrantProposalBuilder({ project, savedPapers = [], onProjectSaved, onPapersChanged }) {
  const { user } = useAuth();
  const saved = readArtifact(project);
  const linkedPapers = useMemo(() => projectLinkedProposalPapers(savedPapers, project.id), [savedPapers, project.id]);
  const [callTitle, setCallTitle] = useState(saved.call_source?.title || '');
  const [callUrl, setCallUrl] = useState(saved.call_source?.url || '');
  const [callText, setCallText] = useState(saved.call?.call_text || '');
  const [sourceDocuments, setSourceDocuments] = useState(saved.source_documents || []);
  const [sourceLines, setSourceLines] = useState(saved.call?.source_lines || (saved.source_documents || []).flatMap(document => document.lines || []));
  const [idea, setIdea] = useState(saved.project_idea || '');
  const [discipline, setDiscipline] = useState(saved.discipline || 'interdisciplinary');
  const [language, setLanguage] = useState(saved.language || 'en');
  const [sectionHeadingText, setSectionHeadingText] = useState((saved.section_headings || saved.call?.candidate_section_headings || []).join('\n'));
  const [confirmedRequirementIds, setConfirmedRequirementIds] = useState(saved.confirmed_requirement_ids || []);
  const [confirmedMissing, setConfirmedMissing] = useState(saved.confirmed_missing_information || []);
  const [selectedIds, setSelectedIds] = useState(saved.selected_paper_ids || []);
  const [budgetText, setBudgetText] = useState((saved.budget_figures || []).map(item => [item.id, item.category, item.amount_text, item.source_quote, item.source_url].join(' | ')).join('\n'));
  const [researcherFacts, setResearcherFacts] = useState(saved.researcher_supplied_facts || '');
  const [draft, setDraft] = useState(saved.draft || null);
  const [editedSections, setEditedSections] = useState(saved.edited_sections || saved.draft?.sections || []);
  const [quality, setQuality] = useState(saved.quality_findings || []);
  const [workflowRun, setWorkflowRun] = useState(() => saved.autonomous_run?.status === 'running' ? { ...saved.autonomous_run, status: 'paused' } : saved.autonomous_run || null);
  const [researcherReview, setResearcherReview] = useState(saved.researcher_review || null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processingDocuments, setProcessingDocuments] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  const projectRef = useRef(project);
  const userRef = useRef(user);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const call = useMemo(() => extractGrantCallRequirements({ text: callText, title: callTitle, sourceUrl: callUrl, sourceLines }), [callText, callTitle, callUrl, sourceLines]);
  const sectionHeadings = sectionHeadingText.split(/\r?\n/).map(text => text.trim()).filter(Boolean).slice(0, 30);
  const budgetFigures = budgetText.split(/\r?\n/).map(line => line.split('|').map(part => part.trim())).filter(parts => parts.length >= 5 && parts.some(Boolean)).map(([id, category, amount_text, source_quote, source_url]) => ({ id, category, amount_text, source_quote, source_url: safeOfficialCallUrl(source_url) }));
  const selectedPapers = linkedPapers.filter(paper => selectedIds.includes(String(paper.id)));
  const currentDraftRevision = editedDraftRevision({
    call: { title: callTitle, url: callUrl, text: callText, requirements: call.requirements, confirmedRequirementIds, missingInformation: call.missing_information, confirmedMissing },
    idea, discipline, language, sectionHeadings, selectedIds, budgetFigures, researcherFacts, draft, sections: editedSections,
  });
  const exportReady = Boolean(!dirty && researcherReview?.approved === true && researcherReview.draft_revision === currentDraftRevision);

  const artifactSnapshot = ({ run = workflowRun, currentDraft = draft, sections = editedSections, findings = quality, review = researcherReview } = {}) => ({
    call: { ...call, source_lines: sourceLines, requirements: call.requirements.map(item => ({ ...item, confirmation_status: confirmedRequirementIds.includes(item.id) ? 'confirmed' : 'unconfirmed' })) },
    call_source: { title: callTitle.trim(), url: safeOfficialCallUrl(callUrl) }, call_requirements: call.requirements.map(item => ({ ...item, confirmation_status: confirmedRequirementIds.includes(item.id) ? 'confirmed' : 'unconfirmed' })),
    bibliography: run?.bibliography || saved.bibliography || linkedPapers.filter(paper => selectedIds.includes(String(paper.id))).map(paper => ({ id: String(paper.id), title: paper.title || '', authors: paper.authors || '', year: paper.year || '', doi: paper.doi || '', url: paper.url || '' })),
    project_idea: idea.trim(), discipline, discipline_label: PROPOSAL_DISCIPLINES.find(item => item.id === discipline)?.label || 'Interdisciplinary', language, language_label: PROPOSAL_LANGUAGES.find(item => item.id === language)?.label || 'English',
    section_headings: sectionHeadings, confirmed_requirement_ids: confirmedRequirementIds, confirmed_missing_information: confirmedMissing, source_documents: sourceDocuments,
    selected_paper_ids: selectedIds, budget_figures: budgetFigures, researcher_supplied_facts: researcherFacts,
    draft: currentDraft, edited_sections: sections, quality_findings: findings, autonomous_run: run,
    researcher_review: review, updated_at: new Date().toISOString(),
  });

  const accountCheck = async (ownerId, signal) => {
    const session = await getUsableSession({ required: true, validate: true, expectedUserId: ownerId, ...(signal?.aborted ? {} : signal ? { signal } : {}) });
    if (!ownerId || session.user.id !== ownerId || String(userRef.current?.id || '') !== ownerId) throw Object.assign(new Error('The signed-in account changed during proposal generation.'), { code: 'ACCOUNT_CHANGED' });
    return session;
  };

  const save = async () => {
    if (saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await getUsableSession({ required: true, validate: true });
      const next = artifactSnapshot();
      const result = await base44.entities.Project.updateIfUnchanged(projectRef.current.id, { grant_proposal: next }, projectRef.current.updated_date);
      if (String(result?.id) !== String(project.id) || result?.grant_proposal?.updated_at !== next.updated_at) throw new Error('unverified');
      projectRef.current = result; onProjectSaved?.(result); setDirty(false); setMessage('Grant draft saved to this private research project.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT' ? 'The project changed in another session. Reload before saving; your current edits remain here.' : 'The grant draft could not be verified as saved. Your edits remain here.');
    } finally { setSaving(false); }
  };

  const generate = async ({ resume = false } = {}) => {
    setBusy(true); setError(''); setMessage('');
    const controller = new AbortController(); controllerRef.current = controller;
    let ownerId = '';
    try {
      ownerId = String((await getUsableSession({ required: true, validate: true, signal: controller.signal })).user.id);
      const validated = validateGrantProposalInputs({ call, idea, discipline, sectionHeadings, confirmedRequirementIds, confirmedMissingInformation: confirmedMissing, selectedPaperIds: selectedIds, budgetFigures });
      await accountCheck(ownerId, controller.signal);
      const checkpoint = async run => {
        const savedProject = await persistAutonomousProposalCheckpoint({
          entities: base44.entities, project: projectRef.current, run, ownerId, artifactKey: 'grant_proposal', runKey: 'autonomous_run',
          getSession: expectedUserId => accountCheck(expectedUserId, controller.signal),
          createArtifact: previous => {
            let next = { ...previous, ...artifactSnapshot({ run, currentDraft: previous.draft || null, sections: previous.edited_sections || [], findings: previous.quality_findings || [], review: previous.researcher_review || null }) };
            if (run.status === 'complete' && run.proposal_kind === 'grant') {
              const generated = run.proposal_draft;
              const merged = mergeResearcherGrantEdits({ sections: previous.edited_sections || [] }, generated);
              const findings = reviewGrantProposal({ draft: { ...generated, sections: merged.sections, bibliography: run.bibliography }, requirements: call.requirements, confirmedRequirementIds, missingInformation: call.missing_information, selectedPaperIds: run.selected_paper_ids || [] });
              next = { ...next, draft: generated, edited_sections: merged.sections, quality_findings: findings, researcher_review: null, generated_at: new Date().toISOString() };
            }
            next.autonomous_run = run;
            next.updated_at = new Date().toISOString();
            return next;
          },
        });
        projectRef.current = savedProject; onProjectSaved?.(savedProject); setWorkflowRun(run);
        if (run.status === 'complete' && run.proposal_kind === 'grant') {
          const artifact = savedProject.grant_proposal;
          setDraft(artifact.draft); setEditedSections(artifact.edited_sections); setQuality(artifact.quality_findings); setResearcherReview(null); setDirty(false);
          setSelectedIds(artifact.selected_paper_ids || selectedIds);
          setMessage('Grant draft is ready for researcher review. Check call provenance, requirements, sources, work packages and budget before saving or exporting.');
        }
        return savedProject;
      };
      await runAutonomousProposal({
        idea, discipline, researchType: 'other', language, project: projectRef.current, savedPapers: selectedPapers,
        contextSelection: { project_objectives: true, evidence_matrix: Boolean(project.evidence_matrix), literature_review: Boolean(project.literature_review), researcher_notes: false },
        resumeRun: resume ? workflowRun : null, proposalKind: 'grant', checkpointArtifactKey: 'grant_proposal', checkpointRunKey: 'autonomous_run',
        invoke: request => base44.integrations.Core.InvokeLLM(request),
        search: ({ query, limit, signal }) => searchAllPapersWithStatus(query, { limit, signal }),
        verifySource: (record, signal) => verifyCitation(record, (url, options) => fetch(url, { ...options, signal })),
        savePaper: async (paper, targetProject) => {
          await accountCheck(ownerId, controller.signal);
          const savedPaper = await saveDiscoveredGapPaper({ entities: base44.entities, paper, project: targetProject });
          if (!savedPaper?.id || String(savedPaper.project_id) !== String(targetProject.id)) throw new Error('no_sources_saved');
          onPapersChanged?.(previous => previous.some(item => String(item.id) === String(savedPaper.id)) ? previous : [savedPaper, ...previous]);
          return savedPaper;
        },
        draftSchema: /** @type {any} */ (GRANT_PROPOSAL_SCHEMA),
        draftPrompt: ({ selectedPapers: records, plan }) => buildGrantProposalPrompt({ call, idea, discipline: PROPOSAL_DISCIPLINES.find(item => item.id === discipline)?.label || 'Interdisciplinary', language: PROPOSAL_LANGUAGES.find(item => item.id === language)?.label || 'English', sections: validated.sectionHeadings, papers: records, budgetFigures, researcherSuppliedFacts: researcherFacts, plan }),
        validateDraft: (response, { records }) => validateGrantProposalDraft(response, { sectionHeadings: validated.sectionHeadings, requirements: call.requirements, selectedPaperIds: records.map(item => String(item.id)), budgetFigures, researcherSuppliedFacts: researcherFacts }),
        checkpoint, onProgress: run => setWorkflowRun(run), signal: controller.signal,
      });
    } catch (failure) {
      if (failure.run) setWorkflowRun(failure.run);
      setError(failure?.code === 'ENTITY_CONFLICT' ? 'The project changed in another session. Your last verified checkpoint remains available; reload before resuming.' : failure?.message === 'proposal_discipline_required' ? 'Choose a research discipline.' : failure?.message === 'proposal_language_required' ? 'Choose a proposal language.' : autonomousProposalErrorMessage(failure?.message));
    } finally { if (controllerRef.current === controller) controllerRef.current = null; setBusy(false); }
  };

  const finishReview = async () => {
    try {
      const ownerId = String((await getUsableSession({ required: true, validate: true })).user.id);
      await accountCheck(ownerId);
      const next = artifactSnapshot({ review: { approved: true, draft_revision: currentDraftRevision, reviewed_at: new Date().toISOString(), scope: 'grant-export' } });
      const savedProject = await base44.entities.Project.updateIfUnchanged(projectRef.current.id, { grant_proposal: next }, projectRef.current.updated_date);
      if (String(savedProject?.id) !== String(project.id) || savedProject?.grant_proposal?.researcher_review?.draft_revision !== currentDraftRevision) throw new Error('unverified');
      projectRef.current = savedProject; onProjectSaved?.(savedProject); setResearcherReview(next.researcher_review); setDirty(false);
      setMessage('Researcher review state saved. This is not funder acceptance, institutional approval or submission.');
    } catch { setError('The project changed or review approval could not be verified. Reload before trying again.'); }
  };

  const updateSection = (heading, value) => {
    const next = editedSections.map(section => section.heading === heading ? { ...section, content: value, origin: 'researcher', status: 'drafted' } : section);
    setEditedSections(next); setResearcherReview(null); setDirty(true);
  };

  const exportMarkdown = () => downloadBlob(new Blob([exportGrantProposalMarkdown({ ...artifactSnapshot(), draft, edited_sections: editedSections })], { type: 'text/markdown;charset=utf-8' }), 'grant-proposal-draft.md');
  const exportDocx = async () => {
    try {
      const { createGrantProposalDocx } = await import('@/lib/grant-proposal-docx.mjs');
      const blob = await createGrantProposalDocx({ ...artifactSnapshot(), draft, edited_sections: editedSections });
      downloadBlob(blob, 'grant-proposal-draft.docx');
    } catch { setError('The DOCX file could not be created. The editable draft remains available in this project.'); }
  };
  const chooseCallFile = async file => {
    if (!file) return;
    setProcessingDocuments(true); setError('');
    try {
      if (sourceDocuments.length >= GRANT_DOCUMENT_LIMITS.documents) throw Object.assign(new Error('Upload up to five call documents.'), { code: 'grant_document_count' });
      const document = await extractGrantCallDocument(file);
      const nextDocuments = [...sourceDocuments, document];
      const nextLines = nextDocuments.flatMap(item => item.lines);
      const joinedText = nextLines.map(line => line.text).join('\n');
      if (joinedText.length > GRANT_DOCUMENT_LIMITS.extractedCharacters) throw Object.assign(new Error('Combined extracted call text exceeds the 30,000 character limit.'), { code: 'grant_document_text_limit' });
      setSourceDocuments(nextDocuments); setSourceLines(nextLines); setCallText(joinedText); setConfirmedRequirementIds([]); setConfirmedMissing([]); setResearcherReview(null); setDirty(true);
      setMessage(`${document.name} processed locally in this browser. Original file bytes were not uploaded; extracted text is stored in this private project when you save.`);
    } catch (failure) {
      setError(failure?.message || 'The call document could not be processed. Your existing draft remains unchanged.');
    } finally { setProcessingDocuments(false); }
  };
  const updateIntake = setter => event => { setter(event.target.value); setResearcherReview(null); setDirty(true); };
  const editCallText = event => { setCallText(event.target.value); setSourceLines([]); setConfirmedRequirementIds([]); setConfirmedMissing([]); setSourceDocuments(previous => previous.map(document => ({ ...document, extraction_status: 'text_edited_provenance_reset' }))); setResearcherReview(null); setDirty(true); };
  const updateCallIdentity = setter => event => { setter(event.target.value); setConfirmedRequirementIds([]); setConfirmedMissing([]); setResearcherReview(null); setDirty(true); };
  const removeCallDocument = documentId => {
    const nextDocuments = sourceDocuments.filter(document => document.id !== documentId);
    const nextLines = nextDocuments.flatMap(document => document.lines || []);
    setSourceDocuments(nextDocuments); setSourceLines(nextLines); setCallText(nextLines.map(line => line.text).join('\n'));
    setConfirmedRequirementIds([]); setConfirmedMissing([]); setResearcherReview(null); setDirty(true);
  };
  const progress = workflowRun ? autonomousProposalProgress(workflowRun) : null;

  return <section className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6" aria-labelledby="grant-proposal-builder-title">
    <header className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><FileText size={20} aria-hidden="true" /></div><div><h3 id="grant-proposal-builder-title" tabIndex={-1} className="text-xl font-semibold">Grant proposal writer</h3><p className="mt-1 text-sm text-muted-foreground">Use one official call’s documented requirements and this project’s scholarly evidence. The call defines the proposal structure.</p></div></header>
    <div className="grid gap-3 md:grid-cols-2"><label className="block text-sm font-medium">Official call title<input value={callTitle} onChange={updateCallIdentity(setCallTitle)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" maxLength={200} /></label><label className="block text-sm font-medium">Official call HTTPS URL<input type="url" value={callUrl} onChange={updateCallIdentity(setCallUrl)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="https://funding.example.org/call" /></label></div>
    <div className="space-y-2 rounded-xl border border-border p-3"><div><h4 className="font-semibold">Official call documents · {sourceDocuments.length}/{GRANT_DOCUMENT_LIMITS.documents}</h4><p className="text-xs leading-5 text-muted-foreground">PDF and DOCX files are parsed locally in this browser; no OCR or third-party document service is used. Original file bytes are not uploaded. Extracted text is saved only inside this owner-scoped project when you save. Confirmed requirement excerpts are sent to the configured EYRA service for drafting.</p></div><label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-border px-3 text-sm font-medium">{processingDocuments ? 'Processing locally…' : 'Add PDF, DOCX, TXT or Markdown'}<input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" disabled={processingDocuments || sourceDocuments.length >= GRANT_DOCUMENT_LIMITS.documents} onChange={event => { chooseCallFile(event.target.files?.[0]); event.target.value = ''; }} /></label>{sourceDocuments.length > 0 && <ul className="space-y-1 text-xs">{sourceDocuments.map(document => <li key={document.id} className="flex flex-wrap gap-x-2"><span className="font-medium">{document.name}</span><span>{document.extraction_status}</span><span>{document.warning}</span><button type="button" onClick={() => removeCallDocument(document.id)} className="text-destructive underline">Remove</button></li>)}</ul>}</div>
    <label className="block text-sm font-medium">Extracted or researcher-entered call text<textarea value={callText} onChange={editCallText} rows={7} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" maxLength={30000} placeholder="Paste official call text with its section and page labels, or upload the official PDF/DOCX." /></label>
    {sourceDocuments.some(document => document.extraction_status === 'text_edited_provenance_reset') && <p className="text-xs text-amber-700">The extracted text was edited after local parsing; page, section and document-line references were cleared for that text. Verify the excerpt and references manually.</p>}
    {call.requirements.length > 0 && <section className="space-y-2 rounded-xl border border-border p-3" aria-label="Documented call requirements"><h4 className="font-semibold">Extracted call requirements · {call.requirements.length}</h4><p className="text-xs text-muted-foreground">Keyword-based candidates only. Inspect the cited page or section; quotations are copied from extracted text and never synthesized. Confirm only after checking the official document.</p>{call.requirements.map(item => <label key={item.id} className="flex gap-2 rounded-lg bg-secondary/30 p-2 text-sm"><input type="checkbox" checked={confirmedRequirementIds.includes(item.id)} onChange={event => { setConfirmedRequirementIds(ids => event.target.checked ? [...new Set([...ids, item.id])] : ids.filter(id => id !== item.id)); setResearcherReview(null); setDirty(true); }} className="mt-1 size-4 accent-primary" /><span><span className="font-medium">{item.category} · {item.source_document_name || item.source_title || 'Supplied call text'} · {item.page ? `page ${item.page}` : item.section ? `section ${item.section}` : `line ${item.line}`} · {item.extraction_confidence}</span><span className="block text-xs leading-5 text-muted-foreground">“{item.supporting_excerpt}”</span><span className="block text-xs leading-5 text-muted-foreground">Uncertainty: {item.uncertainty}</span><a href={item.source_url || undefined} target="_blank" rel="noopener noreferrer" className="text-xs text-primary">Inspect official source</a></span></label>)}</section>}
    {call.missing_information.length > 0 && <fieldset className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3"><legend className="px-1 text-sm font-semibold">Not found in supplied documents · researcher confirmation needed</legend><p className="text-xs text-muted-foreground">EYLO leaves these unresolved. Review the full official call and annexes; do not infer a rule from another funding program.</p>{call.missing_information.map(item => <label key={item.id} className="flex min-h-10 items-start gap-2 text-sm"><input type="checkbox" checked={confirmedMissing.includes(item.id)} onChange={event => { setConfirmedMissing(ids => event.target.checked ? [...new Set([...ids, item.id])] : ids.filter(id => id !== item.id)); setResearcherReview(null); setDirty(true); }} className="mt-1 size-4 accent-primary" />I checked the official call; {item.label.toLowerCase()} is not present in the supplied excerpt.</label>)}</fieldset>}
    <div className="grid gap-3 md:grid-cols-2"><label className="block text-sm font-medium">Project idea<textarea value={idea} onChange={updateIntake(setIdea)} rows={4} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" maxLength={6000} /></label><div className="space-y-3"><label className="block text-sm font-medium">Discipline<select value={discipline} onChange={event => { setDiscipline(event.target.value); setResearcherReview(null); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{PROPOSAL_DISCIPLINES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-sm font-medium">Output language<select value={language} onChange={event => { setLanguage(event.target.value); setResearcherReview(null); setDirty(true); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{PROPOSAL_LANGUAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-sm font-medium">Researcher-supplied facts<textarea value={researcherFacts} onChange={updateIntake(setResearcherFacts)} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="Existing institutional facts, partner names or commitments. Include their provenance; leave blank when not verified." /></label></div></div>
    <label className="block text-sm font-medium">Proposal headings copied from this call<textarea value={sectionHeadingText} onChange={updateIntake(setSectionHeadingText)} rows={4} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="One exact official heading per line. Confirm these against the call template; no universal funder format is assumed." /></label>
    <fieldset className="space-y-2 rounded-xl border border-border p-3"><legend className="px-1 text-sm font-semibold">Scholarly records linked to this project ({selectedPapers.length} selected)</legend>{!linkedPapers.length ? <p className="text-sm text-muted-foreground">Link scholarly sources through Evidence Matrix before grant drafting.</p> : linkedPapers.map(paper => { const href = safeResearchSourceUrl(paper); return <label key={paper.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(String(paper.id))} onChange={event => { setSelectedIds(ids => event.target.checked ? [...new Set([...ids, String(paper.id)])] : ids.filter(id => id !== String(paper.id))); setResearcherReview(null); setDirty(true); }} className="mt-1 size-4 accent-primary" /><span>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{paper.title} · inspect source</a> : paper.title} · {paper.year || 'year unavailable'}</span></label>; })}</fieldset>
    <label className="block text-sm font-medium">Supplied budget figures (one per line: figure ID | category | exact amount | source quote | HTTPS source URL)<textarea value={budgetText} onChange={updateIntake(setBudgetText)} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="fig-1 | personnel | €25,000 | Exact call or verified project figure | https://…" /></label>
    {progress && <section className="space-y-2 rounded-xl border border-border p-3" aria-label="Grant workflow progress" aria-live="polite"><div className="flex justify-between"><h4 className="font-semibold">Grant workflow · {progress.label}</h4><span>{progress.percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} /></div><ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">{['Clarify research idea', 'Search scholarly indexes', 'Select and deduplicate evidence', 'Link selected records', 'Check available DOI metadata', 'Draft grant proposal', 'Researcher review'].map((stage, index) => <li key={stage} className="text-xs text-muted-foreground">{index < progress.completed ? '✓' : progress.completed === index ? '•' : '○'} {stage}</li>)}</ol></section>}
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => generate()} disabled={busy || !call.requirements.length || !sectionHeadings.length || !selectedPapers.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Generate Complete Grant Proposal</button>{busy && <button type="button" onClick={() => controllerRef.current?.abort()} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Cancel generation</button>}{['paused','failed'].includes(workflowRun?.status) && !busy && <button type="button" onClick={() => generate({ resume: true })} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">{workflowRun.status === 'paused' ? 'Resume saved run' : 'Retry current stage'}</button>}{workflowRun?.status === 'complete' && <button type="button" onClick={finishReview} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Mark researcher review complete</button>}<button type="button" onClick={save} disabled={saving || !draft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : 'Save draft'}</button><button type="button" onClick={exportMarkdown} disabled={!draft || !exportReady} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"><Download size={16} />Export Markdown</button><button type="button" onClick={exportDocx} disabled={!draft || !exportReady} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"><Download size={16} />Export DOCX</button></div>
    {quality.length > 0 && <section className="space-y-2 rounded-xl border border-border p-3" aria-label="Grant quality findings"><h4 className="font-semibold">Quality findings</h4><p className="text-xs text-muted-foreground">Automated checks support review but do not verify scientific claims, funder eligibility or institutional authorization.</p>{quality.map(item => <div key={item.id} className="rounded-lg bg-secondary/30 p-2 text-sm"><strong>{item.label}</strong><span className="ml-2 text-xs text-muted-foreground">{item.status.replaceAll('_', ' ')}</span><p className="mt-1 text-xs text-muted-foreground">{item.details} Action: {item.action}</p></div>)}</section>}
    {draft && <section className="space-y-3" aria-label="Editable grant proposal"><h4 className="text-lg font-semibold">Editable grant draft</h4>{editedSections.map(section => <section key={section.heading} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><h5 className="font-semibold">{section.heading}</h5><span className="text-xs text-muted-foreground">{section.origin === 'researcher' ? 'Researcher edited' : section.status}</span></div><textarea aria-label={`Grant section ${section.heading}`} value={section.content} onChange={event => updateSection(section.heading, event.target.value)} rows={6} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6"/><p className="mt-1 text-xs text-muted-foreground">Call requirements: {section.requirement_ids.join(', ') || 'none linked'} · Scholarly records: {section.source_ids.join(', ') || 'none linked'}</p></section>)}<section aria-label="Grant proposal bibliography"><h5 className="font-semibold">Bibliography</h5>{(workflowRun?.bibliography || saved.bibliography || []).map(source => { const href = safeResearchSourceUrl(source); return <p key={source.id} className="text-sm">{source.authors || 'Authors unavailable'}{source.year ? ` (${source.year})` : ''}. {source.title || 'Title unavailable'}.{source.doi ? ` DOI: ${source.doi}.` : ''} {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">Inspect source</a> : 'Source link unavailable.'}</p>; })}</section><h5 className="font-semibold">Provisional work packages</h5>{draft.work_packages.map(item => <p key={item.code} className="rounded-lg bg-secondary/30 p-2 text-sm"><strong>{item.code} · {item.title}</strong> — {item.objective}<span className="block text-xs text-muted-foreground">Deliverables: {item.deliverables.join('; ') || 'researcher input required'} · Milestones: {item.milestones.join('; ') || 'researcher input required'} · Partner: {item.partner_name || 'researcher input required'}</span></p>)}<h5 className="font-semibold">Provisional project timeline</h5>{draft.timeline.map((item, index) => <p key={`${item.work_package_code}-${item.milestone}-${index}`} className="text-sm">{item.sequence || `Sequence ${index + 1}`} · {item.work_package_code || 'Work package requires mapping'} · {item.milestone} · {item.dependency ? `Depends on ${item.dependency}` : 'No dependency supplied'} · provisional</p>)}<h5 className="font-semibold">Provisional risk register</h5>{draft.risks.map((item, index) => <p key={`${item.risk}-${index}`} className="text-sm">{item.risk} · likelihood {item.likelihood} · impact {item.impact} · mitigation {item.mitigation} · owner {item.owner || 'researcher input required'}</p>)}<h5 className="font-semibold">Provisional budget structure</h5>{draft.budget_lines.map((item, index) => <p key={`${item.figure_id}-${index}`} className="text-sm">{item.category}: {item.amount_text || 'amount not supplied'} · {item.basis}</p>)}</section>}
    <p className="text-xs leading-5 text-muted-foreground">The generator cannot verify official eligibility, funding rates, submission deadlines or institutional facts. Missing call information stays unresolved; partners and commitments are not invented. Work packages are proposals, not commitments. Budget amounts are copied only from supplied figures. Scholar citations identify records but do not establish scientific support.</p>
    {message && <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{message}</p>}{error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">{error}</p>}
  </section>;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
}
