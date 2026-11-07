import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Search, Users, Briefcase, ExternalLink, Menu, X } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';
import { searchOpenAlexWorks } from '@/lib/eyra-api';

const workflows = [
  { label: 'Discover', subtitle: 'Find the evidence.', description: 'Explore scholarly literature and trace records back to their sources.', icon: BookOpen, href: '/discover' },
  { label: 'Connect', subtitle: 'See the people.', description: 'Explore researchers and institutions through their public scholarly work.', icon: Users, href: '/login?from=%2Fresearchers' },
  { label: 'Advance', subtitle: 'Find the next step.', description: 'Explore research roles, projects and available funding records.', icon: Briefcase, href: '/login?from=%2Fcareers' },
];

export default function Landing() {
  const [question, setQuestion] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveRecords, setLiveRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    searchOpenAlexWorks('climate adaptation', 3, 'recent', { throwOnError: true })
      .then(records => { if (active) setLiveRecords(records); })
      .catch(() => { if (active) setRecordsError('Live evidence unavailable right now.'); })
      .finally(() => { if (active) setRecordsLoading(false); });
    return () => { active = false; };
  }, []);

  const explore = event => {
    event?.preventDefault();
    const query = question.trim();
    if (query) trackSearchStarted('homepage');
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#fff] text-[#15191E]">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-3">Skip to research search</a>
      <header className="sticky top-0 z-50 border-b border-black/[.07] bg-white/[.94] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-5 px-6 md:px-12">
          <Link to="/" aria-label="EYLO home" className="shrink-0"><img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="150" height="44" className="h-[40px] w-auto max-w-[140px] object-contain" fetchPriority="high"/></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-9 md:flex"><a className="text-[13px] font-medium text-[#3F4851] transition hover:text-black" href="#platform">Platform</a><a className="text-[13px] font-medium text-[#3F4851] transition hover:text-black" href="#experience">Experience</a><a className="text-[13px] font-medium text-[#3F4851] transition hover:text-black" href="#vision">Vision</a><Link className="text-[13px] font-medium text-[#3F4851] transition hover:text-black" to="/contact">Contact</Link></nav>
          <div className="flex items-center gap-3"><Link to="/login" className="hidden text-[13px] font-medium text-[#3F4851] sm:inline-flex">Sign in</Link><Link to="/discover" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#161B20] px-5 text-[13px] font-semibold text-white transition hover:bg-[#39434D]">Explore EYLO <ArrowRight size={15}/></Link><button aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} type="button" className="grid h-10 w-10 place-items-center rounded-full border border-[#E2E5E7] md:hidden" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={19}/> : <Menu size={19}/>}</button></div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="flex flex-col gap-5 border-t border-[#E7EAED] bg-white px-7 py-6 text-sm font-medium md:hidden">{[['Platform','#platform'],['Experience','#experience'],['Vision','#vision']].map(([name,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{name}</a>)}<Link to="/contact" onClick={()=>setMenuOpen(false)}>Contact</Link></nav>}
      </header>

      <section className="relative isolate overflow-hidden bg-[#F7F8FA]">
        <div className="mx-auto flex min-h-[680px] max-w-[1440px] flex-col items-center justify-center px-6 pb-0 pt-24 text-center md:min-h-[770px] md:px-12 md:pt-32">
          <p className="text-[11px] font-semibold uppercase tracking-[.27em] text-[#6C737A]">EYLO / THE RESEARCH PLATFORM</p>
          <h1 className="mt-8 max-w-[1050px] text-[clamp(3.8rem,9vw,9.2rem)] font-semibold leading-[.93] tracking-[-.085em] text-[#15191E]">Where research<br/>finds direction<span className="text-[#5292C1]">.</span></h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-[#59646D] sm:text-lg">Discover knowledge, people and opportunities.<br className="hidden sm:block"/> One platform. A clearer way forward.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3"><Link to="/discover" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#151A20] px-7 text-sm font-semibold text-white transition hover:bg-[#39434D]">Explore the platform <ArrowRight size={16}/></Link><a href="#platform" className="inline-flex min-h-12 items-center rounded-full border border-[#CBD1D6] bg-white px-7 text-sm font-semibold text-[#242C33] transition hover:border-[#7A8B98]">Discover EYLO</a></div>
          <div className="relative mt-16 w-full max-w-[1160px] translate-y-1 overflow-hidden rounded-t-[26px] border border-[#D4DBE2] bg-white shadow-[0_35px_100px_-35px_rgba(25,40,55,.25)] md:mt-20">
            <div className="flex h-11 items-center gap-2 border-b border-[#E5EAF0] bg-[#FBFCFD] px-5"><span className="h-2.5 w-2.5 rounded-full bg-[#D6DDE4]"/><span className="h-2.5 w-2.5 rounded-full bg-[#D6DDE4]"/><span className="h-2.5 w-2.5 rounded-full bg-[#D6DDE4]"/><span className="mx-auto text-[11px] font-medium tracking-[.1em] text-[#86929E]">EYLO / RESEARCH DISCOVERY</span></div>
            <div className="grid min-h-[265px] gap-6 p-6 text-left sm:p-10 md:grid-cols-[.7fr_1.3fr] md:gap-10">
              <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#7491A7]">A research question</p><h2 className="mt-5 max-w-xs text-3xl font-semibold leading-[1.13] tracking-[-.05em] text-[#202C36] sm:text-4xl">Explore what the evidence says.</h2><p className="mt-4 text-xs leading-6 text-[#71808E]">Source-linked scholarly discovery, with context you can inspect.</p><span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#316F9C]">Illustrative product view <ExternalLink size={12}/></span></div>
              <div className="rounded-2xl border border-[#E2E9F0] bg-[#F8FBFD] p-5 sm:p-7"><div className="flex items-center gap-3 border-b border-[#E0E8F0] pb-5 text-[#31556F]"><Search size={18}/><span className="text-sm font-semibold">Climate adaptation</span><span className="ml-auto hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-medium text-[#6486A0] sm:inline-flex">Scholarly records</span></div>
                <div className="mt-5 space-y-3">{[0,1,2].map((index)=><div key={index} className="flex items-start gap-4 rounded-xl border border-[#E4EAF0] bg-white px-4 py-4"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EDF3F8] text-[#557C9C]"><BookOpen size={15}/></span><div className="min-w-0"><p className="line-clamp-2 text-xs font-semibold leading-5 text-[#334A5D]">{liveRecords[index]?.title || ['Explore scholarly evidence','Review relevant publications','Trace evidence to source records'][index]}</p><p className="mt-1.5 text-[10px] text-[#8594A1]">{recordsLoading ? 'Loading live sample…' : recordsError ? 'Illustrative preview · live sample unavailable' : liveRecords[index] ? `OpenAlex · ${liveRecords[index].year || 'Scholarly work'}` : 'Illustrative preview'}</p></div></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-white px-6 py-24 sm:py-32 md:px-12"><div className="mx-auto max-w-[1200px]"><div className="mx-auto max-w-[850px] text-center"><p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#81909C]">THE PLATFORM</p><h2 className="mt-5 text-[clamp(2.75rem,6vw,5.5rem)] font-semibold leading-[1.03] tracking-[-.075em]">Everything connects.</h2><p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#687682]">From an initial question to the work and people around it.</p></div>
          <div className="mt-16 grid gap-4 lg:grid-cols-3">{workflows.map(({label,subtitle,description,icon:Icon,href})=><Link to={href} key={label} className="group flex min-h-[385px] flex-col overflow-hidden rounded-[22px] border border-[#E6E9ED] bg-[#F5F7F9] p-9 transition hover:-translate-y-1 hover:shadow-[0_24px_55px_-30px_rgba(15,31,47,.25)]"><div className="relative flex h-[130px] items-center justify-center"><div className="absolute h-24 w-24 rounded-full border border-[#C8D4DD]"/><div className="absolute h-36 w-36 rounded-full border border-[#DDE5EB]"/><span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white text-[#345F7E] shadow-sm"><Icon size={28} strokeWidth={1.5}/></span></div><p className="mt-8 text-[11px] font-semibold uppercase tracking-[.2em] text-[#6C879B]">{label}</p><h3 className="mt-3 text-[2rem] font-semibold tracking-[-.05em] text-[#242E37]">{subtitle}</h3><p className="mt-3 max-w-xs text-sm leading-6 text-[#6B7783]">{description}</p><span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-[#2F6184]">Explore <ArrowRight size={15}/></span></Link>)}</div>
        </div></section>

      <section id="experience" className="overflow-hidden bg-[#111820] px-6 py-24 text-white sm:py-32 md:px-12"><div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#9DB5C8]">THE EXPERIENCE</p><h2 className="mt-6 max-w-md text-[clamp(3.2rem,6vw,6rem)] font-semibold leading-[1] tracking-[-.075em]">Less noise.<br/>More insight.</h2><p className="mt-6 max-w-sm text-base leading-7 text-[#B3C0CC]">The next discovery starts with a question. Explore real scholarly sources before signing in.</p><Link to="/discover" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#17212A]">See it in action <ArrowRight size={16}/></Link></div><div className="rounded-[25px] border border-white/10 bg-[#1D2833] p-6 shadow-2xl sm:p-10"><p className="text-xs font-semibold tracking-[.14em] text-[#ADC4D8]">START EXPLORING</p><form role="search" onSubmit={explore} className="mt-6 flex min-w-0 items-center gap-2 rounded-2xl bg-white p-2 text-[#152B3C] focus-within:ring-4 focus-within:ring-[#9EBACF]/30"><Search size={20} className="ml-3 shrink-0 text-[#698094]"/><label htmlFor="research-question" className="sr-only">Research question</label><input id="research-question" value={question} onChange={event=>setQuestion(event.target.value)} placeholder="What are you curious about?" className="min-w-0 flex-1 bg-transparent px-2 py-3.5 text-sm text-[#162E41] outline-none placeholder:text-[#82929E]"/><button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17212B] text-white transition hover:bg-[#33516A]"><ArrowRight size={18}/></button></form><div className="mt-5 flex flex-wrap gap-2">{['Climate adaptation','Public health','Machine learning'].map(topic=><button key={topic} type="button" onClick={()=>{trackSearchStarted('homepage_suggestion');navigate('/discover?q='+encodeURIComponent(topic));}} className="rounded-full border border-[#48596A] px-3 py-2 text-xs text-[#D3E0EC] transition hover:border-white/60">{topic}</button>)}</div><p className="mt-7 text-xs leading-6 text-[#8EA4B8]">Scholarly discovery uses source records from services including OpenAlex. AI-assisted interpretations should be verified against original sources.</p></div></div></section>

      <section id="vision" className="bg-[#F5F6F7] px-6 py-28 text-center sm:py-36 md:px-12"><div className="mx-auto max-w-[900px]"><p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#7A8791]">OUR VISION</p><h2 className="mt-7 text-[clamp(3rem,7vw,7rem)] font-semibold leading-[.99] tracking-[-.08em] text-[#171D23]">Great ideas deserve<br/>a clearer path.</h2><p className="mx-auto mt-8 max-w-md text-sm leading-7 text-[#6C7781]">We are building a more connected way to discover research and explore where it can lead.</p><Link to="/contact" className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#B7C1C9] bg-white px-7 text-sm font-semibold text-[#26333E]">Get in touch <ArrowRight size={16}/></Link></div></section>

      <footer className="border-t border-[#E7E9EC] bg-white px-6 py-9 md:px-12"><div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="130" height="40" className="h-9 w-auto" loading="lazy"/><nav aria-label="Footer" className="flex flex-wrap gap-5 text-xs font-medium text-[#66727D]"><Link to="/discover">Platform</Link><Link to="/contact">Contact</Link><Link to="/login">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></nav></div></footer>
    </main>
  );
}
