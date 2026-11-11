import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Download, RefreshCw, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { auditReviewMethods } from '@/lib/literature-review-methods-audit.mjs';
import {
  emptyReviewProtocol,
  validateReviewProtocol,
  reviewProtocolSnapshot,
  screeningLogCsv,
  screeningCounts,
  REVIEW_TYPES,
  isSafeLiteratureSourceUrl,
  hasUnsavedReviewChanges,
} from '@/lib/literature-review-protocol.mjs';

const FIELD_LABELS = [
  ['question', 'Research question', 'text', 'Define the population, intervention or topic, comparator and outcome where applicable.'],
  ['search_databases', 'Sources searched', 'text', 'Specify sources actually queried; not just sources you intend to query.'],
  ['search_strings', 'Exact search strings', 'textarea', 'Record queries exactly as entered, with Boolean operators and filters.'],
  ['inclusion_criteria', 'Inclusion criteria', 'textarea', 'Specify eligibility by population, design, dates and outcomes.'],
  ['exclusion_criteria', 'Exclusion criteria', 'textarea', 'Specify clear, reproducible reasons for exclusion.'],
  ['methods_notes', 'Methods, deviations and limitations', 'textarea', 'Record any protocol deviations or incomplete database coverage.'],
];

export default function LiteratureReview() {
  const [searchParams] = useSearchParams();
  const preferredProjectId = searchParams.get('project_id') || '';
  const [projects, setProjects] = useState([]);
  const [papers, setPapers] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [protocol, setProtocol] = useState(emptyReviewProtocol);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      base44.entities.Project.list('-updated_date', 100),
      base44.entities.SavedPaper.list('-created_date', 100),
    ]).then(([projectRows, paperRows]) => {
      if (!active) return;
      setProjects(projectRows);
      setPapers(paperRows);
      setProjectId(current => {
        if (current && projectRows.some(project => project.id === current)) return current;
        if (preferredProjectId && projectRows.some(project => project.id === preferredProjectId)) return preferredProjectId;
        return projectRows[0]?.id || '';
      });
    }).catch(() => {
      if (active) setError('Could not load your private projects and saved papers. Check your connection and retry.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, preferredProjectId]);

  const selectedProject = projects.find(project => project.id === projectId);
  const savedProtocol = selectedProject?.review_protocol || emptyReviewProtocol();
  const hasUnsavedChanges = Boolean(selectedProject && hasUnsavedReviewChanges(protocol, savedProtocol));

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const warnOnUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnOnUnload);
    return () => window.removeEventListener('beforeunload', warnOnUnload);
  }, [hasUnsavedChanges]);

  const confirmDiscard = () => !hasUnsavedChanges
    || window.confirm('Your review protocol has unsaved changes. Discard these changes?');
  useEffect(() => {
    const saved = selectedProject?.review_protocol;
    const base = emptyReviewProtocol();
    setProtocol(saved && typeof saved === 'object' && !Array.isArray(saved)
      ? { ...base, ...saved, screening: Array.isArray(saved.screening) ? saved.screening : [] }
      : base);
  }, [selectedProject?.id, selectedProject?.review_protocol]);

  const updateField = (field, value) => {
    setProtocol(current => ({ ...current, [field]: value }));
    setMessage('');
  };

  const updateScreening = (paperId, patch) => {
    setProtocol(current => {
      const screening = Array.isArray(current.screening) ? current.screening : [];
      const previous = screening.find(item => item.paper_id === paperId);
      const record = { paper_id: paperId, decision: 'undecided', reason: '', ...previous, ...patch };
      return {
        ...current,
        screening: previous
          ? screening.map(item => item.paper_id === paperId ? record : item)
          : [...screening, record],
      };
    });
    setMessage('');
  };

  const removeScreening = (paperId) => {
    setProtocol(current => ({
      ...current,
      screening: current.screening.filter(item => item.paper_id !== paperId),
    }));
    setMessage('');
  };

  const prepare = () => {
    if (!selectedProject) {
      setError('Choose one of your authorized projects first.');
      return null;
    }
    const result = validateReviewProtocol(protocol, papers.map(paper => String(paper.id)));
    if (!result.ok) {
      setError(result.errors.join(' '));
      return null;
    }
    setError('');
    return result.protocol;
  };

  const save = async () => {
    if (saving) return;
    const checked = prepare();
    if (!checked) return;
    setSaving(true);
    setMessage('');
    try {
      const next = { ...checked, updated_at: new Date().toISOString() };
      await base44.entities.Project.update(selectedProject.id, { review_protocol: next });
      setProjects(current => current.map(project => project.id === selectedProject.id
        ? { ...project, review_protocol: next } : project));
      setMessage('Protocol saved privately in this research project.');
    } catch {
      setError('The protocol could not be saved. Your changes remain in this editor; retry after the connection recovers.');
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    const checked = prepare();
    if (!checked) return;
    const snapshot = reviewProtocolSnapshot(selectedProject, checked, papers, new Date().toISOString());
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'eylo-review-protocol.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage('A snapshot of the current editor was exported. Save separately to persist it in EYLO.');
  };

  const exportScreeningCsv = () => {
    const checked = prepare();
    if (!checked) return;
    const snapshot = reviewProtocolSnapshot(selectedProject, checked, papers, new Date().toISOString());
    const blob = new Blob(['\uFEFF', screeningLogCsv(snapshot)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'eylo-screening-decisions.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
    setMessage('Human-reviewed screening log exported. Save separately to persist your decisions in EYLO.');
  };

  const screening = Array.isArray(protocol.screening) ? protocol.screening : [];
  const counts = screeningCounts({ screening });
  const methodsAudit = auditReviewMethods(protocol, { libraryRowsShown: papers.length, listLimit: 100 });

  return (
    <main className="eylo-page">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Research methods · Human-reviewed</p>
        <h1 className="mt-2 eylo-page-heading">Literature Review Protocol</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Document a reproducible search and screen publications from your private Library.
          Decisions and criteria are researcher-authored; EYLO does not infer study outcomes,
          verify full texts, or claim PRISMA compliance from this form.
        </p>
      </header>

      {loading && <p role="status" className="py-8 text-sm text-muted-foreground">Loading your private research workspaces…</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error} {loading ? null : <button type="button" onClick={() => { if (confirmDiscard()) setAttempt(value => value + 1); }} className="ml-2 underline">Retry load</button>}</p>}
      {hasUnsavedChanges && !loading && <p role="status" className="mb-3 text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved protocol changes — save before leaving this page.</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-border bg-secondary/40 p-3 text-sm">{message}</p>}

      {!loading && !projects.length ? (
        <section className="rounded-xl border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">Create a private research project to attach your review protocol.</p>
          <Link to="/projects" className="mt-3 inline-block text-sm font-semibold text-primary underline">Open projects</Link>
        </section>
      ) : !loading && (
        <>
          <label className="mb-5 block text-sm font-medium">
            Research project
            <select disabled={saving} aria-label="Select literature review project" value={projectId}
              onChange={event => { if (!confirmDiscard()) return; setProjectId(event.target.value); setError(''); setMessage(''); }}
              className="mt-2 block min-h-11 w-full max-w-xl rounded-lg border border-border bg-card px-3">
              {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>

          <section className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
            <label className="text-sm font-medium">Review type
              <select value={protocol.review_type} onChange={event => updateField('review_type', event.target.value)}
                className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background px-3">
                {REVIEW_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Search date (actual execution date)
              <input type="date" value={protocol.search_date || ''} onChange={event => updateField('search_date', event.target.value)}
                className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background px-3" />
            </label>
            {FIELD_LABELS.map(([field, label, type, help]) => (
              <label key={field} className={'block text-sm font-medium ' + (type === 'textarea' ? 'sm:col-span-2' : '')}>
                {label}
                {type === 'textarea' ? (
                  <textarea value={protocol[field] || ''} onChange={event => updateField(field, event.target.value)}
                    rows={field === 'search_strings' ? 4 : 3}
                    className="mt-2 block w-full rounded-lg border border-border bg-background p-3 text-sm" />
                ) : (
                  <input type="text" value={protocol[field] || ''} onChange={event => updateField(field, event.target.value)}
                    className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                )}
                <span className="mt-1 block text-xs font-normal text-muted-foreground">{help}</span>
              </label>
            ))}
          </section>

          <section className="mb-6 rounded-xl border border-border bg-card p-5" aria-labelledby="review-methods-audit">
            <h2 id="review-methods-audit" className="text-base font-semibold">Methods documentation checklist</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {methodsAudit.recorded} of {methodsAudit.requiredDocumentation} documentation fields recorded.
              This inventory is not a review-quality score, complete search certification, or PRISMA compliance claim.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {methodsAudit.entries.map(item => (
                <li key={item.id} className="flex gap-2 text-xs text-foreground">
                  <span aria-hidden="true">{item.recorded ? '✓' : '○'}</span>
                  {item.label}: {item.recorded ? 'Recorded' : 'Missing'}
                </li>
              ))}
            </ul>
            {methodsAudit.warnings.length > 0 && (
              <ul role="status" className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400">
                {methodsAudit.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            )}
          </section>

          <section className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold"><BookOpen size={16} className="mr-2 inline text-primary" />Title and abstract screening</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {counts.considered} considered · {counts.included} included · {counts.excluded} excluded · {counts.undecided} undecided.
                  These are workspace counts, not a completed PRISMA flow.
                </p>
              </div>
              <Link to="/library" onClick={event => { if (!confirmDiscard()) event.preventDefault(); }} className="text-sm text-primary underline">Open Library</Link>
            </div>
            {!papers.length && <p className="mt-4 text-sm text-muted-foreground">Save scholarly publications to your Library before screening.</p>}
            <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto">
              {papers.map(paper => {
                const record = screening.find(item => item.paper_id === String(paper.id));
                return (
                  <div key={paper.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{paper.title || 'Untitled saved publication'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{[paper.authors, paper.year, paper.doi].filter(Boolean).join(' · ')}</p>
                    {isSafeLiteratureSourceUrl(paper.url) && <a href={paper.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline">View recorded source</a>}
                    {!record ? (
                      <button type="button" onClick={() => updateScreening(String(paper.id), {})} className="mt-2 block min-h-10 rounded-lg border border-border px-3 text-xs font-semibold">
                        Add to screening log
                      </button>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                        <label className="text-xs font-medium">Decision
                          <select value={record.decision} onChange={event => updateScreening(String(paper.id), { decision: event.target.value })}
                            className="mt-1 block min-h-10 rounded-lg border border-border bg-background px-2">
                            <option value="undecided">Undecided</option>
                            <option value="include">Include</option>
                            <option value="exclude">Exclude</option>
                          </select>
                        </label>
                        <label className="text-xs font-medium">Reason / screening note
                          <input value={record.reason || ''} onChange={event => updateScreening(String(paper.id), { reason: event.target.value })}
                            placeholder={record.decision === 'exclude' ? 'Required reason for exclusion' : 'Human-reviewed note'}
                            className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs" />
                        </label>
                        <button type="button" onClick={() => removeScreening(String(paper.id))} className="min-h-10 rounded-lg border border-border px-3 text-xs">Remove</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mb-8 flex flex-wrap gap-3">
            <button type="button" disabled={saving || !selectedProject} onClick={save}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              <Save size={16} aria-hidden="true" />{saving ? 'Saving…' : 'Save protocol to project'}
            </button>
            <button type="button" disabled={saving || !selectedProject} onClick={exportJson}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-medium disabled:opacity-50">
              <Download size={16} aria-hidden="true" />Export reproducible JSON
            </button>
            <button type="button" disabled={saving || !selectedProject} onClick={exportScreeningCsv}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-5 text-sm font-medium disabled:opacity-50">
              <Download size={16} aria-hidden="true" />Export screening CSV
            </button>
            <button type="button" disabled={saving} onClick={() => { if (confirmDiscard()) setAttempt(value => value + 1); }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm">
              <RefreshCw size={15} aria-hidden="true" />Reload saved records
            </button>
          </div>
        </>
      )}
    </main>
  );
}
