import React from 'react';

/**
 * Reviews the user's requested *intent* before the AI runs.
 * NOT an exact-field preview of the model's proposed record. Server-side
 * authentication, write-intent validation and RLS remain mandatory.
 */
export default function EyraWriteIntentReview({ review, onCancel, onEdit, onConfirm }) {
  if (!review) return null;
  return (
    <section role="group" aria-label="Review EYRA write request"
      className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground">
      <p className="font-semibold">Review before sending a workspace write</p>
      <p className="mt-1 text-muted-foreground">
        EYRA may {review.writeIntent.project ? 'create a project' : 'save a paper'}
        {review.writeIntent.project && review.writeIntent.paper ? ' and save a paper' : ''}.
        This confirms your requested intent only, not the exact record fields. The model will choose the proposed record fields.
        Verify the resulting record after completion.
      </p>
      <p className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border p-2">
        {review.content}
      </p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" aria-label="Cancel pending EYRA write" className="rounded-lg border border-border px-3 py-2"
          onClick={onCancel}>Cancel</button>
        <button type="button" aria-label="Edit pending EYRA write" className="rounded-lg border border-border px-3 py-2"
          onClick={onEdit}>Edit</button>
        <button type="button" aria-label="Confirm and send EYRA write" className="rounded-lg bg-primary px-3 py-2 text-primary-foreground"
          onClick={onConfirm}>Confirm and send</button>
      </div>
    </section>
  );
}
