import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Layers3,
  Menu,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import LandingPreview from "@/components/marketing/LandingPreview";
import ThemeToggle from "@/components/marketing/ThemeToggle";
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
    title: "Decide",
    subtitle: "Keep both sides of the evidence.",
    body: "Tag sources as supporting, challenging or contextual. Record the alternatives, criteria and rationale beside the project decision.",
    icon: Layers3,
    anchor: "#decision-trail",
    cta: "See the decision trail",
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
const companyLinks = [
  { to: "/company", label: "About EYLO" },
  { to: "/company/what-we-do", label: "What we do" },
  { to: "/company/vision", label: "Our vision" },
  { to: "/company/careers", label: "Careers" },
];
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl company-primary px-6 text-sm font-semibold text-white transition hover:bg-[var(--company-soft)]";
const tag =
  "text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--company-muted)]";

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
    <div className="eylo-company min-h-screen bg-[var(--company-surface)] text-[var(--company-ink)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--company-surface)] focus:px-4 focus:py-3 focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-[var(--company-border)] bg-[var(--company-surface)] backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1480px] items-center justify-between gap-3 px-5 sm:px-9 lg:px-16">
          <Link to="/" aria-label="EYLO home" className="inline-flex shrink-0">
            <img
              src={import.meta.env.BASE_URL + "brand/eylo-light.svg"}
              alt="EYLO"
              width="148"
              height="43"
              fetchPriority="high"
              className="company-brand h-9 w-auto sm:h-[42px]"
            />
          </Link>
          <nav
            aria-label="Company navigation"
            className="hidden items-center gap-7 text-[13px] font-medium text-[var(--company-muted)] xl:flex"
          >
            <a href="#how-it-works">How it works</a>
            <a href="#why-eylo">Why EYLO</a>
            <a href="#who-its-for">Who it’s for</a>
            <Link to="/company">About EYLO</Link>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="hidden min-h-10 items-center px-3 text-[13px] font-medium sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              to="/discover"
              className="hidden min-h-10 items-center gap-2 rounded-xl company-primary px-3 text-xs font-semibold text-white transition sm:inline-flex sm:px-5 sm:text-[13px]"
            >
              Explore research <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <button
              type="button"
              ref={menuButton}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="company-mobile-nav"
              onClick={() => setMenuOpen((value) => !value)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--company-border)] xl:hidden"
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
          className={`${menuOpen ? "grid" : "hidden"} gap-1 border-t border-[var(--company-border)] bg-[var(--company-surface)] px-5 py-4 text-sm font-medium xl:hidden`}
        >
          {[
            { href: "#how-it-works", label: "What EYLO does" },
            { href: "#why-eylo", label: "Why EYLO" },
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
            to="/start"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-3"
          >Start here</Link>
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
          <Link
            to="/plans"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg p-3"
          >
            Plans
          </Link>
          <Link
            to="/discover"
            className="rounded-lg p-3"
            onClick={() => setMenuOpen(false)}
          >
            Explore research
          </Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section id="about" className="overflow-hidden">
          <div className="mx-auto grid max-w-[1480px] items-center gap-8 px-5 pb-16 pt-12 sm:px-9 sm:pt-20 lg:min-h-[700px] lg:grid-cols-[.98fr_1.02fr] lg:gap-12 lg:px-16 lg:pb-20 lg:pt-20">
            <div className="relative z-10">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--company-border)] bg-[var(--company-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--company-muted)]">
                RESEARCH · AI · PROJECTS
              </p>
              <h1 className="max-w-[660px] text-[clamp(2.8rem,5.25vw,5.7rem)] font-bold leading-[1.04] tracking-[-.068em]">
                Your research,
                <br />
                all in one place
                <span className="text-[#24AAF3]" aria-hidden="true">.</span>
              </h1>
              <p className="mt-7 max-w-[540px] text-lg leading-[1.7] text-[var(--company-muted)] sm:text-xl">
                Find papers, think through questions with EYRA, and keep your sources, notes and project decisions together—so the next step is clear.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/discover" className={primary}>
                  Explore research <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--company-border)] px-5 text-sm font-semibold transition hover:bg-[var(--company-soft)]"
                >
                  How it works <span aria-hidden="true">↓</span>
                </a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-medium text-[var(--company-muted)]">
                {audiences.map(({ label, icon: Icon }) => (
                  <span key={label} className="inline-flex items-center gap-2">
                    <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
                    {label.replace("For ", "")}
                  </span>
                ))}
              </div>
            </div>
            <LandingPreview />
          </div>
        </section>
        <section
          id="how-it-works"
          tabIndex={-1}
          className="scroll-mt-24 bg-[var(--company-soft)] px-5 py-16 sm:px-9 sm:py-20 lg:px-16"
        >
          <div id="features" className="mx-auto max-w-[1350px]">
            <p className={tag}>One connected workspace</p>
            <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <h2 className="max-w-2xl text-[clamp(2.1rem,4vw,3.6rem)] font-bold leading-[1.1] tracking-[-.055em]">
                Find it. Think it through. Move it forward.
              </h2>
              <p className="max-w-md text-sm leading-7 text-[var(--company-muted)]">
                Start with a question. Keep the useful work together as it becomes a project.
              </p>
            </div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {capabilities.map(({ number, title, subtitle, body, icon: Icon }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 sm:p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--company-tint)] text-[var(--company-ink)]">
                      <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
                    </span>
                    <span className="text-xs text-[var(--company-muted)]">{number}</span>
                  </div>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[.12em] text-[var(--company-muted)]">
                    {title}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-.03em]">
                    {subtitle}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--company-muted)]">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          id="why-eylo"
          tabIndex={-1}
          className="scroll-mt-24 px-5 py-16 sm:px-9 sm:py-20 lg:px-16"
        >
          <div className="mx-auto grid max-w-[1350px] gap-8 md:grid-cols-[1.1fr_.9fr] md:items-center">
            <div>
              <p className={tag}>Why EYLO</p>
              <h2 className="mt-4 max-w-2xl text-[clamp(2rem,3.8vw,3.3rem)] font-bold leading-[1.12] tracking-[-.05em]">
                Your research keeps its thread.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--company-muted)]">
                Sources, ideas, project decisions and next steps stay connected—so the work doesn’t get lost between searching, thinking and doing.
              </p>
            </div>
            <div id="who-its-for" className="rounded-2xl border border-[var(--company-border)] bg-[var(--company-soft)] p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--company-muted)]">
                Made for curious minds
              </p>
              <h3 className="mt-4 text-lg font-semibold leading-8">
                Students. Academics. Researchers.
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--company-muted)]">
                Across disciplines, from the first question to the next clear step.
              </p>
            </div>
          </div>
        </section>
        <section className="px-5 pb-16 sm:px-9 sm:pb-20 lg:px-16">
          <div className="mx-auto grid max-w-[1350px] gap-6 rounded-[24px] bg-[var(--company-tint)] px-6 py-9 sm:px-10 md:grid-cols-[1fr_auto] md:items-center lg:px-12">
            <div>
              <p className={tag}>Your next question starts somewhere</p>
              <h2 className="mt-3 max-w-2xl text-[clamp(1.8rem,3.4vw,3rem)] font-bold leading-[1.1] tracking-[-.05em]">
                Start exploring. Keep moving.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--company-muted)]">
                Search public research first. Create a workspace when you’re ready.
              </p>
            </div>
            <Link to="/discover" className={primary}>
              Explore EYLO <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-[var(--company-border)] px-5 pb-8 pt-12 sm:px-9 lg:px-16">
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
                  className="company-brand h-[38px] w-auto"
                />
              </Link>
              <p className="mt-5 max-w-xs text-sm leading-7 text-[var(--company-muted)]">
                Connecting evidence, intelligence and the people moving research
                forward.
              </p>
            </div>
            <FooterGroup title="The platform">
              <Link to="/start">Start here — simple guide</Link>
              <Link to="/discover">Discover research</Link>
              <a href="#how-it-works">How it works</a>
              <Link to="/register">Create a workspace</Link>
              <Link to="/plans">Plans & Premium</Link>
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
              <a href="#why-eylo">Why EYLO</a>
              <a href="#who-its-for">Who it’s for</a>
            </FooterGroup>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--company-border)] pt-6 text-xs text-[var(--company-muted)]">
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
      className="flex flex-col items-start gap-3 text-sm text-[var(--company-muted)]"
    >
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-[.12em] text-[var(--company-muted)]">
        {title}
      </h2>
      {children}
    </nav>
  );
}
