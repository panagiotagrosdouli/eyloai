import React, { useState } from 'react';
import { GAP_REVIEW_STATUSES } from '@/lib/gap-candidate-review.mjs';

const LABELS = {
  candidate_needs_human_review: 'Awaiting human review',
  needs_more_evidence: 'Needs more evidence',
  selected_for_followup: 'Selected for further investigation',
  rejected_after_review: 'Rejected after human review',
};

export default function GapCandidateReviewItem({ candidate, index, saving, onReview, onRemove }) {
  const [status, setStatus] = useState(candidate.review_status || 'candidate_needs_human_review');
  const [note, setNote] = useState(candidate.reviewer_note || '');
  const dirty = status !== (candidate.review_status || 'candidate_needs_human_review')
    || note !== (candidate.reviewer_note || '');
  return (
    <article className="rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold">{candidate.question || 'Untitled candidate'}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{candidate.uncertainty || 'Scientific uncertainty not documented.'}</p>
      <p className="mt-2 text-xs font-medium">Supporting saved papers</p>
      <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
        {(candidate.supporting_papers || []).map(paper => (
          <li key={paper.paper_id}>{paper.title || paper.paper_id}{paper.doi ? ` · DOI ${paper.doi}` : ''}</li>
        ))}
      </ul>
      {(candidate.counterevidence_papers || []).length > 0 && (
        <>
          <p className="mt-2 text-xs font-medium">Counterevidence saved papers</p>
          <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
            {candidate.counterevidence_papers.map(paper => (
              <li key={paper.paper_id}>{paper.title || paper.paper_id}{paper.doi ? ` · DOI ${paper.doi}` : ''}</li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-[15rem_1fr]">
        <label className="text-xs font-medium">
          Researcher review decision
          <select aria-label={`Review decision for candidate ${index + 1}`} value={status} disabled={saving}
            onChange={event => setStatus(event.target.value)}
            className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-2">
            {GAP_REVIEW_STATUSES.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium">
          Researcher rationale / additional evidence
          <textarea value={note} disabled={saving} rows={3} maxLength={2000}
            onChange={event => setNote(event.target.value)}
            placeholder="Explain the decision, unresolved literature, counterevidence or next review steps"
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={saving || !dirty}
          onClick={() => onReview(index, candidate, status, note)}
          className="min-h-10 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? 'Saving…' : 'Save human review'}
        </button>
        <button type="button" disabled={saving}
          onClick={() => { if (window.confirm('Remove this saved candidate from the project?')) onRemove(index, candidate); }}
          className="min-h-10 rounded-lg border border-destructive/40 px-3 text-xs font-semibold text-destructive disabled:opacity-50">
          Remove candidate
        </button>
        {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved review changes</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {LABELS[candidate.review_status] || LABELS.candidate_needs_human_review}
        {candidate.reviewed_at ? ` · Reviewed ${candidate.reviewed_at.slice(0, 10)}` : ''}
        — Human assessment, not a verified literature gap.
      </p>
    </article>
  );
}
