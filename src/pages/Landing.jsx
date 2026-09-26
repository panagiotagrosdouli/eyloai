import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Brain, FileSearch, FolderKanban, Orbit, Search,
  ShieldCheck, Sparkles, Users, Zap,
} from 'lucide-react';
import ServiceStatus from '@/components/system/ServiceStatus';
import BrandLogo from '@/components/brand/BrandLogo';
import { trackSearchStarted } from '@/lib/product-analytics';

const EXAMPLES = [
  'AI for early cancer detection',
  'Climate adaptation in Mediterranean cities',
  'Solid-state battery recycling',
];

const CAPABILITIES = [
  { icon: FileSearch, title: 'Discover', text: 'Search live scholarly sources, researchers and institutions.' },
  { icon: BookOpen, title: 'Remember', text: 'Build a reusable evidence base instead of starting over every session.' },
  { icon: Brain, title: 'Reason', text: 'Use EYRA across saved evidence, projects and decisions with uncertainty visible.' },
  { icon: Zap, title: 'Act', text: 'Move from evidence to funding, collaboration, planning and research outputs.' },
];

const START_ACTIONS = [
  { icon: Search, label: 'Search the literature', href: '/discover' },
  { icon: Users, label: 'Find researchers', href: '/discover' },
  { icon: Zap, label: 'Find funding', href: '/register' },
  { icon: FolderKanban, label: 'Create a persistent workspace', href: '/register' },
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
    <main className="min-h-screen overflow-hidden bg-[#05070b] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#05070b]/88 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-[90rem] items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home"><BrandLogo brand="eylo" size="nav" priority /></Link>
          <div className="ml-auto hidden sm:block"><ServiceStatus /></div>
          <Link to="/discover" className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white md:inline-flex">Discover</Link>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">Sign in</Link>
          <Link to="/register" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5">Create workspace</Link>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-14 sm:px-8 sm:pb-32 sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-[-10rem] h-[50rem] w-[90rem] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.16),transparent_63%)]" />
        <div className="pointer-events-none absolute right-[-14rem] top-32 h-[36rem] w-[36rem] rounded-full bg-violet-500/[0.06] blur-3xl" />
        <div className="relative mx-auto grid max-w-[90rem] gap-12 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              <Orbit size={12} /> Research operating system
            </div>
            <h1 className="mt-7 max-w-5xl font-heading text-6xl font-semibold leading-[0.92] tracking-[-0.07em] text-white sm:text-8xl xl:text-[7.2rem]">
              The place your research keeps moving.
              <span className="mt-3 block text-slate-500">From question to evidence to action.</span>
            </h1>
            <form onSubmit={explore} className="mt-9 max-w-4xl rounded-2xl border border-white/10 bg-white/[0.045] p-2 shadow-2xl shadow-black/40 backdrop-blur">
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center">
                  <Search className="ml-3 shrink-0 text-slate-500" size={17} />
                  <input
                    id="research-question"
                    value={question}
                    onChange={event => setQuestion(event.target.value)}
                    placeholder="Ask a research question…"
                    className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-white outline-none placeholder:text-slate-600"
                  />
                </div>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-400">
                  Explore evidence <ArrowRight size={14} />
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Example questions">
              {EXAMPLES.map(example => (
                <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px] text-slate-500 hover:border-white/15 hover:text-white">{example}</button>
              ))}
            </div>
          </div>

          <aside className="overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0b0f16]/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="border-b border-white/[0.07] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">EYLO / today</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Start where the work is.</h2>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-label="Live" />
              </div>
            </div>
            <div className="divide-y divide-white/[0.07]">
              {START_ACTIONS.map(({ icon: Icon, label, href }) => (
                <Link key={label} to={href} className="group flex items-center gap-3 px-5 py-4 text-sm text-slate-300 hover:bg-white/[0.035] hover:text-white">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-slate-500 group-hover:text-cyan-300"><Icon size={15} /></span>
                  <span className="flex-1 font-medium">{label}</span>
                  <ArrowRight size={13} className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </Link>
              ))}
            </div>
            <div className="border-t border-white/[0.07] p-5">
              <div className="rounded-2xl border border-blue-400/10 bg-blue-400/[0.05] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><Sparkles size={14} /> EYRA works over your context</div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">Saved evidence and project context stay connected so the next session starts where the last one ended.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-px overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="bg-[#080b10] p-7">
                <div className="flex items-center justify-between">
                  <Icon size={18} className="text-cyan-300" />
                  <span className="font-mono text-[10px] text-slate-700">0{index + 1}</span>
                </div>
                <h3 className="mt-10 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-xs leading-5 text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-[90rem] gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-7 sm:p-9">
            <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-blue-500/[0.07] blur-3xl" />
            <BrandLogo brand="eylo" size="panel" />
            <h2 className="mt-12 max-w-md text-3xl font-semibold tracking-[-0.04em] text-white">The persistent research workspace.</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">Evidence, projects, people, opportunities and outputs stay connected over time.</p>
          </article>
          <article className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.025] p-7 sm:p-9">
            <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-violet-500/[0.07] blur-3xl" />
            <BrandLogo brand="eyra" size="panel" />
            <h2 className="mt-12 max-w-md text-3xl font-semibold tracking-[-0.04em] text-white">The intelligence layer across your work.</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">EYRA helps interrogate the context you have actually collected rather than treating every question as a blank chat.</p>
          </article>
        </div>
      </section>

      <section className="px-5 py-24 text-center sm:px-8 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <ShieldCheck size={20} className="mx-auto text-emerald-400" />
          <h2 className="mt-6 font-heading text-4xl font-semibold tracking-[-0.05em] text-white sm:text-7xl">Keep your research moving.</h2>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/discover" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Explore <ArrowRight size={14} /></Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-3 text-sm font-semibold text-white">Create workspace</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo brand="eylo" size="compact" />
          <div className="flex flex-wrap gap-5"><Link to="/discover" className="hover:text-white">Discover</Link><Link to="/login" className="hover:text-white">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div>
        </div>
      </footer>
    </main>
  );
}
