import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, ChevronDown,
  ExternalLink, FolderOpen, GraduationCap, LockKeyhole, Menu,
  Search, ShieldCheck, Sparkles, UsersRound, X,
} from "lucide-react";
import ThemeToggle from "@/components/marketing/ThemeToggle";
import PublicPlans from "@/components/marketing/PublicPlans";
import "./landing.css";

const people = [
  {
    label: "I teach or research",
    icon: GraduationCap,
    problem: "I need a reliable starting point for a new research question.",
    example: "What does recent research say about AI in higher education?",
    result: "Find source-linked papers, identify authors and save useful evidence for a project.",
  },
  {
    label: "I work in a business",
    icon: UsersRound,
    problem: "I need to understand a technical question without sorting through dozens of tabs.",
    example: "What research supports the benefits of a four-day workweek?",
    result: "Explore published evidence and its limits before making a business decision.",
  },
  {
    label: "I have a new idea",
    icon: Sparkles,
    problem: "I want to see what is already known before investing time in my idea.",
    example: "What is known about biodegradable packaging materials?",
    result: "Discover relevant work, researchers and possible next steps.",
  },
];

const faqs = [
  ["What exactly does EYLO do?", "EYLO helps you find scholarly sources, see the original records, organize useful findings and plan your next research step. Think of it as a place to move from a question to evidence you can check."],
  ["Why use EYLO rather than ChatGPT?", "ChatGPT is a general-purpose assistant. EYLO is built around a research workflow: finding records in scholarly indexes, linking to original sources, saving evidence and organizing research projects. EYRA helps you reason over that context, but its answers still need checking."],
  ["How does this save me time?", "Instead of searching several academic sites separately and losing track of useful papers, you can discover records and organize them in one workspace. The time saved will depend on your task; we do not claim a measured time-saving figure."],
  ["Can I use EYLO if I am not a researcher?", "Yes. Professionals, founders and curious learners can explore published research too. EYLO is most useful when your question benefits from scholarly evidence, rather than general web browsing."],
  ["Can I trust the information?", "EYLO distinguishes source-linked records from AI interpretation. A published paper is not automatically correct, and AI can make mistakes. Read the original work and verify important claims before acting."],
  ["How can I verify a paper is real?", "Open the link to its original scholarly record and inspect its authors, publication details and identifier when provided. Availability and completeness depend on each upstream source."],
  ["Do I need technical training?", "No technical setup is needed to try public discovery. Start with a plain-language question; select your goal and level to help guide the results."],
  ["Can you show me value in five minutes?", "Try a question in public discovery, open an original source and compare the results with what you already knew. You can do this before creating an account."],
  ["How much does it cost?", "Public scholarly discovery can be tried without an account. Saving work and EYRA require signing in; access and limits depend on the current plan. Check the plans section for published tiers. Paid checkout may be unavailable during early access."],
  ["What happens to my data?", "Saved workspace records are scoped to your signed-in account. EYLO uses external scholarly services and an AI provider for relevant functions. Avoid entering confidential data until you have reviewed the privacy information and terms."],
  ["What is EYRA?", "EYRA is EYLO's AI research assistant. It can work with your selected question and saved project context to help interpret information and suggest next steps. It does not replace expert judgment."],
  ["Can it find funding?", "EYLO includes funding discovery based on official US Grants.gov records for signed-in users. It does not currently cover every country; you must check eligibility, deadlines and terms with the official funder."],
  ["Can I save and revisit my work?", "Yes. A signed-in workspace can keep saved evidence, researchers, projects and related notes for later use."],
  ["Who is behind EYLO?", "EYLO is an evolving product. Visit the About and Contact pages to learn about the project or raise a question. Do not rely on an assumed response time or support guarantee."],
  ["Why trust a new startup?", "Try the public discovery flow and inspect sources yourself. EYLO does not claim independently proven performance, institutional partnerships or production adoption. We prefer visible limitations to unsupported promises."],
];

