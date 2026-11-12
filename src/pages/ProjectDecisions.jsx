import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  createDecisionDraft, DECISION_STATUSES, normalizeDecision,
  normalizeDecisionList, validateDecision,
} from '@/lib/decision-workspace.mjs';

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const labelClass = 'mb-1.5 block text-xs font-medium text-muted-foreground';
const newRowId = () => globalThis.crypto?.randomUUID?.() || ('row-' + Date.now() + '-' + Math.random().toString(36).slice(2));

function ListEditor({ label, description, items, onChange, placeholder, max = 12 }) {
  const add = () => onChange([...items, { id: newRowId(), text: '' }]);
  const update = (id, text) => onChange(items.map((item) => item.id === id ? { ...item, text } : item));
  const remove = (id) => onChange(items.filter((item) => item.id !== id));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="flex items-start justify-between gap-3">
        <div>{description && <p className="text-xs text-muted-foreground">{description}</p>}</div>
        <button type="button" onClick={add} disabled={items.length >= max} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"><Plus size={13} /> Add</button>
      </div>
      {items.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">Nothing recorded yet.</p>}
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-2">
          <label className="sr-only" htmlFor={label + '-' + item.id}>{label + ' ' + (index + 1)}</label>
          <input id={label + '-' + item.id} value={item.text} maxLength={500} onChange={(event) => update(item.id, event.target.value)} className={inputClass} placeholder={placeholder} />
          <button type="button" onClick={() => remove(item.id)} aria-label={'Remove ' + label.toLowerCase() + ' ' + (index + 1)} className="grid min-h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
        </div>
      ))}
    </fieldset>
  );
}

