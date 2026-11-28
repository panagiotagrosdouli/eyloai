import React, { useMemo, useState } from 'react';
import { collectProjectScientificArtifacts, deriveScientificDashboardFindings, scientificSnapshotSignature } from '@/lib/project-scientific-review.mjs';
import { safeResearchSourceUrl } from '@/lib/research-source-url.mjs';

const readable = value => String(value || '').replaceAll('_', ' ');

export default function ScientificEvaluationPanel({ project, savedPapers }) {
  const snapshot = useMemo(() => collectProjectScientificArtifacts(project, savedPapers), [project, savedPapers]);
  const fingerprint = scientificSnapshotSignature(snapshot);
  const [draftNotes, setDraftNotes] = useState({ fingerprint: '', values: {} });
  const [showAbstracts, setShowAbstracts] = useState(false);
  const notes = draftNotes.fingerprint === fingerprint ? draftNotes.values : {};
  const findings = useMemo(() => deriveScientificDashboardFindings(snapshot), [snapshot]);
  const claims = snapshot.artifacts.flatMap(artifact => artifact.claims.map(claim => ({ ...claim, artifact: artifact.kind })));
  const byId = new Map(snapshot.sources.map(source => [source.id, source]));

  return <section aria-labelledby="scientific-evaluation-title" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
    <header>
      <h3 id="scientific-evaluation-title" className="text-lg font-semibold">Scientific evaluation</h3>
      <p className="mt-1 text-sm text-muted-foreground">Read-only inspection of saved project artifacts. Linked records and automated checks do not establish that scientific claims are true.</p>
    </header>
    <div role="status" className="rounded-lg border border-amber-500/30 p-3 text-sm">
      <strong>Scientific quality: NOT REVIEWED</strong>
      <p>{claims.length} statements across {snapshot.artifacts.length} research artifact types. Independent human evaluations: none verified.</p>
      <p className="mt-1 text-xs text-muted-foreground">Abstract access is not full-text verification. No source is automatically classified as semantically supporting a claim.</p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div><h4 className="font-semibold">Eight dimensions</h4>
        <ul className="mt-2 space-y-1 text-xs">{snapshot.dimensions.map(d => <li key={d}>{readable(d)} — not reviewed</li>)}</ul>
      </div>
      <div><h4 className="font-semibold">Semantic categories</h4>
        <ul className="mt-2 space-y-1 text-xs">{snapshot.semantic_labels.map(c => <li key={c}>{readable(c)} — not assigned</li>)}</ul>
      </div>
    </div>
    <div><h4 className="font-semibold">Automated provenance and completeness checks</h4>
      <p className="text-xs text-muted-foreground">Deterministic warnings only, not expert scientific ratings.</p>
      {findings.length ? <ul className="mt-2 space-y-2">{findings.map((f,i) => <li className="rounded-lg bg-secondary/30 p-2 text-xs" key={f.kind + ':' + i}><strong>{readable(f.kind)}: </strong>{f.message}</li>)}</ul>
        : <p className="mt-2 text-xs">No structural warnings found. Scientific quality remains unreviewed.</p>}
    </div>
    <div><h4 className="font-semibold">Project-linked source identities</h4>
      <button type="button" className="mt-2 min-h-10 rounded-lg border border-border px-3 text-xs" aria-expanded={showAbstracts} onClick={() => setShowAbstracts(v => !v)}>{showAbstracts ? 'Hide' : 'Show'} available abstract excerpts</button>
      {!snapshot.sources.length && <p className="mt-2 text-xs">No project-linked bibliographic sources yet.</p>}
      <ul className="mt-2 space-y-2">{snapshot.sources.map(source => {
        const paper = (savedPapers || []).find(p => String(p.id) === source.id && String(p.project_id) === snapshot.project_id);
        const href = paper && safeResearchSourceUrl(paper);
        return <li key={source.id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium">{source.title || 'Untitled record'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{source.authors || 'Author unknown'} · {source.year || 'Year unavailable'} · DOI {source.doi || 'not verified'} · {readable(source.access)}</p>
          <p className="text-xs text-muted-foreground">Metadata: not independently verified · Semantic support: not reviewed</p>
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline">Inspect publication record</a>}
          {showAbstracts && <p className="mt-2 whitespace-pre-wrap break-words bg-secondary/30 p-2 text-xs">{source.abstract || 'No accessible abstract saved.'}</p>}
        </li>;
      })}</ul>
    </div>
    <div><h4 className="font-semibold">Research claim inventory</h4>
      {!claims.length && <p className="mt-2 text-xs">No saved statements. Generate and save a draft to inspect its source links.</p>}
      <ul className="mt-2 space-y-3">{claims.slice(0,120).map(claim => {
        const key = claim.artifact + ':' + claim.id;
        return <li key={key} className="rounded-lg border border-border p-3 text-sm">
          <p className="text-xs font-semibold">{readable(claim.artifact)} · {claim.section || 'section'} · {claim.kind === 'proposal' ? 'proposed' : 'factual or interpretive'}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{claim.text}</p>
          <p className="mt-2 text-xs text-muted-foreground">Automated link status: {readable(claim.source_status)} · Scientific support: NOT REVIEWED</p>
          {claim.source_ids.length ? <ul className="mt-1 space-y-1">{claim.source_ids.map(id => <li key={id} className="text-xs">Linked citation: {byId.get(id)?.title || 'Source missing from this private project'}</li>)}</ul>
            : <p className="mt-1 text-xs">No source citation linked.</p>}
          <label className="mt-2 block text-xs" htmlFor={'scientific-note-' + key}>Unsaved researcher annotation</label>
          <textarea id={'scientific-note-' + key} rows={2} maxLength={1200} value={notes[key] || ''} onChange={event => setDraftNotes({ fingerprint, values: { ...notes, [key]: event.target.value } })} className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm" placeholder="Local observation only; not independent scientific review" />
        </li>;
      })}</ul>
      {claims.length > 120 && <p className="mt-2 text-xs text-muted-foreground">{claims.length - 120} further statements not rendered in this bounded view.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Annotations are temporary, not saved to any database. Edits to research artifacts invalidate the current annotation fingerprint; these notes cannot count as expert assessments.</p>
    </div>
    <p className="text-xs text-muted-foreground">Verified independent review history: none. Hosted staging and human scientific acceptance remain NOT RUN.</p>
  </section>;
}
