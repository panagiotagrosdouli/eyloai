import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, BookOpen, CheckCircle2, FolderOpen, Sparkles, CalendarCheck, Compass } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';
import './eylo-approved-scene.css';
import './eylo-reference-live.css';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;

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
    <main id="main-content" className="min-h-screen bg-[#fcfdff] text-[#0d2440]">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to research search</a>
      <div className="eylo-scene relative isolate overflow-hidden">
        <div className="eylo-scene-landscape pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <div className="eylo-photographic-backdrop pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <header className="relative z-20">
          <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-3 px-5 sm:px-8">
            <Link to="/" aria-label="EYLO home" className="mr-auto shrink-0">
              <img src="/brand/eylo-light.svg" alt="EYLO" width="180" height="54" className="h-10 w-auto max-w-[130px] object-contain sm:h-12 sm:max-w-[180px]" fetchPriority="high" />
            </Link>
            <Link to="/discover" className="px-1 py-2 text-xs text-[#17375c] hover:text-[#226fba] sm:px-3 sm:text-sm">Discover</Link>
            <a href="#how-it-works" className="hidden px-3 py-2 text-sm text-[#17375c] hover:text-[#226fba] sm:inline-flex">How it works</a>
            <Link to="/contact" className="hidden px-3 py-2 text-sm text-[#17375c] hover:text-[#226fba] md:inline-flex">Contact</Link>
            <Link to="/login" className="rounded-full border border-[#507ba4] bg-white/45 px-4 py-2 text-xs text-[#17375c] transition hover:bg-white/80 sm:px-7 sm:text-sm">Sign in</Link>
          </div>
        </header>
        <section className="relative flex min-h-[calc(100svh-76px)] flex-col items-center justify-center px-5 pb-12 pt-8 text-center sm:px-8 sm:py-12">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
            <img src="/brand/eylo-stacked.svg" alt="EYLO" width="520" height="270" className="eylo-hero-emblem h-auto w-[min(46vw,190px)] object-contain sm:w-[220px]" fetchPriority="high" />
            <p className="eylo-hero-intro mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#235c91] sm:text-xs">AI-powered research workspace</p>
            <h1 className="eylo-hero-intro mt-4 max-w-4xl font-serif text-[clamp(2.2rem,4.5vw,4.1rem)] font-normal leading-[1.1] tracking-[-0.04em] text-[#0c2850]">Discover research. Connect ideas. Advance science.</h1>
            <p className="eylo-hero-intro mt-5 max-w-2xl text-base leading-7 text-[#244768] sm:text-lg">Explore scientific literature, discover relevant researchers, and turn evidence into structured research projects with EYRA.</p>
            <form onSubmit={explore} role="search" className="eylo-hero-intro mt-7 flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-[#a8c6e0] bg-white/95 p-2 shadow-[0_12px_35px_-18px_rgba(12,40,80,.4)] focus-within:ring-2 focus-within:ring-[#2779b9]">
              <Search className="ml-3 shrink-0 text-[#51789b]" size={19} aria-hidden="true" />
              <label htmlFor="research-question" className="sr-only">Ask a research question or search scientific literature</label>
              <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a research question…" className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-[#0c2850] outline-none placeholder:text-[#67829c] sm:text-base" />
              <button type="submit" aria-label="Search scientific research" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#153c72] text-white transition hover:bg-[#25578d]"><ArrowRight size={20} /></button>
            </form>
            <div className="eylo-hero-intro mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs text-[#355a7c]">
              <span>Try a topic:</span>
              {['Visual-Inertial SLAM', 'Autonomous Systems', 'AI for Healthcare'].map(topic => (
                <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate(`/discover?q=${encodeURIComponent(topic)}`); }} className="min-h-9 rounded-full border border-[#a8c6e0] bg-white/70 px-3 font-medium hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c68a0]">{topic}</button>
              ))}
            </div>
            <div className="eylo-hero-intro mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <Link to="/discover" className="eylo-scene-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#092c57] to-[#287cbd] px-8 py-3 text-sm font-semibold text-white hover:brightness-110 sm:w-auto">Explore research <ArrowRight size={16} /></Link>
              <Link to={PROJECT_SIGNUP_HREF} className="eylo-scene-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[#8eadcc] bg-white/85 px-8 py-3 text-sm font-semibold text-[#193e68] hover:bg-white sm:w-auto">Create your workspace <ArrowRight size={16} /></Link>
            </div>
            <p className="eylo-hero-intro mt-5 text-xs leading-5 text-[#4c6984]">Explore public research sources without an account. Sign in to save evidence and manage projects.</p>
          </div>
        </section>
      </div>

      <section id="how-it-works" aria-labelledby="how-title" className="border-y border-[#e3edf4] bg-white px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#517da1]">Your research journey</p>
          <h2 id="how-title" className="mt-3 font-serif text-3xl text-[#102b4e] sm:text-4xl">From question to next step.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5c7087]">One connected workflow instead of disconnected research tools.</p>
          <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Compass, title: 'Discover', detail: 'Search scientific literature and researchers.' },
              { icon: CheckCircle2, title: 'Evaluate', detail: 'Check sources, metadata and evidence.' },
              { icon: BookOpen, title: 'Organize', detail: 'Save relevant work to your library.' },
              { icon: Sparkles, title: 'Reason', detail: 'Use EYRA to explore evidence and uncertainty.' },
              { icon: FolderOpen, title: 'Plan', detail: 'Connect findings to projects and milestones.' },
              { icon: CalendarCheck, title: 'Advance', detail: 'Choose a concrete next research action.' },
            ].map(({ icon: Icon, title, detail }, index) => (
              <li key={title} className="rounded-2xl border border-[#d9e7f2] bg-[#f8fbfe] p-5">
                <div className="flex items-center justify-between"><Icon size={23} strokeWidth={1.6} className="text-[#2a658f]" aria-hidden="true"/><span className="text-xs font-semibold text-[#7190a9]">{String(index + 1).padStart(2, '0')}</span></div>
                <h3 className="mt-4 text-lg font-semibold text-[#102b4e]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5c7087]">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-[#f9fbfd] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-5xl gap-10 border-b border-[#dbe6ef] pb-16 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#517da1]">DISCOVERY</p>
            <h2 className="mt-4 max-w-md font-serif text-4xl leading-[1.1] text-[#102b4e] sm:text-5xl">A more curious world.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#5c7087]">Explore scientific knowledge, follow the sources and discover new perspectives.</p>
            <Link to="/discover" className="mt-5 inline-flex items-center gap-2 border-b border-[#9bb8d0] pb-1 text-sm text-[#173d62]">Explore research <ArrowRight size={16} /></Link>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#517da1]">EVIDENCE</p>
            <h2 className="mt-4 max-w-md font-serif text-4xl leading-[1.1] text-[#102b4e] sm:text-5xl">Built on evidence.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#5c7087]">Bring publications, researchers and next steps together in your workspace.</p>
            <Link to={PROJECT_SIGNUP_HREF} className="mt-5 inline-flex items-center gap-2 border-b border-[#9bb8d0] pb-1 text-sm text-[#173d62]">Start a project <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src="/brand/eylo-light.svg" alt="EYLO" width="160" height="48" loading="lazy" className="h-10 w-auto max-w-[150px] object-contain" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link to="/discover" className="hover:text-slate-900">Discover</Link><Link to="/contact" className="hover:text-slate-900">Contact</Link><Link to="/login" className="hover:text-slate-900">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