const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl company-primary px-6 text-sm font-semibold transition";
const outline = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--company-border)] px-6 text-sm font-semibold transition hover:bg-[var(--company-soft)]";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
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
            <a href="#how-it-works">How it works</a>
            <a href="#for-you">Who it helps</a>
            <a href="#trust">Trust & privacy</a>
            <a href="#questions">Questions</a>
            <a href="#premium">Plans</a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="hidden text-sm font-semibold sm:inline-flex">Log in</Link>
            <Link to="/discover" className={btn + " hidden sm:inline-flex"}>Try it free <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-lg border border-[var(--company-border)] lg:hidden" aria-controls="eylo-mobile-menu" aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && <nav id="eylo-mobile-menu" aria-label="Mobile navigation" className="grid gap-1 border-t border-[var(--company-border)] px-5 py-3 lg:hidden">
          {[["How it works", "#how-it-works"], ["Who it helps", "#for-you"], ["Trust & privacy", "#trust"], ["Questions", "#questions"], ["Plans", "#premium"]].map(([label, href]) => <a className="rounded-lg px-3 py-3 text-sm" key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <Link className="rounded-lg px-3 py-3 text-sm" to="/discover" onClick={() => setMenuOpen(false)}>Try research discovery</Link>
          <Link className="rounded-lg px-3 py-3 text-sm" to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
        </nav>}
      </header>

      <main id="main-content">
        <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-9 sm:pt-24 lg:px-12 lg:pb-28">
          <div className="pointer-events-none absolute -right-24 top-2 h-[420px] w-[420px] rounded-full bg-[#24AAF3]/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--company-border)] bg-[var(--company-soft)] px-4 py-2 text-xs font-semibold text-[var(--company-muted)]">
                <Search size={15} /> Your research question. Real sources. A clear next step.
              </p>
              <h1 className="mt-7 max-w-[700px] text-[clamp(2.7rem,5.3vw,5.5rem)] font-bold leading-[1.07] tracking-[-.06em]">
                Stop guessing.<br /><span className="text-[#168bca]">Start with evidence.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-[1.8] text-[var(--company-muted)]">
                EYLO helps you find scientific research, check where it came from, and keep the useful work in one place. No research expertise needed to take the first step.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/discover" className={btn}>Search research for free <ArrowRight size={18} /></Link>
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
                <p className="mt-2 text-lg font-semibold">“How does remote work affect productivity?”</p>
              </div>
              <div className="ml-5 h-6 border-l-2 border-dashed border-[var(--company-border)]" />
              <div className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5">
                <p className="text-xs font-semibold text-[#168bca]">02 · CHECK</p>
                <p className="mt-2 text-base font-semibold">Discover relevant studies</p>
                <p className="mt-2 text-sm leading-6 text-[var(--company-muted)]">Follow the original records to inspect authors, methods and findings.</p>
                <div className="mt-4 flex flex-wrap gap-2">{["OpenAlex", "Crossref", "Semantic Scholar"].map(s => <span key={s} className="rounded-lg bg-[var(--company-soft)] px-3 py-1.5 text-xs text-[var(--company-muted)]">{s}</span>)}</div>
              </div>
              <div className="ml-5 h-6 border-l-2 border-dashed border-[var(--company-border)]" />
              <div className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5">
                <p className="text-xs font-semibold text-[#168bca]">03 · USE</p>
                <p className="mt-2 text-base font-semibold">Save evidence. Plan what to do next.</p>
                <p className="mt-2 text-sm text-[var(--company-muted)]">Sign in when you want a private workspace and EYRA assistance.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">What you get</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.04em] sm:text-5xl">From a question to a useful next step.</h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--company-muted)]">A clear workflow, whether you are preparing a lecture, evaluating a business idea or exploring a subject for the first time.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {icon: Search, name: "Find", text: "Search scholarly records from connected research indexes. Open original sources instead of relying only on a summary."},
                {icon: BookOpen, name: "Understand", text: "Use source details and EYRA's assistance to explore what is known, what is uncertain and what you still need to check."},
                {icon: FolderOpen, name: "Organize", text: "Save papers, researchers and ideas into your private workspace, then return to projects and next steps."},
              ].map(({icon: Icon, name, text}, i) => <article key={name} className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-7">
                <div className="flex items-center justify-between"><Icon size={27} className="text-[#168bca]" /><span className="text-sm font-semibold text-[var(--company-muted)]">0{i + 1}</span></div>
                <h3 className="mt-8 text-2xl font-bold">{name}</h3><p className="mt-3 text-sm leading-7 text-[var(--company-muted)]">{text}</p>
              </article>)}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4"><Link to="/discover" className={btn}>Try your own question <ArrowRight size={17} /></Link><span className="text-sm text-[var(--company-muted)]">Your first search is public. No signup required.</span></div>
          </div>
        </section>

        <section id="for-you" className="scroll-mt-24 px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Made for real questions</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">How could EYLO help you?</h2>
            <div className="mt-9 flex flex-wrap gap-3" role="group" aria-label="Choose your role">
              {people.map(({label, icon: Icon}, i) => <button key={label} type="button" aria-pressed={person === i} onClick={() => setPerson(i)} className={"inline-flex min-h-12 items-center gap-2 rounded-xl border px-5 text-sm font-semibold transition " + (person === i ? "border-[#168bca] bg-[#168bca] text-white" : "border-[var(--company-border)] bg-[var(--company-soft)]")}>
                <Icon size={17} /> {label}
              </button>)}
            </div>
            <div className="mt-5 grid gap-8 rounded-[26px] border border-[var(--company-border)] bg-[var(--company-soft)] p-7 sm:p-10 lg:grid-cols-2">
              <div><p className="text-sm font-semibold text-[#168bca]">Your challenge</p><h3 className="mt-3 text-2xl font-bold leading-snug">{active.problem}</h3><p className="mt-6 text-sm font-semibold text-[var(--company-muted)]">Example question</p><p className="mt-2 rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5 text-base">“{active.example}”</p></div>
              <div className="flex flex-col justify-center"><p className="text-sm font-semibold text-[#168bca]">What EYLO can help you do</p><p className="mt-3 text-xl leading-relaxed">{active.result}</p><p className="mt-5 text-sm leading-7 text-[var(--company-muted)]">This illustrates the workflow, not a promise of a specific result or a measured time saving.</p><Link to="/discover" className={btn + " mt-7 self-start"}>Try this in EYLO <ArrowRight size={17} /></Link></div>
            </div>
          </div>
        </section>

        <section id="trust" className="scroll-mt-24 border-y border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Trust before hype</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-.04em] sm:text-5xl">You stay in control of the judgment.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {icon: ExternalLink, title: "Follow the source", body: "EYLO links to scholarly records from services such as OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar. Verify the paper itself."},
                {icon: ShieldCheck, title: "AI is not a scientific fact", body: "EYRA helps with interpretation and planning; it can make mistakes. Evidence, inference and uncertainty should not be confused."},
                {icon: LockKeyhole, title: "Private saved workspace", body: "Saved records are user-scoped. Read the applicable privacy terms before sharing sensitive or confidential material."},
              ].map(({icon: Icon,title,body}) => <article key={title} className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-7"><Icon size={26} className="text-[#168bca]" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-7 text-[var(--company-muted)]">{body}</p></article>)}
            </div>
            <div className="mt-8 rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 text-sm leading-7 text-[var(--company-muted)]">
              <strong className="text-[var(--company-ink)]">What we will not promise:</strong> EYLO is not a systematic-review tool, not a guarantee of correct AI answers and not a substitute for expert advice. Funding discovery currently focuses on official US Grants.gov records, and eligibility must be confirmed at the source.
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-9 lg:px-12" id="eyra">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[1fr_.9fr]">
            <div><p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Meet EYRA</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">Not just another chat window.</h2><p className="mt-6 max-w-xl text-base leading-8 text-[var(--company-muted)]">EYRA is the assistant inside EYLO. With the research context you choose, it can help you explore a question, connect ideas and decide what to investigate next. You verify the conclusions.</p><Link to="/register" className={btn + " mt-7"}>Create a research workspace <ArrowRight size={17} /></Link></div>
            <div className="rounded-[24px] border border-[var(--company-border)] bg-[var(--company-soft)] p-7">
              <p className="text-sm font-semibold text-[var(--company-muted)]">What makes EYLO different from a general chatbot?</p>
              <ul className="mt-6 space-y-5">{["Scholarly discovery with links to original records", "Saved papers, people and project context in one place", "AI assistance within a research workflow", "Clear reminders to check conclusions against evidence"].map(item => <li key={item} className="flex items-start gap-3 text-base leading-7"><Check className="mt-1 shrink-0 text-[#168bca]" size={19} />{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section id="premium" className="scroll-mt-24 border-y border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[1240px]"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Access & plans</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">Start exploring before you sign up.</h2><p className="mt-4 max-w-2xl text-base leading-8 text-[var(--company-muted)]">Public discovery is available without an account. Saving work and using EYRA require authentication. The options below describe current or planned access; paid checkout may still be in early access.</p><div className="mt-9"><PublicPlans /></div></div>
        </section>

        <section id="questions" className="scroll-mt-24 px-5 py-20 sm:px-9 lg:px-12">
          <div className="mx-auto max-w-[940px]"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#168bca]">Straight answers</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em] sm:text-5xl">15 questions worth asking.</h2><p className="mt-4 text-base leading-8 text-[var(--company-muted)]">Especially if you are new to research tools or skeptical of AI.</p>
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
            <div><p className="text-sm font-bold uppercase tracking-[.16em] text-[#91d8ff]">Your first five minutes</p><h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-.04em] sm:text-5xl">Bring one question. See what the evidence says.</h2><p className="mt-5 max-w-2xl text-base leading-7 text-white/75">Search public research, open an original record, and decide for yourself whether EYLO helps.</p></div>
            <Link to="/discover" className="inline-flex min-h-14 shrink-0 items-center gap-2 rounded-xl bg-white px-7 text-base font-bold text-[#102a3d] transition hover:bg-[#daf3ff]">Explore without signing up <ArrowRight size={20} /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--company-border)] px-5 py-9 sm:px-9 lg:px-12">
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-5 text-sm text-[var(--company-muted)] md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} EYLO. Research decisions deserve verifiable sources.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3"><Link to="/company">About</Link><Link to="/contact">Contact</Link><Link to="/company/careers">Careers</Link><Link to="/discover">Discovery</Link></div>
        </div>
      </footer>
    </div>
  );
}
