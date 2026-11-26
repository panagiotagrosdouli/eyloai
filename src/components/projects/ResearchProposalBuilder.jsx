import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Save, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getUsableSession } from '@/lib/supabaseClient';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { safeResearchSourceUrl } from '@/lib/research-source-url.mjs';
import { saveDiscoveredGapPaper } from '@/lib/research-gap-literature-save.mjs';
import { verifyCitation } from '@/lib/citation-verification.mjs';
import { reviewProposalDraft } from '@/lib/proposal-quality-review.mjs';
import { persistAutonomousProposalCheckpoint } from '@/lib/autonomous-proposal-checkpoint.mjs';
import {
  buildGrantRequirementExtractionPrompt, grantCriticalRequirementIds, GRANT_REQUIREMENT_FIELDS, GRANT_REQUIREMENTS_SCHEMA,
  hasConfirmedCriticalGrantRequirements, validateGrantRequirements,
} from '@/lib/grant-proposal-workflow.mjs';
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
  const { user } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const linkedPapers = useMemo(() => projectLinkedProposalPapers(savedPapers, project.id), [savedPapers, project.id]);
  const stored = project.research_proposal && typeof project.research_proposal === 'object' ? project.research_proposal : {};
  const resumableRun = stored.autonomous_run && ['failed', 'paused', 'running'].includes(stored.autonomous_run.status) ? stored.autonomous_run : null;
  const initialIds = stored.selected_paper_ids || (resumableRun ? stored.autonomous_run?.selected_paper_ids : null) || project.literature_review?.selected_paper_ids || project.evidence_matrix?.selected_paper_ids || [];
  const [question, setQuestion] = useState(resumableRun?.idea || stored.research_question || stored.autonomous_run?.planning?.research_question || project.evidence_matrix?.research_question || project.literature_review?.research_question || '');
  const [researchType, setResearchType] = useState(stored.research_type || 'other');
  const [discipline, setDiscipline] = useState(stored.discipline || 'interdisciplinary');
  const [language, setLanguage] = useState(stored.language || 'en');
  const [proposalMode, setProposalMode] = useState(stored.output_kind === 'grant_proposal' ? 'grant_proposal' : 'academic_proposal');
  const [grantContext, setGrantContext] = useState(stored.grant_context || null);
  const [grantSourceText, setGrantSourceText] = useState(stored.grant_context?.source_text || '');
  const [grantSourceName, setGrantSourceName] = useState(stored.grant_context?.source_name || 'Official funding call');
  const [applicantInformation, setApplicantInformation] = useState(stored.grant_context?.applicant_information || '');
  const [grantWorkPackages, setGrantWorkPackages] = useState(stored.edited_work_packages || stored.ai_draft?.work_packages || []);
  const [grantCallSections, setGrantCallSections] = useState(stored.edited_call_sections || stored.ai_draft?.call_sections || []);
  const [grantBudgetNotes, setGrantBudgetNotes] = useState(stored.edited_budget_notes || stored.ai_draft?.budget_notes || []);
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
  const [generationRun, setGenerationRun] = useState(() => stored.autonomous_run?.status === 'running'
    ? { ...stored.autonomous_run, status: 'paused', error_code: 'page_reloaded' }
    : stored.autonomous_run || null);
  const [generating, setGenerating] = useState(false);
  const [extractingCall, setExtractingCall] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [draftRevision, setDraftRevision] = useState(Number(stored.draft_revision) || 0);
  const [researcherReview, setResearcherReview] = useState(stored.researcher_review || null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const controllerRef = useRef(null);
  const projectRef = useRef(project);
  const accountIdRef = useRef(user?.id ? String(user.id) : '');
  const localEditRevisionRef = useRef(0);
  const researcherEditedRef = useRef(Boolean(stored.researcher_edited));
  const grantWorkPackagesEditedRef = useRef(Boolean(stored.edited_work_packages?.length
    && JSON.stringify(stored.edited_work_packages) !== JSON.stringify(stored.ai_draft?.work_packages)));
  const grantCallSectionsEditedRef = useRef(Boolean(stored.edited_call_sections?.length
    && JSON.stringify(stored.edited_call_sections) !== JSON.stringify(stored.ai_draft?.call_sections)));
  const linkedById = useMemo(() => new Map(linkedPapers.map(paper => [String(paper.id), paper])), [linkedPapers]);
  const selectedPapers = linkedPapers.filter(paper => selectedIds.includes(String(paper.id)));
  const qualityFindings = useMemo(() => reviewProposalDraft({ sections, methodologyPlan: methodology, papers: linkedPapers }), [sections, methodology, linkedPapers]);
  const exportApproved = Boolean(!dirty && researcherReview?.approved === true && researcherReview.draft_revision === draftRevision);
  const hasDraft = Boolean(aiDraft || stored.edited_sections || Object.values(sectionNotes).some(value => String(value || '').trim()));
  const citedIds = [...sections, ...Object.values(methodology)].flatMap(section => (section?.claims || []).flatMap(claim => claim.source_ids || []));
  const bibliography = useMemo(() => bibliographyForProposal(linkedPapers, [...selectedIds, ...citedIds]), [linkedPapers, selectedIds.join('|'), citedIds.join('|')]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    const nextAccountId = user?.id ? String(user.id) : '';
    if (accountIdRef.current && accountIdRef.current !== nextAccountId) {
      controllerRef.current?.abort();
      setGenerationRun(null);
      setResearcherReview(null);
      setMessage('Your account changed. Reload this project before continuing proposal work.');
    }
    accountIdRef.current = nextAccountId;
  }, [user?.id]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const toggle = id => {
    markDraftRevision();
    setSelectedIds(current => current.includes(String(id)) ? current.filter(item => item !== String(id)) : [...current, String(id)]);
    setDirty(true);
  };
  const toggleContext = key => {
    markDraftRevision();
    setContextSelection(current => ({ ...current, [key]: !current[key] }));
    setDirty(true);
  };

  const markDraftRevision = () => {
    localEditRevisionRef.current += 1;
    setDraftRevision(value => value + 1);
    setResearcherReview(null);
    setReviewConfirmed(false);
    setDirty(true);
  };

  const markResearcherEdit = () => {
    markDraftRevision();
    researcherEditedRef.current = true;
    setResearcherEdited(true);
  };

  const generateCompleteProposal = async (resume = false) => {
    setError(''); setMessage('');
    const idea = question.trim();
    if (idea.length < 8) { setError('Describe the research idea in at least 8 characters.'); return; }
    if (!discipline || !language) { setError('Choose a discipline and output language before generation.'); return; }
    if (proposalMode === 'grant_proposal' && !hasConfirmedCriticalGrantRequirements(grantContext)) {
      setError('Extract and review the official call requirements, then confirm each critical requirement before generation.'); return;
    }
    const controller = new AbortController(); controllerRef.current = controller; setGenerating(true);
    let accountAtStart = '';
    const assertSameAccount = async () => {
      const session = await getUsableSession({ required: true, validate: true, expectedUserId: accountAtStart || undefined, signal: controller.signal });
      const sessionUserId = String(session?.user?.id || '');
      if (!accountAtStart) accountAtStart = sessionUserId;
      if (!sessionUserId || sessionUserId !== accountAtStart || String(userRef.current?.id || '') !== accountAtStart) {
        throw Object.assign(new Error('account_switched'), { code: 'ACCOUNT_CHANGED' });
      }
    };
    const revisionAtStart = localEditRevisionRef.current;
    try {
      await assertSameAccount();
      await runAutonomousProposal({
        idea, discipline, researchType, language, project: projectRef.current, savedPapers,
        grantCallContext: proposalMode === 'grant_proposal' ? grantContext : null,
        contextSelection, resumeRun: resume ? generationRun : null,
        invoke: request => base44.integrations.Core.InvokeLLM(request),
        search: ({ query, limit, signal }) => searchAllPapersWithStatus(query, { limit, signal }),
        verifySource: (record, signal) => verifyCitation(record, (url, options) => fetch(url, { ...options, signal })),
        savePaper: async (paper, targetProject) => {
          await assertSameAccount();
          const saved = await saveDiscoveredGapPaper({ entities: base44.entities, paper, project: targetProject });
          if (!saved?.id || String(saved.project_id) !== String(targetProject.id)) throw new Error('no_sources_saved');
          onPapersChanged?.(previous => previous.some(item => String(item.id) === String(saved.id))
            ? previous.map(item => String(item.id) === String(saved.id) ? saved : item)
            : [saved, ...previous]);
          return saved;
        },
        checkpoint: async run => {
          const currentProject = projectRef.current;
          const saved = await persistAutonomousProposalCheckpoint({
            entities: base44.entities, project: currentProject, run, ownerId: accountAtStart,
            getSession: expectedUserId => getUsableSession({ required: true, validate: true, expectedUserId, signal: controller.signal }),
            createArtifact: previous => ({
              ...previous,
              autonomous_run: run,
              output_kind: run.output_kind || 'academic_proposal',
              ...(run.grant_call ? { grant_context: run.grant_call } : {}),
              updated_at: new Date().toISOString(),
              draft_revision: run.status === 'complete' ? Math.max(Number(previous.draft_revision) || 0, draftRevision) + 1 : (previous.draft_revision ?? draftRevision),
              researcher_review: run.status === 'complete' ? null : previous.researcher_review,
              ...(run.status === 'complete' ? {
                research_question: run.planning.research_question,
                research_type: run.research_type,
                discipline: run.discipline,
                language: run.language,
                ...(localEditRevisionRef.current === revisionAtStart ? { selected_paper_ids: run.selected_paper_ids } : {}),
                ai_draft: run.proposal_draft,
                quality_findings: reviewProposalDraft({
                  sections: run.proposal_draft.sections,
                  methodologyPlan: run.proposal_draft.methodology_plan,
                  papers: run.selected_source_keys.map(key => {
                    const candidate = run.candidates.find(item => item.key === key);
                    return candidate ? { ...candidate.record, id: run.saved_sources?.[key] || candidate.record.id, project_id: currentProject.id } : null;
                  }).filter(Boolean),
                }),
              } : {}),
            }),
          });
          const artifact = saved.research_proposal;
          if (!hasProposalSaveReceipt(saved, currentProject.id, artifact)) throw Object.assign(new Error('unverified'), { code: 'CHECKPOINT_UNVERIFIED' });
          projectRef.current = saved; onProjectSaved(saved); setGenerationRun(run);
          if (run.status === 'complete') {
            const preserveEdits = researcherEditedRef.current || localEditRevisionRef.current !== revisionAtStart;
            setAiDraft(run.proposal_draft); setGenerationRun(run);
            if (!grantWorkPackagesEditedRef.current) {
              setGrantWorkPackages(run.proposal_draft.work_packages || []);
              setGrantBudgetNotes(run.proposal_draft.budget_notes || []);
            }
            if (!grantCallSectionsEditedRef.current) setGrantCallSections(run.proposal_draft.call_sections || []);
            setDraftRevision(Number(saved.research_proposal.draft_revision) || draftRevision + 1);
            setResearcherReview(null); setReviewConfirmed(false);
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

  const saveGrantContext = async context => {
    const currentProject = projectRef.current;
    const nextRevision = Math.max(draftRevision, Number(currentProject.research_proposal?.draft_revision) || 0) + 1;
    const proposal = { ...(currentProject.research_proposal || {}), output_kind: 'grant_proposal', grant_context: context, draft_revision: nextRevision, researcher_review: null, updated_at: new Date().toISOString() };
    const saved = await base44.entities.Project.updateIfUnchanged(currentProject.id, { research_proposal: proposal }, currentProject.updated_date);
    if (!hasProposalSaveReceipt(saved, currentProject.id, proposal)) throw new Error('unverified');
    projectRef.current = saved; onProjectSaved(saved); setGrantContext(context);
    setDraftRevision(nextRevision); setResearcherReview(null); setReviewConfirmed(false); setDirty(true);
    return saved;
  };

  const extractGrantCall = async () => {
    if (grantSourceText.trim().length < 80) { setError('Add at least 80 characters from the official call document.'); return; }
    setError(''); setMessage(''); setExtractingCall(true); setGenerating(true);
    try {
      const accountAtStart = String(userRef.current?.id || '');
      await getUsableSession({ required: true, validate: true, expectedUserId: accountAtStart });
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: buildGrantRequirementExtractionPrompt({ documentName: grantSourceName, sourceText: grantSourceText }),
        response_json_schema: GRANT_REQUIREMENTS_SCHEMA,
      });
      const requirements = validateGrantRequirements(response, grantSourceText);
      const context = {
        schema_version: 1, source_name: grantSourceName.trim().slice(0, 240), source_text: grantSourceText.slice(0, 30000),
        requirements, applicant_information: applicantInformation.slice(0, 6000), confirmed: false,
        confirmed_requirement_ids: [], extracted_at: new Date().toISOString(),
      };
      await getUsableSession({ required: true, validate: true, expectedUserId: accountAtStart });
      await saveGrantContext(context);
      setMessage('Call requirements extracted with source quotes and saved for researcher review. No proposal has been generated.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT' ? 'This project changed in another session. Reload before saving call intake.' : 'Call extraction or its source-quote check failed. Review the document text and try again.');
    } finally { setExtractingCall(false); setGenerating(false); }
  };

  const confirmGrantRequirements = async () => {
    if (!grantContext) return;
    const required = grantCriticalRequirementIds(grantContext.requirements);
    if (!required.length || required.some(id => !grantContext.confirmed_requirement_ids?.includes(id))) {
      setError('Review and confirm each critical requirement, including any marked missing, before drafting.'); return;
    }
    setError(''); setMessage(''); setSaving(true);
    try {
      const context = { ...grantContext, applicant_information: applicantInformation.slice(0, 6000), confirmed: true, confirmed_at: new Date().toISOString() };
      await saveGrantContext(context);
      setMessage('Critical call requirements saved as researcher-reviewed. This is not a funding eligibility determination.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT' ? 'The project changed in another session. Reload and review the call before confirming.' : 'The call review could not be verified as saved.');
    } finally { setSaving(false); }
  };

  const toggleGrantRequirement = id => setGrantContext(current => ({
    ...current, confirmed: false, confirmed_at: null,
    confirmed_requirement_ids: current.confirmed_requirement_ids?.includes(id)
      ? current.confirmed_requirement_ids.filter(value => value !== id)
      : [...(current.confirmed_requirement_ids || []), id],
  }));

  const save = async () => {
    if (saving || !hasDraft) return;
    setSaving(true); setError(''); setMessage('');
    const proposal = {
      ...(projectRef.current.research_proposal || {}),
      research_question: question.trim().slice(0, 1200), research_type: researchType, discipline, language,
      selected_paper_ids: selectedIds.filter(id => linkedById.has(id)), context_selection: contextSelection,
      ai_draft: aiDraft, edited_sections: sections, edited_methodology: methodology,
      output_kind: proposalMode, grant_context: proposalMode === 'grant_proposal' ? grantContext : null,
      edited_work_packages: proposalMode === 'grant_proposal' ? grantWorkPackages : [],
      edited_call_sections: proposalMode === 'grant_proposal' ? grantCallSections : [],
      edited_budget_notes: proposalMode === 'grant_proposal' ? grantBudgetNotes : [],
      section_notes: sectionNotes, bibliography_entries: bibliographyEntries, autonomous_run: generationRun,
      researcher_edited: researcherEdited, updated_at: new Date().toISOString(),
      quality_findings: qualityFindings,
      draft_revision: draftRevision,
      researcher_review: researcherReview?.draft_revision === draftRevision ? researcherReview : null,
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
    markResearcherEdit(); researcherEditedRef.current = false;
    setSections(aiDraft.sections); setMethodology(aiDraft.methodology_plan);
    grantWorkPackagesEditedRef.current = false;
    setGrantWorkPackages(aiDraft.work_packages || []); setGrantBudgetNotes(aiDraft.budget_notes || []);
    grantCallSectionsEditedRef.current = false;
    setGrantCallSections(aiDraft.call_sections || []);
    setResearcherEdited(false); setDirty(true);
    setMessage('Latest EYRA draft applied. Review the replaced sections before saving.');
  };

  const approveForExport = async () => {
    if (!reviewConfirmed || saving || !hasDraft) return;
    setSaving(true); setError(''); setMessage('');
    const currentProject = projectRef.current;
    const proposal = {
      ...(currentProject.research_proposal || {}),
      research_question: question.trim().slice(0, 1200), research_type: researchType, discipline, language,
      selected_paper_ids: selectedIds.filter(id => linkedById.has(id)), context_selection: contextSelection,
      ai_draft: aiDraft, edited_sections: sections, edited_methodology: methodology,
      output_kind: proposalMode, grant_context: proposalMode === 'grant_proposal' ? grantContext : null,
      edited_work_packages: proposalMode === 'grant_proposal' ? grantWorkPackages : [],
      edited_call_sections: proposalMode === 'grant_proposal' ? grantCallSections : [],
      edited_budget_notes: proposalMode === 'grant_proposal' ? grantBudgetNotes : [],
      section_notes: sectionNotes, bibliography_entries: bibliographyEntries, autonomous_run: generationRun,
      researcher_edited: researcherEdited, draft_revision: draftRevision,
      quality_findings: qualityFindings,
      researcher_review: { approved: true, draft_revision: draftRevision, reviewed_at: new Date().toISOString(), scope: 'export' },
      updated_at: new Date().toISOString(),
    };
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(currentProject.id, { research_proposal: proposal }, currentProject.updated_date);
      if (!hasProposalSaveReceipt(saved, currentProject.id, proposal)) throw new Error('unverified');
      projectRef.current = saved; onProjectSaved(saved); setResearcherReview(proposal.researcher_review); setDirty(false);
      setMessage('Your review approval is saved for this proposal revision. It does not represent peer review or scientific validation.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT' ? 'This project changed in another session. Reload and review the latest version before approving export.' : 'Your review approval could not be verified as saved. Export remains disabled.');
    } finally { setSaving(false); }
  };

  const exportMarkdown = () => {
    if (!exportApproved) return;
    const markdown = exportResearchProposalMarkdown({
      question, researchType, discipline: PROPOSAL_DISCIPLINES.find(item => item.id === discipline)?.label || 'Interdisciplinary',
      language, sections, methodologyPlan: methodology, bibliography, bibliographyEntries, sectionNotes,
      milestones: generationRun?.milestones || [],
    });
    const grantAppendix = proposalMode === 'grant_proposal' && grantContext ? `\n\n## Grant Call Provenance and Coverage\n\n${GRANT_REQUIREMENT_FIELDS.map(({ id, label }) => {
      const raw = grantContext.requirements?.[id]; const items = Array.isArray(raw) ? raw : [raw].filter(Boolean);
      return `### ${label}\n\n${items.map(item => `- **${item.classification}**: ${item.value || 'Missing'}${item.section_or_page ? ` — ${item.section_or_page}` : ''}${item.evidence_quote ? `\n  > ${item.evidence_quote}` : ''}`).join('\n')}`;
    }).join('\n\n')}\n\n### Required call sections\n\n${grantCallSections.map(section => `#### ${section.section_name} (${section.status})\n\n${(section.claims || []).map(claim => `**${claim.heading || section.section_name}**\n\n${claim.text}${claim.source_ids?.length ? `\n\nSources: ${claim.source_ids.join(', ')}` : ''}`).join('\n\n') || 'Requires researcher input.'}`).join('\n\n')}\n\n### Requirement coverage\n\n${(aiDraft?.requirement_coverage || []).map(item => `- ${item.requirement_id}: **${item.status}** — ${item.note}`).join('\n')}\n\n### Work packages\n\n${grantWorkPackages.map((item, index) => `#### ${index + 1}. ${item.title}\n\n${item.objective || ''}\n\n${(item.activities || []).map(value => `- Activity: ${value}`).join('\n')}\n${(item.deliverables || []).map(value => `- Deliverable: ${value}`).join('\n')}`).join('\n\n')}\n\n### Budget notes\n\n${grantBudgetNotes.map(value => `- ${value}`).join('\n')}\n\nAutomated checks do not establish scientific correctness, eligibility, or compliance with the call.` : '';
    const url = URL.createObjectURL(new Blob([markdown + grantAppendix], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = proposalMode === 'grant_proposal' ? 'grant-proposal-draft.md' : 'research-proposal-draft.md';
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Scientific Output Studio · {proposalMode === 'grant_proposal' ? 'Grant Proposal' : 'Research Proposal'}</p>
      <h3 id="research-proposal-builder-title" className="mt-1 text-xl font-semibold">Build a {proposalMode === 'grant_proposal' ? 'call-grounded grant proposal' : 'research proposal'}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{proposalMode === 'grant_proposal' ? 'Review a funding call’s source-backed requirements, confirm the critical items and then use the existing scholarly proposal workflow to create an editable grant draft.' : 'Start from a research idea. EYRA searches scholarly indexes, selects project-linked records and drafts a complete proposal for your review. It can use bibliographic metadata and available abstracts; full text is not assumed.'}</p>
    </header>
    <label className="block max-w-md text-sm font-medium">Proposal type<select value={proposalMode} onChange={event => { markDraftRevision(); setProposalMode(event.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2"><option value="academic_proposal">Research Proposal</option><option value="grant_proposal">Grant Proposal</option></select></label>
    {proposalMode === 'grant_proposal' && <section className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-4" aria-label="Funding call intake">
      <div><h4 className="font-semibold">1. Official call intake</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Paste official call text or upload a plain-text/Markdown copy. Extraction is limited to that supplied text. PDF and Word files are not currently parsed in this workflow.</p></div>
      <label className="block text-sm font-medium">Call document name<input disabled={generating} value={grantSourceName} onChange={event => { markDraftRevision(); setGrantSourceName(event.target.value); setGrantContext(null); }} maxLength={240} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-60" /></label>
      <label className="block text-sm font-medium">Official call text<textarea disabled={generating} value={grantSourceText} onChange={event => { markDraftRevision(); setGrantSourceText(event.target.value); setGrantContext(null); }} maxLength={30000} rows={8} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 disabled:opacity-60" placeholder="Paste the relevant official call text, including headings and page markers when available." /></label>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium">Upload .txt or .md<input disabled={generating} type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 30000) { setError('Call text files are limited to 30 KB for this intake.'); return; } const text = await file.text(); markDraftRevision(); setGrantSourceName(file.name); setGrantSourceText(text); setGrantContext(null); }} /></label>
      <label className="block text-sm font-medium">Applicant and institutional information supplied by you<textarea disabled={generating} value={applicantInformation} onChange={event => { markDraftRevision(); setApplicantInformation(event.target.value); setGrantContext(current => current ? { ...current, confirmed: false } : null); }} maxLength={6000} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 disabled:opacity-60" placeholder="Provide only facts you can confirm, such as institution type, team roles or facilities. Leave unknown facts blank." /></label>
      <button type="button" onClick={extractGrantCall} disabled={generating || grantSourceText.trim().length < 80} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{extractingCall ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}{extractingCall ? 'Extracting call requirements…' : 'Extract call requirements'}</button>
      {grantContext?.requirements && <div className="space-y-3 rounded-lg border border-border bg-background p-3">
        <p className="text-sm font-semibold">2. Inspect provenance and confirm critical requirements</p>
        <p className="text-xs text-muted-foreground">Quotes are checked against the supplied document text. A matching quote establishes provenance only; it does not establish that an interpretation is correct or that the applicant is eligible.</p>
        {Object.entries(grantContext.requirements).map(([id, raw]) => {
          const items = Array.isArray(raw) ? raw : [raw];
          const field = GRANT_REQUIREMENT_FIELDS.find(item => item.id === id);
          return <div key={id} className="rounded-lg bg-secondary/30 p-3"><h5 className="text-sm font-semibold">{field?.label || id}</h5>{items.map((item, index) => <div key={`${id}-${index}`} className="mt-2 text-xs"><p><span className="font-semibold">{item.classification.replaceAll('_', ' ')}:</span> {item.value || 'No fact extracted from the supplied text.'}</p>{item.section_or_page && <p className="mt-1 text-muted-foreground">Location: {item.section_or_page}</p>}{item.evidence_quote && <blockquote className="mt-1 border-l-2 border-primary/50 pl-2 text-muted-foreground">{item.evidence_quote}</blockquote>}</div>)}{field?.critical && <label className="mt-3 flex min-h-9 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={grantContext.confirmed_requirement_ids?.includes(id) || false} onChange={() => toggleGrantRequirement(id)} />I reviewed this requirement or its missing status.</label>}</div>;
        })}
        <button type="button" onClick={confirmGrantRequirements} disabled={saving || !grantCriticalRequirementIds(grantContext.requirements).every(id => grantContext.confirmed_requirement_ids?.includes(id))} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Saving confirmation…' : grantContext.confirmed ? 'Critical requirements confirmed' : 'Save critical requirement review'}</button>
        <p className="text-xs text-muted-foreground">Confirmation records that you reviewed these extracted items. It is not a funding eligibility determination or legal review.</p>
      </div>}
    </section>}
    <div className="grid gap-4 lg:grid-cols-2">
      <label className="block text-sm font-medium">Research idea<textarea value={question} onChange={event => { markDraftRevision(); setQuestion(event.target.value); }} maxLength={1200} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="What scientific problem would you like to investigate?" /></label>
      <label className="block text-sm font-medium">Discipline<select value={discipline} onChange={event => { markDraftRevision(); setDiscipline(event.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{PROPOSAL_DISCIPLINES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="block text-sm font-medium">Proposal language<select value={language} onChange={event => { markDraftRevision(); setLanguage(event.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{PROPOSAL_LANGUAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><span className="mt-2 block text-xs font-normal text-muted-foreground">Proposal sections can be marked not applicable or left for researcher input.</span></label>
      <label className="block text-sm font-medium">Study approach<select value={researchType} onChange={event => { markDraftRevision(); setResearchType(event.target.value); }} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">{RESEARCH_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
    </div>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project publications ({selectedPapers.length} selected)</legend>
      {!linkedPapers.length ? <p className="p-2 text-sm text-muted-foreground">No saved project sources yet. The complete proposal workflow will search scholarly indexes for candidate records.</p> : <><p className="mb-2 text-xs text-muted-foreground">Optionally include these records in discovery and selection.</p><div className="max-h-64 space-y-1 overflow-y-auto">{linkedPapers.map(paper => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary/60"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedIds.includes(String(paper.id))} onChange={() => toggle(paper.id)} /><span className="min-w-0 text-sm"><span className="block font-medium leading-5">{paper.title || 'Title unavailable'}</span><span className="mt-1 block text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'} · {paper.year || 'Year unavailable'} · {paper.summary ? 'abstract available' : 'metadata only'}</span></span></label>)}</div></>}
    </fieldset>
    <fieldset className="rounded-xl border border-border p-3 sm:p-4"><legend className="px-1 text-sm font-semibold">Project context EYRA may use</legend><div className="grid gap-2 sm:grid-cols-2">
      {[['project_objectives','Project objectives and plan'],['evidence_matrix','Evidence Matrix'],['literature_review','Literature Review'],['researcher_notes','Researcher-authored matrix notes']].map(([key,label]) => <label key={key} className="flex min-h-10 items-start gap-2 text-sm"><input className="mt-1 size-4 accent-primary" type="checkbox" checked={Boolean(contextSelection[key])} onChange={() => toggleContext(key)} />{label}</label>)}
    </div><p className="mt-2 text-xs text-muted-foreground">Only selected papers and selected project outputs are sent to EYRA. Source facts and interpretations require citations; proposed methods and contributions are not validated outcomes.</p></fieldset>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => generateCompleteProposal(false)} disabled={generating || question.trim().length < 8} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{generating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{extractingCall ? 'Extracting official call…' : generating ? 'Generating complete proposal…' : 'Generate Complete Proposal'}</button>
      {generating && controllerRef.current && <button type="button" onClick={() => controllerRef.current?.abort()} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Cancel generation</button>}
      {generationRun && ['failed', 'paused'].includes(generationRun.status) && <button type="button" onClick={() => generateCompleteProposal(true)} disabled={generating || question.trim() !== generationRun.idea || discipline !== generationRun.discipline || researchType !== (generationRun.research_type || 'other') || language !== generationRun.language || (generationRun.output_kind || 'academic_proposal') !== proposalMode || (proposalMode === 'grant_proposal' && !hasConfirmedCriticalGrantRequirements(grantContext))} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">Resume saved run</button>}
      <button type="button" onClick={save} disabled={saving || !hasDraft} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save to project'}</button>
      <button type="button" onClick={exportMarkdown} disabled={!hasDraft || !exportApproved} title={exportApproved ? 'Export researcher-approved revision' : 'Save and approve this exact revision before export'} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"><Download size={16} aria-hidden="true" />Export Markdown</button>
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
    {hasDraft && <section className="rounded-xl border border-border p-4" aria-label="Research quality review"><h4 className="font-semibold">Research quality checks</h4><p className="mt-1 text-xs text-muted-foreground">Automated checks assess structure and source identifiers only. They are not peer review or scientific validation.</p><ul className="mt-3 space-y-2">{qualityFindings.map(finding => <li key={finding.pass} className="text-sm"><span className="font-medium">{finding.label}: {finding.status.replaceAll('_', ' ')}</span><span className="block text-xs text-muted-foreground">{finding.details}</span></li>)}</ul><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} /><span>I reviewed the sources, claims, uncertainties, methods and proposed milestones for this revision. I understand this is not independent scientific validation.</span></label><button type="button" onClick={approveForExport} disabled={!reviewConfirmed || saving || !hasDraft || dirty === false && exportApproved} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Saving review…' : exportApproved ? 'Review approval saved' : 'Save review approval for export'}</button></section>}
    {proposalMode === 'grant_proposal' && generationRun?.status === 'complete' && <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Grant proposal review">
      <div><h4 className="font-semibold">Call coverage and proposed work packages</h4><p className="mt-1 text-xs text-muted-foreground">Automated coverage is a checklist, not evidence of eligibility or call compliance. Inspect the source quotes and verify every scientific claim against the original publication.</p></div>
      <div className="space-y-3" aria-label="Call-required proposal sections">{grantCallSections.map((section, index) => <fieldset key={`grant-section-${index}`} className="space-y-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">{section.section_name}</legend>
        <label className="text-xs font-medium">Section status<select value={section.status} onChange={event => { grantCallSectionsEditedRef.current = true; markResearcherEdit(); setGrantCallSections(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: event.target.value } : row)); }} className="ml-2 min-h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value="drafted">Drafted</option><option value="needs_input">Needs input</option></select></label>
        {(section.claims || []).map((claim, claimIndex) => <label key={`${index}-${claimIndex}`} className="block text-xs font-medium">{claim.heading || section.section_name}<textarea value={claim.text} onChange={event => { grantCallSectionsEditedRef.current = true; markResearcherEdit(); setGrantCallSections(current => current.map((row, rowIndex) => rowIndex !== index ? row : ({ ...row, claims: row.claims.map((entry, entryIndex) => entryIndex === claimIndex ? { ...entry, text: event.target.value, origin: 'researcher' } : entry) }))); }} rows={4} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal" /></label>)}
        {!section.claims?.length && <label className="block text-xs font-medium">Draft text<textarea value="" onChange={event => { grantCallSectionsEditedRef.current = true; markResearcherEdit(); setGrantCallSections(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, claims: [{ heading: row.section_name, text: event.target.value, kind: 'proposal', source_ids: [], origin: 'researcher' }] } : row)); }} rows={4} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal" placeholder="Add section content or leave for researcher input." /></label>}
        <p className="text-xs text-muted-foreground">AI draft or researcher edit · source facts and interpretations require source citations; a citation identifier does not prove claim support.</p>
      </fieldset>)}</div>
      <ul className="space-y-2">{(aiDraft?.requirement_coverage || []).map(item => <li key={item.requirement_id} className="rounded-lg bg-secondary/30 p-3 text-sm"><span className="font-semibold">{GRANT_REQUIREMENT_FIELDS.find(field => field.id === item.requirement_id)?.label || item.requirement_id}: {item.status}</span><span className="mt-1 block text-xs text-muted-foreground">{item.note}</span></li>)}</ul>
      <div className="space-y-3">{grantWorkPackages.map((item, index) => <fieldset key={`grant-wp-${index}`} className="space-y-2 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">Work package {index + 1}</legend>
        <label className="block text-xs font-medium">Title<input value={item.title} onChange={event => { grantWorkPackagesEditedRef.current = true; markResearcherEdit(); setGrantWorkPackages(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row)); }} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">Objective<textarea value={item.objective || ''} onChange={event => { grantWorkPackagesEditedRef.current = true; markResearcherEdit(); setGrantWorkPackages(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, objective: event.target.value } : row)); }} rows={2} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">Activities<textarea value={(item.activities || []).join('\n')} onChange={event => { grantWorkPackagesEditedRef.current = true; markResearcherEdit(); setGrantWorkPackages(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, activities: event.target.value.split('\n').slice(0, 20) } : row)); }} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium">Planned deliverables<textarea value={(item.deliverables || []).join('\n')} onChange={event => { grantWorkPackagesEditedRef.current = true; markResearcherEdit(); setGrantWorkPackages(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, deliverables: event.target.value.split('\n').slice(0, 20) } : row)); }} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
      </fieldset>)}</div>
      <label className="block text-sm font-medium">Provisional budget notes (no unverified amounts)<textarea value={grantBudgetNotes.join('\n')} onChange={event => { grantWorkPackagesEditedRef.current = true; markResearcherEdit(); setGrantBudgetNotes(event.target.value.split('\n').slice(0, 30)); }} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Qualitative cost categories or call constraints; add amounts only after researcher verification." /></label>
      <p className="text-xs text-muted-foreground">Editing call sections, work packages or budget notes invalidates the saved review approval until this revision is saved and reviewed again. Milestones remain proposal content and are never added to the project workplan automatically.</p>
    </section>}
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