function EvidenceEditor({ items, onChange }) {
  const update = (id, field, value) => onChange(items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  const remove = (id) => onChange(items.filter((item) => item.id !== id));
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">Evidence and sources</legend>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs text-muted-foreground">Record what supports or challenges this decision. EYLO does not independently verify these sources.</p></div>
        <button type="button" onClick={() => onChange([...items, { id: newRowId(), claim: '', source_label: '', source_url: '' }])} disabled={items.length >= 40} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-secondary disabled:opacity-50"><Plus size={13} /> Add source</button>
      </div>
      {items.length === 0 && <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">No sources attached. You can save a draft and add evidence later.</p>}
      {items.map((item, index) => (
        <div key={item.id} className="grid gap-2 rounded-lg border border-border bg-background/60 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div><label className={labelClass} htmlFor={'evidence-claim-' + item.id}>Claim or observation {index + 1}</label><input id={'evidence-claim-' + item.id} value={item.claim} maxLength={1000} onChange={(event) => update(item.id, 'claim', event.target.value)} className={inputClass} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><label className={labelClass} htmlFor={'evidence-label-' + item.id}>Source label</label><input id={'evidence-label-' + item.id} value={item.source_label} maxLength={200} onChange={(event) => update(item.id, 'source_label', event.target.value)} className={inputClass} /></div>
            <div><label className={labelClass} htmlFor={'evidence-url-' + item.id}>Source URL (optional)</label><input id={'evidence-url-' + item.id} type="url" value={item.source_url} maxLength={1000} onChange={(event) => update(item.id, 'source_url', event.target.value)} className={inputClass} placeholder="https://" /></div>
          </div>
          <button type="button" onClick={() => remove(item.id)} aria-label={'Remove evidence source ' + (index + 1)} className="grid min-h-10 w-10 place-self-end rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:self-center"><Trash2 size={14} /></button>
        </div>
      ))}
    </fieldset>
  );
}

export default function ProjectDecisions() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const ordered = useMemo(() => [...decisions].sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date))), [decisions]);

  const load = useCallback(async ({ discardDraft = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const saved = await base44.entities.Project.get(id);
      if (!saved?.id || saved.id !== id) throw new Error('This project could not be found in your workspace.');
      const records = normalizeDecisionList(saved.decision_records);
      setProject(saved);
      setDecisions(records);
      if (discardDraft) setDraft(null);
      setNotice('');
    } catch (failure) {
      setError(failure?.message || 'Your project decisions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load({ discardDraft: true }); }, [load]);

  const startNew = () => { setNotice(''); setError(''); setDraft(createDecisionDraft()); };
  const edit = (decision) => { setNotice(''); setError(''); setDraft(normalizeDecision(decision)); };
  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const save = async (event) => {
    event.preventDefault();
    if (!draft || !project) return;
    const validation = validateDecision(draft);
    if (!validation.valid) { setError(validation.errors.join(' ')); return; }
    const normalized = normalizeDecision({ ...draft, updated_date: new Date().toISOString() });
    const next = decisions.some((record) => record.id === normalized.id)
      ? decisions.map((record) => record.id === normalized.id ? normalized : record)
      : [normalized, ...decisions];
    if (next.length > 100) { setError('This project has reached the 100-decision limit. Remove or archive a decision before adding another.'); return; }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(id, { decision_records: next }, project.updated_date);
      setProject((current) => ({ ...current, ...saved }));
      setDecisions(next);
      setDraft(null);
      setNotice('Decision saved to this project.');
    } catch (failure) {
      setError(failure?.code === 'ENTITY_CONFLICT' || failure?.code === 'PROJECT_VERSION_CONFLICT'
        ? 'This project changed in another tab. Your decision draft is still here. Reload the latest project, review the updated decision list and draft, then save again.'
        : failure?.message || 'Your decision could not be saved. Your draft is still here.');
    } finally { setSaving(false); }
  };

  const remove = async (decision) => {
    if (!window.confirm('Delete “' + decision.title + '” from this project?')) return;
    const next = decisions.filter((record) => record.id !== decision.id);
    setSaving(true);
    setError('');
    try {
      const saved = await base44.entities.Project.updateIfUnchanged(id, { decision_records: next }, project.updated_date);
      setProject((current) => ({ ...current, ...saved }));
      setDecisions(next);
      if (draft?.id === decision.id) setDraft(null);
      setNotice('Decision removed from this project.');
    } catch (failure) {
      setError(failure?.message || 'The decision could not be removed. Reload the project and try again.');
    } finally { setSaving(false); }
  };

  return (
    <main className="eylo-page mx-auto w-full max-w-5xl space-y-6">
      <Link to={'/projects/' + id} className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Back to {project?.title || 'project'}</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Project workspace</p><h1 className="mt-1 text-2xl font-heading font-bold text-foreground">Decision workspace</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Compare options against explicit criteria, keep sources with your reasoning, and record what you chose and when to review it.</p></div>
        <button type="button" onClick={startNew} disabled={!project || loading || saving || decisions.length >= 100} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"><Plus size={15} /> New decision</button>
      </header>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground"><span>{error}</span>{!loading && !saving && <button type="button" onClick={() => load({ discardDraft: false })} className="min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary">Reload project</button>}</div>}
      {notice && <p role="status" className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-foreground">{notice}</p>}
      {loading && <div role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Loading project decisions…</div>}
      {!loading && !error && ordered.length === 0 && !draft && <section className="rounded-2xl border border-dashed border-border bg-card/70 px-5 py-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarClock size={20} /></div><h2 className="mt-4 text-base font-semibold text-foreground">No decisions recorded yet</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Start with a real project question. Add alternatives, criteria and sources, then record your choice and return to review the outcome.</p><button type="button" onClick={startNew} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus size={14} /> Record a decision</button></section>}
      {draft && <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="decision-form-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="decision-form-heading" className="text-lg font-semibold text-foreground">{decisions.some((item) => item.id === draft.id) ? 'Edit decision' : 'New decision'}</h2><p className="mt-1 text-xs text-muted-foreground">This record follows the existing project owner access policy.</p></div><button type="button" onClick={() => setDraft(null)} disabled={saving} className="min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary">Cancel</button></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass} htmlFor="decision-title">Decision title</label><input id="decision-title" required maxLength={160} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} className={inputClass} placeholder="e.g. Select a study design" /></div>
          <div><label className={labelClass} htmlFor="decision-status">Status</label><select id="decision-status" value={draft.status} onChange={(event) => updateDraft({ status: event.target.value })} className={inputClass}>{DECISION_STATUSES.map((status) => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></div>
          <div className="sm:col-span-2"><label className={labelClass} htmlFor="decision-question">Question to resolve</label><textarea id="decision-question" required rows={2} maxLength={1200} value={draft.question} onChange={(event) => updateDraft({ question: event.target.value })} className={inputClass} placeholder="What needs to be decided, and what constraints matter?" /></div>
          <div><label className={labelClass} htmlFor="decision-review-date">Review date (optional)</label><input id="decision-review-date" type="date" value={draft.review_date} onChange={(event) => updateDraft({ review_date: event.target.value })} className={inputClass} /></div>
          <div><label className={labelClass} htmlFor="decision-choice">Chosen option (optional)</label><input id="decision-choice" maxLength={3000} value={draft.decision} onChange={(event) => updateDraft({ decision: event.target.value })} className={inputClass} placeholder="Record after you decide" /></div>
        </div>
        <ListEditor label="Alternatives" description="Keep options distinct and specific." items={draft.alternatives} onChange={(alternatives) => updateDraft({ alternatives })} placeholder="Option or course of action" />
        <ListEditor label="Criteria" description="List the considerations used to compare options. No composite score is calculated." items={draft.criteria} onChange={(criteria) => updateDraft({ criteria })} placeholder="Criterion, e.g. feasibility or cost" max={16} />
        <EvidenceEditor items={draft.evidence} onChange={(evidence) => updateDraft({ evidence })} />
        <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass} htmlFor="decision-rationale">Reasoning and trade-offs</label><textarea id="decision-rationale" rows={4} maxLength={6000} value={draft.rationale} onChange={(event) => updateDraft({ rationale: event.target.value })} className={inputClass} /></div><div><label className={labelClass} htmlFor="decision-outcome">Outcome or follow-up (optional)</label><textarea id="decision-outcome" rows={4} maxLength={3000} value={draft.outcome} onChange={(event) => updateDraft({ outcome: event.target.value })} className={inputClass} /></div></div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><button type="button" onClick={() => setDraft(null)} disabled={saving} className="min-h-10 rounded-lg border border-border px-4 text-sm hover:bg-secondary">Cancel</button><button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save size={14} /> {saving ? 'Saving…' : 'Save decision'}</button></div>
      </form>}
      {!loading && ordered.length > 0 && <section className="space-y-3" aria-label="Saved decisions"><h2 className="text-sm font-semibold text-foreground">Saved decisions <span className="ml-1 text-xs font-normal text-muted-foreground">({ordered.length})</span></h2>{ordered.map((decision) => <article key={decision.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground">{decision.title}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{decision.status}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{decision.question}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => edit(decision)} disabled={saving} className="min-h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary">Edit</button><button type="button" onClick={() => remove(decision)} disabled={saving} aria-label={'Delete ' + decision.title} className="grid min-h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button></div></div>
        {decision.review_date && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock size={13} /> Review by <time dateTime={decision.review_date}>{decision.review_date}</time></p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-secondary/40 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Alternatives</p><p className="mt-1 text-sm text-foreground">{decision.alternatives.length ? decision.alternatives.map((item) => item.text).join(' · ') : 'Not recorded'}</p></div><div className="rounded-lg bg-secondary/40 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Criteria</p><p className="mt-1 text-sm text-foreground">{decision.criteria.length ? decision.criteria.map((item) => item.text).join(' · ') : 'Not recorded'}</p></div><div className="rounded-lg bg-secondary/40 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sources</p><div className="mt-1 space-y-1">{decision.evidence.length ? decision.evidence.slice(0, 3).map((item) => <p key={item.id} className="truncate text-sm text-foreground">{item.claim} <span className="text-muted-foreground">— {item.source_label}</span>{item.source_url && <a className="ml-1 inline-flex text-primary hover:underline" href={item.source_url} target="_blank" rel="noreferrer" aria-label={'Open source ' + item.source_label + ' in a new tab'}><ExternalLink size={12} /></a>}</p>) : <p className="text-sm text-muted-foreground">No sources attached</p>}{decision.evidence.length > 3 && <p className="text-xs text-muted-foreground">+{decision.evidence.length - 3} more</p>}</div></div></div>
        {decision.decision && <p className="mt-3 text-sm"><span className="font-medium text-foreground">Recorded choice:</span> <span className="text-muted-foreground">{decision.decision}</span></p>}
        {(decision.rationale || decision.outcome) && <details className="mt-3 rounded-lg border border-border px-3 py-2"><summary className="min-h-8 cursor-pointer text-xs font-medium text-primary">Reasoning and follow-up</summary><div className="space-y-3 py-2 text-sm text-muted-foreground">{decision.rationale && <p className="whitespace-pre-wrap">{decision.rationale}</p>}{decision.outcome && <p className="whitespace-pre-wrap"><span className="font-medium text-foreground">Outcome: </span>{decision.outcome}</p>}</div></details>}
        <p className="mt-3 text-[11px] text-muted-foreground">{Number.isFinite(Date.parse(decision.updated_date)) ? 'Updated ' + new Date(decision.updated_date).toLocaleDateString() : 'Update date unavailable'}</p>
      </article>)}</section>}
      {!loading && !project && !error && <button type="button" onClick={() => load({ discardDraft: true })} className="min-h-10 rounded-lg border border-border px-4 text-sm hover:bg-secondary">Retry</button>}
      <p className="text-xs text-muted-foreground">Evidence is user-recorded. A saved source does not by itself establish that a claim is correct or that an option is scientifically superior.</p>
    </main>
  );
}
