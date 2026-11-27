import React, { useMemo, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { CLAIM_SUPPORT_LABELS } from '@/lib/scientific-evaluation.mjs';
import { collectScientificReviewItems, updateScientificReview } from '@/lib/scientific-quality-review.mjs';

const labels = {
  supported_by_inspected_evidence: 'Supported by inspected evidence',
  partially_supported: 'Partially supported',
  unsupported: 'Unsupported',
  contradicted: 'Contradicted',
  insufficient_accessible_source_material: 'Insufficient accessible source material',
  not_yet_reviewed: 'Not yet reviewed',
};
const errorText = error => error?.code === 'ENTITY_CONFLICT'
  ? 'This project changed elsewhere. Your review remains in the editor; reload the project before saving.'
  : error?.message || 'The scientific review could not be saved.';

export default function ScientificQualityReview({ project, onProjectSaved }) {
  const items = useMemo(() => collectScientificReviewItems(project), [project]);
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const editFor = item => edits[item.id] || item;
  const save = async item => {
    if (savingId) return;
    setSavingId(item.id); setError(''); setMessage('');
    const value = editFor(item);
    try {
      const scientific_quality_review = updateScientificReview(project, item.id, value);
      const saved = await base44.entities.Project.updateIfUnchanged(project.id, { scientific_quality_review }, project.updated_date);
      if (saved?.id !== project.id || JSON.stringify(saved.scientific_quality_review) !== JSON.stringify(scientific_quality_review)) throw new Error('The saved review could not be verified. Reload before relying on it.');
      onProjectSaved(saved);
      setEdits(previous => { const next = { ...previous }; delete next[item.id]; return next; });
      setMessage('Research assessment saved to this private project.');
    } catch (failure) { setError(errorText(failure)); }
    finally { setSavingId(''); }
  };

  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="scientific-quality-review-title">
    <div><h3 id="scientific-quality-review-title" className="text-lg font-semibold">Scientific quality review</h3><p className="mt-1 text-sm text-muted-foreground">Review claims across saved research artifacts. Automated findings check record structure only; source identifiers do not establish whether evidence supports a claim.</p></div>
    {!items.length ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Save an Evidence Matrix, Literature Review, Proposal, Methodology or Grant Proposal to begin claim review.</p> : <div className="space-y-3">{items.map(item => {
      const value = editFor(item);
      return <article key={item.id} className="space-y-3 rounded-xl border border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.artifact_label}</span><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{item.evidence_scope.replaceAll('_', ' ')}</span></div>
        <p className="whitespace-pre-wrap text-sm leading-6">{item.claim}</p>
        <p className="text-xs text-muted-foreground">Source references: {item.source_ids.length ? item.source_ids.join(', ') : 'none recorded'} · Evidence access: {item.evidence_scope.replaceAll('_', ' ')}</p>
        {item.automated_findings.length > 0 && <ul className="space-y-1 rounded-lg bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-100">{item.automated_findings.map(finding => <li key={finding} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{finding}</li>)}</ul>}
        <label className="block text-sm font-medium">Reviewer assessment<select className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3" value={value.assessment} onChange={event => setEdits(previous => ({ ...previous, [item.id]: { ...value, assessment: event.target.value } }))}>{CLAIM_SUPPORT_LABELS.map(option => <option key={option} value={option}>{labels[option]}</option>)}</select></label>
        <label className="block text-sm font-medium">Researcher annotation<textarea className="mt-1 min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2" maxLength={2000} value={value.annotation || ''} onChange={event => setEdits(previous => ({ ...previous, [item.id]: { ...value, annotation: event.target.value } }))} placeholder="Record the evidence inspected, reasoning, or reviewer note." /></label>
        <label className="block text-sm font-medium">Scientific limitation<textarea className="mt-1 min-h-16 w-full rounded-lg border border-border bg-background px-3 py-2" maxLength={1000} value={value.limitation || ''} onChange={event => setEdits(previous => ({ ...previous, [item.id]: { ...value, limitation: event.target.value } }))} placeholder="For example: abstract only, inaccessible full text, or conflicting findings." /></label>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">State: {labels[value.assessment]}{item.reviewed_at && !edits[item.id] ? ` · saved ${new Date(item.reviewed_at).toLocaleString()}` : ''}</span><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50" disabled={Boolean(savingId)} onClick={() => save(item)}><Save size={15} />{savingId === item.id ? 'Saving…' : 'Save assessment'}</button></div>
      </article>;
    })}</div>}
    <p className="text-xs leading-5 text-muted-foreground">Assessments are researcher-entered and are not independent peer review. A citation identity check verifies bibliographic identity only. Scientific correctness requires source inspection and qualified human assessment.</p>
    {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
