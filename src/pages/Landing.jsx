import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Search, BookOpen, Users, FolderOpen, Sparkles, Compass, Target, Network, FileText, Rocket,
} from 'lucide-react';
import BrandLogo from '@/components/brand/BrandLogo';
import { trackSearchStarted } from '@/lib/product-analytics';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;

const CAPABILITIES = [
  { icon: BookOpen, name: "Research discovery", detail: "Explore scholarly publications from connected research indexes, with direct links to sources.", tag: "Discover", href: "/discover" },
  { icon: Sparkles, name: "EYRA AI research companion", detail: "Work through evidence, develop ideas and plan your next research action with AI assistance.", tag: "AI-assisted", href: "/register" },
  { icon: Users, name: "Researchers & collaborators", detail: "Find real scholarly researchers and explore possible connections based on their published work.", tag: "Connect", href: "/register" },
  { icon: FolderOpen, name: "Projects & knowledge library", detail: "Save papers and researchers, organize your ideas and keep your research context together.", tag: "Workspace", href: "/register" },
  { icon: Target, name: "Funding & opportunities", detail: "Explore official funding records and review their relevance to your research interests and projects.", tag: "Opportunities", href: "/register" },
  { icon: Network, name: "Research & innovation labs", detail: "Explore scenarios, teams, impact assessments, professional pathways and proposal-drafting tools.", tag: "Experimental · plan-dependent", href: "/register" },
];

