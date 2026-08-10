import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, BookOpen, Brain, Check, Database, FlaskConical,
  FolderOpen, Search, ShieldCheck, Sparkles, Video,
} from 'lucide-react';

const LIVE_CAPABILITIES = [
  {
    icon: Search,
    title: 'Live research discovery',
    text: 'Searches OpenAlex, arXiv, Europe PMC and Crossref, with links back to source records.',
  },
  {
    icon: Brain,
    title: 'Authenticated EYRA AI',
    text: 'Uses structured AI analysis while separating retrieved evidence, inference and assumptions.',
  },
  {
    icon: Database,
    title: 'Official funding search',
    text: 'Retrieves current Grants.gov notices, deadlines and official links before AI ranks relevance.',
  },
  {
    icon: FolderOpen,
    title: 'Private research workspace',
    text: 'Stores projects, papers, researchers, ideas, opportunities and meetings in your account.',
  },
  {
    icon: FlaskConical,
    title: 'Evidence-backed tools',
    text: 'Project intelligence, scenarios, team planning and impact assessment operate on supplied or retrieved evidence.',
  },
  {
    icon: Video,
    title: 'Working meeting actions',
    text: 'Creates joinable Jitsi rooms and provides a Google Calendar handoff for scheduled meetings.',
  },
];

const INCLUDED = [
  'Public multi-source paper discovery',
  'EYRA research and strategy analysis',
  'Projects, library, ideas and saved opportunities',
  'Official funding records and on-demand watchlists',
  'Researcher and institution discovery through OpenAlex',
  'Project Twin and Battlefield source scans',
  'Scenario, impact, team and startup planning tools',
  'Meeting preparation, debrief, video room and calendar handoff',
];

const FAQS = [
  {
    q: 'Does EYLO charge today?',
    a: 'No. EYLO is currently in early access and the available product is free to use while reliability, source coverage and researcher workflows are being validated.',
  },
  {
    q: 'Are there paid limits or trials?',
    a: 'No billing or paid entitlement system is active. EYLO does not claim monthly limits, trials or premium access that the product does not enforce.',
  },
  {
    q: 'Does EYRA invent papers or grants?',
    a: 'Specific papers, researchers and funding records come from connected sources. AI is used for analysis and ranking; source links and uncertainty remain visible so you can verify decisions.',
  },
  {
    q: 'Is monitoring automatic?',
    a: 'Not yet. Watchlists run an on-demand source check when you open or refresh them. The interface does not claim a background monitoring service.',
  },
  {
    q: 'What will happen before paid plans launch?',
    a: 'Billing, quotas, plan entitlements, cancellation and support commitments will be implemented and tested before prices or paid promises are published.',
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <section className="mx-auto max-w-3xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/5 px-3 py-1.5">
          <ShieldCheck size={12} className="text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Honest early access</span>
        </div>
        <h1 className="font-heading text-4xl font-black sm:text-6xl">
          Use what is real. <span className="impact-gradient">Pay nothing today.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          EYLO is in early access. Every capability listed here is available in the current product; paid plans will appear only after billing and access controls are genuinely implemented.
        </p>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-3xl border border-primary/30 bg-card"
      >
        <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl eyra-gradient">
              <Sparkles size={19} className="text-white" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-primary">EYLO Early Access</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-heading text-5xl font-black">$0</span>
              <span className="mb-1 text-sm text-muted-foreground">during early access</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Build a real research workspace, test EYRA on your topics, and help shape a product researchers can trust.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-xl eyra-gradient px-5 py-3 text-sm font-semibold text-white">
                Create workspace <ArrowRight size={14} />
              </Link>
              <Link to="/discover" className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold hover:bg-secondary">
                Try discovery <BookOpen size={14} />
              </Link>
            </div>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {INCLUDED.map((feature) => (
              <li key={feature} className="flex items-start gap-2 rounded-xl bg-secondary/30 p-3 text-xs leading-5 text-foreground/85">
                <Check size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      <section className="mt-16">
        <div className="mb-7 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Available now</p>
          <h2 className="mt-3 font-heading text-2xl font-bold sm:text-4xl">The current, verifiable product</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIVE_CAPABILITIES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={16} />
              </div>
              <h3 className="mt-4 font-heading text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-6 text-center font-heading text-2xl font-bold">Common questions</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group rounded-xl border border-border bg-card px-5 py-4">
              <summary className="cursor-pointer list-none text-sm font-semibold">{faq.q}</summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
