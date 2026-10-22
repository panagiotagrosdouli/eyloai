import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { protectedApiFetch } from '@/lib/protected-api';
import { ShieldCheck, Users, CreditCard, Activity } from 'lucide-react';

export default function OwnerConsole() {
  const [state, setState] = useState({ loading: true, allowed: false, error: '' });
  useEffect(() => {
    let live = true;
    protectedApiFetch('/api/owner-status').then(async response => {
      const data = await response.json().catch(() => ({}));
      if (live) setState({ loading: false, allowed: response.ok && data.owner === true, error: response.ok ? '' : (data.error || 'Access denied') });
    }).catch(() => {
      if (live) setState({ loading: false, allowed: false, error: 'Cannot verify owner permissions right now.' });
    });
    return () => { live = false; };
  }, []);
  if (state.loading) return <div className="eylo-page" role="status">Verifying owner access…</div>;
  if (!state.allowed) return <main className="eylo-page max-w-2xl"><h1 className="eylo-page-heading">Owner access</h1><p role="alert" className="mt-4 text-sm text-muted-foreground">{state.error}</p><p className="mt-3 text-sm text-muted-foreground">An authorized database administrator must verify your existing account and provision its owner role. Your subscription plan does not grant owner rights.</p><Link to="/home" className="mt-5 inline-block text-primary underline">Return home</Link></main>;
  return <main className="eylo-page">
    <div className="flex items-center gap-3"><ShieldCheck className="text-primary" size={24}/><h1 className="eylo-page-heading">Founder & Owner Console</h1></div>
    <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Your owner role has been verified by the server. Management links below only open existing authenticated EYLO tools; sensitive organization-wide operations require additional secured APIs.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <Link to="/institution" className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40"><Users className="mb-4 text-primary"/><strong>Workspace analytics</strong><p className="mt-2 text-xs text-muted-foreground">Available institution and workspace metrics</p></Link>
      <Link to="/pricing" className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40"><CreditCard className="mb-4 text-primary"/><strong>Plans & billing</strong><p className="mt-2 text-xs text-muted-foreground">Inspect customer-facing plans; no privileged billing actions exposed here</p></Link>
      <Link to="/settings" className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40"><Activity className="mb-4 text-primary"/><strong>Platform settings</strong><p className="mt-2 text-xs text-muted-foreground">Existing account configuration</p></Link>
    </div>
  </main>;
}
