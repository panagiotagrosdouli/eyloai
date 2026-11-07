import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, BookOpen, CheckCircle2, FolderOpen, Sparkles, CalendarCheck, Compass, ShieldCheck, LibraryBig } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';

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
    <main id="main-content" className="min-h-screen bg-[#F7F9FC] text-[#142D49]">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to research search</a>

      <header className="border-b border-[#DFE7EF] bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto shrink-0"><img src="/brand/eylo-light.svg" alt="EYLO" width="180" height="54" className="h-10 w-auto max-w-[130px] object-contain sm:h-12 sm:max-w-[180px]" fetchPriority="high" /></Link>
          <Link to="/discover" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] sm:inline-flex">Discover</Link>
          <a href="#how-it-works" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] sm:inline-flex">How it works</a>
          <a href="#methodology" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] md:inline-flex">Methodology</a>
          <Link to="/contact" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] lg:inline-flex">Contact</Link>
          <Link to="/login" className="rounded-lg border border-[#B9CADB] bg-white px-4 py-2 text-sm font-medium text-[#173D67] transition hover:bg-[#F1F6FB]">Sign in</Link>
        </div>
      </header>
      <section className="border-b border-[#E3EAF1] bg-white px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24" aria-labelledby="eylo-hero-title">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#276A99]">Scientific discovery & research workspace</p>
          <h1 id="eylo-hero-title" className="mx-auto mt-6 max-w-4xl font-serif text-[clamp(2.6rem,5.5vw,5rem)] font-normal leading-[1.08] tracking-[-0.045em] text-[#102B49]">Research begins with evidence.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#526A82] sm:text-lg">Discover scholarly literature, explore researchers, and organize evidence into structured research projects — with AI assistance.</p>
          <form role="search" onSubmit={explore} className="mx-auto mt-10 flex w-full max-w-2xl items-center gap-2 rounded-xl border border-[#BFCFDB] bg-white p-2 shadow-[0_12px_32px_-24px_rgba(16,43,73,0.3)] focus-within:ring-2 focus-within:ring-[#347BA8]">
            <Search className="ml-3 shrink-0 text-[#567895]" size={20} aria-hidden="true" />
            <label htmlFor="research-question" className="sr-only">Research question</label>
            <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Enter a research question or topic" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#142D49] outline-none placeholder:text-[#788CA0]" />
            <button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#174672] text-white transition hover:bg-[#245D91]"><ArrowRight size={19} /></button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[#526B83]">
            <span>Try a topic:</span>
            {['Visual-Inertial SLAM', 'Autonomous Systems', 'AI for Healthcare'].map(topic => (
              <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate(`/discover?q=${encodeURIComponent(topic)}`); }} className="min-h-9 rounded-full border border-[#D6E1EB] bg-[#F6F9FC] px-3 font-medium hover:bg-[#EAF2F8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c68a0]">{topic}</button>
            ))}
          </div>
          <div className="mx-auto mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/discover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#174672] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245D91]">Explore research <ArrowRight size={16} /></Link>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#B9CADB] bg-white px-6 py-3 text-sm font-semibold text-[#174672] hover:bg-[#F2F7FB]">Create workspace <ArrowRight size={16} /></Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#61778E]">Search public scholarly records without an account. Sign in to save evidence and manage projects.</p>
        </div>
      </section>
      <section id="methodology" className="border-b border-[#E3EAF1] bg-[#F7F9FC] px-5 py-12 sm:px-8" aria-labelledby="trust-heading">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#38749B]">Built for transparent research</p>
            <h2 id="trust-heading" className="mt-3 font-serif text-3xl text-[#173653] sm:text-4xl">Follow the evidence, not just the answer.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-[#DEE7F0] bg-white p-6"><BookOpen className="text-[#2D6B94]" size={23} aria-hidden="true" /><h3 className="mt-4 text-base font-semibold">Scholarly sources</h3><p className="mt-2 text-sm leading-6 text-[#5B7187]">Discover records from OpenAlex, arXiv, Crossref, Europe PMC and Semantic Scholar, with links to original sources.</p></article>
            <article className="rounded-xl border border-[#DEE7F0] bg-white p-6"><ShieldCheck className="text-[#2D6B94]" size={23} aria-hidden="true" /><h3 className="mt-4 text-base font-semibold">Traceable research context</h3><p className="mt-2 text-sm leading-6 text-[#5B7187]">Distinguish scholarly records from AI-generated interpretation. Verify important claims at the source.</p></article>
            <article className="rounded-xl border border-[#DEE7F0] bg-white p-6"><LibraryBig className="text-[#2D6B94]" size={23} aria-hidden="true" /><h3 className="mt-4 text-base font-semibold">From evidence to action</h3><p className="mt-2 text-sm leading-6 text-[#5B7187]">Collect relevant papers, organize project milestones and use EYRA to plan your next research step.</p></article>
          </div>
          <p className="mt-5 max-w-4xl text-xs leading-6 text-[#657A90]">EYLO supports research judgment; it does not independently validate scientific findings. AI-generated summaries and suggestions require human verification.</p>
        </div>
      </section>

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
