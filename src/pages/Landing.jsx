import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, FileSearch, FolderKanban, Search, ShieldCheck,
  Sparkles, Users, Zap,
} from 'lucide-react';
import ServiceStatus from '@/components/system/ServiceStatus';
import BrandLogo from '@/components/brand/BrandLogo';
import { trackSearchStarted } from '@/lib/product-analytics';

const EXAMPLES = [
  'AI for early cancer detection',
  'Climate adaptation',
  'Battery recycling',
];

const SOURCES = ['OpenAlex', 'arXiv', 'Europe PMC', 'Crossref', 'Semantic Scholar'];

const CAPABILITIES = [
  { icon: FileSearch, title: 'Discover', text: 'Papers, researchers, institutions.' },
  { icon: BookOpen, title: 'Organize', text: 'Evidence, projects, decisions.' },
  { icon: Sparkles, title: 'Decide', text: 'Sourced reasoning with EYRA.' },
  { icon: Zap, title: 'Deliver', text: 'Grants, briefs, decks, plans.' },
];

const START_ACTIONS = [
  { icon: Search, label: 'Search evidence', href: '/discover' },
  { icon: Users, label: 'Find expertise', href: '/discover' },
  { icon: FolderKanban, label: 'Create a workspace', href: '/register' },
  { icon: Sparkles, label: 'Work with EYRA', href: '/register' },
];

export default function Landing() {
  const [question, setQuestion] = useState('');
  const navigate = useNavigate();

  const explore = event => {
    event?.preventDefault();
    const query = question.trim();
    if (query) trackSearchStarted('homepage');
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#07090d]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home"><BrandLogo brand="eylo" size="nav" priority /></Link>
          <div className="ml-auto hidden sm:block"><ServiceStatus /></div>
          <Link to="/discover" className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white md:inline-flex">Explore</Link>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">Sign in</Link>
          <Link to="/register" className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Start</Link>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[30rem] w-[60rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.11),transparent_68%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Research intelligence workspace</p>
            <h1 className="mt-6 max-w-4xl font-heading text-6xl font-semibold leading-[0.96] tracking-[-0.065em] text-white sm:text-8xl">
              Find the signal.
              <span className="block text-slate-500">Make the move.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              EYLO connects live research, your work and EYRA into one decisive flow.
            </p>

            <form onSubmit={explore} className="mt-9 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.035] p-2 shadow-2xl shadow-black/30">
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center">
                  <Search className="ml-3 shrink-0 text-slate-500" size={17} />
                  <input
                    id="research-question"
                    value={question}
                    onChange={event => setQuestion(event.target.value)}
                    placeholder="Ask a real question…"
                    className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-base text-white outline-none placeholder:text-slate-600"
                  />
                </div>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-400">
                  Explore <ArrowRight size={14} />
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Example questions">
              {EXAMPLES.map(example => (
                <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] text-slate-500 hover:text-white">{example}</button>
              ))}
            </div>
          </div>

          <aside className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d1119] shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <span className="text-xs font-semibold text-white">Start here</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Live" />
            </div>
            <div className="divide-y divide-white/[0.07]">
              {START_ACTIONS.map(({ icon: Icon, label, href }) => (
                <Link key={label} to={href} className="group flex items-center gap-3 px-5 py-4 text-sm text-slate-300 hover:bg-white/[0.035] hover:text-white">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-slate-500 group-hover:text-cyan-300"><Icon size={15} /></span>
                  <span className="flex-1 font-medium">{label}</span>
                  <ArrowRight size={13} className="text-slate-700 group-hover:text-slate-300" />
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3 text-[10px] text-slate-600"><ShieldCheck size={12} className="text-emerald-400" /> Source-linked. No invented records.</div>
          </aside>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {SOURCES.map(source => <span key={source} className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600">{source}</span>)}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">What EYLO does</p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.045em] text-white sm:text-6xl">Question to outcome.</h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, text }) => (
              <article key={title} className="bg-[#090c12] p-6">
                <Icon size={18} className="text-cyan-300" />
                <h3 className="mt-8 text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
            <BrandLogo brand="eylo" size="panel" />
            <h2 className="mt-8 text-2xl font-semibold text-white">The workspace.</h2>
            <p className="mt-3 text-sm text-slate-500">Evidence, projects and execution.</p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
            <BrandLogo brand="eyra" size="panel" />
            <h2 className="mt-8 text-2xl font-semibold text-white">The intelligence.</h2>
            <p className="mt-3 text-sm text-slate-500">Reasoning, challenge and next action.</p>
          </article>
        </div>
      </section>

      <section className="px-5 py-20 text-center sm:px-8 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-4xl font-semibold tracking-[-0.045em] text-white sm:text-6xl">Do the work.</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-slate-500">Start public. Save when it matters.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/discover" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Explore <ArrowRight size={14} /></Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white">Create workspace</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo brand="eylo" size="compact" />
          <div className="flex flex-wrap gap-5"><Link to="/discover" className="hover:text-white">Explore</Link><Link to="/login" className="hover:text-white">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div>
        </div>
      </footer>
    </main>
  );
}
