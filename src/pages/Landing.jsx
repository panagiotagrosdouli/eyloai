import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Search,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { trackSearchStarted } from '@/lib/product-analytics';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;

const EXAMPLES = [
  'Help me explore AI in healthcare',
  'Find recent papers on climate adaptation',
  'Find researchers working on battery recycling',
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
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">Sign in</Link>
          <Link to={PROJECT_SIGNUP_HREF} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5">Get started</Link>
        </div>
      </header>

      <section className="relative flex min-h-[min(790px,calc(100svh-80px))] items-center px-5 py-20 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[580px] bg-[radial-gradient(ellipse_at_50%_25%,rgba(40,100,175,0.12),transparent_65%)]" />
        <div className="relative mx-auto w-full max-w-4xl text-center">
          <p className="text-xs font-medium tracking-[0.22em] text-cyan-300 uppercase">EYLO AI · Meet EYRA</p>
          <h1 className="mx-auto mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[1.06] tracking-[-0.055em] text-white sm:text-7xl">A better way to<br /><span className="text-slate-400">move research forward.</span></h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Discover papers, explore ideas and find the people who can help you build something real. No research experience required.</p>
          <form onSubmit={explore} className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/15 bg-white/[0.055] p-2 text-left shadow-xl shadow-black/20">
            <label htmlFor="research-question" className="sr-only">What would you like to research?</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center">
                <Search className="ml-3 shrink-0 text-slate-400" size={18} aria-hidden="true" />
                <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What would you like to explore?" className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-white outline-none placeholder:text-slate-500" />
              </div>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-100">Explore <ArrowRight size={16} /></button>
            </div>
          </form>
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2" aria-label="Example research topics">
            {EXAMPLES.map(example => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/25 hover:text-white">{example}</button>)}
          </div>
          <p className="mt-7 text-xs text-slate-500">Real scientific sources · Your projects in one place · EYRA by your side</p>
        </div>
      </section>

      <section className="border-t border-white/[0.07] px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="what-eylo-does">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div><p className="text-xs uppercase tracking-[0.18em] text-cyan-300">One connected workspace</p><h2 id="what-eylo-does" className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">From curiosity to collaboration.</h2></div>
            <Link to="/discover" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white">Explore EYLO <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-9 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-6"><p className="text-xs text-cyan-300">01 / DISCOVER</p><h3 className="mt-5 text-lg font-semibold">Find your evidence</h3><p className="mt-3 text-sm leading-6 text-slate-400">Explore real and recent papers, with help framing your question and investigating possible research gaps.</p></div>
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-6"><p className="text-xs text-cyan-300">02 / CONNECT</p><h3 className="mt-5 text-lg font-semibold">Find your people</h3><p className="mt-3 text-sm leading-6 text-slate-400">Discover researchers, potential PhD collaborators and relevant research institutions.</p></div>
            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-6"><p className="text-xs text-cyan-300">03 / BUILD</p><h3 className="mt-5 text-lg font-semibold">Make progress</h3><p className="mt-3 text-sm leading-6 text-slate-400">Bring papers, people, plans and your next steps into a project supported by EYRA.</p></div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] pt-8">
            <p className="max-w-lg text-sm leading-6 text-slate-400">EYRA helps with research and collaboration preparation. Contacting researchers or booking meetings requires your approval and connected services.</p>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">Start a project <ArrowRight size={15} /></Link>
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
