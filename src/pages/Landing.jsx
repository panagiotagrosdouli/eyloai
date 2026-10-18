import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, HelpCircle, BookOpen, Lightbulb, Box } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';
import './eylo-approved-scene.css';
import './eylo-reference-stage.css';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;

export default function Landing() {
  const [question, setQuestion] = useState('');
  const [careerForm, setCareerForm] = useState({ name: '', email: '', interest: 'Research & Evidence', message: '', website: '' });
  const [careerStatus, setCareerStatus] = useState({ submitting: false, error: '', sent: false });
  const navigate = useNavigate();

  const explore = event => {
    event?.preventDefault();
    const query = question.trim();
    if (query) trackSearchStarted('homepage');
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  const submitCareer = async event => {
    event.preventDefault();
    if (careerStatus.submitting) return;
    setCareerStatus({ submitting: true, error: '', sent: false });
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(careerForm) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send your message.');
      setCareerStatus({ submitting: false, error: '', sent: true });
      setCareerForm({ name: '', email: '', interest: 'Research & Evidence', message: '', website: '' });
    } catch (error) {
      setCareerStatus({ submitting: false, error: error.message || 'Could not send your message.', sent: false });
    }
  };


  return (
    <main id="main-content" className="min-h-screen bg-[#fcfdff] text-[#0d2440]">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to research search</a>
      {/* The approved desktop reference is rendered directly when its art asset is provided.
          Interactive links remain real DOM elements, while smaller screens use the responsive
          editable layout below. Keep this image free of user data. */}
      <div className="eylo-reference-stage hidden lg:block" aria-label="EYLO introduction">
        <picture>
          <img src="/brand/eylo-approved-reference.webp" alt="" className="block h-auto w-full" loading="eager" fetchPriority="high" onError={event => { event.currentTarget.closest('.eylo-reference-stage')?.classList.add('eylo-reference-unavailable'); }} />
        </picture>
        <nav aria-label="EYLO desktop navigation" className="eylo-reference-hotspots">
          <Link to="/" className="eylo-ref-link eylo-ref-home" aria-label="EYLO home"><span className="sr-only">EYLO home</span></Link>
          <Link to="/discover" className="eylo-ref-link eylo-ref-discover" aria-label="Discover"><span className="sr-only">Discover</span></Link>
          <a href="#careers" className="eylo-ref-link eylo-ref-careers" aria-label="Careers"><span className="sr-only">Careers</span></a>
          <Link to="/login" className="eylo-ref-link eylo-ref-signin" aria-label="Sign in"><span className="sr-only">Sign in</span></Link>
          <Link to="/discover" className="eylo-ref-link eylo-ref-explore" aria-label="Explore Research"><span className="sr-only">Explore Research</span></Link>
          <Link to={PROJECT_SIGNUP_HREF} className="eylo-ref-link eylo-ref-start" aria-label="Get Started"><span className="sr-only">Get Started</span></Link>
        </nav>
        <h1 className="sr-only">Where knowledge moves forward.</h1>
        <p className="sr-only">DISCOVER. CONNECT. CREATE.</p>
      </div>
      <div className="eylo-scene eylo-responsive-scene relative isolate overflow-hidden">
        <div className="eylo-scene-landscape pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/eylo-horizon.svg')] bg-cover bg-center" aria-hidden="true" />
        <header className="relative z-20">
          <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-3 px-5 sm:px-8">
            <Link to="/" aria-label="EYLO home" className="mr-auto shrink-0">
              <img src="/brand/eylo-light.svg" alt="EYLO" width="180" height="54" className="h-10 w-auto max-w-[130px] object-contain sm:h-12 sm:max-w-[180px]" fetchPriority="high" />
            </Link>
            <Link to="/discover" className="hidden px-3 py-2 text-sm text-[#17375c] hover:text-[#226fba] sm:inline-flex">Discover</Link>
            <a href="#careers" className="hidden px-3 py-2 text-sm text-[#17375c] hover:text-[#226fba] sm:inline-flex">Careers</a>
            <Link to="/login" className="rounded-full border border-[#507ba4] bg-white/45 px-4 py-2 text-xs text-[#17375c] transition hover:bg-white/80 sm:px-7 sm:text-sm">Sign in</Link>
          </div>
        </header>
        <section className="relative flex min-h-[calc(100svh-76px)] flex-col items-center px-5 pb-24 pt-12 text-center sm:px-8 sm:pt-14 lg:min-h-[calc(100vh-76px)]">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
            <img src="/brand/eylo-light.svg" alt="EYLO" width="430" height="240" className="eylo-hero-emblem h-auto w-[min(77vw,340px)] object-contain sm:w-[390px]" fetchPriority="high" />
            <h1 className="eylo-hero-intro mt-4 max-w-5xl font-serif text-[clamp(2.25rem,4.2vw,4.4rem)] font-normal leading-tight tracking-[-0.045em] text-[#0c2850]">Where knowledge moves forward.</h1>
            <p className="eylo-hero-intro mt-5 text-xs font-medium tracking-[0.22em] text-[#43658a] sm:text-sm sm:tracking-[0.32em]">DISCOVER. CONNECT. CREATE.</p>
            <div className="eylo-hero-intro mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-5">
              <Link to="/discover" className="eylo-scene-cta inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#092c57] to-[#287cbd] px-9 py-3 text-sm font-medium text-white shadow-[0_10px_24px_-18px_rgba(7,41,91,0.75)] hover:brightness-110 sm:w-auto">Explore Research <ArrowRight size={16} /></Link>
              <Link to={PROJECT_SIGNUP_HREF} className="eylo-scene-cta inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-[#a2bdd9] bg-white/60 px-9 py-3 text-sm font-medium text-[#193e68] hover:bg-white/90 sm:w-auto">Get Started <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="mt-auto flex flex-col items-center gap-4 pt-16">
            <a href="#eylo-next" className="eylo-scroll-cue inline-flex flex-col items-center gap-2 text-[10px] font-medium tracking-[0.2em] text-[#294c73] hover:text-[#0c2850]"><span className="text-xl leading-none" aria-hidden="true">⌄</span> SCROLL TO EXPLORE</a>
          </div>
        </section>
      </div>

      <section id="eylo-next" className="bg-white px-5 py-10 sm:px-8">
        <form onSubmit={explore} className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border border-[#d5e4f0] bg-white p-2 shadow-sm">
          <Search className="ml-3 shrink-0 text-[#587998]" size={18} aria-hidden="true" />
          <label htmlFor="research-question" className="sr-only">Research question</label>
          <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a research question…" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-[#718ba3]" />
          <button type="submit" aria-label="Search research" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#256eac] hover:bg-[#e8f4ff]"><ArrowRight size={20} /></button>
        </form>
      </section>

      <section aria-label="How EYLO works" className="border-y border-[#e3edf4] bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {[
            { icon: HelpCircle, label: 'Question', line: 'Start with curiosity.' },
            { icon: BookOpen, label: 'Evidence', line: 'Explore scholarly sources.' },
            { icon: Lightbulb, label: 'Insight', line: 'Understand the findings.' },
            { icon: Box, label: 'Project', line: 'Move ideas forward.' },
          ].map(({ icon: Icon, label, line }) => (
            <div key={label} className="flex flex-col items-center">
              <Icon aria-hidden="true" className="mb-3 text-[#2a658f]" size={27} strokeWidth={1.4} />
              <h2 className="font-serif text-2xl text-[#102b4e]">{label}</h2>
              <p className="mt-1 text-xs text-[#71859a] sm:text-sm">{line}</p>
            </div>
          ))}
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

      <section id="careers" className="border-t border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="careers-heading">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#356ba0]">EYLO / CAREERS & COLLABORATION</p>
          <h2 id="careers-heading" className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Help shape the future of research.</h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">We’re building EYLO for people who want to turn knowledge into meaningful work. If you care about research, technology or making complex ideas easier to explore, we’d like to hear from you.</p>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">Research & Evidence</h3><p className="mt-3 text-sm leading-6 text-slate-600">Scholarly discovery, research quality and scientific methods.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">AI & Engineering</h3><p className="mt-3 text-sm leading-6 text-slate-600">Reliable technology, responsible AI and product development.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">Design & Partnerships</h3><p className="mt-3 text-sm leading-6 text-slate-600">Human-centered product design and research community connections.</p></article>
          </div>
          <div className="mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-7">
            <h3 className="text-xl font-semibold text-slate-900">Introduce yourself</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Share your background and how you would like to contribute. This is an expression of interest, not an application for an advertised vacancy.</p>
            <form onSubmit={submitCareer} className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-800">Your name<input required minLength={2} maxLength={100} value={careerForm.name} onChange={e => setCareerForm(s => ({ ...s, name: e.target.value }))} autoComplete="name" className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" /></label>
                <label className="grid gap-2 text-sm font-medium text-slate-800">Email<input type="email" required maxLength={200} value={careerForm.email} onChange={e => setCareerForm(s => ({ ...s, email: e.target.value }))} autoComplete="email" className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" /></label>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-800">Area of interest<select value={careerForm.interest} onChange={e => setCareerForm(s => ({ ...s, interest: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]"><option>Research & Evidence</option><option>AI & Engineering</option><option>Design & Partnerships</option><option>Other</option></select></label>
              <label className="grid gap-2 text-sm font-medium text-slate-800">A little about you<textarea required minLength={20} maxLength={2400} rows={5} value={careerForm.message} onChange={e => setCareerForm(s => ({ ...s, message: e.target.value }))} placeholder="What do you work on, and how might we collaborate?" className="resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" /></label>
              <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={careerForm.website} onChange={e => setCareerForm(s => ({ ...s, website: e.target.value }))} /></label></div>
              <p className="text-xs leading-5 text-slate-500">Your details will be used to review and reply to your enquiry. Please don't include sensitive personal information.</p>
              {careerStatus.error && <p role="alert" className="text-sm text-red-700">{careerStatus.error}</p>}
              {careerStatus.sent && <p role="status" className="text-sm text-green-800">Thank you. Your message was sent to the EYLO team.</p>}
              <button type="submit" disabled={careerStatus.submitting} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#153c72] px-6 py-3 text-sm font-semibold text-white hover:bg-[#25578d] disabled:cursor-wait disabled:opacity-60">{careerStatus.submitting ? 'Sending…' : 'Send your introduction'} <ArrowRight size={16} /></button>
            </form>
          </div>
          <p className="mt-4 text-xs text-slate-500">Open to conversations and future collaboration. No paid vacancies are currently advertised.</p>
        </div>
      </section>


      <footer className="border-t border-slate-200 bg-white px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src="/brand/eylo-light.svg" alt="EYLO" width="160" height="48" loading="lazy" className="h-10 w-auto max-w-[150px] object-contain" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link to="/discover" className="hover:text-slate-900">Discover</Link><a href="#careers" className="hover:text-slate-900">Careers</a><Link to="/login" className="hover:text-slate-900">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