const EXAMPLES = [
  'Explore AI applications in healthcare',
  'Find researchers working on robotics',
  'Discover recent research on climate adaptation',
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
    <main className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#f8fafc]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto"><BrandLogo brand="eylo" size="nav" priority /></Link>
          <a href="#capabilities" className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950 sm:inline-flex">What EYLO does</a>
          <a href="#careers" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950">Careers</a>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950">Sign in</Link>
          <Link to={PROJECT_SIGNUP_HREF} className="rounded-xl bg-[#153c72] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25578d]">Get started</Link>
        </div>
      </header>

      <section className="relative flex min-h-[min(740px,calc(100svh-64px))] items-center px-5 py-20 sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[580px] bg-[radial-gradient(ellipse_at_50%_25%,rgba(53,128,189,0.10),transparent_68%)]" />
        <div className="relative mx-auto w-full max-w-4xl text-center">
          <p className="text-xs font-medium tracking-[0.22em] text-[#356ba0] uppercase">EYLO AI · Meet EYRA</p>
          <h1 className="mx-auto mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[1.12] tracking-[-0.055em] text-slate-900 sm:text-6xl lg:text-[4.5rem]">From ideas to<br /><span className="text-[#416b91]">research, people and possibilities.</span></h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">EYLO brings scientific discovery, researchers, project tools and opportunities into one connected workspace. EYRA helps you turn evidence into your next step — whether you are studying, researching or building an idea.</p>
          <form onSubmit={explore} className="mx-auto mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl shadow-slate-200/60">
            <label htmlFor="research-question" className="sr-only">What would you like to research?</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center">
                <Search className="ml-3 shrink-0 text-slate-400" size={18} aria-hidden="true" />
                <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What would you like to explore?" className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-slate-900 outline-none placeholder:text-slate-400" />
              </div>
              <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#153c72] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#25578d]">Explore <ArrowRight size={16} /></button>
            </div>
          </form>
          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2" aria-label="Example research topics">
            {EXAMPLES.map(example => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-[#8cb3d3] hover:text-slate-950">{example}</button>)}
          </div>
          <p className="mt-7 text-xs text-slate-500">Explore research without signing in · Create a free account to save your work</p>
        </div>
      </section>

      <section id="capabilities" className="border-t border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#356ba0]">Inside EYLO</p>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h2 id="capabilities-heading" className="max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-5xl">More than a search engine.<br /><span className="text-[#416b91]">One place to move ideas forward.</span></h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Find knowledge, discover people, manage projects and explore opportunities. The tools connect around your research goals — with EYRA as your AI assistant.</p>
            </div>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#153c72] px-5 py-3 text-sm font-semibold text-white hover:bg-[#25578d]">Create your workspace <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, name, detail, tag, href }) => (
              <article key={name} className="flex flex-col rounded-2xl border border-slate-200 bg-[#f8fafc] p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f0f8] text-[#153c72]"><Icon size={21} aria-hidden="true" /></span>
                <p className="mt-5 text-xs font-medium uppercase tracking-wider text-[#356ba0]">{tag}</p>
                <h3 className="mt-2 text-lg font-semibold">{name}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{detail}</p>
                <Link to={href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#153c72] hover:underline">Explore feature <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Some AI and innovation lab tools are experimental or require a qualifying plan. AI outputs, research matches and funding eligibility require verification at their original sources.</p>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#edf4fa] px-5 py-16 sm:px-8" aria-labelledby="eyra-heading">
        <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#356ba0]">Meet EYRA</p>
            <h2 id="eyra-heading" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Your AI companion for research and what comes next.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">EYRA helps you work with the evidence you discover, explore different paths and plan practical next steps. Your judgment stays in control.</p>
            <Link to={PROJECT_SIGNUP_HREF} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#153c72] hover:underline">Work with EYRA <ArrowRight size={16} /></Link>
          </div>
          <div className="rounded-3xl border border-[#c9dfef] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#153c72] text-white"><Sparkles size={21} /></span><div><p className="font-semibold">EYRA · Research intelligence</p><p className="text-xs text-slate-500">From a question to a practical pathway</p></div></div>
            <div className="mt-6 space-y-3">
              {["Explore source-linked research", "Connect findings to your project", "Identify people and possible opportunities", "Plan your next evidence-based action"].map((step, index) => <div key={step} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-semibold text-[#356ba0]">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></div>)}
            </div>
            <p className="mt-4 text-xs text-slate-500">Illustrative workflow, not an autonomous process or guaranteed result.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28" aria-labelledby="what-eylo-does">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div><p className="text-xs uppercase tracking-[0.18em] text-[#356ba0]">One connected workspace</p><h2 id="what-eylo-does" className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">From curiosity to collaboration.</h2></div>
            <Link to="/discover" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950">Explore EYLO <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs text-[#356ba0]">01 / DISCOVER</p><h3 className="mt-5 text-lg font-semibold">Find your evidence</h3><p className="mt-3 text-sm leading-6 text-slate-600">Explore real and recent papers, with help framing your question and investigating possible research gaps.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs text-[#356ba0]">02 / CONNECT</p><h3 className="mt-5 text-lg font-semibold">Find your people</h3><p className="mt-3 text-sm leading-6 text-slate-600">Discover researchers, potential PhD collaborators and relevant research institutions.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs text-[#356ba0]">03 / BUILD</p><h3 className="mt-5 text-lg font-semibold">Make progress</h3><p className="mt-3 text-sm leading-6 text-slate-600">Bring papers, people, plans and your next steps into a project supported by EYRA.</p></div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
            <p className="max-w-lg text-sm leading-6 text-slate-600">EYRA helps with research and collaboration preparation. Contacting researchers or booking meetings requires your approval and connected services.</p>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white">Start a project <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section id="careers" className="border-t border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="careers-heading">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#356ba0]">EYLO / CAREERS & COLLABORATION</p>
          <h2 id="careers-heading" className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Help shape the future of research.</h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">Connect with EYLO around scientific information retrieval, responsible AI, research workflows and product engineering. We welcome expressions of interest for future collaboration; no specific paid positions are advertised at this time.</p>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">Research & Evidence</h3><p className="mt-3 text-sm leading-6 text-slate-600">Scholarly discovery, evidence evaluation and research methodology.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">AI & Engineering</h3><p className="mt-3 text-sm leading-6 text-slate-600">Applied AI, trustworthy systems and full-stack product development.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">Design & Partnerships</h3><p className="mt-3 text-sm leading-6 text-slate-600">Researcher experience, product design and academic collaboration.</p></article>
          </div>
          <a href="mailto:panagiotagrosdouli@gmail.com?subject=EYLO%20Careers%20%26%20Collaboration" className="mt-8 inline-flex rounded-xl bg-[#153c72] px-5 py-3 text-sm font-semibold text-white hover:bg-[#25578d]">Express interest by email <ArrowRight className="ml-2" size={16} /></a>
          <p className="mt-4 text-xs text-slate-500">Please share your area of interest. Avoid sensitive personal information in initial messages.</p>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo brand="eylo" size="compact" />
          <div className="flex flex-wrap gap-5"><Link to="/discover" className="hover:text-slate-900">Discover</Link><a href="#careers" className="hover:text-slate-900">Careers</a><Link to="/login" className="hover:text-slate-900">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div>
        </div>
      </footer>
    </main>
  );
}
