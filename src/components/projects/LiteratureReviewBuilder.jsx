import React, { useMemo, useState } from 'react';
import { Download, ExternalLink, Loader2, Save, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { isSafeLiteratureSourceUrl } from '@/lib/literature-review-protocol.mjs';
import {
  bibliographyForSelectedPapers,
  buildLiteratureReviewPrompt,
  exportLiteratureReviewMarkdown,
  hasLiteratureReviewSaveReceipt,
  LITERATURE_REVIEW_SCHEMA,
  LITERATURE_REVIEW_SECTIONS,
  projectLinkedPapers,
  validateLiteratureReviewDraft,
} from '@/lib/literature-review-builder.mjs';

function errorMessage(error, fallback) {
  if (error?.code === 'ENTITY_CONFLICT') return 'This project changed in another session. Your draft remains here; reload the project before saving.';
  return fallback;
}

function sourceLabel(source) {
  return `${source.authors} (${source.year}) — ${source.title}`;
}

export default function LiteratureReviewBuilder({ project, savedPapers, onProjectSaved }) {
  const linkedPapers = useMemo(() => projectLinkedPapers(savedPapers, project.id), [savedPapers, project.id]);
  const stored = project.literature_review && typeof project.literature_review === 'object' ? project.literature_review : {};
  const [question, setQuestion] = useState(stored.research_question || project.evidence_matrix?.research_question || '');
  const [searchScope, setSearchScope] = useState(stored.search_scope || '');
  const [selectedIds, setSelectedIds] = useState(() => Array.isArray(stored.selected_paper_ids)
    ? stored.selected_paper_ids.map(String).filter(id => linkedPapers.some(paper => String(paper.id) === id))
    : (project.evidence_matrix?.selected_paper_ids || []).map(String).filter(id => linkedPapers.some(paper => String(paper.id) === id)));
  const [aiDraft, setAiDraft] = useState(Array.isArray(stored.ai_draft?.sections) ? stored.ai_draft.sections : []);
  const [aiDraftMeta, setAiDraftMeta] = useState(stored.ai_draft && typeof stored.ai_draft === 'object' ? stored.ai_draft : null);
  const [sections, setSections] = useState(Array.isArray(stored.edited_sections) ? stored.edited_sections : (Array.isArray(stored.ai_draft?.sections) ? stored.ai_draft.sections : []));
  const [researcherEdited, setResearcherEdited] = useState(Boolean(stored.researcher_edited));
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectedPapers = useMemo(() => linkedPapers.filter(paper => selectedIds.includes(String(paper.id))), [linkedPapers, selectedIds]);
  const citedIds = sections.flatMap(section => (section.claims || []).flatMap(claim => claim.source_ids || []));
  const citedKey = citedIds.join('|');
  const bibliography = useMemo(() => bibliographyForSelectedPapers(linkedPapers, [...selectedIds, ...citedIds]), [linkedPapers, selectedIds, citedKey]);

  const togglePaper = id => setSelectedIds(previous => previous.includes(String(id))
    ? previous.filter(item => item !== String(id)) : [...previous, String(id)]);

  const generate = async () => {
    if (!question.trim()) { setError('Enter a research question before drafting the review.'); return; }
    if (!selectedPapers.length) { setError('Select at least one publication linked to this project.'); return; }
    setGenerating(true); setError(''); setMessage('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: LITERATURE_REVIEW_SCHEMA,
        prompt: buildLiteratureReviewPrompt({ question, searchScope, papers: selectedPapers }),
      });
      const validated = validateLiteratureReviewDraft(result, selectedPapers);
      const metadata = {
        research_question: question.trim(),
        search_scope: searchScope.trim(),
        selected_paper_ids: selectedPapers.map(paper => String(paper.id)),
        model: 'EYRA',
        created_at: new Date().toISOString(),
      };
      setAiDraft(validated);
      setAiDraftMeta(metadata);
      if (!researcherEdited || !sections.length) setSections(validated);
      setMessage(researcherEdited
        ? 'A new EYRA draft is ready. Your edited review remains intact; use “Apply latest draft” only if you want to replace it.'
        : 'EYRA drafted a source-linked narrative review. Check each claim against the linked records and abstracts.');
    } catch {
      setError('EYRA could not produce a validated source-linked review. Your saved work was not changed.');
    } finally { setGenerating(false); }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true); setError(''); setMessage('');
    const review = {
      research_question: question.trim().slice(0, 1200),
      search_scope: searchScope.trim().slice(0, 2400),
      selected_paper_ids: selectedPapers.map(paper => String(paper.id)),
      ai_draft: aiDraft.length ? { ...aiDraftMeta, sections: aiDraft } : null,
      edited_sections: sections,
      researcher_edited: researcherEdited,
      updated_at: new Date().toISOString(),
    };
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(project.id, { literature_review: review }, project.updated_date);
      if (!hasLiteratureReviewSaveReceipt(saved, project.id, review)) throw new Error('unverified');
      onProjectSaved(saved);
      setMessage('Literature review saved to this private research project.');
    } catch (failure) {
      setError(errorMessage(failure, 'The review could not be verified as saved. Your edits remain here.'));
    } finally { setSaving(false); }
  };

  const updateClaim = (sectionId, index, text) => {
    setResearcherEdited(true);
    setSections(previous => previous.map(section => section.section_id !== sectionId ? section : {
      ...section,
      claims: section.claims.map((claim, claimIndex) => claimIndex === index ? { ...claim, text } : claim),
    }));
  };

  const exportReview = () => {
    const markdown = exportLiteratureReviewMarkdown({ question, searchScope, sections, bibliography });
    const blobUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = 'literature-review-draft.md';
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(blobUrl);
  };

  const citeMap = new Map(bibliography.map(source => [source.id, source]));
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="literature-review-builder-title">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Scientific Output Studio · Literature Review</p>
        <h3 id="literature-review-builder-title" className="mt-1 text-xl font-semibold">Build a source-grounded review</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Draft a preliminary narrative synthesis from papers already saved in this private project. EYRA receives bibliographic metadata and available abstracts; it does not verify full text.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium">Literature review research question
          <textarea value={question} onChange={event => setQuestion(event.target.value)} maxLength={1200} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="What does the evidence show about…" />
        </label>
        <label className="block text-sm font-medium">Search scope <span className="font-normal text-muted-foreground">(researcher defined)</span>
          <textarea value={searchScope} onChange={event => setSearchScope(event.target.value)} maxLength={2400} rows={3} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6" placeholder="Databases, date range, inclusion boundaries, or other search notes" />
        </label>
      </div>

      <fieldset className="rounded-xl border border-border p-3 sm:p-4">
        <legend className="px-1 text-sm font-semibold">Project publications ({selectedPapers.length} selected)</legend>
        {!linkedPapers.length ? <p className="p-2 text-sm text-muted-foreground">Add scholarly records to this project in the Evidence Matrix before generating a review.</p> : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {linkedPapers.map(paper => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-secondary/60">
              <input type="checkbox" className="mt-1 size-4 accent-primary" checked={selectedIds.includes(String(paper.id))} onChange={() => togglePaper(paper.id)} />
              <span className="min-w-0 text-sm"><span className="block font-medium leading-5">{paper.title || 'Title unavailable'}</span><span className="mt-1 block text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'} · {paper.year || 'Year unavailable'} · {paper.summary ? 'abstract available' : 'metadata only'}</span></span>
            </label>)}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={generate} disabled={generating || !selectedPapers.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
          {generating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{generating ? 'Drafting review…' : 'Generate literature review'}
        </button>
        <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save to project'}</button>
        <button type="button" onClick={exportReview} disabled={!sections.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"><Download size={16} aria-hidden="true" />Export Markdown</button>
        {researcherEdited && aiDraft.length > 0 && <button type="button" onClick={() => { setSections(aiDraft); setResearcherEdited(false); setQuestion(aiDraftMeta?.research_question || question); setSearchScope(aiDraftMeta?.search_scope || ''); setSelectedIds(aiDraftMeta?.selected_paper_ids || selectedIds); setMessage('Latest EYRA draft and its research context applied.'); }} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold">Apply latest draft</button>}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">This is a narrative draft, not a systematic review or independent peer review. Confirm claims against the original publications. Abstract-only sources cannot support details beyond their available metadata and abstracts.</p>
      {message && <p role="status" className="rounded-lg bg-secondary px-3 py-2 text-sm">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}

      {sections.length > 0 && <div className="space-y-4" aria-label="Editable literature review draft">
        {LITERATURE_REVIEW_SECTIONS.map(definition => {
          const section = sections.find(item => item.section_id === definition.id) || { section_id: definition.id, claims: [] };
          return <section key={definition.id} className="rounded-xl border border-border p-4 sm:p-5">
            <h4 className="text-base font-semibold">{definition.label}</h4>
            {definition.id === 'research_gaps' && <p className="mt-1 text-xs text-muted-foreground">Candidate gaps are prompts for further searching; these records cannot establish that no other studies exist.</p>}
            {section.claims.length ? <div className="mt-3 space-y-4">{section.claims.map((claim, index) => <div key={`${definition.id}-${index}`}>
              {claim.heading && <p className="mb-1 text-sm font-semibold">{claim.heading}</p>}
              <textarea aria-label={`${definition.label} claim ${index + 1}`} value={claim.text} onChange={event => updateClaim(definition.id, index, event.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6" />
              <p className="mt-2 text-xs font-medium text-muted-foreground">Source records</p>
              <ul className="mt-1 space-y-1">{claim.source_ids.map(id => { const source = citeMap.get(String(id)); return source ? <li key={id}><a className="inline-flex min-h-8 items-center gap-1 text-xs text-primary underline-offset-2 hover:underline" href={isSafeLiteratureSourceUrl(source.url) ? source.url : source.doi ? `https://doi.org/${source.doi}` : undefined} target="_blank" rel="noopener noreferrer">{sourceLabel(source)}{(isSafeLiteratureSourceUrl(source.url) || source.doi) && <ExternalLink size={12} aria-hidden="true" />}</a></li> : <li key={id} className="text-xs text-destructive">Source record is no longer selected. Regenerate or select the source.</li>; })}</ul>
            </div>)}</div> : <p className="mt-2 text-sm italic text-muted-foreground">No source-supported draft content for this section.</p>}
          </section>;
        })}
      </div>}

      {!!bibliography.length && <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold">Verified bibliography ({bibliography.length})</summary>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">{bibliography.map(source => <li key={source.id}><span>{source.authors} ({source.year}). {source.title}. {source.source}.</span>{source.doi && <span> DOI: {source.doi}.</span>}{isSafeLiteratureSourceUrl(source.url) && <> <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">Open source record</a></>}</li>)}</ol>
      </details>}
    </section>
  );
}
