import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Briefcase, CheckCircle2,
  FileText, Search, Sparkles, Users,
} from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';
import { searchOpenAlexWorks } from '@/lib/eyra-api';

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
            <a href="#eylo-does" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">What we do</a>
            <a href="#how-it-works" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">How it works</a>
            <a href="#about-eylo" className="rounded-lg px-3 py-2 text-sm font-medium text-[#405B77] transition hover:bg-[#F2F6FA] hover:text-[#174C7C]">Our vision</a>
          </nav>
          <div className="flex items-center gap-3"><Link to="/login" className="hidden px-3 py-2 text-sm font-medium text-[#405B77] hover:text-[#174C7C] sm:inline-flex">Sign in</Link><Link to="/discover" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#174672] px-4 text-sm font-semibold text-white transition hover:bg-[#245D91]">See EYLO AI <ArrowRight size={15} /></Link></div>
        </div>
      </header>

      <section aria-labelledby="eylo-hero-title" className="relative isolate overflow-hidden bg-[#102B49] text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12]" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(#D6E7F5 0.7px, transparent 0.7px)', backgroundSize: '21px 21px' }} />
        <div className="pointer-events-none absolute -right-56 -top-72 -z-10 h-[46rem] w-[46rem] rounded-full bg-[#245D91]/35 blur-3xl" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:pb-24 lg:pt-24">
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B9D8EE]">
              <span className="h-2 w-2 rounded-full bg-[#9FC8E8] shadow-[0_0_14px_#9FC8E8]" /> Research, connected
            </p>
            <h1 id="eylo-hero-title" className="mt-7 max-w-2xl text-[clamp(3.4rem,7.1vw,6.6rem)] font-medium leading-[0.91] tracking-[-0.075em] text-[#F6F7EF]">
              Research is a <span className="font-serif font-normal italic text-[#B9D8EE]">network.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-[#D5E4EF] sm:text-lg sm:leading-8">
              EYLO AI brings research, people, open questions and opportunities together so you can see where an idea can go.
            </p>
            <form role="search" onSubmit={explore} className="mt-9 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-white p-2 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.65)] transition focus-within:ring-4 focus-within:ring-[#B9D8EE]/25">
              <Search className="ml-3 shrink-0 text-[#567895]" size={20} aria-hidden="true" />
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What are you curious about?" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#173A5D] outline-none placeholder:text-[#788CA0]" />
              <button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#B9D8EE] text-[#173D67] transition hover:bg-[#D8E9F5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><ArrowRight size={19} /></button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-[#C7D7E4]">
              <span className="mr-1">Try</span>
              {['Climate adaptation', 'Public health', 'Machine learning'].map(topic => (
                <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate('/discover?q=' + encodeURIComponent(topic)); }} className="rounded-full border border-white/15 px-3 py-1.5 transition hover:border-[#B9D8EE]/60 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B9D8EE]">{topic}</button>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link to="/discover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#B9D8EE] px-5 text-sm font-semibold text-[#173D67] transition hover:bg-[#D8E9F5]">See EYLO AI <ArrowRight size={16} /></Link>
              <span className="inline-flex items-center gap-2 text-xs font-medium text-[#C7D7E4]"><CheckCircle2 size={15} className="text-[#B9D8EE]" />Start searching, no sign-in needed</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[620px]">
            <div className="pointer-events-none absolute inset-0 -z-10 scale-90 rounded-full bg-[#8DB9D8]/20 blur-[80px]" aria-hidden="true" />
            <div className="relative min-h-[420px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#173A5D]/80 p-5 shadow-[0_35px_110px_-42px_rgba(0,0,0,0.6)] backdrop-blur sm:min-h-[500px] sm:p-7">
              <div className="absolute inset-0 opacity-80" aria-hidden="true">
                <svg viewBox="0 0 620 500" className="h-full w-full" fill="none">
                  <circle cx="320" cy="244" r="155" stroke="#9FC8E8" strokeOpacity=".17" />
                  <circle cx="320" cy="244" r="108" stroke="#9FC8E8" strokeOpacity=".14" />
                  <path d="M71 357 198 270l115-99 132 43 101-117M114 93l84 177 120 73 127-99 101 106M198 270l-30 132 150-59 127 14 101-106M313 171l6 173M71 357l43-264 199 78 233-74" stroke="#B7D1E3" strokeOpacity=".27" strokeWidth="1.2" />
                  <circle cx="320" cy="244" r="5" fill="#D1E7F6" />
                  <circle cx="198" cy="270" r="4" fill="#D1E7F6" />
                  <circle cx="313" cy="171" r="4" fill="#D1E7F6" />
                  <circle cx="440" cy="214" r="4" fill="#D1E7F6" />
                  <circle cx="168" cy="402" r="3" fill="#D1E7F6" />
                  <circle cx="541" cy="117" r="3" fill="#D1E7F6" />
                  <circle cx="440" cy="398" r="3" fill="#D1E7F6" />
                  <circle cx="114" cy="93" r="3" fill="#D1E7F6" />
                  <circle cx="519" cy="344" r="3" fill="#D1E7F6" />
                </svg>
              </div>
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B9D8EE]">One question. Many connections.</p>
                  <p className="mt-2 text-sm text-white/70">A glimpse into climate adaptation</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-[#D5E4D7]"><span className="h-1.5 w-1.5 rounded-full bg-[#B9D8EE]" />Evidence graph</span>
              </div>
              <div className="relative mt-10 grid min-h-[285px] grid-cols-2 items-center gap-3 sm:mt-14">
                <div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#C2DFAF]/45 bg-[#B9D8EE] text-center text-xs font-bold leading-4 text-[#173B32] shadow-[0_0_48px_rgba(185,216,238,0.28)] sm:h-28 sm:w-28">climate<br />adaptation</div>
                <div className="relative z-10 self-start rounded-2xl border border-white/10 bg-[#1B4D74]/90 p-3.5 shadow-xl backdrop-blur sm:ml-2 sm:max-w-[210px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#D6E7F5]"><BookOpen size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">Evidence</span></div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-4 text-white sm:text-xs">{liveRecords[0]?.title || 'Research on climate adaptation'}</p>
                  <p className="mt-2 text-[9px] text-white/55">{recordsLoading ? 'Finding live records…' : recordsError ? 'OpenAlex sample unavailable' : liveRecords[0] ? 'OpenAlex · ' + (liveRecords[0].year || 'Research') : 'OpenAlex · source-linked'}</p>
                </div>
                <div className="relative z-10 col-start-2 row-start-1 mt-20 justify-self-end rounded-2xl border border-white/10 bg-[#1B4D74]/90 p-3.5 shadow-xl backdrop-blur sm:mr-1 sm:max-w-[180px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#D6E7F5]"><Users size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">People</span></div>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-white sm:text-xs">Researchers & shared interests</p>
                  <p className="mt-2 text-[9px] text-white/55">Discover public profiles</p>
                </div>
                <div className="relative z-10 col-start-1 row-start-2 mb-2 self-end rounded-2xl border border-white/10 bg-[#1B4D74]/90 p-3.5 shadow-xl backdrop-blur sm:ml-2 sm:max-w-[185px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#D6E7F5]"><Sparkles size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">Open questions</span></div>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-white sm:text-xs">Patterns worth exploring</p>
                  <p className="mt-2 text-[9px] text-white/55">AI-assisted · verify the evidence</p>
                </div>
                <div className="relative z-10 col-start-2 row-start-2 mb-8 justify-self-end self-end rounded-2xl border border-white/10 bg-[#1B4D74]/90 p-3.5 shadow-xl backdrop-blur sm:mr-1 sm:max-w-[175px] sm:p-4">
                  <div className="flex items-center gap-2 text-[#D6E7F5]"><Briefcase size={14} /><span className="text-[9px] font-bold uppercase tracking-[0.14em]">Next steps</span></div>
                  <p className="mt-2 text-[11px] font-medium leading-4 text-white sm:text-xs">Calls, roles & projects</p>
                  <p className="mt-2 text-[9px] text-white/55">Explore opportunities</p>
                </div>
              </div>
              <div className="relative flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-white/55">
                <span>From discovery to direction</span>
                <Link to="/discover?q=climate%20adaptation" className="inline-flex min-h-8 items-center gap-1 font-semibold text-[#D6E7F5] hover:text-white">See the evidence <ArrowRight size={13} /></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="eylo-does" aria-labelledby="eylo-does-title" className="border-b border-[#DFE7EF] bg-[#F6F9FC] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">What we do</p>
            <h2 id="eylo-does-title" className="mt-4 font-serif text-4xl leading-[1.06] tracking-[-0.05em] text-[#102B49] sm:text-5xl">One place for the next step in your research.</h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#536B82]">EYLO AI connects papers, people, open questions and research opportunities around what you want to explore.</p>
          </div>

          <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-[1.5rem] border border-[#D9E4EF] bg-white shadow-[0_24px_75px_-54px_rgba(16,43,73,0.45)]">
            <div className="flex gap-1 overflow-x-auto border-b border-[#E3EAF2] px-3 pt-3 sm:justify-center sm:px-5" role="tablist" aria-label="What EYLO AI does">
              {WORKFLOWS.map(({ id, label, icon: Icon }) => (
                <button key={id} id={'workflow-tab-' + id} type="button" role="tab" aria-controls="workflow-panel" aria-selected={activeWorkflow === id} onClick={() => setActiveWorkflow(id)} className={'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition sm:px-5 sm:text-sm ' + (activeWorkflow === id ? 'border-[#205986] text-[#153C62]' : 'border-transparent text-[#647A90] hover:text-[#153C62]')}>
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <div id="workflow-panel" role="tabpanel" aria-labelledby={'workflow-tab-' + activeWorkflow} className="grid min-h-[210px] gap-6 p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-[#EDF4F8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#356E98]"><SelectedIcon size={12} aria-hidden="true" />{selected.source}</p>
                <h3 className="mt-4 max-w-lg font-serif text-2xl leading-tight tracking-[-0.03em] text-[#173A5D] sm:text-3xl">{selected.title}</h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#61788E]">{selected.description}</p>
                {selected.note && <p className="mt-3 max-w-xl text-xs leading-5 text-[#697D90]">{selected.note}</p>}
                {activeWorkflow === 'papers' && liveRecords.length > 0 && (
                  <div className="mt-4 space-y-1.5">
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

      <section id="how-it-works" aria-labelledby="how-title" className="border-b border-[#DFE7EF] bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">How it works</p>
            <h2 id="how-title" className="mt-4 font-serif text-4xl leading-tight tracking-[-0.05em] text-[#102B49] sm:text-5xl">A question becomes a way forward.</h2>
          </div>
          <ol className="mt-9 grid gap-3 md:grid-cols-3">
            {[
              { number: '01', title: 'Ask', text: 'Start with a topic, a problem or an idea you want to explore.' },
              { number: '02', title: 'Connect', text: 'Follow the evidence to people, open questions and related work.' },
              { number: '03', title: 'Move forward', text: 'Save discoveries and explore projects, roles or funding calls.' },
            ].map(({ number, title, text }) => (
              <li key={number} className="rounded-2xl border border-[#DDE7F0] bg-[#FBFCFE] p-6 sm:p-7">
                <span className="text-xs font-bold tracking-[0.16em] text-[#6E879C]">{number}</span>
                <h3 className="mt-5 text-lg font-semibold text-[#173452]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#61778B]">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="about-eylo" aria-labelledby="about-title" className="bg-[#F1F5F9] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">Who we are</p>
            <h2 id="about-title" className="mt-4 font-serif text-3xl leading-tight tracking-[-0.05em] text-[#102B49] sm:text-4xl">We’re building a more connected way to do research.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#536B82]">EYLO AI is a research discovery platform for people who want to find knowledge, collaborators and opportunities without losing the thread between them.</p>
          </div>
          <div className="border-l-2 border-[#8CB4D1] pl-6 lg:pl-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#37749B]">Our vision</p>
            <h3 className="mt-4 font-serif text-3xl leading-tight tracking-[-0.05em] text-[#102B49] sm:text-4xl">Every good question should have a clearer path to progress.</h3>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#536B82]">We imagine a research world where evidence is easier to navigate, relevant people are easier to find, and promising ideas can reach the resources they need.</p>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-6xl rounded-[1.5rem] bg-[#102B49] px-6 py-8 text-white sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-9">
          <div>
            <p className="text-lg font-semibold">Ready to see EYLO AI in action?</p>
            <p className="mt-1 text-sm text-[#D5E4EF]">Explore the real research discovery experience.</p>
          </div>
          <Link to="/discover" className="mt-5 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#B9D8EE] px-6 text-sm font-semibold text-[#173D67] transition hover:bg-[#D8E9F5] sm:mt-0">
            See EYLO AI <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-[#F8FAFC] px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="160" height="48" loading="lazy" className="h-10 w-auto max-w-[150px] object-contain" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link to="/discover" className="hover:text-slate-900">Discover</Link>
            <a href="#eylo-does" className="hover:text-slate-900">What EYLO does</a>
            <Link to="/login" className="hover:text-slate-900">Sign in</Link>
            <span>© {new Date().getFullYear()} EYLO</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
