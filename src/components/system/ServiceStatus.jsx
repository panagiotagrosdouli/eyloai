import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleAlert, RefreshCw } from 'lucide-react';
import { useCapabilities } from '@/lib/capabilities';

const SERVICE_ROWS = [
  {
    key: 'ai',
    label: 'EYRA synthesis',
    ready: 'Live',
    waiting: 'Unavailable',
  },
  {
    key: 'billing',
    label: 'Payments',
    ready: 'Live',
    waiting: 'Early access',
  },
  {
    key: 'scheduled_monitoring',
    label: 'Automatic watchlists',
    ready: 'Live',
    waiting: 'Manual checks',
  },
  {
    key: 'institution_analytics',
    label: 'Institution analytics',
    ready: 'Live',
    waiting: 'Needs setup',
  },
];

export default function ServiceStatus({ compact = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error, refresh } = useCapabilities();
  const rootRef = useRef(null);

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
  const statusLabel = loading ? 'Checking' : error ? 'Status unknown' : aiReady ? 'EYRA live' : 'AI unavailable';

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
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Checked against this deployment. Research sources are checked separately on every query.</p>
            </div>
            <button type="button" onClick={refresh} disabled={loading} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Refresh service status">
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
        </div>
      )}
    </div>
  );
}
