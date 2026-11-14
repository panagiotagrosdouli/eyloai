import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Compass,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Layers3,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import LandingPreview from "@/components/marketing/LandingPreview";
import "./landing.css";

const audiences = [
  {
    label: "For students",
    icon: GraduationCap,
    title: "Start with a stronger foundation.",
    body: "Explore a topic, build a reading list and turn scattered notes into a clearer plan for your next assignment or project.",
    outcome: "From a new subject to a focused starting point.",
  },
  {
    label: "For academics",
    icon: UsersRound,
    title: "Keep ideas and evidence connected.",
    body: "Bring literature, teaching preparation and project planning into a more coherent research workflow.",
    outcome: "From a collection of sources to a useful body of work.",
  },
  {
    label: "For researchers",
    icon: FlaskConical,
    title: "Move the question forward.",
    body: "Find relevant work, explore the people behind it and organize the evidence and tasks around your research question.",
    outcome: "From discovery to a considered next step.",
  },
];
const capabilities = [
  {
    number: "01",
    title: "Discover",
    subtitle: "Find the evidence that matters.",
    body: "Explore source-linked research, researchers and opportunities across disciplines. Follow original records and build a starting point you can investigate.",
    icon: Search,
    link: "/discover",
    cta: "Explore discovery",
  },
  {
    number: "02",
    title: "Understand",
    subtitle: "Think with EYRA.",
    body: "Ask questions, work through ideas and use your saved research context with EYRA, the AI assistant within EYLO. Review its responses against the sources.",
    icon: Sparkles,
    anchor: "#eyra",
    cta: "Meet EYRA",
  },
  {
    number: "03",
    title: "Advance",
    subtitle: "Give your next step a home.",
    body: "Bring sources, notes, projects and tasks into your own workspace. Keep the decisions and next steps alongside the work that inspired them.",
    icon: FolderOpen,
    link: "/register",
    cta: "Create your workspace",
  },
];
const questions = [
  {
    question: "What can I do with EYLO?",
    answer:
      "Explore scholarly publications, researchers and opportunities, then organize what you find in a private workspace with notes, projects and tasks. EYRA adds AI assistance to help you work through questions and plan your next steps.",
  },
  {
    question: "Can I explore before creating an account?",
    answer:
      "Yes. Public research discovery is available without an account. Sign in when you want to save work, use your private workspace and access authenticated EYRA features.",
  },
  {
    question: "Is EYLO only for one field of research?",
    answer:
      "EYLO is designed for exploration across disciplines, from education and the humanities to health, science and technology. Coverage varies by topic and by the scholarly sources available.",
  },
  {
    question: "How should I use EYRA’s answers?",
    answer:
      "Use EYRA as support for your thinking. Check cited records, read the original sources and review any proposed action before confirming it. Your academic judgment remains essential.",
  },
  {
    question: "How can I discuss EYLO with my research group?",
    answer:
      "Get in touch to tell us about your research or academic workflow. We welcome conversations about collaboration, feedback and the needs of research groups.",
  },
];
const companyLinks = [
  { to: "/company", label: "About EYLO" },
  { to: "/company/what-we-do", label: "What we do" },
  { to: "/company/vision", label: "Our vision" },
  { to: "/company/careers", label: "Careers" },
];
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-[#172A40] px-6 text-sm font-semibold text-white transition hover:bg-[#25496C]";
const tag =
  "text-[11px] font-semibold uppercase tracking-[.18em] text-[#3B6D8F]";

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false),
    menuButton = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [menuOpen]);
  return (
    <div className="eylo-company min-h-screen bg-white text-[#172A40]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-[#E0E9F0] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1480px] items-center justify-between gap-3 px-5 sm:px-9 lg:px-16">
          <Link to="/" aria-label="EYLO home" className="inline-flex shrink-0">
            <img
              src={import.meta.env.BASE_URL + "brand/eylo-light.svg"}
              alt="EYLO"
              width="148"
              height="43"
              fetchPriority="high"
              className="h-9 w-auto sm:h-[42px]"
            />
          </Link>
          <nav
            aria-label="Company navigation"
            className="hidden items-center gap-7 text-[13px] font-medium text-[#3B5467] lg:flex"
          >
            <a href="#features">The platform</a>
            <a href="#eyra">Meet EYRA</a>
            <a href="#who-its-for">Who it’s for</a>
            <Link to="/company">About EYLO</Link>
            <Link to="/contact">Contact</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="hidden min-h-10 items-center px-3 text-[13px] font-medium sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              to="/discover"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#172A40] px-3 text-xs font-semibold text-white transition hover:bg-[#25496C] sm:px-5 sm:text-[13px]"
            >
              Enter EYLO AI <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <button
              type="button"
              ref={menuButton}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="company-mobile-nav"
              onClick={() => setMenuOpen((value) => !value)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#D9E6EF] lg:hidden"
            >
              {menuOpen ? (
                <X size={19} aria-hidden="true" />
              ) : (
                <Menu size={19} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        <nav
          id="company-mobile-nav"
          aria-label="Mobile navigation"
          hidden={!menuOpen}
          className={`${menuOpen ? "grid" : "hidden"} gap-1 border-t border-[#E0E9F0] bg-white px-5 py-4 text-sm font-medium lg:hidden`}
        >
          {[
            { href: "#features", label: "The platform" },
            { href: "#eyra", label: "Meet EYRA" },
            { href: "#who-its-for", label: "Who it’s for" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg p-3"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/company"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-3"
          >
            About EYLO
          </Link>
          <Link
            to="/contact"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-3"
          >
            Contact
          </Link>
          <Link
            to="/login"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-3"
          >
            Log in
          </Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section id="about" className="overflow-hidden">
          <div className="mx-auto grid max-w-[1480px] items-center gap-8 px-5 pb-16 pt-12 sm:px-9 sm:pt-20 lg:min-h-[710px] lg:grid-cols-[.98fr_1.02fr] lg:gap-12 lg:px-16 lg:pb-20 lg:pt-20">
            <div className="relative z-10">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#DFEAF2] bg-[#FAFCFE] px-3 py-1.5 text-[11px] font-medium text-[#526E82]">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#24AAF3]"
                  aria-hidden="true"
                />{" "}
                Discovery. Intelligence. Progress.
              </p>
              <h1 className="max-w-[660px] text-[clamp(2.8rem,5.25vw,5.7rem)] font-bold leading-[1.04] tracking-[-.068em]">
                A better way to
                <br />
                explore research
                <span className="text-[#24AAF3]" aria-hidden="true">
                  .
                </span>
              </h1>
              <p className="mt-7 max-w-[540px] text-lg leading-[1.7] text-[#526E82] sm:text-xl">
                EYLO connects scientific discovery, AI assistance and your
                research workspace—so a good question can become a meaningful
                next step.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/discover" className={primary}>
                  Explore EYLO <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#D9E3EC] px-5 text-sm font-semibold transition hover:bg-[#F4F8FB]"
                >
                  See how it works <ArrowDownIcon />
                </a>
              </div>
              <p className="mt-4 text-xs leading-5 text-[#526E82]">
                Explore research without an account. Sign in to make it your
                workspace.
              </p>
              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#E4ECF2] pt-6 text-xs font-medium text-[#3B5467]">
                {audiences.map(({ label, icon: Icon }) => (
                  <span key={label} className="inline-flex items-center gap-2">
                    <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <LandingPreview />
          </div>
        </section>
        <section
          aria-label="Research sources"
          className="border-y border-[#E7EEF4] bg-[#FAFCFE] px-5 py-7 sm:px-9 lg:px-16"
        >
          <div className="mx-auto flex max-w-[1350px] flex-col justify-between gap-5 md:flex-row md:items-center">
            <p className="max-w-xs text-sm leading-6 text-[#526E82]">
              Start with source-linked research.
              <br />
              <span className="font-medium text-[#254B67]">
                Go back to the original evidence.
              </span>
            </p>
            <ul className="flex flex-wrap gap-x-7 gap-y-3 text-base font-semibold tracking-[-.025em] text-[#49687E] sm:gap-x-10">
              {["OpenAlex", "arXiv", "Europe PMC", "Crossref"].map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
        </section>
        <section
          id="features"
          tabIndex={-1}
          className="scroll-mt-24 bg-white px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
        >
          <div className="mx-auto max-w-[1350px]">
            <div className="mb-12 grid gap-5 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
              <div>
                <p className={tag}>What EYLO does</p>
                <h2 className="mt-4 max-w-3xl text-[clamp(2.2rem,4.2vw,4rem)] font-bold leading-[1.12] tracking-[-.055em]">
                  Less scattered.
                  <br />
                  More connected.
                </h2>
              </div>
              <p className="max-w-md text-base leading-7 text-[#526E82]">
                Research is more than a search. EYLO brings finding, thinking
                and doing into one connected experience.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {capabilities.map(
                ({
                  number,
                  title,
                  subtitle,
                  body,
                  icon: Icon,
                  link,
                  anchor,
                  cta,
                }) => (
                  <article
                    key={title}
                    className="flex flex-col rounded-2xl border border-[#E0E9F0] bg-[#FAFCFE] p-6 transition hover:border-[#BDD7E9] lg:p-8"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-xl border border-[#E0EAF2] bg-white text-[#2E739D]">
                        <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <span className="text-xs font-medium text-[#526E82]">
                        {number}
                      </span>
                    </div>
                    <p className="mt-7 text-xs font-semibold uppercase tracking-[.12em] text-[#3B6D8F]">
                      {title}
                    </p>
                    <h3 className="mt-3 max-w-xs text-[25px] font-bold leading-tight tracking-[-.04em]">
                      {subtitle}
                    </h3>
                    <p className="mb-7 mt-4 flex-1 text-sm leading-7 text-[#526E82]">
                      {body}
                    </p>
                    {link ? (
                      <Link
                        to={link}
                        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#235E88]"
                      >
                        {cta}
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    ) : (
                      <a
                        href={anchor}
                        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#235E88]"
                      >
                        {cta}
                        <ArrowRight size={15} aria-hidden="true" />
                      </a>
                    )}
                  </article>
                ),
              )}
            </div>
          </div>
        </section>
        <section
          id="eyra"
          tabIndex={-1}
          className="scroll-mt-24 bg-[#F2F7FB] px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
        >
          <div className="mx-auto grid max-w-[1350px] items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
            <div>
              <p className={tag}>Meet EYRA</p>
              <h2 className="mt-4 text-[clamp(2.2rem,4vw,3.8rem)] font-bold leading-[1.12] tracking-[-.055em]">
                Your questions.
                <br />A clearer way forward.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#577286]">
                EYRA is the AI intelligence layer of EYLO. Work through a
                research question, connect ideas in your notes and plan the next
                step with the context you choose to share.
              </p>
              <ul className="my-7 space-y-4 text-sm font-medium text-[#34556D]">
                {[
                  "Explore a question and shape a reading plan",
                  "Work with your saved notes and project context",
                  "Review sources and confirm the actions you want",
                ].map((text) => (
                  <li key={text} className="flex items-start gap-3">
                    <Check
                      size={17}
                      className="mt-0.5 shrink-0 text-[#3287BB]"
                      aria-hidden="true"
                    />
                    {text}
                  </li>
                ))}
              </ul>
              <Link
                to="/login?from=%2Fhome"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#235E88]"
              >
                Bring EYRA into your workspace{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-[#1B2944] bg-[#050712] shadow-[0_24px_60px_-35px_rgba(23,42,64,.6)]">
              <img
                src={import.meta.env.BASE_URL + "brand/eyra.png"}
                alt="EYRA — the intelligence behind EYLO"
                width="1024"
                height="683"
                loading="lazy"
                decoding="async"
                className="aspect-[1.5] w-full object-cover"
              />
              <div className="border-t border-white/10 px-7 py-6">
                <p className="text-sm font-medium text-[#D4DFEF]">
                  A thinking partner, with you in control.
                </p>
                <p className="mt-2 text-xs leading-6 text-[#9EACC3]">
                  Check the evidence. Keep your judgment. Decide what happens
                  next.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="how-it-works"
          tabIndex={-1}
          className="scroll-mt-24 px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
        >
          <div className="mx-auto max-w-[1350px]">
            <p className={tag}>One question. A connected journey.</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2.2rem,4vw,3.8rem)] font-bold leading-[1.12] tracking-[-.055em]">
              From “where do I start?”
              <br />
              to “here’s my next step.”
            </h2>
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  title: "Explore the landscape",
                  body: "Start with a question. Discover related publications, people and opportunities.",
                  icon: Compass,
                },
                {
                  title: "Connect your thinking",
                  body: "Save useful sources, capture notes and work through the question with EYRA.",
                  icon: BookOpen,
                },
                {
                  title: "Move the work forward",
                  body: "Organize your project, choose the next tasks and return to your research with context.",
                  icon: Layers3,
                },
              ].map(({ title, body, icon: Icon }, index) => (
                <li key={title} className="border-t-2 border-[#DCE8F1] pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-widest text-[#3B6D8F]">
                      STEP 0{index + 1}
                    </span>
                    <Icon
                      size={20}
                      className="text-[#3B6D8F]"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-.03em]">
                    {title}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-[#526E82]">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          id="who-its-for"
          tabIndex={-1}
          className="scroll-mt-24 border-y border-[#E5EDF3] bg-[#FAFCFE] px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
        >
          <div className="mx-auto max-w-[1350px]">
            <p className={tag}>Built around the way you work</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2.2rem,4vw,3.8rem)] font-bold leading-[1.12] tracking-[-.055em]">
              Different starting points.
              <br />
              The same curiosity.
            </h2>
            <div className="mt-12 grid gap-9 md:grid-cols-3">
              {audiences.map(({ label, icon: Icon, title, body, outcome }) => (
                <article
                  key={label}
                  className="flex flex-col border-t border-[#D6E4EE] pt-6"
                >
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-[#2C6B94]">
                    <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
                    {label}
                  </div>
                  <h3 className="mt-5 max-w-xs text-[24px] font-semibold leading-tight tracking-[-.035em]">
                    {title}
                  </h3>
                  <p className="mb-6 mt-4 flex-1 text-sm leading-7 text-[#526E82]">
                    {body}
                  </p>
                  <p className="border-t border-[#E2EBF2] pt-4 text-xs font-medium leading-6 text-[#44667E]">
                    {outcome}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          id="principles"
          tabIndex={-1}
          className="scroll-mt-24 px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
        >
          <div className="mx-auto grid max-w-[1350px] gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className={tag}>Our approach</p>
              <h2 className="mt-4 max-w-lg text-[clamp(2.2rem,4vw,3.6rem)] font-bold leading-[1.12] tracking-[-.055em]">
                Built around evidence.
                <br />
                Designed around people.
              </h2>
              <Link
                to="/company/vision"
                className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#235E88]"
              >
                Read our vision <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="space-y-6">
              {[
                {
                  icon: BookOpen,
                  title: "A path back to the source",
                  body: "Original scholarly records stay part of the journey, so you can inspect where information comes from.",
                },
                {
                  icon: ShieldCheck,
                  title: "You choose the next action",
                  body: "Your private work belongs in your signed-in workspace. Review AI suggestions and choose what to save or confirm.",
                },
                {
                  icon: UsersRound,
                  title: "Room for different disciplines",
                  body: "Good questions come from everywhere. EYLO is built to support curiosity across academic backgrounds.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 border-b border-[#E5EDF3] pb-6 last:border-b-0"
                >
                  <Icon
                    size={22}
                    className="mt-1 shrink-0 text-[#2C6B94]"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="mt-2 max-w-lg text-sm leading-7 text-[#526E82]">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          id="questions"
          tabIndex={-1}
          className="scroll-mt-24 bg-[#FAFCFE] px-5 py-20 sm:px-9 sm:py-24 lg:px-16"
        >
          <div className="mx-auto grid max-w-[1350px] gap-10 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className={tag}>A few things to know</p>
              <h2 className="mt-4 text-[clamp(2.2rem,4vw,3.4rem)] font-bold leading-[1.12] tracking-[-.055em]">
                Curious?
                <br />
                Start here.
              </h2>
              <p className="mt-5 text-sm leading-7 text-[#526E82]">
                Have a different question?
                <br />
                <Link
                  to="/contact"
                  className="font-semibold text-[#235E88] underline underline-offset-4"
                >
                  Talk to us about EYLO.
                </Link>
              </p>
            </div>
            <div>
              {questions.map(({ question, answer }) => (
                <details
                  key={question}
                  className="group border-b border-[#DDE7EF] first:border-t"
                >
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-semibold sm:text-base">
                    {question}
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-[#3E6C8B] transition group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-[#526E82]">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="px-5 py-16 sm:px-9 sm:py-20 lg:px-16">
          <div className="mx-auto grid max-w-[1350px] gap-8 rounded-[24px] border border-[#DCE8F1] bg-[#EFF6FB] px-6 py-12 sm:px-10 md:grid-cols-[1fr_auto] md:items-center lg:px-14">
            <div>
              <p className={tag}>A place for your next idea</p>
              <h2 className="mt-4 max-w-2xl text-[clamp(2rem,3.8vw,3.6rem)] font-bold leading-[1.12] tracking-[-.055em]">
                Start exploring.
                <br />
                See where it takes you.
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-[#526E82]">
                Start with discovery. Build your workspace when you’re ready.
              </p>
            </div>
            <div className="flex flex-col items-start gap-4">
              <Link to="/discover" className={primary}>
                Explore EYLO <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#315F7D]"
              >
                Research group or collaborator? Let’s talk{" "}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#E0E9F0] px-5 pb-8 pt-12 sm:px-9 lg:px-16">
        <div className="mx-auto max-w-[1350px]">
          <div className="grid gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div>
              <Link to="/" aria-label="EYLO home" className="inline-flex">
                <img
                  src={import.meta.env.BASE_URL + "brand/eylo-light.svg"}
                  alt="EYLO"
                  width="130"
                  height="38"
                  loading="lazy"
                  className="h-[38px] w-auto"
                />
              </Link>
              <p className="mt-5 max-w-xs text-sm leading-7 text-[#526E82]">
                Connecting evidence, intelligence and the people moving research
                forward.
              </p>
            </div>
            <FooterGroup title="The platform">
              <Link to="/discover">Discover research</Link>
              <a href="#eyra">Meet EYRA</a>
              <Link to="/register">Create a workspace</Link>
              <Link to="/login">Log in</Link>
            </FooterGroup>
            <FooterGroup title="The company">
              {companyLinks.map((item) => (
                <Link key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </FooterGroup>
            <FooterGroup title="Let’s connect">
              <Link to="/contact">Contact EYLO</Link>
              <a href="#who-its-for">Who it’s for</a>
              <a href="#principles">Our approach</a>
              <a href="#questions">Questions & answers</a>
            </FooterGroup>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4ECF2] pt-6 text-xs text-[#526E82]">
            <p>© {new Date().getFullYear()} EYLO</p>
            <p>For curious minds. Across disciplines.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
function FooterGroup({ title, children }) {
  return (
    <nav
      aria-label={title}
      className="flex flex-col items-start gap-3 text-sm text-[#526E82]"
    >
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-[#284D67]">
        {title}
      </h2>
      {children}
    </nav>
  );
}
function ArrowDownIcon() {
  return <ChevronDown size={16} aria-hidden="true" />;
}
