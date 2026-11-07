import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Bookmark, BriefcaseBusiness, Clock3, FileText, FlaskConical, GraduationCap, Layers3, Menu, Search, UsersRound, X } from 'lucide-react';

const audience = [
  { label: 'For students', icon: GraduationCap },
  { label: 'For academics', icon: UsersRound },
  { label: 'For researchers', icon: FlaskConical },
];

const features = [
  { title: 'Discover', description: 'Find relevant, source-linked research across disciplines.', icon: Search },
  { title: 'Connect', description: 'Explore researchers, institutions and ideas.', icon: UsersRound },
  { title: 'Advance', description: 'Find research opportunities and move your work forward.', icon: Layers3 },
];

const previews = [
  { title: 'Scholarly publications', meta: 'Explore sources and evidence', icon: FileText },
  { title: 'Researchers and institutions', meta: 'Follow related scholarly work', icon: UsersRound },
  { title: 'Research opportunities', meta: 'Find possible next steps', icon: BriefcaseBusiness },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main id="main-content" className="min-h-screen bg-white text-[#181818]">
      <a href="#about" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to content</a>

      <header className="sticky top-0 z-50 border-b border-[#ECECEC] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-9 lg:px-16">
          <Link to="/" aria-label="EYLO home" className="inline-flex shrink-0 items-center">
            <img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" width="148" height="43" className="h-[42px] w-auto max-w-[148px] object-contain" fetchPriority="high" />
          </Link>
          <nav aria-label="Company navigation" className="hidden items-center gap-9 lg:flex">
            <a href="#product" className="text-[13px] font-medium text-[#404040] transition hover:text-black">Product</a>
            <a href="#audience" className="text-[13px] font-medium text-[#404040] transition hover:text-black">For academics</a>
            <a href="#features" className="text-[13px] font-medium text-[#404040] transition hover:text-black">What EYLO does</a>
            <Link to="/contact" className="text-[13px] font-medium text-[#404040] transition hover:text-black">Company</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="hidden min-h-10 items-center rounded-xl border border-[#DEDEDE] px-4 text-[13px] font-medium text-[#272727] transition hover:bg-[#F7F7F7] sm:inline-flex">Log in</Link>
            <Link to="/discover" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#191919] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#363636] sm:px-5 sm:text-[13px]">Enter EYLO AI <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#E5E5E5] lg:hidden">{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
          </div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="flex flex-col gap-5 border-t border-[#ECECEC] bg-white px-7 py-6 text-sm font-medium lg:hidden">
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
          <a href="#audience" onClick={() => setMenuOpen(false)}>For academics</a>
          <a href="#features" onClick={() => setMenuOpen(false)}>What EYLO does</a>
          <Link to="/contact" onClick={() => setMenuOpen(false)}>Company</Link>
          <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
        </nav>}
      </header>

      <section id="about" className="overflow-hidden bg-white">
        <div className="mx-auto grid max-w-[1480px] items-center gap-12 px-5 pb-20 pt-16 sm:px-9 sm:pt-24 lg:min-h-[700px] lg:grid-cols-[.94fr_1.06fr] lg:gap-14 lg:px-16 lg:pb-28 lg:pt-28">
          <div className="relative z-10">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E9E9E9] bg-[#FAFAFA] px-3 py-1.5 text-[11px] font-medium text-[#636363]"><span className="h-1.5 w-1.5 rounded-full bg-[#555555]"/> A connected research platform</p>
            <h1 className="max-w-[760px] text-[clamp(3.3rem,6.6vw,6.7rem)] font-bold leading-[1.02] tracking-[-.078em] text-[#191919]">A better way to<br/>explore research<span className="text-[#191919]">.</span></h1>
            <p className="mt-7 max-w-[550px] text-[clamp(1.1rem,1.7vw,1.4rem)] leading-[1.55] text-[#55585B]">Discover papers, researchers and opportunities in one connected platform.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/discover" className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#191919] px-6 text-sm font-semibold text-white shadow-[0_9px_23px_-12px_rgba(0,0,0,.35)] transition hover:bg-[#383838]">Enter EYLO AI <ArrowRight size={17}/></Link>
              <a href="#features" className="inline-flex min-h-12 items-center rounded-xl border border-[#D9D9D9] bg-white px-6 text-sm font-semibold text-[#242424] transition hover:bg-[#F8F8F8]">Learn more</a>
            </div>
            <div id="audience" className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#EEEEEE] pt-6 text-xs text-[#404040] sm:gap-x-9">
              {audience.map(({label,icon:Icon})=><span key={label} className="inline-flex items-center gap-2 font-medium"><Icon size={18} strokeWidth={1.65} aria-hidden="true"/>{label}</span>)}
            </div>
          </div>

          <div id="product" className="relative min-w-0 py-5 lg:py-14">
            <div className="pointer-events-none absolute -right-[10%] -top-5 h-[52%] w-[66%] rounded-[90px] bg-[#E8F0EE] blur-[.5px]" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-4 -left-[10%] h-[43%] w-[63%] rounded-[90px] bg-[#EEF2F0]" aria-hidden="true"/>
            <div className="relative overflow-hidden rounded-[19px] border border-[#E1E3E4] bg-white shadow-[0_24px_75px_-23px_rgba(24,35,35,.22)]">
              <div className="flex h-10 items-center gap-2 border-b border-[#E8E8E8] bg-[#FDFDFD] px-4" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B9B9B9]"/><span className="h-2.5 w-2.5 rounded-full bg-[#C9C9C9]"/><span className="h-2.5 w-2.5 rounded-full bg-[#D9D9D9]"/>
              </div>
              <div className="grid min-h-[425px] grid-cols-[118px_minmax(0,1fr)] sm:grid-cols-[155px_minmax(0,1fr)]">
                <div className="border-r border-[#EBEBEB] bg-[#FCFCFC] px-2 py-5 sm:px-3">
                  <p className="px-2 text-[12px] font-bold tracking-[-.04em] sm:px-3">EYLO</p>
                  <div className="mt-5 space-y-1.5 text-[10px] text-[#686868] sm:text-[11px]">
                    <div className="flex items-center gap-2 rounded-md bg-[#EFEFEF] px-2 py-2 font-semibold text-[#252525]"><Search size={14} className="shrink-0"/> Discover</div>
                    <div className="flex items-center gap-2 px-2 py-2"><BookOpen size={14} className="shrink-0"/> Papers</div>
                    <div className="flex items-center gap-2 px-2 py-2"><UsersRound size={14} className="shrink-0"/> Researchers</div>
                    <div className="flex items-center gap-2 px-2 py-2"><GraduationCap size={14} className="shrink-0"/> Opportunities</div>
                  </div>
                  <div className="mt-6 border-t border-[#E8E8E8] pt-3 text-[10px] text-[#777]">
                    <div className="flex items-center gap-2 px-2 py-2"><Bookmark size={13}/> Saved</div>
                    <div className="flex items-center gap-2 px-2 py-2"><Clock3 size={13}/> History</div>
                  </div>
                </div>
                <div className="min-w-0 px-4 py-7 sm:px-7 sm:py-9">
                  <h2 className="text-[clamp(1.25rem,2.5vw,1.85rem)] font-bold tracking-[-.05em]">Discover research</h2>
                  <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#E0E0E0] px-3 py-3 text-xs text-[#999]"><Search size={16} className="shrink-0"/><span className="truncate">Search for a topic, paper or researcher...</span></div>
                  <div className="mt-5">
                    <p className="text-[10px] font-semibold text-[#525252]">Suggested topics</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">{['Machine learning','Sustainability','Education','Health'].map(topic=><span key={topic} className="rounded-full bg-[#F2F3F3] px-2.5 py-1.5 text-[9px] text-[#585858]">{topic}</span>)}</div>
                  </div>
                  <div className="mt-6 space-y-0 overflow-hidden rounded-xl border border-[#E9E9E9]">
                    {previews.map(({title,meta,icon:Icon})=><div key={title} className="flex items-center gap-3 border-b border-[#EEEEEE] bg-white px-3 py-4 last:border-b-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F4F4F4] text-[#676767]"><Icon size={17}/></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#383838] sm:text-xs">{title}</p><p className="mt-1 truncate text-[9px] text-[#8A8A8A] sm:text-[10px]">{meta}</p></div><Bookmark size={15} className="shrink-0 text-[#A4A4A4]" aria-hidden="true"/></div>)}
                  </div>
                  <p className="mt-3 text-[10px] text-[#909090]">Illustrative product overview, not a live application view.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-[#F0F0F0] bg-[#FAFAFA] px-5 py-20 sm:px-9 sm:py-24 lg:px-16">
        <div className="mx-auto max-w-[1350px]">
          <div className="mb-12 max-w-[660px]"><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#777]">What EYLO does</p><h2 className="mt-4 text-[clamp(2.3rem,4.5vw,4.1rem)] font-bold leading-[1.08] tracking-[-.06em]">Research, made easier to navigate.</h2></div>
          <div className="grid gap-10 md:grid-cols-3 md:gap-0">
            {features.map(({title,description,icon:Icon})=><div key={title} className="border-b border-[#EAEAEA] pb-9 md:border-b-0 md:border-r md:px-10 md:pb-3 md:first:pl-0 md:last:border-r-0 md:last:pr-0"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F1F0ED] text-[#212121]"><Icon size={27} strokeWidth={1.7}/></span><h3 className="mt-6 text-[26px] font-bold tracking-[-.05em]">{title}</h3><p className="mt-2 max-w-[300px] text-base leading-7 text-[#5F6265]">{description}</p></div>)}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 text-center sm:px-9 sm:py-28 lg:px-16">
        <div className="mx-auto max-w-[800px]">
          <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#888]">Built for research</p>
          <h2 className="mt-5 text-[clamp(2.5rem,5vw,4.8rem)] font-bold leading-[1.08] tracking-[-.065em]">Your next idea starts here.</h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#626262]">Explore source-linked scholarship without an account. Save your work and access advanced tools by signing in.</p>
          <Link to="/discover" className="mt-9 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#191919] px-7 text-sm font-semibold text-white transition hover:bg-[#363636]">Enter EYLO AI <ArrowRight size={17}/></Link>
        </div>
      </section>

      <footer className="border-t border-[#ECECEC] bg-white px-5 py-9 sm:px-9 lg:px-16">
        <div className="mx-auto flex max-w-[1350px] flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <Link to="/" aria-label="EYLO home"><img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" width="130" height="38" loading="lazy" className="h-[38px] w-auto"/></Link>
          <nav aria-label="Footer" className="flex flex-wrap gap-5 text-xs font-medium text-[#656565]"><Link to="/discover">EYLO AI</Link><Link to="/contact">Company</Link><Link to="/login">Log in</Link><span>© {new Date().getFullYear()} EYLO</span></nav>
        </div>
      </footer>
    </main>
  );
}
