import React, { useEffect, useState } from 'react';
import { Crown, Loader2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBillingStatus, hasPlan } from '@/lib/billing';

export default function PlanGate({ minimum = 'pro', children }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getBillingStatus().then(setStatus).catch(loadError => setError(loadError?.message || 'Could not verify plan access.'));
  }, []);

  if (!status && !error) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (error) return <div className="mx-auto max-w-lg px-4 py-20"><div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">{error}</div></div>;
  if (!status.billing_configured) {
    return (
      <>
        <div className="mx-auto mt-4 max-w-6xl rounded-xl border border-border bg-card/60 px-4 py-2 text-center text-[10px] text-muted-foreground">
          Early access · this tool is open while paid plans are inactive on this deployment.
        </div>
        {children}
      </>
    );
  }
  if (hasPlan(status.plan, minimum)) return children;

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Crown size={23} /></div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-primary">{minimum} plan</p>
      <h1 className="mt-2 font-heading text-3xl font-black">This working tool is included in {minimum}.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Your current plan is {status.plan}. Access is read from the authenticated billing entitlement stored on your account.</p>
      {!status.billing_configured && <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left text-xs text-amber-200"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Checkout is not configured on this deployment yet. The pricing page lists the exact configuration still required.</div>}
      <Link to="/pricing" className="mt-6 inline-flex items-center gap-2 rounded-xl eyra-gradient px-5 py-3 text-sm font-semibold text-white">View plans</Link>
    </div>
  );
}
