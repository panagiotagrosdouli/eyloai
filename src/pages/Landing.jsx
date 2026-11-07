import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Search, Users, Briefcase, ExternalLink, Menu, X } from 'lucide-react';

const workflows = [
  { label: 'Discover', subtitle: 'Find the evidence.', description: 'Explore scholarly literature and trace records back to their sources.', icon: BookOpen, href: '/discover' },
  { label: 'Connect', subtitle: 'See the people.', description: 'Explore researchers and institutions through their public scholarly work.', icon: Users, href: '/login?from=%2Fresearchers' },
  { label: 'Advance', subtitle: 'Find the next step.', description: 'Explore research roles, projects and available funding records.', icon: Briefcase, href: '/login?from=%2Fcareers' },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return () => { active = false; };
  }, []);

  const explore = event => {
    event?.preventDefault();
    const query = question.trim();
    if (query) trackSearchStarted('homepage');
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#FFFFFF] text-[#182A38]">
      <header className="sticky top-0 z-50 border-b border-black/[.07] bg-white/[.94] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-5 px-6 md:px-12">
          <Link to="/" aria-label="EYLO home" className="shrink-0"><img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="150" height="44" className="h-[40px] w-auto max-w-[140px] object-contain" fetchPriority="high"/></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-9 md:flex"><a className="text-[13px] font-medium text-[#435D6A] transition hover:text-black" href="#platform">Platform</a><a className="text-[13px] font-medium text-[#435D6A] transition hover:text-black" href="#experience">Experience</a><a className="text-[13px] font-medium text-[#435D6A] transition hover:text-black" href="#vision">Vision</a><Link className="text-[13px] font-medium text-[#435D6A] transition hover:text-black" to="/contact">Contact</Link></nav>
          <div className="flex items-center gap-3"><Link to="/login" className="hidden text-[13px] font-medium text-[#435D6A] sm:inline-flex">Sign in</Link><Link to="/discover" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#1B3547] px-5 text-[13px] font-semibold text-white transition hover:bg-[#2D5267]">Enter EYLO AI <ArrowRight size={15}/></Link><button aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} type="button" className="grid h-10 w-10 place-items-center rounded-full border border-[#E2E5E7] md:hidden" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={19}/> : <Menu size={19}/>}</button></div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="flex flex-col gap-5 border-t border-[#E7EAED] bg-white px-7 py-6 text-sm font-medium md:hidden">{[['Platform','#platform'],['Experience','#experience'],['Vision','#vision']].map(([name,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{name}</a>)}<Link to="/contact" onClick={()=>setMenuOpen(false)}>Contact</Link></nav>}
      </header>

      <section className="relative isolate overflow-hidden bg-[#F8FAF9]">
        <div className="mx-auto flex min-h-[600px] max-w-[1440px] flex-col items-center justify-center px-6 pb-0 pt-14 text-center md:min-h-[650px] md:px-12 md:pt-20">
          <p className="text-[11px] font-semibold uppercase tracking-[.27em] text-[#637986]">EYLO / THE RESEARCH PLATFORM</p>
          <h1 className="mt-8 max-w-[1050px] text-[clamp(3.8rem,9vw,9.2rem)] font-semibold leading-[.93] tracking-[-.085em] text-[#182A38]">Where research<br/>finds direction<span className="text-[#5F899C]">.</span></h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-[#566B77] sm:text-lg">A focused research platform for students, academics and researchers.<br className="hidden sm:block"/> Explore evidence, people and opportunities with clarity.</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3"><Link to="/discover" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#1B3547] px-8 text-sm font-semibold text-white transition hover:bg-[#315D73]">Enter EYLO AI <ArrowRight size={16}/></Link><a href="#platform" className="inline-flex min-h-12 items-center rounded-full border border-[#C9D7DB] bg-white px-7 text-sm font-semibold text-[#263D4A] transition hover:border-[#708C97]">What we do</a></div>
          <p className="mt-4 text-xs font-medium text-[#637C87]">Visit the EYLO AI application to explore research. Public discovery does not require an account.</p>
          <div className="relative mt-12 w-full max-w-[1160px] translate-y-1 overflow-hidden rounded-t-[26px] border border-[#D5E2E5] bg-white shadow-[0_35px_100px_-35px_rgba(25,40,55,.25)] md:mt-14">
            <div className="flex h-11 items-center gap-2 border-b border-[#E5EAF0] bg-[#FBFCFD] px-5"><span className="h-2.5 w-2.5 rounded-full bg-[#D6DDE4]"/><span className="h-2.5 w-2.5 rounded-full bg-[#D6DDE4]"/><span className="h-2.5 w-2.5 rounded-full bg-[#D6DDE4]"/><span className="mx-auto text-[11px] font-medium tracking-[.1em] text-[#86929E]">EYLO / RESEARCH DISCOVERY</span></div>
            <div className="grid min-h-[265px] gap-6 p-6 text-left sm:p-10 md:grid-cols-[.7fr_1.3fr] md:gap-10">
              <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#607D8D]">A research question</p><h2 className="mt-5 max-w-xs text-3xl font-semibold leading-[1.13] tracking-[-.05em] text-[#1D3544] sm:text-4xl">Explore what the evidence says.</h2><p className="mt-4 text-xs leading-6 text-[#71808E]">Source-linked scholarly discovery, with context you can inspect.</p><span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#32657F]">Illustrative product view <ExternalLink size={12}/></span></div>
              <div className="rounded-2xl border border-[#E2E9F0] bg-[#F8FBFD] p-5 sm:p-7"><div className="flex items-center gap-3 border-b border-[#E0E8F0] pb-5 text-[#31556F]"><Search size={18}/><span className="text-sm font-semibold">Climate adaptation</span><span className="ml-auto hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-medium text-[#6486A0] sm:inline-flex">Scholarly records</span></div>
                <div className="mt-5 space-y-3">{['Scholarly literature','Researchers and institutions','Research opportunities'].map((label,index)=><div key={label} className="flex items-start gap-4 rounded-xl border border-[#E4EAF0] bg-white px-4 py-4"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EDF3F8] text-[#557C9C]"><BookOpen size={15}/></span><div className="min-w-0"><p className="text-xs font-semibold leading-5 text-[#334A5D]">{label}</p><p className="mt-1.5 text-[10px] text-[#8594A1]">{['Source-linked evidence discovery','Public scholarly profiles','Related roles and funding records'][index]}</p></div></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-white px-6 py-24 sm:py-32 md:px-12"><div className="mx-auto max-w-[1200px]"><div className="mx-auto max-w-[850px] text-center"><p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#718896]">THE PLATFORM</p><h2 className="mt-5 text-[clamp(2.75rem,6vw,5.5rem)] font-semibold leading-[1.03] tracking-[-.075em]">Everything connects.</h2><p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#617782]">From an initial question to the work and people around it.</p></div>
          <div className="mt-16 grid gap-4 lg:grid-cols-3">{workflows.map(({label,subtitle,description,icon:Icon,href})=><Link to={href} key={label} className="group flex min-h-[385px] flex-col overflow-hidden rounded-[22px] border border-[#DEE8E9] bg-[#F4F8F7] p-9 transition hover:-translate-y-1 hover:shadow-[0_24px_55px_-30px_rgba(15,31,47,.25)]"><div className="relative flex h-[130px] items-center justify-center"><div className="absolute h-24 w-24 rounded-full border border-[#C8D4DD]"/><div className="absolute h-36 w-36 rounded-full border border-[#DDE5EB]"/><span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white text-[#3C6980] shadow-sm"><Icon size={28} strokeWidth={1.5}/></span></div><p className="mt-8 text-[11px] font-semibold uppercase tracking-[.2em] text-[#607E8E]">{label}</p><h3 className="mt-3 text-[2rem] font-semibold tracking-[-.05em] text-[#223D4B]">{subtitle}</h3><p className="mt-3 max-w-xs text-sm leading-6 text-[#5B7580]">{description}</p><span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-[#315D73]">Explore <ArrowRight size={15}/></span></Link>)}</div>
        </div></section>

      <section id="experience" className="overflow-hidden bg-[#193344] px-6 py-24 text-white sm:py-32 md:px-12"><div className="mx-auto grid max-w-[1200px] items-center gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#B5D3DB]">THE EXPERIENCE</p><h2 className="mt-6 max-w-md text-[clamp(3.2rem,6vw,6rem)] font-semibold leading-[1] tracking-[-.075em]">Less noise.<br/>More insight.</h2><p className="mt-6 max-w-sm text-base leading-7 text-[#D5E3E8]">The next discovery starts with a question. Explore real scholarly sources before signing in.</p><Link to="/discover" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#213C4D]">Launch EYLO AI <ArrowRight size={16}/></Link></div><div className="rounded-[25px] border border-white/10 bg-[#254559] p-6 shadow-2xl sm:p-10"><p className="text-xs font-semibold tracking-[.14em] text-[#ADC4D8]">ENTER THE PLATFORM</p><Link to="/discover" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#193447]">Enter EYLO AI <ArrowRight size={16}/></Link><p className="mt-7 text-xs leading-6 text-[#B3CAD3]">Scholarly discovery uses source records from services including OpenAlex. AI-assisted interpretations should be verified against original sources.</p></div></div></section>

      <section id="vision" className="bg-[#F7F9F8] px-6 py-28 text-center sm:py-36 md:px-12"><div className="mx-auto max-w-[900px]"><p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#647C89]">OUR VISION</p><h2 className="mt-7 text-[clamp(3rem,7vw,7rem)] font-semibold leading-[.99] tracking-[-.08em] text-[#183140]">Great ideas deserve<br/>a clearer path.</h2><p className="mx-auto mt-8 max-w-md text-sm leading-7 text-[#6C7781]">We are building a more connected way to discover research and explore where it can lead.</p><Link to="/contact" className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#BFCDD2] bg-white px-7 text-sm font-semibold text-[#294755]">Get in touch <ArrowRight size={16}/></Link></div></section>

      <footer className="border-t border-[#E7E9EC] bg-white px-6 py-9 md:px-12"><div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="130" height="40" className="h-9 w-auto" loading="lazy"/><nav aria-label="Footer" className="flex flex-wrap gap-5 text-xs font-medium text-[#66727D]"><Link to="/discover">Enter EYLO AI</Link><Link to="/contact">Contact</Link><Link to="/login">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></nav></div></footer>
    </main>
  );
}
