import React, { useMemo, useState } from 'react';
import { planProjectReconciliation, resolveProjectReconciliation } from '@/lib/project-conflict-recovery.mjs';

function DisplayValue({ value }) {
  return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-3 text-xs">{value || '(empty)'}</pre>;
}

export default function ProjectConflictRecovery({ base, local, latest, onPrepare, onDiscard, onRetryLoad, busy }) {
  const [choices, setChoices] = useState({});
  const plan = useMemo(() => planProjectReconciliation(base, local, latest), [base, local, latest]);
  const unresolved = plan.conflicts.filter(row => !['mine', 'latest'].includes(choices[row.id]));

  const prepare = () => {
    if (unresolved.length || busy) return;
    const draft = resolveProjectReconciliation(base, local, latest, choices);
    onPrepare(draft, latest);
  };

  return (
    <section role="alert" aria-label="Project save conflict" className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <h2 className="text-base font-semibold">This project was updated elsewhere</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your unsaved draft is still in the editor. Compare your changes with the latest saved version.
        Choose which text to keep wherever both versions changed the same field.
        Preparing a new draft does not save anything automatically.
      </p>
      <p className="mt-2 text-xs">{plan.localChanges} local changes · {plan.remoteChanges} changes in the saved project · {plan.conflicts.length} overlapping fields</p>
      {plan.fields.length === 0 && <p className="mt-3 text-xs">No differences found. The saved project version changed for another reason.</p>}
      <div className="mt-4 space-y-4">
        {plan.fields.map(field => (
          <div key={field.id} className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-sm font-semibold">{field.label}{field.conflict ? ' · Both versions changed' : ''}</h3>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div><p className="mb-1 text-xs font-medium">Your unsaved draft</p><DisplayValue value={field.mine} /></div>
              <div><p className="mb-1 text-xs font-medium">Latest saved value</p><DisplayValue value={field.latest} /></div>
            </div>
            {field.conflict && (
              <fieldset className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                <legend className="mb-1 font-semibold">Choose a value for {field.label}</legend>
                {['mine', 'latest'].map(choice => (
                  <label key={choice} className="inline-flex min-h-9 items-center gap-2">
                    <input type="radio" name={'resolution-' + field.id}
                      checked={choices[field.id] === choice}
                      onChange={() => setChoices(previous => ({ ...previous, [field.id]: choice }))}/>
                    {choice === 'mine' ? 'Keep my draft' : 'Use latest saved value'}
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={prepare} disabled={busy || !!unresolved.length}
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          Prepare reconciled draft (then Save)
        </button>
        <button type="button" onClick={onDiscard} disabled={busy}
          className="min-h-11 rounded-lg border border-border px-4 text-sm">Discard my draft and load latest</button>
        <button type="button" onClick={onRetryLoad} disabled={busy}
          className="min-h-11 rounded-lg border border-border px-4 text-sm">Check for newer saved version</button>
      </div>
      {unresolved.length > 0 && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
        Resolve {unresolved.length} overlapping field(s) to prepare your draft.
      </p>}
    </section>
  );
}
