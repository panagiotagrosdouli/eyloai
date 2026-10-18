import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, HelpCircle, BookOpen, Lightbulb, Box } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';

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
      <header className="relative z-20 border-b border-[#dce8f1]/70 bg-white/90">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-3 px-4 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto shrink-0"><img src="/brand/eylo-light.svg" alt="EYLO" width="180" height="54" className="h-11 w-auto max-w-[125px] object-contain sm:h-12 sm:max-w-[180px]" fetchPriority="high" /></Link>
          <Link to="/discover" className="hidden px-3 py-2 text-sm text-[#25415b] hover:text-[#1b80ce] sm:inline-flex">Discover</Link>
          <a href="#careers" className="hidden px-3 py-2 text-sm text-[#25415b] hover:text-[#1b80ce] sm:inline-flex">Careers</a>
          <Link to="/login" className="px-2 py-2 text-xs text-[#25415b] hover:text-[#1b80ce] sm:px-3 sm:text-sm">Sign in</Link>
          <Link to={PROJECT_SIGNUP_HREF} className="rounded-full bg-[#0b2646] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#214e7c] sm:px-5 sm:text-sm">Get started</Link>
        </div>
      </header>

      <section className="relative isolate min-h-[680px] overflow-hidden px-5 pb-20 pt-20 sm:px-8 sm:pt-24 lg:min-h-[730px] lg:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/eylo-horizon.svg')] bg-cover bg-center" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-2/3 bg-gradient-to-b from-white/65 via-white/45 to-transparent" />
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <img src="/brand/eylo-light.svg" alt="EYLO" width="390" height="230" className="h-auto w-[min(64vw,315px)] object-contain drop-shadow-[0_8px_25px_rgba(43,111,163,0.10)] sm:w-[360px]" fetchPriority="high" />
          <h1 className="mt-10 max-w-5xl font-serif text-[clamp(2.6rem,5.1vw,5.3rem)] font-normal leading-[1.09] tracking-[-0.045em] text-[#102b4e]">The future begins with a question.</h1>
          <p className="mt-6 text-sm font-medium tracking-[0.18em] text-[#4b6886] sm:text-base sm:tracking-[0.28em]">Discover. Connect. Create.</p>
          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-5">
            <Link to="/discover" className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-[#0b2646] px-9 py-3 text-sm font-semibold text-white shadow-[0_14px_26px_-17px_rgba(8,38,76,0.7)] transition hover:bg-[#214e7c] sm:w-auto">Explore Research <ArrowRight size={17} /></Link>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#42617f] bg-white/80 px-9 py-3 text-sm font-semibold text-[#0b2646] transition hover:bg-white sm:w-auto">Get Started</Link>
          </div>
          <form onSubmit={explore} className="mt-12 flex w-full max-w-xl items-center rounded-full border border-[#d5e4f0] bg-white/90 p-1.5 shadow-[0_14px_40px_-25px_rgba(28,88,135,0.5)]">
            <Search className="ml-4 shrink-0 text-[#587998]" size={18} aria-hidden="true" />
            <label htmlFor="research-question" className="sr-only">Research question</label>
            <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a research question…" className="w-full min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#0d2440] outline-none placeholder:text-[#718ba3] focus-visible:ring-2 focus-visible:ring-[#74b8e1]" />
            <button type="submit" aria-label="Search research" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#256eac] transition hover:bg-[#e8f4ff]"><ArrowRight size={21} /></button>
          </form>
        </div>
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
