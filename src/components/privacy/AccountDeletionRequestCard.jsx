import React, { useEffect, useState } from 'react';
import { getUsableSession } from '@/lib/supabaseClient';

const REQUIRED_CONFIRMATION = 'REQUEST ACCOUNT DELETION';

async function requestStatus(method, confirmation) {
  const session = await getUsableSession({ required: true, validate: true });
  const response = await fetch('/api/account-deletion-request', {
    method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify({ confirmation }) } : {}),
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(
      response.status === 503
        ? 'Deletion requests are not yet available on this deployment.'
        : response.status === 401
          ? 'Please sign in again to view or submit a deletion request.'
          : 'We could not verify the request status. No account deletion was performed.',
    ), { status: response.status });
  }
  return result;
}

export default function AccountDeletionRequestCard() {
  const [phase, setPhase] = useState('loading');
  const [status, setStatus] = useState('not_requested');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    requestStatus('GET')
      .then(data => {
        if (!mounted) return;
        setStatus(data.request_status);
        setPhase('ready');
      })
      .catch(error => {
        if (!mounted) return;
        setMessage(error.message);
        setPhase(error.status === 503 ? 'unavailable' : 'error');
      });
    return () => { mounted = false; };
  }, []);

  const submit = async () => {
    if (confirmation !== REQUIRED_CONFIRMATION || phase !== 'ready' || status !== 'not_requested') return;
    setPhase('submitting');
    try {
      const data = await requestStatus('POST', confirmation);
      setStatus(data.request_status);
      setMessage('Your request was recorded for review. Your account and saved data have NOT been deleted. Your Stripe subscription, if any, is unchanged.');
      setConfirmation('');
      setPhase('ready');
    } catch (error) {
      setMessage(error.message);
      setPhase(error.status === 503 ? 'unavailable' : 'ready');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Request account deletion</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        A request is reviewed before any account or workspace data is removed.
        Some billing, security or legal records may need to be retained under applicable rules.
        Submitting a request does not sign you out, cancel subscriptions or delete data.
      </p>
      {phase === 'loading' && <p className="mt-3 text-xs text-muted-foreground" role="status">Checking request availability…</p>}
      {phase === 'unavailable' && <p className="mt-3 text-xs text-amber-400" role="status">Deletion request intake is not yet enabled. No deletion was attempted.</p>}
      {phase === 'error' && <p className="mt-3 text-xs text-amber-400" role="status">{message}</p>}
      {phase === 'ready' && status !== 'not_requested' && (
        <p className="mt-3 text-xs text-foreground" role="status">
          Request status: <strong>{status.replaceAll('_', ' ')}</strong>. Account deletion is not confirmed by this status.
        </p>
      )}
      {(phase === 'ready' || phase === 'submitting') && status === 'not_requested' && (
        <div className="mt-4 space-y-2">
          <label htmlFor="deletion-request-confirmation" className="block text-xs text-foreground">
            To submit a request, type <strong>{REQUIRED_CONFIRMATION}</strong>
          </label>
          <input
            id="deletion-request-confirmation"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            disabled={confirmation !== REQUIRED_CONFIRMATION || phase === 'submitting'}
            onClick={submit}
            className="rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === 'submitting' ? 'Recording request…' : 'Submit deletion request for review'}
          </button>
        </div>
      )}
      {message && phase === 'ready' && <p className="mt-3 text-xs text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}
