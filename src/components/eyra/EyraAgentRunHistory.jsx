import React from 'react';

/**
 * Presentation-only, owner-scoped run ledger viewer.
 * Cancellation is cooperative and cannot undo an already attempted write.
 * The parent is responsible for authentication, request epochs and mutations.
 */
export default function EyraAgentRunHistory({
  open, runs, selected, busy, error,
  onRefresh, onInspect, onCancel, onReviewStale, onDelete,
}) {
  if (!open) return null;
  return (
    <section aria-label="EYRA agent runs" className="mb-2 max-h-56 overflow-y-auto rounded-lg border border-border p-2 text-xs">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold">Agent run history</span>
        <button type="button" onClick={onRefresh}
          disabled={busy} className="rounded-md border border-border px-2 py-1">Refresh</button>
      </div>
      {error && <p role="alert" className="mb-2 text-destructive">{error}</p>}
      {!error && !busy && runs.length === 0 && (
        <p className="text-muted-foreground">No recorded agent runs in this environment.</p>
      )}
      {runs.map(item => (
        <div key={item.id} className="mb-1 flex flex-wrap items-center gap-2 border-b border-border/70 py-1">
          <span className="min-w-0 flex-1 truncate">{item.input_preview || item.id}</span>
          <span className="font-medium">{item.status}</span>
          <button type="button" onClick={() => onInspect(item.id)}
            disabled={busy} className="rounded-md border border-border px-2 py-1">Details</button>
        </div>
      ))}
      {selected && (
        <div className="mt-2 rounded-md border border-border bg-secondary/20 p-2">
          <p className="font-semibold">Run: {selected.run.id}</p>
          <p>Status: {selected.run.status}</p>
          <p className="break-words">Response: {selected.run.response_text || 'No recorded final response.'}</p>
          {selected.actions.map(action => (
            <p key={action.id} className="break-words">
              {action.tool_name}: {action.status}
              {action.status === 'needs_review' ? ' — inspect the saved record before retrying.' : ''}
            </p>
          ))}
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.run.status === 'running' ? (
              <>
                <button type="button" disabled={busy}
                  className="rounded-md border border-border px-2 py-1"
                  onClick={() => onCancel(selected.run.id)}>Request cancellation</button>
                <button type="button" disabled={busy}
                  className="rounded-md border border-border px-2 py-1"
                  onClick={() => onReviewStale(selected.run.id)}>Review stale run (30+ min)</button>
              </>
            ) : (
              <button type="button" disabled={busy}
                className="rounded-md border border-border px-2 py-1"
                onClick={() => onDelete(selected.run.id)}>Delete run history</button>
            )}
          </div>
        </div>
      )}
      <p className="mt-2 text-muted-foreground">
        Cancellation is cooperative. A previously initiated external write may still complete.
      </p>
    </section>
  );
}
