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

      <section aria-labelledby="eylo-hero-title" className="relative isolate overflow-hidden bg-[#112F2C] text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(#d8e7d3 0.7px, transparent 0.7px)', backgroundSize: '21px 21px' }} />
        <div className="pointer-events-none absolute -right-56 -top-72 -z-10 h-[46rem] w-[46rem] rounded-full bg-[#467F68]/35 blur-3xl" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:pb-24 lg:pt-24">
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B9D6B1]">
              <span className="h-2 w-2 rounded-full bg-[#B5D48A] shadow-[0_0_14px_#B5D48A]" /> Research, connected
            </p>
            <h1 id="eylo-hero-title" className="mt-7 max-w-2xl text-[clamp(3.4rem,7.1vw,6.6rem)] font-medium leading-[0.91] tracking-[-0.075em] text-[#F6F7EF]">
              Research is a <span className="font-serif font-normal italic text-[#B9D6B1]">network.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[#D1DED6] sm:text-lg sm:leading-8">
              EYLO connects the evidence, people and opportunities around your next idea.
            </p>
            <form role="search" onSubmit={explore} className="mt-9 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-white p-2 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.65)] transition focus-within:ring-4 focus-within:ring-[#B9D6B1]/25">
              <Search className="ml-3 shrink-0 text-[#627A70]" size={20} aria-hidden="true" />
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What are you curious about?" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#183B34] outline-none placeholder:text-[#81928A]" />
              <button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#B9D6B1] text-[#153B32] transition hover:bg-[#CDE3C5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ArrowRight size={19} /></button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-[#B8C9BF]">
              <span className="mr-1">Try</span>
              {['Climate adaptation', 'Public health', 'Machine learning'].map(topic => (
                <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate('/discover?q=' + encodeURIComponent(topic)); }} className="rounded-full border border-white/15 px-3 py-1.5 transition hover:border-[#B9D6B1]/60 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B9D6B1]">{topic}</button>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link to="/discover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#B9D6B1] px-5 text-sm font-semibold text-[#153B32] transition hover:bg-[#CDE3C5]">Explore research <ArrowRight size={16} /></Link>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-[#C0D0C6]"><CheckCircle2 size={15} className="text-[#B9D6B1]" />Start searching, no sign-in needed</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px]">
            <div className="pointer-events-none absolute inset-0 -z-10 scale-90 rounded-full bg-[#9ECBB1]/20 blur-[80px]" aria-hidden="true" />
            <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#173B36]/80 p-5 shadow-[0_35px_110px_-42px_rgba(0,0,0,0.6)] backdrop-blur sm:min-h-[500px] sm:p-7">
              <div className="absolute inset-0 opacity-80" aria-hidden="true">
                <svg viewBox="0 0 620 500" className="h-full w-full" fill="none">
                  <circle cx="320" cy="244" r="155" stroke="#B5D48A" strokeOpacity=".17" />
                  <circle cx="320" cy="244" r="108" stroke="#B5D48A" strokeOpacity=".14" />
                  <path d="M71 357 198 270l115-99 132 43 101-117M114 93l84 177 120 73 127-99 101 106M198 270l-30 132 150-59 127 14 101-106M313 171l6 173M71 357l43-264 199 78 233-74" stroke="#B8D2BF" strokeOpacity=".27" strokeWidth="1.2" />
                  <circle cx="320" cy="244" r="5" fill="#C6E6B2" />
                  <circle cx="198" cy="270" r="4" fill="#C6E6B2" />
                  <circle cx="313" cy="171" r="4" fill="#C6E6B2" />
                  <circle cx="440" cy="214" r="4" fill="#C6E6B2" />
                  <circle cx="168" cy="402" r="3" fill="#C6E6B2" />
                  <circle cx="541" cy="117" r="3" fill="#C6E6B2" />
                  <circle cx="440" cy="398" r="3" fill="#C6E6B2" />
                  <circle cx="114" cy="93" r="3" fill="#C6E6B2" />
                  <circle cx="519" cy="344" r="3" fill="#C6E6B2" />
                </svg>
              </div>
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B9D6B1]">One question. Many connections.</p>
                  <p className="mt-2 text-sm text-white/70">A glimpse into climate adaptation</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-[#D5E4D7]"><span className="h-1.5 w-1.5 rounded-full bg-[#B9D6B1]" />Evidence graph</span>
              </div>
              <div className="relative mt-10 grid min-h-[285px] grid-cols-2 items-center gap-3 sm:mt-14">
                <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#C2DFAF]/45 bg-[#B9D6B1] text-center text-xs font-bold leading-4 text-[#173B32] shadow-[0_0_48px_rgba(185,214,177,0.28)] sm:h-28 sm:w-28">climate<br />adaptation</div>
                <div className="relative z-10 self-start rounded-2xl border border-white/10 bg-[#204840]/90 p-3.5 shadow-xl backdrop-blur sm:ml-2 sm:max-w-[210px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#C9E4C0]"><BookOpen size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">Evidence</span></div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-4 text-white sm:text-xs">{liveRecords[0]?.title || 'Research on climate adaptation'}</p>
                  <p className="mt-2 text-[9px] text-white/55">{recordsLoading ? 'Finding live records…' : recordsError ? 'OpenAlex sample unavailable' : liveRecords[0] ? 'OpenAlex · ' + (liveRecords[0].year || 'Research') : 'OpenAlex · source-linked'}</p>
                </div>
                <div className="relative z-10 col-start-2 row-start-1 mt-20 justify-self-end rounded-2xl border border-white/10 bg-[#204840]/90 p-3.5 shadow-xl backdrop-blur sm:mr-1 sm:max-w-[180px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#C9E4C0]"><Users size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">People</span></div>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-white sm:text-xs">Researchers & shared interests</p>
                  <p className="mt-2 text-[9px] text-white/55">Discover public profiles</p>
                </div>
                <div className="relative z-10 col-start-1 row-start-2 mb-2 self-end rounded-2xl border border-white/10 bg-[#204840]/90 p-3.5 shadow-xl backdrop-blur sm:ml-2 sm:max-w-[185px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#C9E4C0]"><Sparkles size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">Open questions</span></div>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-white sm:text-xs">Patterns worth exploring</p>
                  <p className="mt-2 text-[9px] text-white/55">AI-assisted · verify the evidence</p>
                </div>
                <div className="relative z-10 col-start-2 row-start-2 mb-8 justify-self-end self-end rounded-2xl border border-white/10 bg-[#204840]/90 p-3.5 shadow-xl backdrop-blur sm:mr-1 sm:max-w-[175px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#C9E4C0]"><Briefcase size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">Next steps</span></div>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-white sm:text-xs">Calls, roles & projects</p>
                  <p className="mt-2 text-[9px] text-white/55">Explore opportunities</p>
                </div>
              </div>
              <div className="relative flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-white/55">
                <span>From discovery to direction</span>
                <Link to="/discover?q=climate%20adaptation" className="inline-flex min-h-8 items-center gap-1 font-semibold text-[#CBE2C4] hover:text-white">See the evidence <ArrowRight size={13} /></Link>
              </div>
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
