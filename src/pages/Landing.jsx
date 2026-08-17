import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, CheckCircle2, Database, ExternalLink, FileSearch, FolderKanban,
  Search, ShieldCheck,
} from 'lucide-react';
import ServiceStatus from '@/components/system/ServiceStatus';
import { trackSearchStarted } from '@/lib/product-analytics';

const EXAMPLES = [
  'AI for early cancer detection',
  'Climate adaptation for coastal cities',
  'Trustworthy AI in higher education',
  'Battery recycling for grid storage',
];

const SOURCES = [
  ['OpenAlex', 'works, authors, institutions'],
  ['arXiv', 'open research preprints'],
  ['Europe PMC', 'biomedical literature'],
  ['Crossref', 'DOIs and publication metadata'],
  ['Semantic Scholar', 'scholarly records and citations'],
];

const STEPS = [
  { number: '01', title: 'Ask a useful question', detail: 'Choose your level, goal and time horizon so the same topic produces the right research path.', icon: Search },
  { number: '02', title: 'Inspect real evidence', detail: 'EYLO retrieves source records, removes duplicates and labels partial source failures instead of filling gaps.', icon: BookOpen },
  { number: '03', title: 'Turn it into work', detail: 'Save evidence to a project, find collaborators and funding, then ask EYRA for a sourced next step.', icon: FolderKanban },
];

const OUTPUTS = [
  { label: 'Evidence', text: 'Source-linked papers and records', tone: 'text-cyan-300' },
  { label: 'Inference', text: 'Model reasoning labelled separately', tone: 'text-violet-300' },
  { label: 'Uncertainty', text: 'Missing or weak support stays visible', tone: 'text-amber-300' },
  { label: 'Next action', text: 'A concrete validation step', tone: 'text-emerald-300' },
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
    <main className="min-h-screen overflow-hidden bg-[#090b0f] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#090b0f]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="EYLO home">
            <img src="/brand/eylo-logo.svg" alt="EYLO" className="h-9 w-auto max-w-[126px] object-contain" />
          </Link>
          <div className="ml-auto hidden sm:block"><ServiceStatus /></div>
          <Link to="/discover" className="hidden rounded-xl px-3 py-2 text-sm text-slate-400 hover:text-white md:inline-flex">Explore</Link>
          <Link to="/login" className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:text-white">Sign in</Link>
          <Link to="/register" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100">Create workspace</Link>
        </div>
      </header>

      <section className="px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.88fr)] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
              <Database size={12} />Research workflow grounded in source records
            </div>
            <h1 className="mt-7 max-w-4xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-7xl lg:text-[5rem]">
              Research less blindly.
              <span className="block text-slate-400">Move with evidence.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
              Search papers, people and opportunities across scholarly sources. Save the useful evidence and let EYRA turn it into a clear, sourced next step.
            </p>

            <form onSubmit={explore} className="mt-9 max-w-3xl rounded-2xl border border-white/10 bg-[#10131a] p-2 shadow-2xl shadow-black/25">
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center">
                  <Search className="ml-3 shrink-0 text-slate-400" size={17} />
                  <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What do you want to understand or build?"
                    className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-base text-white outline-none placeholder:text-slate-500" />
                </div>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-blue-400">
                  Explore evidence <ArrowRight size={14} />
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2" aria-label="Example research questions">
              {EXAMPLES.map(example => (
                <button key={example} type="button" onClick={() => setQuestion(example)} className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] text-slate-500 hover:border-cyan-300/25 hover:text-slate-200">{example}</button>
              ))}
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={13} className="text-emerald-400" />Public discovery works without an account. No invented records.</p>
          </div>

          <div className="rounded-2xl border border-white/[0.09] bg-[#10131a] p-5 shadow-2xl shadow-black/25 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">What you receive</p><p className="mt-2 text-sm font-semibold text-white">A decision-ready answer for your own question</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03]"><FileSearch size={17} className="text-slate-300" /></span>
            </div>
            <div className="mt-2 divide-y divide-white/[0.07]">
              {OUTPUTS.map(output => (
                <div key={output.label} className="grid grid-cols-[6.5rem_1fr] gap-3 py-4">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${output.tone}`}>{output.label}</span>
                  <span className="text-xs leading-5 text-slate-400">{output.text}</span>
                </div>
              ))}
            </div>
            <Link to="/discover" className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-xs font-semibold text-slate-200 hover:border-blue-300/25">
              Try it with your own topic <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015] px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-600">Queries attempt multiple scholarly indexes; each response reports which sources answered</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SOURCES.map(([name, detail]) => <div key={name} className="text-center"><p className="text-xs font-semibold text-slate-300">{name}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{detail}</p></div>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">One continuous workflow</p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">From question to next action.</h2>
            <p className="mt-4 text-base leading-7 text-slate-400">No maze of disconnected AI tools. Start with evidence, keep the context and choose what happens next.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ number, title, detail, icon: Icon }) => (
              <article key={number} className="rounded-2xl border border-white/[0.08] bg-[#0b101a] p-6">
                <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/[0.07] text-cyan-300"><Icon size={17} /></span><span className="font-mono text-[10px] text-slate-700">{number}</span></div>
                <h3 className="mt-7 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Built for honest research</p>
            <h2 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Know what is evidence — and what is AI.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">EYLO keeps source records, model inference and uncertainty separate. Failed sources are shown, and AI synthesis never replaces the underlying papers.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              'Source links remain attached to records.',
              'Duplicate papers are filtered across indexes.',
              'Partial retrieval is labelled per query.',
              'Saved workspace data is private to the user.',
              'AI availability is checked live.',
              'Researchers keep final scientific responsibility.',
            ].map(item => <div key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs leading-5 text-slate-400"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />{item}</div>)}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 text-center sm:px-8 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] text-cyan-300"><Database size={19} /></div>
          <h2 className="mt-6 font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Start with a real question.</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400">Explore public evidence now. Create a workspace only when you want to save, organize and continue.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/discover" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Explore evidence <ArrowRight size={14} /></Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white">Create workspace</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><img src="/brand/eylo-logo.svg" alt="EYLO" className="h-8 w-auto" /><span>Research intelligence workspace</span></div>
          <div className="flex flex-wrap gap-5"><Link to="/discover" className="hover:text-slate-300">Public discovery</Link><Link to="/login" className="hover:text-slate-300">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div>
        </div>
      </footer>
    </main>
  );
}
