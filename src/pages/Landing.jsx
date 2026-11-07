import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Menu, X, BookOpen, Users, Compass, Search } from 'lucide-react';

const pillars = [
  { number: '01', title: 'Knowledge', description: 'Explore scholarly records with links to the original sources.', icon: BookOpen },
  { number: '02', title: 'People', description: 'Discover researchers and institutions through their published work.', icon: Users },
  { number: '03', title: 'Possibility', description: 'Find research opportunities and build on the work that matters.', icon: Compass },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main id="main-content" className="min-h-screen bg-[#F6F5F1] text-[#1B2529]">
      <a href="#about" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-5 focus:py-3">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-[#293A3B]/10 bg-[#F6F5F1]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1450px] items-center justify-between gap-5 px-5 sm:px-9 lg:px-16">
          <Link to="/" aria-label="EYLO home" className="inline-flex items-center">
            <img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" width="142" height="42" className="h-10 w-auto max-w-[142px] object-contain" fetchPriority="high" />
          </Link>
          <nav aria-label="Company navigation" className="hidden items-center gap-9 md:flex">
            <a href="#about" className="text-[13px] font-medium text-[#4D5D60] transition hover:text-[#111A1D]">Company</a>
            <a href="#product" className="text-[13px] font-medium text-[#4D5D60] transition hover:text-[#111A1D]">Product</a>
            <a href="#vision" className="text-[13px] font-medium text-[#4D5D60] transition hover:text-[#111A1D]">Vision</a>
            <Link to="/contact" className="text-[13px] font-medium text-[#4D5D60] transition hover:text-[#111A1D]">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1B292E] px-5 text-xs font-semibold tracking-[.01em] text-white transition hover:bg-[#41565A] sm:text-sm">
              Enter EYLO AI <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="grid h-11 w-11 place-items-center rounded-full border border-[#CFD2CD] text-[#293D41] md:hidden">
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="flex flex-col gap-5 border-t border-[#DCE0DC] px-7 py-6 text-sm font-medium md:hidden">
          <a onClick={() => setMenuOpen(false)} href="#about">Company</a>
          <a onClick={() => setMenuOpen(false)} href="#product">Product</a>
          <a onClick={() => setMenuOpen(false)} href="#vision">Vision</a>
          <Link onClick={() => setMenuOpen(false)} to="/contact">Contact</Link>
        </nav>}
      </header>

      <section id="about" className="relative overflow-hidden">
        <div className="mx-auto max-w-[1450px] px-5 pb-14 pt-16 sm:px-9 sm:pt-24 lg:px-16 lg:pt-28">
          <div className="grid items-end gap-10 lg:grid-cols-[1.12fr_.88fr]">
            <div>
              <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.22em] text-[#6B7F7D]"><span className="h-[2px] w-9 bg-[#7C9890]" />A company for curious minds</p>
              <h1 className="mt-9 max-w-[850px] font-serif text-[clamp(4rem,9vw,9rem)] font-normal leading-[.88] tracking-[-.065em] text-[#1B292E]">
                Make space<br />for <em className="font-normal text-[#6F8780]">discovery.</em>
              </h1>
            </div>
            <div className="max-w-[420px] pb-2 lg:justify-self-end lg:pb-5">
              <p className="text-[clamp(1.15rem,2vw,1.45rem)] leading-[1.5] text-[#4D6060]">EYLO brings research, people and opportunities together — giving every idea a clearer path forward.</p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link to="/discover" className="inline-flex min-h-12 items-center gap-3 border-b-2 border-[#1C2F31] pb-1 text-sm font-semibold text-[#1C2F31] transition hover:gap-5">Explore EYLO AI <ArrowUpRight size={18} /></Link>
                <a href="#product" className="text-sm font-medium text-[#71807C] hover:text-[#22383A]">See what we do</a>
              </div>
            </div>
          </div>

          <div id="product" className="relative mt-16 overflow-hidden rounded-[24px] border border-[#C4D2CE] bg-[#DDE6E3] shadow-[0_35px_90px_-58px_rgba(29,49,49,.5)] sm:mt-20 lg:mt-24">
            <div className="grid min-h-[510px] lg:grid-cols-[.36fr_.64fr]">
              <div className="relative flex flex-col justify-between overflow-hidden bg-[#223536] p-7 text-[#F0F1EA] sm:p-10 lg:p-12">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#C1D3CB]">Introducing the platform</p><h2 className="mt-8 max-w-xs font-serif text-[clamp(2.8rem,4vw,4.4rem)] leading-[.98] tracking-[-.055em]">A clearer view of what matters.</h2></div>
                <div className="mt-12"><p className="max-w-xs text-sm leading-7 text-[#D6E2DD]">Knowledge is connected. Your tools should be, too.</p><Link to="/discover" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#F5F5EE] px-5 text-xs font-semibold text-[#1B292E] transition hover:bg-white">Enter EYLO AI <ArrowRight size={16}/></Link></div>
                <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-16 h-80 w-80 rounded-full border border-[#94A9A0]/20"/>
              </div>
              <div className="flex items-center justify-center bg-[radial-gradient(ellipse_at_40%_30%,#EEF3F0_0%,#DFE7E3_74%)] px-5 py-12 sm:px-10 lg:py-16">
                <div className="w-full max-w-[730px] overflow-hidden rounded-xl border border-[#D6DFDB] bg-[#FCFDFB] shadow-[0_30px_75px_-28px_rgba(35,53,55,.35)]">
                  <div className="flex h-11 items-center justify-between border-b border-[#E5EBE7] bg-white px-5"><span className="text-[11px] font-semibold tracking-[.18em] text-[#496762]">EYLO / DISCOVERY</span><span className="flex gap-1.5" aria-hidden="true"><i className="h-2 w-2 rounded-full bg-[#CCD7D0]"/><i className="h-2 w-2 rounded-full bg-[#CCD7D0]"/><i className="h-2 w-2 rounded-full bg-[#CCD7D0]"/></span></div>
                  <div className="grid gap-7 p-5 sm:p-8">
                    <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#6C8A7D]">Research discovery</p><h3 className="mt-3 font-serif text-3xl leading-tight text-[#263B39] sm:text-4xl">Follow the question.</h3></div>
                    <div className="flex items-center gap-3 rounded-xl border border-[#D8E2DD] bg-[#F5F8F6] px-4 py-4"><Search size={19} className="shrink-0 text-[#65847B]"/><span className="min-w-0 truncate text-sm text-[#587168]">Explore a topic or research question</span><span className="ml-auto hidden rounded-lg bg-[#253C3B] px-3 py-2 text-[10px] font-semibold text-white sm:inline-flex">Discover</span></div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[{icon:BookOpen,label:'Evidence',detail:'Source-linked records'},{icon:Users,label:'People',detail:'Researchers & institutions'},{icon:Compass,label:'Opportunities',detail:'Relevant next steps'}].map(({icon:Icon,label,detail})=><div key={label} className="rounded-lg border border-[#E3EAE5] bg-white p-4"><Icon size={20} className="text-[#678A7E]"/><p className="mt-5 text-sm font-semibold text-[#2D4643]">{label}</p><p className="mt-1.5 text-[11px] leading-5 text-[#80928C]">{detail}</p></div>)}
                    </div>
                  </div>
                  <p className="border-t border-[#EEF0ED] px-5 py-3 text-[10px] text-[#8A9A94] sm:px-8">Illustrative interface · Explore the working product via Enter EYLO AI.</p>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-right text-[10px] uppercase tracking-[.18em] text-[#8A9690]">Research, thoughtfully connected.</p>
        </div>
      </section>

      <section className="border-t border-[#E2E5DE] bg-[#FAFAF7] px-5 py-24 sm:px-9 sm:py-32 lg:px-16">
        <div className="mx-auto max-w-[1290px]">
          <div className="mb-12 grid gap-6 lg:grid-cols-[.6fr_.4fr] lg:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#789087]">What we make possible</p><h2 className="mt-5 font-serif text-5xl leading-[1] tracking-[-.055em] text-[#1B2F30] sm:text-7xl">One connected path.</h2></div><p className="max-w-sm text-sm leading-7 text-[#667975] lg:justify-self-end">Designed for students, academics and researchers who want to go further with their work.</p></div>
          <div className="border-t border-[#CCD7D1]">{pillars.map(({number,title,description,icon:Icon})=><div key={title} className="grid gap-4 border-b border-[#CCD7D1] py-8 sm:grid-cols-[80px_1fr_1fr_auto] sm:items-center sm:gap-8 sm:py-10"><span className="text-xs font-semibold tracking-[.2em] text-[#879891]">{number}</span><h3 className="font-serif text-4xl tracking-[-.04em] text-[#263C3B] sm:text-5xl">{title}</h3><p className="max-w-sm text-sm leading-7 text-[#61746E]">{description}</p><Icon className="hidden text-[#8CA59A] sm:block" size={27} strokeWidth={1.2}/></div>)}</div>
        </div>
      </section>

      <section id="vision" className="bg-[#233736] px-5 py-28 text-[#F4F5EE] sm:px-9 sm:py-36 lg:px-16">
        <div className="mx-auto grid max-w-[1290px] gap-12 lg:grid-cols-[.35fr_.65fr]"><p className="text-[11px] font-bold uppercase tracking-[.22em] text-[#B5C9BF]">Our vision</p><div><h2 className="max-w-4xl font-serif text-[clamp(3.6rem,7vw,7.2rem)] leading-[.99] tracking-[-.065em]">Better questions.<br/><span className="italic text-[#B5C9BF]">Brighter possibilities.</span></h2><p className="mt-9 max-w-lg text-base leading-8 text-[#D3DED7]">We believe useful research tools should make knowledge easier to explore, understand and connect.</p><div className="mt-10 flex flex-wrap gap-4"><Link to="/discover" className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#F5F5EE] px-7 text-sm font-semibold text-[#233736] hover:bg-white">Enter EYLO AI <ArrowUpRight size={18}/></Link><Link to="/contact" className="inline-flex min-h-12 items-center gap-3 rounded-full border border-[#93ABA1] px-7 text-sm font-semibold text-white hover:bg-white/10">Get in touch <ArrowUpRight size={18}/></Link></div></div></div>
      </section>

      <footer className="bg-[#F6F5F1] px-5 py-10 sm:px-9 lg:px-16">
        <div className="mx-auto flex max-w-[1290px] flex-col gap-7 sm:flex-row sm:items-center sm:justify-between"><img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" width="132" height="40" loading="lazy" className="h-10 w-auto"/><div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#667873]"><Link to="/discover" className="hover:text-[#1C3630]">EYLO AI</Link><Link to="/contact" className="hover:text-[#1C3630]">Contact</Link><Link to="/login" className="hover:text-[#1C3630]">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span></div></div>
      </footer>
    </main>
  );
}
