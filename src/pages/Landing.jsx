import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown,
  ExternalLink, FolderOpen, LockKeyhole, Menu,
  Search, ShieldCheck, Sparkles, X,
} from "lucide-react";
import ThemeToggle from "@/components/marketing/ThemeToggle";
import PublicPlans from "@/components/marketing/PublicPlans";
import "./landing.css";

const people = [
  {label:"Ask & explore",path:"/login?from=%2Fhome",icon:Sparkles,problem:"I have a question and want a clearer starting point.",example:"How should I approach a difficult decision?",result:"Use EYRA for AI-assisted thinking when signed in, then explore specialized tools for the next step."},
  {label:"Learn & create",path:"/start",icon:BookOpen,problem:"I want to learn, write or develop something useful.",example:"How should I structure a learning plan?",result:"Work with learning tools, documents and saved ideas in one workspace."},
  {label:"Plan & organize",path:"/login?from=%2Fprojects",icon:FolderOpen,problem:"I want to keep tasks, projects and priorities together.",example:"How do I organize a new project?",result:"Keep project work, tasks and next steps in one place."},
  {label:"Research & evidence",path:"/discover",icon:Search,problem:"I want to check a claim against published work.",example:"What does research say about sleep and learning?",result:"Find scholarly records, follow original sources and save useful evidence."},
];
const faqs = [
  ["What is EYLO?", "EYLO is a workspace that combines AI assistance with tools for learning, creating documents, organizing tasks and projects, and exploring scholarly research. Some features require an account."],
  ["How is EYLO different from ChatGPT?", "EYLO connects its AI assistant EYRA with specialized tools and saved work. It is an evolving product, not a claim to match every feature or model capability of ChatGPT."],
  ["What can I do today?", "You can try public scientific discovery without signing in. With an account you can access available workspace tools such as projects, tasks, documents, learning, and eligible AI functions."],
  ["Is EYLO only for researchers?", "No. EYLO is intended for anyone who wants to ask, learn, create, plan or research. Its scholarly search and research funding tools are specialist options within a broader workspace."],
  ["Can I trust EYRA's answers?", "AI outputs can be wrong. Verify important facts, especially for scientific, financial, legal and health decisions. Source-linked scholarly records are for checking evidence, not a guarantee of scientific truth."],
  ["How do I verify scientific results?", "Open the original scholarly record and inspect authors, publication details and linked identifiers where available. The quality and completeness of metadata depend on the source."],
  ["Do I need technical experience?", "You can begin with a simple goal using the Start here page. Some functions need a signed-in account; advanced tools have their own workflows."],
  ["Can I try EYLO before signing up?", "Yes, public scholarly discovery is available without an account. Most personalized workspace features and EYRA require signing in."],
  ["How much does EYLO cost?", "See the current or planned plans below. Paid checkout may be unavailable during early access; features and access levels depend on configuration."],
  ["What about my privacy?", "Saved workspace records are scoped to the signed-in user. Some features depend on external AI or scholarly services. Review the applicable privacy terms before sharing sensitive material."],
  ["What is EYRA?", "EYRA is EYLO's AI assistant, available when the service and account entitlements permit. It can help think through questions and selected context; its output still needs checking."],
  ["Does EYLO help with research funding?", "EYLO includes a specialized funding workflow using official US Grants.gov records. It is not a worldwide grants directory; always check the official eligibility rules."],
  ["Can I save my work?", "Authenticated users can save project and research work in their workspace. Some public discovery saving may be browser-scoped, so check where a particular item is stored."],
  ["Who is behind EYLO?", "Visit the About and Contact pages to learn about the project and get in touch. Support availability and response times should not be assumed."],
  ["Why should I trust a new product?", "Try available functionality, review its limitations and judge whether it suits your workflow. EYLO does not claim independently verified performance, institutional adoption or feature parity with ChatGPT."],
];
const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl company-primary px-6 text-sm font-semibold transition";
const outline = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--company-border)] px-6 text-sm font-semibold transition hover:bg-[var(--company-soft)]";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleEscape = event => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);
  const [person, setPerson] = useState(0);
  const active = people[person];

  return (
    <div className="eylo-company min-h-screen bg-[var(--company-surface)] text-[var(--company-ink)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--company-surface)] focus:p-3">Skip to content</a>
      <header className="sticky top-0 z-50 border-b border-[var(--company-border)] bg-[var(--company-surface)]">
        <div className="mx-auto flex min-h-[76px] max-w-[1320px] items-center justify-between gap-4 px-5 sm:px-9 lg:px-12">
          <Link to="/" aria-label="EYLO home">
            <img src={import.meta.env.BASE_URL + "brand/eylo-light.svg"} alt="EYLO" className="company-brand h-9 w-auto" width="148" height="43" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--company-muted)] lg:flex" aria-label="Main navigation">
            <Link to="/start">Start here</Link>\n            <a href="#how-it-works">How it works</a>
            <a href="#for-you">Who it helps</a>
            <a href="#trust">Trust & privacy</a>
            <a href="#questions">Questions</a>
            <a href="#premium">Plans</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="hidden text-sm font-semibold sm:inline-flex">Log in</Link>
            <Link to="/discover" className={btn + " hidden sm:inline-flex"}>Try it free <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <button type="button" ref={menuButton} className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--company-border)] lg:hidden" aria-controls="eylo-mobile-menu" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && <nav id="eylo-mobile-menu" aria-label="Mobile navigation" className="grid gap-1 border-t border-[var(--company-border)] px-5 py-3 lg:hidden">
          {[["How it works", "#how-it-works"], ["Who it helps", "#for-you"], ["Trust & privacy", "#trust"], ["Questions", "#questions"], ["Plans", "#premium"]].map(([label, href]) => <a className="rounded-lg px-3 py-3 text-sm" key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <Link className="rounded-lg px-3 py-3 text-sm" to="/start" onClick={() => setMenuOpen(false)}>Choose your starting point</Link>\n          <Link className="rounded-lg px-3 py-3 text-sm" to="/discover" onClick={() => setMenuOpen(false)}>Try research discovery</Link>
          <Link className="rounded-lg px-3 py-3 text-sm" to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
        </nav>}
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-9 sm:pt-24 lg:px-12 lg:pb-28">
          <div className="pointer-events-none absolute -right-24 top-2 h-[420px] w-[420px] rounded-full bg-[#24AAF3]/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--company-border)] bg-[var(--company-soft)] px-4 py-2 text-xs font-semibold text-[var(--company-muted)]">
                <Search size={15} /> One workspace · Many goals · Your next step
              </p>
              <h1 className="mt-7 max-w-[700px] text-[clamp(2.7rem,5.3vw,5.5rem)] font-bold leading-[1.07] tracking-[-.06em]">
                One place to ask, learn,<br /><span className="text-[#168bca]">create and do more.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-[1.8] text-[var(--company-muted)]">
                EYLO brings together an AI assistant and connected tools for learning, writing, organizing projects and exploring research. Start with your goal, not a long menu of features.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/start" className={btn}>Explore EYLO <ArrowRight size={18} /></Link>\n                <Link to="/start" className={outline}>Help me choose <ArrowRight size={17} /></Link>
                <a className={outline} href="#how-it-works">See a simple example <ArrowRight size={17} /></a>
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-[var(--company-muted)]"><Check size={16} /> No account needed to explore public research.</p>
            </div>
            <div className="rounded-[28px] border border-[var(--company-border)] bg-[var(--company-soft)] p-5 shadow-[0_28px_80px_-46px_rgba(17,55,88,.45)] sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--company-muted)]">Example, not live results</span>
                <span className="rounded-full border border-[var(--company-border)] px-3 py-1 text-xs text-[var(--company-muted)]">3 simple steps</span>
              </div>
              <div className="mt-6 rounded-2xl bg-[var(--company-surface)] p-5">
                <p className="text-xs font-semibold text-[#168bca]">01 · ASK</p>
                <p className="mt-2 text-lg font-semibold">“What do you want to work on today?”</p>
              </div>
              <div className="ml-5 h-6 border-l-2 border-dashed border-[var(--company-border)]" />
              <div className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5">
                <p className="text-xs font-semibold text-[#168bca]">02 · CHECK</p>
                <p className="mt-2 text-base font-semibold">Choose the right tools</p>
                <p className="mt-2 text-sm leading-6 text-[var(--company-muted)]">Explore AI assistance, learning, documents, projects or source-linked research depending on your goal.</p>
                <div className="mt-4 flex flex-wrap gap-2">{["EYRA", "Learn", "Projects"].map(s => <span key={s} className="rounded-lg bg-[var(--company-soft)] px-3 py-1.5 text-xs text-[var(--company-muted)]">{s}</span>)}</div>
              </div>
              <div className="ml-5 h-6 border-l-2 border-dashed border-[var(--company-border)]" />
              <div className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5">
                <p className="text-xs font-semibold text-[#168bca]">03 · USE</p>
                <p className="mt-2 text-base font-semibold">Keep your work together</p>
                <p className="mt-2 text-sm text-[var(--company-muted)]">Sign in to organize projects and use eligible workspace features.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">What you get</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.04em] sm:text-5xl">From your idea to your next step.</h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--company-muted)]">Ask a question, learn a skill, write something, plan a project or follow scientific evidence. Choose the path that fits.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {icon: Search, name: "Find", text: "Find a starting point. Use EYRA when available or explore source-linked scholarly records."},
                {icon: BookOpen, name: "Understand", text: "Learn with study tools, create documents and use EYRA for AI-assisted thinking when available."},
                {icon: FolderOpen, name: "Organize", text: "Keep tasks, projects, documents and saved research connected in your workspace."},
              ].map(({icon: Icon, name, text}, i) => <article key={name} className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-7">
                <div className="flex items-center justify-between"><Icon size={27} className="text-[#168bca]" /><span className="text-sm font-semibold text-[var(--company-muted)]">0{i + 1}</span></div>
                <h3 className="mt-8 text-2xl font-bold">{name}</h3><p className="mt-3 text-sm leading-7 text-[var(--company-muted)]">{text}</p>
              </article>)}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4"><Link to="/start" className={btn}>Find your starting point <ArrowRight size={17} /></Link><span className="text-sm text-[var(--company-muted)]">Public research discovery needs no signup; most workspace tools require an account.</span></div>
          </div>
        </section>

        <section id="for-you" className="scroll-mt-24 px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">For different everyday goals</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">What would you like to do?</h2>
            <div className="mt-9 flex flex-wrap gap-3" role="group" aria-label="Choose your role">
              {people.map(({label, icon: Icon}, i) => <button key={label} type="button" aria-pressed={person === i} onClick={() => setPerson(i)} className={"inline-flex min-h-12 items-center gap-2 rounded-xl border px-5 text-sm font-semibold transition " + (person === i ? "border-[#168bca] bg-[#168bca] text-white" : "border-[var(--company-border)] bg-[var(--company-soft)]")}>
                <Icon size={17} /> {label}
              </button>)}
            </div>
            <div className="mt-5 grid gap-8 rounded-[26px] border border-[var(--company-border)] bg-[var(--company-soft)] p-7 sm:p-10 lg:grid-cols-2">
              <div><p className="text-sm font-semibold text-[#168bca]">Your challenge</p><h3 className="mt-3 text-2xl font-bold leading-snug">{active.problem}</h3><p className="mt-6 text-sm font-semibold text-[var(--company-muted)]">Example question</p><p className="mt-2 rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5 text-base">“{active.example}”</p></div>
              <div className="flex flex-col justify-center"><p className="text-sm font-semibold text-[#168bca]">What EYLO can help you do</p><p className="mt-3 text-xl leading-relaxed">{active.result}</p><p className="mt-5 text-sm leading-7 text-[var(--company-muted)]">Illustrative use case; available features vary by plan and configuration.</p><Link to={active.path} className={btn + " mt-7 self-start"}>Explore this path <ArrowRight size={17} /></Link></div>
            </div>
          </div>
        </section>

        <section id="trust" className="scroll-mt-24 border-y border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Trust before hype</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.04em] sm:text-5xl">Stay in control of important decisions.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {icon: ExternalLink, title: "Follow the source", body: "EYLO links to scholarly records from services such as OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar. Verify the paper itself."},
                {icon: ShieldCheck, title: "AI is not a scientific fact", body: "EYRA helps with interpretation and planning; it can make mistakes. Evidence, inference and uncertainty should not be confused."},
                {icon: LockKeyhole, title: "Private saved workspace", body: "Saved records are user-scoped. Read the applicable privacy terms before sharing sensitive or confidential material."},
              ].map(({icon: Icon,title,body}) => <article key={title} className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-7"><Icon size={26} className="text-[#168bca]" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--company-muted)]">{body}</p></article>)}
            </div>
            <div className="mt-8 rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 text-sm leading-7 text-[var(--company-muted)]">
              <strong className="text-[var(--company-ink)]">What we will not promise:</strong> EYLO is not a guarantee of correct AI answers or a substitute for expert advice. Its scholarly discovery is not a systematic-review protocol. Funding discovery currently focuses on official US Grants.gov records, and eligibility must be confirmed at the source.
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-9 lg:px-12" id="eyra">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[1fr_.9fr]">
            <div><p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Meet EYRA</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">Not just another chat window.</h2><p className="mt-6 max-w-xl text-base leading-8 text-[var(--company-muted)]">EYRA is the AI assistant inside EYLO. It can help you explore questions and work with selected context when available. EYLO also offers separate tools for learning, creation, planning and research. Check important answers.</p><Link to="/register" className={btn + " mt-7"}>Create your workspace <ArrowRight size={17} /></Link></div>
            <div className="rounded-[24px] border border-[var(--company-border)] bg-[var(--company-soft)] p-7">
              <p className="text-sm font-semibold text-[var(--company-muted)]">What connects EYLO tools?</p>
              <ul className="mt-6 space-y-5">{["AI assistance through EYRA when available", "Learning, documents, tasks and project tools", "Specialized scholarly discovery with original source links", "One workspace to return to your work"].map(item => <li key={item} className="flex items-start gap-3 text-base leading-7"><Check className="mt-1 shrink-0 text-[#168bca]" size={19} />{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section id="premium" className="scroll-mt-24 border-y border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Access & plans</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">Start exploring before you sign up.</h2><p className="mt-4 max-w-2xl text-base leading-8 text-[var(--company-muted)]">Public discovery is available without an account. Saving work and using EYRA require authentication. The options below describe current or planned access; paid checkout may still be in early access.</p><div className="mt-9"><PublicPlans /></div></div>
        </section>

        <section id="questions" className="scroll-mt-24 px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[940px]"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Straight answers</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">Good questions, clear answers.</h2><p className="mt-4 text-base leading-8 text-[var(--company-muted)]">Answers about capabilities, privacy, pricing, AI limitations, research sources and getting started.</p>
            <div className="mt-9 divide-y divide-[var(--company-border)] border-y border-[var(--company-border)]">
              {faqs.map(([question, answer], i) => <details key={question} className="group py-1" open={i === 0 ? true : undefined}>
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 text-left text-base font-semibold sm:text-lg"><span><span className="mr-3 text-sm text-[var(--company-muted)]">{String(i + 1).padStart(2, "0")}</span>{question}</span><ChevronDown size={19} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" /></summary>
                <p className="max-w-[780px] pb-6 pl-9 text-sm leading-8 text-[var(--company-muted)] sm:text-base">{answer}</p>
              </details>)}
            </div>
          </div>
        </section>

        <section className="bg-[#102a3d] px-5 py-20 text-white sm:px-9 lg:px-12">
          <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div><p className="text-sm font-bold uppercase tracking-[.16em] text-[#91d8ff]">Your first five minutes</p><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-.04em] sm:text-5xl">Start with what matters to you.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-white/75">Choose an everyday goal and explore the tools that support it. You can try scholarly discovery without creating an account.</p></div>
            <Link to="/discover" className="inline-flex min-h-14 shrink-0 items-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-[#102a3d] transition hover:bg-[#daf3ff]">Explore EYLO <ArrowRight size={20} /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--company-border)] px-5 py-9 sm:px-9 lg:px-12">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 text-sm text-[var(--company-muted)] md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} EYLO. Ask, learn, create and organize with clarity.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Link to="/company">About</Link><Link to="/company/what-we-do">What we do</Link><Link to="/company/vision">Vision</Link><Link to="/contact">Contact</Link><Link to="/company/careers">Careers</Link><Link to="/discover">Discovery</Link></div>
        </div>
      </footer>
    </div>
  );
}
