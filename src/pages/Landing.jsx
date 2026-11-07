import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight, ArrowRight, BookOpen, Briefcase, CheckCircle2,
  FileText, FolderOpen, Search, ShieldCheck,
  Sparkles, Users,
} from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';
import { searchOpenAlexWorks } from '@/lib/eyra-api';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;
const WORKFLOWS = [
  {
    id: 'papers',
    label: 'Papers',
    icon: BookOpen,
    source: 'OpenAlex · live records',
    title: 'Start with the evidence.',
    description: 'Search scholarly records, inspect their sources, and carry the useful work into a project.',
    href: '/discover?q=climate%20adaptation',
    action: 'Explore papers',
  },
  {
    id: 'connections',
    label: 'Connections',
    icon: Users,
    source: 'OpenAlex · researcher records',
    title: 'Find people by what they study.',
    description: 'Explore researchers and compare their public scholarly topics with your interests.',
    href: '/login?from=%2Fresearchers',
    action: 'Explore connections',
    note: 'A public researcher profile does not confirm hiring or PhD availability.',
  },
  {
    id: 'gaps',
    label: 'Research gaps',
    icon: Sparkles,
    source: 'AI-assisted · exploratory',
    title: 'Turn open questions into a research map.',
    description: 'Compare approaches, populations and evidence across a literature landscape.',
    href: '/login?from=%2Flabs%2Fresearch-landscape',
    action: 'Map a research landscape',
    note: 'Gap signals are hypotheses to check against the original studies.',
  },
  {
    id: 'careers',
    label: 'PhD & careers',
    icon: Briefcase,
    source: 'EURAXESS · official listings',
    title: 'Find roles connected to your research.',
    description: 'Search current research roles and compare listing text with your CV in your browser.',
    href: '/login?from=%2Fcareers',
    action: 'Explore research careers',
    note: 'CV matching supports TXT and Markdown files; it does not determine eligibility.',
  },
  {
    id: 'funding',
    label: 'Funding',
    icon: FileText,
    source: 'Grants.gov · United States',
    title: 'Find calls that can move a project forward.',
    description: 'Search official US grant records and review deadlines, eligibility and source details.',
    href: '/login?from=%2Fopportunities',
    action: 'Explore funding calls',
    note: 'Current funding search covers Grants.gov, not every international funder.',
  },
];

const STEPS = [
  { number: '01', title: 'Ask a better question', text: 'Start with a topic, a challenge or the next step you need.' },
  { number: '02', title: 'Follow the evidence', text: 'Review source-linked papers and the people behind the work.' },
  { number: '03', title: 'Make a move', text: 'Carry useful findings into a project, role search or funding call.' },
];

