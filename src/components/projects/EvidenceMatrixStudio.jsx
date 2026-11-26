import React, { useMemo, useState } from 'react';
import { ExternalLink, FileText, Loader2, Search, Sparkles, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { saveDiscoveredGapPaper } from '@/lib/research-gap-literature-save.mjs';
import { isSafeLiteratureSourceUrl } from '@/lib/literature-review-protocol.mjs';
import { getEvidenceMatrixRows, NOTE_FIELDS } from '@/lib/evidence-matrix.mjs';
import {
  buildEvidenceMatrixPrompt,
  EVIDENCE_MATRIX_FIELDS,
  EVIDENCE_MATRIX_SCHEMA,
  exportEvidenceMatrixStudioCsv,
  hasEvidenceMatrixSaveReceipt,
  validateEvidenceMatrixDraft,
} from '@/lib/evidence-matrix-studio.mjs';

function errorMessage(error, fallback) {
  if (error?.code === 'ENTITY_CONFLICT') return 'This project changed in another session. Your edits remain here; reload the project before saving.';
  return error?.message || fallback;
}

export default function EvidenceMatrixStudio({ project, savedPapers, onProjectSaved, onPapersChanged }) {
  const initialMatrix = project?.evidence_matrix && typeof project.evidence_matrix === 'object' ? project.evidence_matrix : {};
  const [question, setQuestion] = useState(initialMatrix.research_question || '');
  const [selectedPaperIds, setSelectedPaperIds] = useState(() => Array.isArray(initialMatrix.selected_paper_ids)
    ? initialMatrix.selected_paper_ids.map(String)
    : []);
  const [annotations, setAnnotations] = useState(initialMatrix.annotations || {});
  const [draftRows, setDraftRows] = useState(Array.isArray(initialMatrix.ai_draft?.rows) ? initialMatrix.ai_draft.rows : []);
  const [draftQuestion, setDraftQuestion] = useState(String(initialMatrix.ai_draft?.research_question || ''));
  const [searchResults, setSearchResults] = useState([]);
  const [sourceStatus, setSourceStatus] = useState([]);
  const [filter, setFilter] = useState('');
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingPaperId, setAddingPaperId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedPapers = useMemo(() => {
    const selected = new Set(selectedPaperIds.map(String));
    return (Array.isArray(savedPapers) ? savedPapers : []).filter(paper => selected.has(String(paper.id)) && paper.project_id === project.id);
  }, [project.id, savedPapers, selectedPaperIds]);
  const matrixRows = useMemo(() => getEvidenceMatrixRows(selectedPapers, selectedPapers.map(paper => String(paper.id)), annotations)
    .map(({ paper, notes }) => ({ paper, notes, draft: draftRows.find(row => String(row.paper_id) === String(paper.id)) || {} })), [annotations, draftRows, selectedPapers]);
  const filteredResults = searchResults.filter(paper => `${paper.title || ''} ${paper.authors || ''} ${paper.source_index || ''}`.toLowerCase().includes(filter.trim().toLowerCase()));

  const search = async (event) => {
    event.preventDefault();
    const query = question.trim();
    if (query.length < 8) {
      setError('Enter a focused research question with at least 8 characters.');
      return;
    }
    setSearching(true); setError(''); setMessage(''); setSourceStatus([]);
    try {
      const result = await searchAllPapersWithStatus(query, { limit: 16 });
      setSearchResults(result.papers);
      setSourceStatus(result.source_status);
      if (!result.papers.length) setMessage(result.unavailable_source_count
        ? 'No records were returned, and one or more scholarly providers were unavailable. Retry when they recover.'
        : 'No matching records were returned. Refine the question and search again.');
      else setMessage(`${result.papers.length} scholarly records returned from ${result.available_source_count} available providers.`);
    } catch (failure) {
      setError(errorMessage(failure, 'Scholarly search failed. Your saved project was not changed.'));
    } finally { setSearching(false); }
  };

  const addPaper = async (paper) => {
    setAddingPaperId(String(paper.id)); setError(''); setMessage('');
    try {
      const saved = await saveDiscoveredGapPaper({ entities: base44.entities, paper, project });
      if (!saved?.id || saved.project_id !== project.id) throw new Error('The saved publication could not be verified as linked to this project.');
      onPapersChanged(previous => previous.some(item => String(item.id) === String(saved.id))
        ? previous.map(item => String(item.id) === String(saved.id) ? saved : item)
        : [saved, ...previous]);
      setSelectedPaperIds(previous => [...new Set([...previous.map(String), String(saved.id)])]);
      setMessage(`Added “${saved.title}” to this private project.`);
    } catch (failure) {
      setError(errorMessage(failure, 'The publication could not be added to this project.'));
    } finally { setAddingPaperId(''); }
  };

  const analyze = async () => {
    if (selectedPapers.length === 0) { setError('Select at least one linked publication before asking EYRA to analyze the evidence.'); return; }
    if (!question.trim()) { setError('Add a research question before generating the matrix.'); return; }
    setAnalyzing(true); setError(''); setMessage('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: EVIDENCE_MATRIX_SCHEMA,
        prompt: buildEvidenceMatrixPrompt(question, selectedPapers),
      });
      const validatedRows = validateEvidenceMatrixDraft(result, selectedPapers);
      setDraftRows(validatedRows);
      setDraftQuestion(question.trim());
      setMessage(`EYRA drafted ${validatedRows.length} rows from the selected publication records. Review the source links and edit each field.`);
    } catch (failure) {
      setError(errorMessage(failure, 'EYRA could not complete the evidence analysis. Your saved work was not changed.'));
    } finally { setAnalyzing(false); }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true); setError(''); setMessage('');
    const evidence_matrix = {
      research_question: question.trim().slice(0, 1200),
      selected_paper_ids: selectedPapers.map(paper => String(paper.id)),
      annotations,
      ai_draft: draftRows.length ? { rows: draftRows, research_question: draftQuestion, model: 'EYRA', created_at: new Date().toISOString() } : null,
      updated_at: new Date().toISOString(),
    };
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(project.id, { evidence_matrix }, project.updated_date);
      if (!hasEvidenceMatrixSaveReceipt(saved, project.id, evidence_matrix)) {
        throw new Error('The saved project could not be verified. Reload before relying on this save.');
      }
      onProjectSaved(saved);
      setMessage('Evidence Matrix saved to this private research project.');
    } catch (failure) { setError(errorMessage(failure, 'The matrix could not be saved. Your edits remain here.')); }
    finally { setSaving(false); }
  };

  const exportCsv = () => {
    const csv = exportEvidenceMatrixStudioCsv({ question, draftQuestion, rows: matrixRows, annotations });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    const safeName = String(project.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project';
    anchor.href = url; anchor.download = `evidence-matrix-${safeName}.csv`;
    document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };

  const updateField = (paperId, field, value, kind) => {
    if (kind === 'draft') setDraftRows(previous => previous.map(row => String(row.paper_id) === String(paperId) ? { ...row, [field]: value } : row));
    else setAnnotations(previous => ({ ...previous, [paperId]: { ...(previous[paperId] || {}), [field]: value } }));
  };

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="evidence-matrix-studio-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Scientific Output Studio</p>
          <h3 id="evidence-matrix-studio-title" tabIndex={-1} className="mt-1 scroll-mt-4 text-xl font-semibold">Evidence Matrix</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Search scholarly indexes, add source records to this project, and ask EYRA for a preliminary source-grounded comparison. Review abstracts and citations; the matrix is an editable draft, not a substitute for full-text appraisal.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save size={15} />{saving ? 'Saving…' : 'Save matrix'}</button>
          <button type="button" onClick={exportCsv} disabled={!matrixRows.length} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"><FileText size={15} />Export CSV</button>
        </div>
      </div>

      <form onSubmit={search} className="space-y-3 rounded-xl border border-border bg-background/70 p-4">
        <label htmlFor="evidence-research-question" className="block text-sm font-semibold">Research question</label>
        <textarea id="evidence-research-question" value={question} onChange={event => setQuestion(event.target.value)} disabled={analyzing} maxLength={1200} rows={3} placeholder="For adults with condition X, how does intervention Y compare with standard care for outcome Z?" className="min-h-24 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-70" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Search sends the question to scholarly indexes (OpenAlex, arXiv, Europe PMC, Crossref, and Semantic Scholar).</p>
          <button type="submit" disabled={searching || question.trim().length < 8} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50">{searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}{searching ? 'Searching…' : 'Search scholarly sources'}</button>
        </div>
      </form>

      {(error || message) && <p role={error ? 'alert' : 'status'} aria-live="polite" className={`rounded-lg border px-3 py-2 text-sm leading-5 ${error ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-primary/30 bg-primary/5 text-foreground'}`}>{error || message}</p>}
      {draftRows.length > 0 && draftQuestion && draftQuestion !== question.trim() && <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">The saved EYRA draft was generated for a different research question. Re-run analysis before treating it as aligned with the current question.</p>}
      {sourceStatus.length > 0 && <ul aria-label="Scholarly provider status" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{sourceStatus.map(source => <li key={source.id}>{source.label}: {source.status === 'available' ? `${source.count} records` : 'unavailable'}</li>)}</ul>}

      {searchResults.length > 0 && <div className="space-y-3" aria-labelledby="evidence-search-results-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h4 id="evidence-search-results-title" className="font-semibold">Search results</h4><label className="sr-only" htmlFor="evidence-search-filter">Filter search results</label><input id="evidence-search-filter" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter title, author, source" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm sm:max-w-sm" /></div>
        <ul className="grid gap-3 lg:grid-cols-2">{filteredResults.map(paper => {
          const alreadyLinked = savedPapers.some(saved => String(saved.source_id) === String(paper.id) || (paper.doi && String(saved.doi || '').toLowerCase() === String(paper.doi).toLowerCase()));
          const sourceUrl = isSafeLiteratureSourceUrl(paper.url) ? paper.url : '';
          return <li key={`${paper.source_index || 'source'}:${paper.id}`} className="rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{paper.source_index || paper.source || 'Scholarly index'}{paper.year ? ` · ${paper.year}` : ''}</p><h5 className="mt-1 text-sm font-semibold leading-5">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{paper.title || 'Untitled publication'} <ExternalLink aria-hidden="true" className="inline" size={12} /></a> : paper.title || 'Untitled publication'}</h5><p className="mt-1 text-xs leading-5 text-muted-foreground">{paper.authors || 'Authors not supplied by index'}{paper.doi ? ` · DOI: ${paper.doi}` : ''}</p></div>
              <button type="button" onClick={() => addPaper(paper)} disabled={!sourceUrl || alreadyLinked || Boolean(addingPaperId)} className="min-h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50">{addingPaperId === String(paper.id) ? 'Adding…' : alreadyLinked ? 'Linked' : 'Add to project'}</button></div>
            {paper.summary && <p className="mt-3 line-clamp-4 text-xs leading-5 text-muted-foreground">{paper.summary}</p>}
            {!sourceUrl && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No verified source URL was supplied; this record cannot be added until a link is available.</p>}
          </li>;
        })}</ul>
      </div>}

      <section className="space-y-3 border-t border-border pt-5" aria-labelledby="linked-evidence-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h4 id="linked-evidence-title" className="font-semibold">Project evidence <span className="text-sm font-normal text-muted-foreground">({savedPapers.length} linked)</span></h4><p className="mt-1 text-xs text-muted-foreground">Only publications linked to this project can be selected for analysis.</p></div>
          <button type="button" onClick={analyze} disabled={analyzing || selectedPapers.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/40 px-3 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">{analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{analyzing ? 'EYRA is analyzing…' : `Analyze selected (${selectedPapers.length})`}</button></div>
        {savedPapers.length ? <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{savedPapers.map(paper => { const paperId = String(paper.id); return <li key={paperId}><label className="flex min-h-10 cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary/60"><input type="checkbox" checked={selectedPaperIds.includes(paperId)} onChange={event => setSelectedPaperIds(previous => event.target.checked ? [...new Set([...previous, paperId])] : previous.filter(value => value !== paperId))} className="mt-1 accent-primary" /><span className="min-w-0"><span className="block line-clamp-2 font-medium">{paper.title || 'Untitled publication'}</span><span className="text-xs text-muted-foreground">{paper.authors || 'Authors not recorded'}{paper.year ? ` · ${paper.year}` : ''}</span></span></label></li>; })}</ul> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Search the scholarly indexes above and add records to this project to begin.</p>}
      </section>

      {matrixRows.length > 0 && <section className="space-y-3" aria-labelledby="evidence-table-title"><div><h4 id="evidence-table-title" className="font-semibold">Editable evidence matrix</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">EYRA fields are preliminary summaries of the available record. Researcher notes stay separate. Verify each statement against the linked source before using it in scholarly work.</p></div>
        <div className="space-y-4">{matrixRows.map(({ paper, notes, draft }) => {
          const sourceUrl = isSafeLiteratureSourceUrl(paper.url) ? paper.url : '';
          const savedDraftRow = draftRows.some(row => String(row.paper_id) === String(paper.id));
          return <article key={paper.id} className="overflow-hidden rounded-xl border border-border">
            <header className="flex flex-col gap-2 border-b border-border bg-secondary/30 p-4 sm:flex-row sm:items-start sm:justify-between"><div><h5 className="font-semibold leading-5">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{paper.title || 'Untitled publication'} <ExternalLink aria-hidden="true" className="inline" size={13} /></a> : paper.title || 'Untitled publication'}</h5><p className="mt-1 text-xs leading-5 text-muted-foreground">{paper.authors || 'Authors not recorded'}{paper.year ? ` · ${paper.year}` : ''}{paper.doi ? ` · DOI: ${paper.doi}` : ''}</p></div><span className="shrink-0 text-xs text-muted-foreground">{paper.source_index || paper.source || 'Source index'}</span></header>
            <div className="grid gap-3 p-4 md:grid-cols-2">{EVIDENCE_MATRIX_FIELDS.map(([field, label]) => <div key={`draft-${field}`}><label htmlFor={`matrix-${paper.id}-${field}`} className="mb-1 block text-xs font-semibold">{label} · EYRA draft</label><textarea id={`matrix-${paper.id}-${field}`} aria-label={`${label} EYRA draft for ${paper.title || 'publication'}`} maxLength={2000} rows={3} value={draft[field] || ''} onChange={event => updateField(paper.id, field, event.target.value, 'draft')} placeholder={savedDraftRow ? 'Not reported in the available record.' : 'Run EYRA analysis to create a draft.'} className="min-h-20 w-full resize-y rounded-md border border-border bg-background p-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-primary/40" /></div>)}
              {NOTE_FIELDS.map(([field, label]) => <div key={`note-${field}`}><label htmlFor={`researcher-note-${paper.id}-${field}`} className="mb-1 block text-xs font-semibold">{label} · researcher note</label><textarea id={`researcher-note-${paper.id}-${field}`} maxLength={2000} rows={2} value={notes[field] || ''} onChange={event => updateField(paper.id, field, event.target.value, 'note')} placeholder="Your source-checked note" className="min-h-16 w-full resize-y rounded-md border border-border bg-background p-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-primary/40" /></div>)}
            </div>
            <footer className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Citation provenance: {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open source record <ExternalLink aria-hidden="true" size={11} /></a> : 'No source URL saved'}{paper.summary ? ' · Abstract/record text supplied to EYRA' : ' · No abstract text supplied to EYRA'}</footer>
          </article>;
        })}</div>
      </section>}
    </section>
  );
}
