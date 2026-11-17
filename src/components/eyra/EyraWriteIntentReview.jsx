import React from 'react';

/**
 * Reviews the user's requested *intent* before the AI runs.
 * NOT an exact-field preview of the model's proposed record. Server-side
 * authentication, write-intent validation and RLS remain mandatory.
 */
export default function EyraWriteIntentReview({ review, onCancel, onEdit, onConfirm, onPreview, onApprove, preview }) {
  if (!review) return null;
  const busy = preview?.status === 'loading' || preview?.status === 'committing';
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
      {(preview?.status === 'ready' || preview?.status === 'committing') && (
        <div role="status" aria-label="EYRA proposed record fields"
          className="mt-2 rounded-lg border border-border bg-background p-2">
          <p className="font-semibold">Exact fields proposed by EYRA — draft only</p>
          {preview.status === 'committing' && <p role="status">Submitting exactly these fields. Do not retry; an already started write may still finish.</p>}
          {preview.proposals.length === 0 && <p>No record was proposed. Nothing was saved.</p>}
          {preview.proposals.map((proposal, index) => (
            <div key={proposal.tool + ':' + index} className="mt-2">
              <p className="font-medium">{proposal.tool}</p>
              {Object.entries(proposal.fields).map(([field, value]) => (
                <p key={field} className="mt-1 break-words whitespace-pre-wrap">
                  <strong>{field}:</strong> {String(value)}
                </p>
              ))}
            </div>
          ))}
          <p className="mt-2 text-muted-foreground">
            These are proposed fields, not a saved record. Exact-field execution is available only
            if an authenticated, expiring approval token and verified durable ledger are enabled.
          </p>
          {!preview.approvalToken && (
            <p className="mt-2 text-muted-foreground">
              Exact-field execution approval is not active in this environment. To avoid
              changing fields after review, this preview cannot be confirmed here.
              Edit your request or cancel instead.
            </p>
          )}
        </div>
      )}
      {preview?.status === 'error' && <p role="alert" className="mt-2 text-destructive">{preview.error}</p>}
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button type="button" aria-label="Cancel pending EYRA write" className="rounded-lg border border-border px-3 py-2"
          onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" aria-label="Edit pending EYRA write" className="rounded-lg border border-border px-3 py-2"
          onClick={onEdit} disabled={busy}>Edit</button>
        <button type="button" aria-label="Preview EYRA proposed write fields without saving"
          disabled={busy} className="rounded-lg border border-border px-3 py-2"
          onClick={onPreview}>{preview?.status === 'loading' ? 'Preparing preview…' : preview?.status === 'committing' ? 'Saving reviewed fields…' : 'Preview fields (no save)'}</button>
        {preview?.status === 'committing' ? null : preview?.status === 'ready' ? (
          preview.approvalToken && preview.proposals.length === 1 ? (
            <button type="button" aria-label="Approve exactly the displayed EYRA fields"
              className="rounded-lg bg-primary px-3 py-2 text-primary-foreground"
              onClick={onApprove}>Approve exactly these fields</button>
          ) : null
        ) : preview?.status !== 'loading' ? (
          <button type="button" aria-label="Confirm and send EYRA write"
            className="rounded-lg bg-primary px-3 py-2 text-primary-foreground"
            onClick={onConfirm}>Confirm and send (fields may differ)</button>
        ) : null}
      </div>
    </section>
  );
}