export default function Landing() {
  const [question, setQuestion] = useState('');
  const [activeWorkflow, setActiveWorkflow] = useState('papers');
  const [liveRecords, setLiveRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    searchOpenAlexWorks('climate adaptation', 3, 'recent', { throwOnError: true })
      .then(records => { if (active) setLiveRecords(records); })
      .catch(() => { if (active) setRecordsError('Live sample is temporarily unavailable.'); })
      .finally(() => { if (active) setRecordsLoading(false); });
    return () => { active = false; };
  }, []);

  const explore = event => {
    event?.preventDefault();
    const query = question.trim();
    if (query) trackSearchStarted('homepage');
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  const selected = WORKFLOWS.find(item => item.id === activeWorkflow) || WORKFLOWS[0];
  const SelectedIcon = selected.icon;

  return (
    <main id="main-content" className="min-h-screen bg-[#F7F9FC] text-[#142D49]">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to research search</a>

      <header className="sticky top-0 z-40 border-b border-[#DFE7EF]/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto shrink-0">
            <img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="180" height="54" className="h-10 w-auto max-w-[130px] object-contain sm:h-12 sm:max-w-[180px]" fetchPriority="high" />
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <Link to="/discover" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">Discover</Link>
            <a href="#journey" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">What you can do</a>
            <a href="#trust" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">Evidence & trust</a>
            <Link to="/contact" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">Contact</Link>
          </nav>
          <Link to="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#C4D2DF] bg-white px-4 text-sm font-semibold text-[#173D67] transition hover:border-[#8EAAC0] hover:bg-[#F4F8FB]">Sign in</Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-[#E3EAF1] bg-white px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:pb-24 lg:pt-20" aria-labelledby="eylo-hero-title">
        <div className="pointer-events-none absolute -right-36 -top-40 -z-10 h-[36rem] w-[36rem] rounded-full bg-[#DCEBF6] opacity-80 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-52 left-[28%] -z-10 h-[24rem] w-[24rem] rounded-full bg-[#E6F1E9] opacity-75 blur-3xl" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#D9E6EF] bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.17em] text-[#276A99]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5C9C76]" /> Research, connected
            </p>
            <h1 id="eylo-hero-title" className="mt-6 max-w-xl font-serif text-[clamp(3rem,6vw,5.4rem)] font-normal leading-[0.99] tracking-[-0.06em] text-[#102B49]">
              Research moves when the right things connect.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#526A82] sm:text-lg">
              Follow evidence to people, opportunities and a clear next step.
            </p>
            <form role="search" onSubmit={explore} className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-xl border border-[#BFCFDB] bg-white p-2 shadow-[0_18px_42px_-28px_rgba(16,43,73,0.42)] transition focus-within:border-[#75A0BF] focus-within:ring-2 focus-within:ring-[#347BA8]/20">
              <Search className="ml-3 shrink-0 text-[#567895]" size={20} aria-hidden="true" />
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What are you researching?" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#142D49] outline-none placeholder:text-[#788CA0]" />
              <button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#174672] text-white transition hover:bg-[#245D91] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174672]"><ArrowRight size={19} /></button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#526B83]">
              {['Climate adaptation', 'Public health', 'Machine learning'].map(topic => (
                <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate('/discover?q=' + encodeURIComponent(topic)); }} className="min-h-9 rounded-full border border-[#D6E1EB] bg-white/80 px-3 font-medium transition hover:border-[#9DB8CF] hover:bg-[#F2F7FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c68a0]">{topic}</button>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link to="/discover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#174672] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245D91]">Explore research <ArrowRight size={16} /></Link>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-[#61778E]"><CheckCircle2 size={15} className="text-[#4E8B68]" />Public paper search · no sign-in needed</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#DDECF7] via-white to-[#E3F0E8] opacity-90 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[1.7rem] border border-[#D8E4EE] bg-white/95 shadow-[0_34px_100px_-52px_rgba(17,48,78,0.55)] backdrop-blur">
              <div className="flex items-center justify-between border-b border-[#E6EDF3] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF2F8] text-[#1D5986]"><BookOpen size={19} aria-hidden="true" /></span>
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#71869A]">A live literature search</p><h2 className="mt-0.5 text-sm font-semibold text-[#173A5D]">Climate adaptation</h2></div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF7F0] px-2.5 py-1 text-[10px] font-semibold text-[#3D7654]"><span className="h-1.5 w-1.5 rounded-full bg-[#64A678]" />OpenAlex</span>
              </div>
              <div className="space-y-3 p-4 sm:p-5" aria-live="polite">
                {recordsLoading && <div role="status" className="space-y-3"><div className="h-20 animate-pulse rounded-xl bg-[#F1F5F8]" /><div className="h-20 animate-pulse rounded-xl bg-[#F1F5F8]" /><span className="sr-only">Loading live papers</span></div>}
                {recordsError && <p role="status" className="rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#65798D]">{recordsError}</p>}
                {!recordsLoading && !recordsError && liveRecords.map(record => (
                  <article key={record.id} className="rounded-xl border border-[#E4EBF1] bg-[#FBFCFE] p-4 transition hover:border-[#BDD0DE]">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[#173A5D]">{record.title}</h3>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#75889B]">{record.year || '—'}</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs text-[#61788E]">{record.authors || 'Authors not listed'}</p>
                    <p className="mt-3 flex items-center gap-2 text-[10px] text-[#74879A]"><span className="rounded bg-[#EAF2F8] px-2 py-1 text-[#356E98]">{record.source}</span><span>{(record.cited_by_count || 0).toLocaleString()} citations</span></p>
                  </article>
                ))}
                {!recordsLoading && !recordsError && liveRecords.length === 0 && <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#65798D]">No records returned for this sample topic.</p>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6EDF3] px-5 py-3 sm:px-6">
                <p className="text-[10px] text-[#7B8FA1]">{recordsLoading ? 'Retrieving source records…' : liveRecords.length + ' source records · retrieved live'}</p>
                <Link to="/discover?q=climate%20adaptation" className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[#1C5B8B] hover:underline">Open search results <ArrowRight size={13} /></Link>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#6D8498]">
              <span>Evidence</span><ArrowRight size={12} aria-hidden="true" /><span>People</span><ArrowRight size={12} aria-hidden="true" /><span>Opportunity</span><ArrowRight size={12} aria-hidden="true" /><span>Progress</span>
            </div>
          </div>
        </div>
      </section>

      <section id="journey" aria-labelledby="journey-title" className="border-b border-[#DFE7EF] bg-[#F6F9FC] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-9 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14">
          <div className="lg:pt-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">One connected workspace</p>
            <h2 id="journey-title" className="mt-4 max-w-lg font-serif text-4xl leading-[1.06] tracking-[-0.04em] text-[#102B49] sm:text-5xl">A useful next step starts with the right connection.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#536B82]">Choose where you are in your research. EYLO brings the source, context and next action together.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#174672] px-5 text-sm font-semibold text-white transition hover:bg-[#245D91]">Start with a question <ArrowRight size={15} /></Link>
              <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#B9CADB] bg-white px-4 text-sm font-semibold text-[#174672] transition hover:bg-[#F2F7FB]">Build a workspace <FolderOpen size={15} /></Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-[#D9E4EF] bg-white shadow-[0_24px_75px_-54px_rgba(16,43,73,0.45)]">
            <div className="flex gap-1 overflow-x-auto border-b border-[#E3EAF2] px-3 pt-3 sm:px-5" role="tablist" aria-label="Explore EYLO workflows">
              {WORKFLOWS.map(({ id, label, icon: Icon }) => (
                <button key={id} id={'workflow-tab-' + id} type="button" role="tab" aria-controls="workflow-panel" aria-selected={activeWorkflow === id} onClick={() => setActiveWorkflow(id)} className={'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition sm:px-4 sm:text-sm ' + (activeWorkflow === id ? 'border-[#205986] text-[#153C62]' : 'border-transparent text-[#647A90] hover:text-[#153C62]')}>
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <div id="workflow-panel" role="tabpanel" aria-labelledby={'workflow-tab-' + activeWorkflow} className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-[#EDF4F8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#356E98]"><SelectedIcon size={12} aria-hidden="true" />{selected.source}</p>
                <h3 className="mt-4 max-w-lg font-serif text-2xl leading-tight tracking-[-0.03em] text-[#173A5D] sm:text-3xl">{selected.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#61788E]">{selected.description}</p>
                {selected.note && <p className="mt-4 max-w-xl border-l-2 border-[#B9CADB] pl-3 text-xs leading-5 text-[#697D90]">{selected.note}</p>}
                {activeWorkflow === 'papers' && liveRecords.length > 0 && (
                  <div className="mt-5 space-y-2">
                    {liveRecords.slice(0, 2).map(record => <p key={record.id} className="line-clamp-1 text-xs font-medium text-[#405B77]"><span className="mr-2 text-[#6D8498]">{record.year || 'Paper'}</span>{record.title}</p>)}
                  </div>
                )}
              </div>
              <Link to={selected.href} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-lg bg-[#174672] px-4 text-sm font-semibold text-white transition hover:bg-[#245D91]">
                {selected.action}<ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="border-b border-[#E3EAF1] bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">From question to action</p>
              <h2 id="how-title" className="mt-4 max-w-2xl font-serif text-4xl leading-tight tracking-[-0.04em] text-[#102B49] sm:text-5xl">Less hunting. More research.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#587187]">A simple path from a question to the evidence, people and opportunities around it.</p>
          </div>
          <ol className="mt-10 grid gap-3 md:grid-cols-3">
            {STEPS.map(({ number, title, text }, index) => (
              <li key={number} className="group rounded-2xl border border-[#DDE7F0] bg-[#FBFCFE] p-6 transition hover:border-[#B9CDDE] hover:bg-white">
                <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-[0.16em] text-[#6E879C]">{number}</span><ArrowDownRight size={17} className="text-[#91A6B8] transition group-hover:translate-x-0.5 group-hover:translate-y-0.5" aria-hidden="true" /></div>
                <h3 className="mt-7 text-lg font-semibold text-[#173452]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#61778B]">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="trust" aria-labelledby="trust-title" className="border-b border-[#E3EAF1] bg-[#F6F9FC] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">Built for research judgment</p>
            <h2 id="trust-title" className="mt-4 max-w-lg font-serif text-4xl leading-tight tracking-[-0.04em] text-[#102B49] sm:text-5xl">Every signal has a source. Every suggestion has limits.</h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[#587187]">EYLO helps you investigate. It does not replace reading the study, contacting a researcher or checking a call's requirements.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: BookOpen, title: 'Source-linked discovery', text: 'Search public scholarly metadata from OpenAlex, arXiv, Crossref, Semantic Scholar and Europe PMC.' },
              { icon: Users, title: 'People in context', text: 'Explore public researcher records and topic overlap. Availability is never assumed.' },
              { icon: ShieldCheck, title: 'Private work, clear consent', text: 'CV matching runs in your browser. Search terms leave the browser only after you choose to search.' },
              { icon: CheckCircle2, title: 'Limits stay visible', text: 'AI gap signals are exploratory. Funding and job coverage depends on the linked source.' },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-xl border border-[#DEE7F0] bg-white p-5 sm:p-6">
                <Icon className="text-[#2D6B94]" size={21} aria-hidden="true" />
                <h3 className="mt-4 text-sm font-semibold text-[#173452]">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-[#5B7187]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workspace" aria-labelledby="workspace-title" className="bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[1.7rem] bg-[#12395E] px-6 py-9 text-white shadow-[0_28px_80px_-45px_rgba(15,45,75,0.65)] sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.19em] text-[#B7D1E3]">Your research, connected</p>
            <h2 id="workspace-title" className="mt-4 font-serif text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">Keep the next step close to the evidence.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#D7E5F1]">Save useful papers, organize projects and turn questions into clear actions.</p>
          </div>
          <div className="mt-7 flex shrink-0 flex-wrap gap-3 lg:mt-0">
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-[#153C62] transition hover:bg-[#EDF4F8]">Create your workspace <ArrowRight size={15} /></Link>
            <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 px-4 text-sm font-semibold text-white transition hover:bg-white/10">Explore first <Search size={15} /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#F8FAFC] px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="160" height="48" loading="lazy" className="h-10 w-auto max-w-[150px] object-contain" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link to="/discover" className="hover:text-slate-900">Discover</Link>
            <a href="#journey" className="hover:text-slate-900">Workflows</a>
            <a href="#trust" className="hover:text-slate-900">Evidence & trust</a>
            <Link to="/contact" className="hover:text-slate-900">Contact</Link>
            <Link to="/login" className="hover:text-slate-900">Sign in</Link>
            <span>© {new Date().getFullYear()} EYLO</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
