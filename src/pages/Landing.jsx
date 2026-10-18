import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Users, FolderOpen, Sparkles, Target, Network, MoveUpRight,
} from 'lucide-react';
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
    <main id="main-content" className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-[#153c72] focus:shadow-lg">Skip to research search</a>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto"><img src="/brand/eylo-light.svg" alt="EYLO" className="h-11 w-auto max-w-[175px] object-contain sm:h-12" /></Link>
          <a href="#capabilities" className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950 sm:inline-flex">What EYLO does</a>
          <a href="#careers" className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950 md:inline-flex">Careers</a>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950">Sign in</Link>
          <Link to={PROJECT_SIGNUP_HREF} className="rounded-xl bg-[#153c72] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#25578d] sm:px-4 sm:text-sm">Get started</Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#f8fafc_0%,#edf2f7_65%,#f8fafc_100%)] px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute -right-32 -top-48 h-[35rem] w-[35rem] rounded-full bg-[#b1c6db]/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#cbd5e1]/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cbdff1] bg-white/85 px-4 py-2 text-xs font-semibold tracking-[0.11em] text-[#2866a0] shadow-sm"><Sparkles size={14} /> RESEARCH INTELLIGENCE · EYLO <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#63b5a6]" /></div>
            <h1 className="mt-7 font-heading text-[clamp(3.3rem,5.5vw,5.7rem)] font-semibold leading-[1.02] tracking-[-0.07em] text-[#173450]">Explore research. <span className="text-[#315779]">Connect ideas.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4c657b]">Discover scientific publications, connect with researchers and develop projects. EYRA supports your research process with AI, while you stay close to the evidence.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#1c528e] px-7 py-4 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(28,82,142,0.55)] transition hover:-translate-y-0.5 hover:bg-[#2d6cad]">Create a workspace <ArrowRight size={17} /></Link>
              <Link to="/discover" className="inline-flex min-h-13 items-center gap-2 rounded-2xl border border-[#c7d9e8] bg-white/85 px-6 py-4 text-sm font-semibold text-[#234a70] transition hover:border-[#6da5ce] hover:bg-white">Browse research <MoveUpRight size={16} /></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#617e94]"><span>Explore before signing up</span><span>Save research in your workspace</span><span>Follow original scholarly sources</span></div>
          </div>
          <div className="relative self-center border-l-2 border-[#9bc3dc] pl-6 sm:pl-9" aria-label="Explore research with EYLO">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#47779c]">Begin with a question</p>
            <h2 className="mt-4 font-heading text-2xl font-semibold leading-snug text-[#193b57] sm:text-3xl">What are you working on?</h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-[#536f85]">Explore published research and follow the original sources. No account needed to start.</p>
            <form onSubmit={explore} className="mt-7 rounded-2xl border border-[#d0e0eb] bg-white p-2 shadow-[0_12px_35px_-28px_rgba(37,77,110,0.45)]">
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Enter a topic or research question" className="w-full rounded-xl bg-transparent px-3 py-3 text-sm text-[#20466e] outline-none placeholder:text-[#829aac] focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" />
              <button type="submit" className="mt-1 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1c528e] px-5 text-sm font-semibold text-white hover:bg-[#2a6ba9]">Explore research <ArrowRight size={16} /></button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">{EXAMPLES.map(example => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-[#d6e3ec] bg-white/65 px-3 py-2 text-xs text-[#567a95] hover:border-[#80afcf] hover:text-[#1c528e]">{example}</button>)}</div>
          </div>
        </div>

      </section>

      <section aria-labelledby="standards-heading" className="border-y border-slate-200 bg-[#f1f5f9] px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p id="standards-heading" className="text-xs font-semibold uppercase tracking-[0.18em] text-[#365b7d]">Built around research integrity</p>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div className="border-l-2 border-[#829bb1] pl-4"><h3 className="text-sm font-semibold text-slate-900">Traceable sources</h3><p className="mt-2 text-sm leading-6 text-slate-600">Follow scholarly records back to their original source. Metadata is not a substitute for reading the paper.</p></div>
            <div className="border-l-2 border-[#829bb1] pl-4"><h3 className="text-sm font-semibold text-slate-900">Evidence, not certainty</h3><p className="mt-2 text-sm leading-6 text-slate-600">Treat AI synthesis as an interpretation to verify, not an independently established scientific finding.</p></div>
            <div className="border-l-2 border-[#829bb1] pl-4"><h3 className="text-sm font-semibold text-slate-900">Research continuity</h3><p className="mt-2 text-sm leading-6 text-slate-600">Carry selected papers, researcher profiles, and next steps into your private workspace.</p></div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="border-t border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-24" aria-labelledby="capabilities-heading">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#356ba0]">A structured research workflow</p>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h2 id="capabilities-heading" className="max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-5xl">From discovery to informed decisions.<br /><span className="text-[#416b91]">A workspace for rigorous inquiry.</span></h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Trace publications to their original records, connect evidence to projects, identify relevant researchers, and plan next steps. EYRA supports interpretation while you retain scholarly judgment.</p>
            </div>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#153c72] px-5 py-3 text-sm font-semibold text-white hover:bg-[#25578d]">Create your workspace <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, name, detail, tag, href }) => (
              <article key={name} className="group flex flex-col rounded-[1.6rem] border border-[#e0eaf2] bg-gradient-to-b from-white to-[#f8fbff] p-7 shadow-[0_12px_35px_-30px_rgba(30,76,128,0.5)] transition duration-300 hover:-translate-y-1 hover:border-[#9cc8e4] hover:shadow-[0_24px_50px_-32px_rgba(30,76,128,0.45)]">
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
            <div><p className="text-xs uppercase tracking-[0.18em] text-[#356ba0]">Research process</p><h2 id="what-eylo-does" className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">A clear path from question to evidence.</h2></div>
            <Link to="/discover" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950">Explore EYLO <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs text-[#356ba0]">01 / DISCOVER</p><h3 className="mt-5 text-lg font-semibold">Find your evidence</h3><p className="mt-3 text-sm leading-6 text-slate-600">Search scholarly indexes for relevant publications, review source links and inspect limitations before drawing conclusions.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs text-[#356ba0]">02 / CONNECT</p><h3 className="mt-5 text-lg font-semibold">Find your people</h3><p className="mt-3 text-sm leading-6 text-slate-600">Explore publication-backed researcher profiles and institutional information without assuming supervisory availability.</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs text-[#356ba0]">03 / BUILD</p><h3 className="mt-5 text-lg font-semibold">Make progress</h3><p className="mt-3 text-sm leading-6 text-slate-600">Organize evidence, researchers and milestones in a private project, with EYRA assisting your next research action.</p></div>
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
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">We’re building EYLO for people who want to turn knowledge into meaningful work. If you care about research, technology or making complex ideas easier to explore, we’d like to hear from you.</p>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">Research & Evidence</h3><p className="mt-3 text-sm leading-6 text-slate-600">Scholarly discovery, research quality and scientific methods.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">AI & Engineering</h3><p className="mt-3 text-sm leading-6 text-slate-600">Reliable technology, responsible AI and product development.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6"><h3 className="text-lg font-semibold">Design & Partnerships</h3><p className="mt-3 text-sm leading-6 text-slate-600">Human-centered product design and research community connections.</p></article>
          </div>
          <a href="mailto:panagiotagrosdouli@gmail.com?subject=Working%20with%20EYLO&body=Hello%20EYLO%20team%2C%0A%0AI%27d%20like%20to%20explore%20working%20with%20you.%0A%0AMy%20area%20of%20interest%3A%20%0AA%20little%20about%20me%3A%20%0AHow%20I%20could%20contribute%3A%20%0A" className="mt-8 inline-flex rounded-xl bg-[#153c72] px-5 py-3 text-sm font-semibold text-white hover:bg-[#25578d]">Get in touch <ArrowRight className="ml-2" size={16} /></a>
          <p className="mt-4 text-xs text-slate-500">Open to conversations and future collaboration. No specific paid vacancies are advertised at this time.</p>
        </div>
      </section>

            <footer className="border-t border-slate-200 px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src="/brand/eylo-light.svg" alt="EYLO" className="h-11 w-auto max-w-[175px] object-contain sm:h-12" />
          <div className="flex flex-wrap gap-5"><Link to="/discover" className="hover:text-slate-900">Discover</Link><a href="#careers" className="hover:text-slate-900">Careers</a><Link to="/login" className="hover:text-slate-900">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div>
        </div>
      </footer>
    </main>
  );
}
