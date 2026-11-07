import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Compass, GraduationCap, Users } from 'lucide-react';

const pages = [
  { slug: '', label: 'About EYLO', title: 'Research should feel connected.', eyebrow: 'THE COMPANY', intro: 'EYLO is building a more approachable way to discover scientific evidence, explore the people behind it and find meaningful next steps.' },
  { slug: 'what-we-do', label: 'What we do', title: 'From questions to clarity.', eyebrow: 'WHAT WE DO', intro: 'A connected research experience for exploring scholarly sources, researchers and opportunities without losing the context behind the question.' },
  { slug: 'vision', label: 'Our vision', title: 'Make knowledge easier to navigate.', eyebrow: 'OUR VISION', intro: 'We believe that trustworthy access to knowledge and clear research workflows can help more people develop meaningful ideas.' },
  { slug: 'careers', label: 'Careers', title: 'Build something meaningful.', eyebrow: 'CAREERS & COLLABORATION', intro: 'EYLO welcomes conversations with people interested in research technology, academic collaboration, product design and responsible AI.' },
];

const valueItems = [
  { icon: BookOpen, title: 'Discover evidence', body: 'Search scholarly records and follow links back to original publishers and indexes.' },
  { icon: Users, title: 'Explore people', body: 'Find relevant researchers and institutions through their publicly available work.' },
  { icon: Compass, title: 'See opportunities', body: 'Explore research and professional pathways using available source records.' },
];

export default function CompanyPage() {
  const location = useLocation();
  const slug = location.pathname.split('/').filter(Boolean)[1] || '';
  const page = pages.find(item => item.slug === slug);
  if (!page) return <main className="grid min-h-[75vh] place-items-center bg-white px-6 text-[#172A40]"><div className="text-center"><h1 className="text-4xl font-bold">Page not found</h1><Link to="/company" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#245B81]">About EYLO <ArrowRight size={16}/></Link></div></main>;

  return (
    <main className="min-h-screen bg-white text-[#172A40]">
      <header className="sticky top-0 z-40 border-b border-[#E1EAF1] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-9">
          <Link to="/" aria-label="EYLO homepage"><img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" width="148" height="43" className="h-11 w-auto" /></Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="hidden text-sm font-semibold text-[#536F83] hover:text-[#172A40] sm:inline-flex">Home</Link>
            <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#172A40] px-5 text-sm font-semibold text-white hover:bg-[#285274]">Enter EYLO AI <ArrowUpRight size={16}/></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1340px] px-5 pb-24 pt-10 sm:px-9 sm:pt-16">
        <nav aria-label="Company sections" className="flex flex-wrap gap-2 border-b border-[#E4EDF3] pb-6">
          {pages.map(item => <Link key={item.slug} aria-current={item.slug === slug ? 'page' : undefined} to={item.slug ? '/company/' + item.slug : '/company'} className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${item.slug === slug ? 'bg-[#EAF4FB] text-[#174672]' : 'text-[#5D7182] hover:bg-[#F4F8FB]'}`}>{item.label}</Link>)}
        </nav>

        <section className="grid items-end gap-10 py-16 lg:grid-cols-[1.25fr_.75fr] lg:py-24">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#4E87AA]">{page.eyebrow}</p><h1 className="mt-6 max-w-[860px] text-[clamp(3.3rem,7vw,6.9rem)] font-bold leading-[1.03] tracking-[-.075em]">{page.title}</h1></div>
          <p className="max-w-lg text-lg leading-8 text-[#5E7485]">{page.intro}</p>
        </section>

        {slug === '' && <section className="grid gap-4 border-t border-[#E3ECF2] pt-12 sm:grid-cols-3">{[{label:'For students',icon:GraduationCap},{label:'For academics',icon:BookOpen},{label:'For researchers',icon:Users}].map(({label,icon:Icon}) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E1EAF1] bg-[#FAFCFE] p-6"><Icon size={25} className="text-[#367AA2]"/><span className="font-semibold">{label}</span></div>)}</section>}
        {slug === 'what-we-do' && <section className="grid gap-4 border-t border-[#E3ECF2] pt-12 md:grid-cols-3">{valueItems.map(({icon:Icon,title,body})=><article key={title} className="rounded-2xl border border-[#E1EAF1] bg-[#FAFCFE] p-7"><Icon className="text-[#357CA5]" size={26}/><h2 className="mt-7 text-2xl font-bold tracking-tight">{title}</h2><p className="mt-3 text-sm leading-7 text-[#627889]">{body}</p></article>)}</section>}
        {slug === 'vision' && <section className="max-w-3xl border-t border-[#E3ECF2] pt-12"><h2 className="text-3xl font-bold tracking-tight">Built around evidence and transparency.</h2><p className="mt-5 text-base leading-8 text-[#5D7485]">EYLO aims to make the research journey more accessible while keeping source information visible. AI-assisted summaries and suggestions should always be checked against original sources and do not replace academic judgment.</p></section>}
        {slug === 'careers' && <section className="grid gap-8 border-t border-[#E3ECF2] pt-12 md:grid-cols-[1fr_auto] md:items-center"><div><h2 className="text-3xl font-bold tracking-tight">Interested in EYLO?</h2><p className="mt-4 max-w-2xl text-base leading-8 text-[#5D7485]">Explore potential collaborations or send us an introduction. We are not displaying unverified open job positions or promising active vacancies.</p></div><Link to="/contact" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#172A40] px-6 text-sm font-semibold text-white hover:bg-[#285274]">Contact EYLO <ArrowRight size={17}/></Link></section>}

        <section className="mt-20 rounded-[28px] bg-[#F1F6FA] px-7 py-12 sm:px-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#4686AA]">THE EYLO AI PLATFORM</p><h2 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-[-.06em] sm:text-5xl">Explore the actual research experience.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-[#64798A]">The company site introduces EYLO. Research discovery runs in the separate EYLO AI application.</p><Link to="/discover" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#172A40] px-6 text-sm font-semibold text-white">Enter EYLO AI <ArrowRight size={17}/></Link></section>
      </div>

      <footer className="border-t border-[#E5EDF3] px-5 py-8 sm:px-9"><div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-4"><Link to="/"><img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" width="120" height="38" className="h-9 w-auto" /></Link><p className="text-xs text-[#728696]">© {new Date().getFullYear()} EYLO</p></div></footer>
    </main>
  );
}
