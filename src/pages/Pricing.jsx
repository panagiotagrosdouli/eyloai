import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Building2, Check, Crown, Loader2, Rocket, ShieldCheck, Sparkles, Zap,
} from 'lucide-react';
import { getBillingStatus, openBillingPortal, startCheckout } from '@/lib/billing';

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Sparkles,
    features: [
      'Public multi-source discovery',
      '1 project workspace',
      'Live paper and researcher discovery',
      'Evidence library and saved records',
      'EYRA access according to the active deployment',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$19',
    period: 'per month',
    icon: Zap,
    features: [
      'Unlimited EYRA AI actions',
      'Unlimited project workspaces',
      'Official funding Radar and watchlists',
      'EYRA Voice sourced assistant',
      'Executive Briefing and Project Twin',
      'Research Battlefield and Future Simulator',
      'Evidence-backed Impact Assessment',
    ],
  },
  {
    key: 'founder',
    name: 'Founder',
    price: '$49',
    period: 'per month',
    icon: Rocket,
    features: [
      'Everything in Pro',
      'Grant Builder and application tracker',
      'Pitch Deck AI with PDF export',
      'Dream Team candidate discovery',
      'Startup planning with evidence',
      'Funding and project execution workspace',
    ],
  },
  {
    key: 'institution',
    name: 'Institution',
    price: 'Custom',
    period: 'per organization',
    icon: Building2,
    features: [
      'Everything in Founder',
      'Institution analytics dashboard',
      'Organization-level activity metrics',
      'Manual role and entitlement provisioning',
      'Billing and rollout configuration',
    ],
  },
];

export default function Pricing() {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workingPlan, setWorkingPlan] = useState('');
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getBillingStatus().then(setBilling).catch(loadError => setError(loadError?.message || 'Could not load billing.')).finally(() => setLoading(false));
  }, []);

  const checkout = async (plan) => {
    if (workingPlan || openingPortal) return;
    setWorkingPlan(plan);
    setError('');
    try {
      await startCheckout(plan);
    } catch (checkoutError) {
      setError(checkoutError?.message || 'Checkout could not start.');
      setWorkingPlan('');
    }
  };

  const openPortal = async () => {
    if (openingPortal || workingPlan) return;
    setOpeningPortal(true);
    setError('');
    try {
      await openBillingPortal();
    } catch (portalError) {
      setError(portalError?.message || 'Billing portal could not open.');
      setOpeningPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12" role="status" aria-live="polite">
        <div className="mx-auto h-10 w-44 animate-pulse rounded bg-secondary" />
        <div className="mx-auto mt-4 h-4 w-72 animate-pulse rounded bg-secondary/70" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-[29rem] animate-pulse rounded-2xl border border-border bg-card" />)}
        </div>
        <span className="sr-only">Loading plans and billing status</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Account access</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Plans</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Choose the workspace level you need. Access is enforced by the authenticated billing entitlement, not by the browser.
        </p>
        {billing && (
          <p className="mt-4 text-xs text-muted-foreground">
            Current plan: <span className="font-semibold uppercase text-foreground">{billing.plan}</span> · status {billing.subscription_status}
          </p>
        )}
      </header>

      {!billing?.billing_configured && (
        <div className="mx-auto mt-7 max-w-3xl rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-200">
          Early access is active. The tier structure and displayed prices are product configuration, but checkout is disabled until Stripe prices, webhook verification, and server-side entitlements are fully configured.
        </div>
      )}
      {error && <div className="mx-auto mt-5 max-w-3xl rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}

      <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan, index) => {
          const Icon = plan.icon;
          const current = billing?.plan === plan.key;
          const isCheckout = ['pro', 'founder'].includes(plan.key);
          return (
            <motion.article
              key={plan.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 ${current ? 'border-primary/35' : 'border-border'}`}
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-muted-foreground"><Icon size={17} aria-hidden="true" /></div>
              <h2 className="mt-4 font-heading text-lg font-bold">{plan.name}</h2>
              <div className="mt-2"><span className="text-3xl font-black">{plan.price}</span><span className="ml-2 text-[10px] text-muted-foreground">{plan.period}</span></div>
              <ul className="my-6 flex-1 space-y-2.5">{plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-xs leading-5 text-foreground/80"><Check size={13} className="mt-0.5 shrink-0 text-emerald-400" />{feature}</li>)}</ul>

              {current ? (
                <button disabled className="w-full rounded-xl border border-primary/30 bg-primary/5 py-2.5 text-xs font-semibold text-primary">Current plan</button>
              ) : isCheckout ? (
                <button
                  onClick={() => checkout(plan.key)}
                  disabled={!billing?.billing_configured || !!workingPlan}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {workingPlan === plan.key ? <Loader2 size={13} className="animate-spin" /> : <Crown size={13} aria-hidden="true" />}
                  {billing?.billing_configured ? `Choose ${plan.name}` : 'Checkout unavailable'}
                </button>
              ) : plan.key === 'institution' ? (
                <button disabled className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground">Institution setup required <ArrowRight size={12} /></button>
              ) : (
                <button disabled className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground">Included by default</button>
              )}
            </motion.article>
          );
        })}
      </section>

      {billing?.plan !== 'free' && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={openPortal}
            disabled={!billing.billing_configured || openingPortal || !!workingPlan}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-40"
          >
            {openingPortal && <Loader2 size={13} className="animate-spin" />}
            {openingPortal ? 'Opening billing…' : 'Manage subscription in Stripe'}
          </button>
        </div>
      )}

      <section className="mx-auto mt-14 max-w-3xl border-t border-border pt-8">
        <h2 className="font-heading text-lg font-semibold">Billing integrity</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            'Checkout Sessions are created server-side; secret keys never reach the browser.',
            'Stripe webhook signatures are verified before a plan changes.',
            'Cancellation or failed status returns the entitlement to Free.',
            'The UI reads the authenticated entitlement rather than trusting a query string.',
          ].map(item => <div key={item} className="flex items-start gap-2 rounded-xl bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-primary" />{item}</div>)}
        </div>
      </section>
    </div>
  );
}
