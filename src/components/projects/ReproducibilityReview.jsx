import React, { useEffect, useState } from 'react';
import { Download, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  REPRODUCIBILITY_ITEMS, REPRODUCIBILITY_STATUSES, emptyReproducibilityReview,
  validateReproducibilityReview, reproducibilityDocumentationSummary,
  reproducibilityReviewSnapshot,
} from '@/lib/reproducibility-review.mjs';

const LABELS = {
  not_assessed: 'Not assessed',
  documented: 'Documented in material',
  missing: 'Not documented',
  not_applicable: 'Not applicable (explain)',
};

export default function ReproducibilityReview({ project, onSaved }) {
  const [review, setReview] = useState(() => project?.reproducibility_review || emptyReproducibilityReview());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setReview(project?.reproducibility_review || emptyReproducibilityReview());
    setError('');
    setMessage('');
    setDirty(false);
  }, [project?.id, project?.reproducibility_review]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = patch => {
    setReview(current => ({ ...current, ...patch }));
    setDirty(true);
    setMessage('');
  };
  const updateEntry = (id, patch) => {
    setReview(current => ({
      ...current,
      entries: {
        ...current.entries,
        [id]: { status: 'not_assessed', evidence: '', ...(current.entries?.[id] || {}), ...patch },
      },
    }));
    setDirty(true);
    setMessage('');
  };
  const save = async () => {
    if (saving) return;
    const checked = validateReproducibilityReview(review);
    if (!checked.ok) { setError(checked.errors.join(' ')); return; }
    setError('');
    setSaving(true);
    try {
      const next = { ...checked.value, updated_at: new Date().toISOString() };
      const saved = await base44.entities.Project.update(project.id, { reproducibility_review: next });
      onSaved?.(saved);
      setReview(next);
      setDirty(false);
      setMessage('Documentation checklist saved privately in this project.');
    } catch {
      setError('Could not save the checklist. Your changes remain in this editor.');
    } finally {
      setSaving(false);
    }
  };
  const exportJson = () => {
    try {
      const snapshot = reproducibilityReviewSnapshot(project, review, new Date().toISOString());
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = 'eylo-reproducibility-documentation.json';
        document.body.append(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setError('');
      setMessage('Current draft exported; save separately to persist your changes in EYLO.');
    } catch (failure) {
      setError(failure?.message || 'Could not export this checklist.');
    }
  };
  const summary = reproducibilityDocumentationSummary(review);

  return (
    <section className="space-y-5" aria-label="Reproducibility documentation checker">
      <header>
        <h2 className="text-xl font-semibold">Reproducibility documentation checker</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Review your own manuscript, code, dataset or protocol and record where information appears.
          EYLO does not upload or analyze your file, run experiments, independently check evidence,
          or certify that a study is reproducible.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {summary.counts.documented} documented · {summary.counts.missing} missing · {summary.counts.not_applicable} not applicable · {summary.counts.not_assessed} not assessed
        </p>
      </header>

      <label className="block text-sm font-medium">
        Materials assessed (required)
        <input value={review.manuscript_reference || ''} onChange={event => update({ manuscript_reference: event.target.value })}
          placeholder="e.g. Draft manuscript v2, OSF protocol DOI or dataset version"
          className="mt-2 min-h-11 w-full rounded-lg border border-border bg-card px-3" />
      </label>
      <label className="block text-sm font-medium">
        Assessment scope, caveats and changes
        <textarea value={review.scope_notes || ''} onChange={event => update({ scope_notes: event.target.value })} rows={3}
          className="mt-2 w-full rounded-lg border border-border bg-card p-3" />
      </label>

      <div className="space-y-3">
        {REPRODUCIBILITY_ITEMS.map(([id, label, help]) => {
          const entry = review.entries?.[id] || { status: 'not_assessed', evidence: '' };
          return (
            <div key={id} className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">{label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{help}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[14rem_1fr]">
                <label className="text-xs font-medium">Review status
                  <select value={entry.status} onChange={event => updateEntry(id, { status: event.target.value })}
                    className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-2">
                    {REPRODUCIBILITY_STATUSES.map(status => <option key={status} value={status}>{LABELS[status]}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium">Evidence location / explanation
                  <input value={entry.evidence || ''} onChange={event => updateEntry(id, { evidence: event.target.value })}
                    placeholder="Section, page, table, repository URL, or why not applicable"
                    className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-3" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {dirty && <p role="status" className="text-xs text-amber-600 dark:text-amber-400">Unsaved checklist changes.</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Save size={15} />{saving ? 'Saving…' : 'Save checklist'}
        </button>
        <button type="button" onClick={exportJson} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">
          <Download size={15} />Export documented review JSON
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{summary.disclaimer}</p>
    </section>
  );
}
