import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Search, BookOpen, Users, FolderOpen, Sparkles, Target, Network, Rocket, Lightbulb, MoveUpRight,
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
    <main className="min-h-screen overflow-hidden bg-[#fbfdff] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto"><span className="inline-flex items-center gap-2.5" aria-label="EYLO"><span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#2866b0] via-[#66a7d9] to-[#a6dbce] shadow-[0_9px_26px_-10px_rgba(25,88,157,0.45)]"><span className="absolute h-7 w-7 rotate-45 rounded-[7px] border-[1.5px] border-white/70" /><span className="relative h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" /></span><span className="font-heading text-[1.65rem] font-bold tracking-[-0.075em] text-[#14365c]">EYLO<span className="text-[#4c91c6]">.</span></span></span></Link>
          <a href="#capabilities" className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950 sm:inline-flex">What EYLO does</a>
          <a href="#careers" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950">Careers</a>
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-950">Sign in</Link>
          <Link to={PROJECT_SIGNUP_HREF} className="rounded-xl bg-[#153c72] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25578d]">Get started</Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[linear-gradient(145deg,#f7fbff_0%,#f0f7ff_51%,#f7fdf9_100%)] px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute -right-32 -top-48 h-[35rem] w-[35rem] rounded-full bg-[#9fd2f0]/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-40 h-[30rem] w-[30rem] rounded-full bg-[#b0e5d4]/25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.04fr_0.96fr] lg:gap-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cbdff1] bg-white/85 px-4 py-2 text-xs font-semibold tracking-[0.11em] text-[#2866a0] shadow-sm"><Sparkles size={14} /> MEET EYLO & EYRA <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#63b5a6]" /></div>
            <h1 className="mt-7 font-heading text-[clamp(3.3rem,5.5vw,5.7rem)] font-semibold leading-[1.02] tracking-[-0.07em] text-[#173450]">Your ideas deserve <span className="bg-gradient-to-r from-[#3479c0] via-[#5e95c6] to-[#3d9b92] bg-clip-text text-transparent">a way forward.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#4c657b]">One inspiring space to explore real research, find the right people, develop your projects and discover opportunities. With EYRA, your AI research companion, by your side.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-[#1c528e] px-7 py-4 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(28,82,142,0.55)] transition hover:-translate-y-0.5 hover:bg-[#2d6cad]">Start your journey <ArrowRight size={17} /></Link>
              <Link to="/discover" className="inline-flex min-h-13 items-center gap-2 rounded-2xl border border-[#c7d9e8] bg-white/85 px-6 py-4 text-sm font-semibold text-[#234a70] transition hover:border-[#6da5ce] hover:bg-white">Explore research <MoveUpRight size={16} /></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#617e94]"><span>✦ Source-linked discovery</span><span>✦ Your own workspace</span><span>✦ AI-guided exploration</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-[31rem]" aria-label="Illustration of connected EYLO research and innovation tools">
            <div className="absolute inset-10 rounded-full bg-gradient-to-tr from-[#b6e6e0]/70 to-[#bbd9f7]/80 blur-[65px]" />
            <div className="relative rounded-[2.5rem] border border-white/90 bg-white/65 p-4 shadow-[0_35px_100px_-45px_rgba(51,100,145,0.38)] backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#356fad] to-[#6bb4cc] text-white"><Sparkles size={19} /></span><div><p className="text-sm font-bold text-[#20466e]">EYRA</p><p className="text-[11px] text-[#6b8aa0]">Your research companion</p></div></div><span className="rounded-full bg-[#e5f6ee] px-3 py-1 text-[10px] font-semibold text-[#3d8c75]">Explore possibilities</span></div>
              <div className="mt-5 rounded-2xl border border-[#e0eaf3] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#7194b1]">It starts with a question</p><p className="mt-2 font-heading text-xl font-semibold leading-snug text-[#1e4263]">What could your next big idea become?</p><div className="mt-4 flex items-center gap-2 rounded-xl bg-[#eff7fc] px-3 py-2.5 text-xs text-[#5b86a8]"><Search size={14} /> Explore scientific possibilities <ArrowRight className="ml-auto" size={14} /></div></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#dfeaf5] bg-[#f4f9ff] p-4"><BookOpen className="text-[#477fb4]" size={22} /><p className="mt-4 text-sm font-bold text-[#284e72]">Discover</p><p className="mt-1 text-xs text-[#6d8ba4]">Evidence & ideas</p></div>
                <div className="rounded-2xl border border-[#e1eee8] bg-[#f2faf6] p-4"><Users className="text-[#389784]" size={22} /><p className="mt-4 text-sm font-bold text-[#284e72]">Connect</p><p className="mt-1 text-xs text-[#6d8ba4]">People & expertise</p></div>
                <div className="rounded-2xl border border-[#e8e3f5] bg-[#f8f5ff] p-4"><Lightbulb className="text-[#8c7bc0]" size={22} /><p className="mt-4 text-sm font-bold text-[#284e72]">Create</p><p className="mt-1 text-xs text-[#6d8ba4]">Projects & pathways</p></div>
                <div className="rounded-2xl border border-[#f4e9d8] bg-[#fffaf2] p-4"><Rocket className="text-[#cc9553]" size={22} /><p className="mt-4 text-sm font-bold text-[#284e72]">Grow</p><p className="mt-1 text-xs text-[#6d8ba4]">Funding & impact</p></div>
              </div>
              <p className="mt-4 text-center text-[11px] text-[#7290a5]">Your curiosity. Real knowledge. New directions.</p>
            </div>
          </div>
        </div>
        <div className="relative mx-auto mt-16 max-w-5xl rounded-3xl border border-[#d7e7f2] bg-white/80 p-3 shadow-[0_16px_50px_-30px_rgba(55,100,150,0.32)] backdrop-blur-md sm:p-4">
          <form onSubmit={explore} className="flex flex-col gap-2 md:flex-row md:items-center">
            <label htmlFor="research-question" className="sr-only">Research question</label>
            <Search size={19} className="mx-3 hidden text-[#76a0bd] md:block" aria-hidden="true" />
            <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What would you love to explore?" className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-[#20466e] outline-none placeholder:text-[#92aab9] focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" />
            <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1c528e] px-6 text-sm font-semibold text-white hover:bg-[#2a6ba9]">Discover with EYLO <ArrowRight size={16} /></button>
          </form>
          <div className="flex flex-wrap gap-2 px-2 pb-1 pt-3">{EXAMPLES.map(example => <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-[#d8e8f1] bg-[#f6fbff] px-3 py-2 text-xs text-[#63839d] hover:border-[#80afcf] hover:text-[#1c528e]">{example}</button>)}</div>
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
          <span className="inline-flex items-center gap-2.5" aria-label="EYLO"><span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#2866b0] via-[#66a7d9] to-[#a6dbce] shadow-[0_9px_26px_-10px_rgba(25,88,157,0.45)]"><span className="absolute h-7 w-7 rotate-45 rounded-[7px] border-[1.5px] border-white/70" /><span className="relative h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" /></span><span className="font-heading text-[1.65rem] font-bold tracking-[-0.075em] text-[#14365c]">EYLO<span className="text-[#4c91c6]">.</span></span></span>
          <div className="flex flex-wrap gap-5"><Link to="/discover" className="hover:text-slate-900">Discover</Link><a href="#careers" className="hover:text-slate-900">Careers</a><Link to="/login" className="hover:text-slate-900">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div>
        </div>
      </footer>
    </main>
  );
}
