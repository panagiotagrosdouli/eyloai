import React from 'react';
import { ArrowRight, Loader2, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCapabilities } from '@/lib/capabilities';

const COPY = {
  institution_analytics: {
    eyebrow: 'Deployment capability',
    title: 'Institution analytics needs administrator setup.',
    description: 'The dashboard is implemented, but this deployment does not yet have the protected server credentials required to aggregate organization data safely.',
    action: 'Return to workspace',
    href: '/home',
  },
};

export default function CapabilityGate({ capability, children }) {
  const { data, loading, error, refresh } = useCapabilities();
  const content = COPY[capability] || {
    eyebrow: 'Service status',
    title: 'This service is not active on this deployment.',
    description: 'The rest of your EYLO workspace remains available.',
    action: 'Return to workspace',
    href: '/home',
  };

  if (loading) {
    return <div className="grid min-h-[55vh] place-items-center" role="status"><Loader2 className="animate-spin text-primary" /><span className="sr-only">Checking service availability</span></div>;
  }

  if (data[capability]) return children;

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 py-16 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border bg-card text-primary"><Settings2 size={20} /></div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{content.eyebrow}</p>
        <h1 className="mx-auto mt-3 max-w-2xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{content.title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{error || content.description}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to={content.href} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background">{content.action} <ArrowRight size={13} /></Link>
          <button type="button" onClick={refresh} className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground">Check again</button>
        </div>
      </div>
    </main>
  );
}
