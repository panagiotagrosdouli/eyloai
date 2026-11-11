import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, RefreshCw } from 'lucide-react';
import { useCapabilities } from '@/lib/capabilities';

const SERVICE_ROWS = [
  {
    key: 'ai',
    label: 'EYRA synthesis',
    ready: 'Configured',
    waiting: 'Unavailable',
  },
  {
    key: 'billing',
    label: 'Payments',
    ready: 'Configured',
    waiting: 'Early access',
  },
  {
    key: 'scheduled_monitoring',
    label: 'Automatic watchlists',
    ready: 'Configured',
    waiting: 'Manual checks',
  },
  {
    key: 'institution_analytics',
    label: 'Institution analytics',
    ready: 'Configured',
    waiting: 'Needs setup',
  },
];

export default function ServiceStatus({ compact = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const [deployment, setDeployment] = useState(null);
  const [deploymentError, setDeploymentError] = useState('');
  const [deploymentLoading, setDeploymentLoading] = useState(false);
  const [deploymentAttempt, setDeploymentAttempt] = useState(0);
  const { data, loading, error, refresh } = useCapabilities();
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setDeploymentLoading(true);
    setDeploymentError('');
    fetch('/api/deployment-status', { method: 'GET', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Deployment identity could not be retrieved.');
        const data = await response.json();
        if (!data || typeof data !== 'object' || typeof data.provenance_verified !== 'boolean') {
          throw new Error('Deployment identity response is invalid.');
        }
        if (data.deployment_sha !== null && !/^[a-f0-9]{40}$/i.test(data.deployment_sha)) {
          throw new Error('Deployment commit identifier is invalid.');
        }
        return data;
      })
      .then(data => { if (!controller.signal.aborted) setDeployment(data); })
      .catch(() => { if (!controller.signal.aborted) setDeploymentError('Deployed revision could not be verified.'); })
      .finally(() => { if (!controller.signal.aborted) setDeploymentLoading(false); });
    return () => controller.abort();
  }, [open, deploymentAttempt]);

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeWithKeyboard = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeWithKeyboard);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeWithKeyboard);
    };
  }, []);

  const aiReady = !loading && !error && data.ai;
  const statusLabel = loading ? 'Checking' : error ? 'Status unknown' : aiReady ? 'EYRA configured' : 'AI unavailable';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-border bg-card/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      >
        <span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-amber-400' : aiReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {!compact && <span>{statusLabel}</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border bg-popover p-4 shadow-2xl shadow-black/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Service availability</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Configuration checked against this deployment; actual AI calls and research sources are verified separately.</p>
            </div>
            <button type="button" onClick={() => { refresh(); setDeploymentAttempt(value => value + 1); }} disabled={loading || deploymentLoading} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Refresh service status">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100">
              <CircleAlert size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-border/70 border-y border-border/70">
              {SERVICE_ROWS.map(service => {
                const available = data[service.key];
                return (
                  <div key={service.key} className="flex items-center justify-between gap-3 py-3 text-xs">
                    <span className="text-foreground/85">{service.label}</span>
                    <span className={`inline-flex items-center gap-1.5 font-medium ${available ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {available && <CheckCircle2 size={12} aria-hidden="true" />}
                      {available ? service.ready : service.waiting}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted-foreground" aria-label="Deployment revision">
            <p className="font-semibold text-foreground">Deployed revision</p>
            {deploymentLoading ? (
              <p role="status">Checking deployed Git revision…</p>
            ) : deploymentError ? (
              <p role="status">{deploymentError}</p>
            ) : deployment?.provenance_verified && deployment.deployment_sha ? (
              <p>
                {deployment.environment === 'production' ? 'Production' : deployment.environment || 'Unknown environment'} ·
                {' '}<a href={`https://github.com/panagiotagrosdouli/eyloai/commit/${deployment.deployment_sha}`}
                  target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {deployment.deployment_sha.slice(0, 10)}
                </a>
                {' '}— Git identity only; not proof that services work.
              </p>
            ) : (
              <p role="status">Not verified. This deployment did not report a Git revision.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
