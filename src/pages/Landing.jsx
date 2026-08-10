import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Building2, Sparkles, Users, Database,
  FolderOpen, Zap, Lightbulb, TrendingUp, ShieldCheck,
  CheckCircle2, Globe, Search, Brain, Target, Rocket,
} from 'lucide-react';

const EXAMPLES = [
  'AI for early cancer detection',
  'Robotics for independent ageing',
  'Climate adaptation for coastal cities',
  'Trustworthy AI in higher education',
];

const WORKFLOW = [
  {
    step: '01',
    icon: Search,
    title: 'Discover the evidence',
    text: 'Search papers, authors and institutions across four live research indexes from one question.',
  },
  {
    step: '02',
    icon: Brain,
    title: 'Synthesize with EYRA',
    text: 'Separate verified records, model inference and assumptions before making a research decision.',
  },
  {
    step: '03',
    icon: FolderOpen,
    title: 'Build the project',
    text: 'Turn findings into a project with saved evidence, milestones, collaborators and a working roadmap.',
  },
  {
    step: '04',
    icon: Rocket,
    title: 'Move to action',
    text: 'Explore real funding programmes, team gaps and the next measurable validation step.',
  },
];

const TOOLS = [
  {
    icon: BookOpen,
    title: 'Evidence Library',
    text: 'Keep papers, researchers and opportunities connected to the question they support.',
    label: 'Build an evidence base',
    href: '/register',
  },
  {
    icon: Users,
    title: 'Researcher Intelligence',
    text: 'Find relevant experts and institutions through live OpenAlex records, not fabricated profiles.',
    label: 'Find collaborators',
    href: '/discover',
  },
  {
    icon: Zap,
    title: 'Opportunity Radar',
    text: 'Match a project to grants, calls and programmes while keeping eligibility and deadlines explicit.',
    label: 'Explore funding',
    href: '/register',
  },
  {
    icon: FolderOpen,
    title: 'Project Workspace',
    text: 'Convert an idea into milestones, evidence, decisions and a visible execution path.',
    label: 'Create a project',
    href: '/register',
  },
  {
    icon: Lightbulb,
    title: 'Idea Vault',
    text: 'Capture early hypotheses and save valuable EYRA insights before they disappear in a chat.',
    label: 'Develop an idea',
    href: '/register',
  },
  {
    icon: TrendingUp,
    title: 'Impact & Scenarios',
    text: 'Stress-test scientific, social and commercial assumptions with transparent confidence levels.',
    label: 'Test a direction',
    href: '/register',
  },
];

const SOURCES = [
  { name: 'OpenAlex', detail: 'Works, authors and institutions', icon: Globe },
  { name: 'arXiv', detail: 'Current open preprints', icon: BookOpen },
  { name: 'Europe PMC', detail: 'Biomedical research records', icon: Database },
  { name: 'Crossref', detail: 'DOI and publication metadata', icon: Building2 },
];

const TRUST_POINTS = [
  'No invented citations or researcher profiles',
  'Evidence and inference are labelled separately',
  'Your saved workspace is private to your account',
  'Every recommendation ends in a concrete next step',
];

export default function Landing() {
  const [idea, setIdea] = useState('');
  const navigate = useNavigate();

  const discover = (event) => {
    event?.preventDefault();
    const query = idea.trim();
    navigate(query ? '/discover?q=' + encodeURIComponent(query) : '/discover');
  };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-30 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="EYLO home">
          <img
            src="/brand/eylo-logo.svg"
            alt="EYLO"
            className="h-14 w-20 rounded-2xl border border-white/10 bg-white/[0.03] object-contain p-1 shadow-xl shadow-cyan-500/15 sm:w-24"
          />
          <span className="hidden sm:block">
            <span className="block font-heading text-lg font-bold tracking-tight">EYLO</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Research & Innovation OS</span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/discover" className="hidden rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Explore</Link>
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
          <Link to="/register" className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90">Get started</Link>
        </nav>
      </header>

      <section className="relative px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[680px] w-[1100px] -translate-x-1/2 rounded-full bg-primary/10 blur-[150px]" />
        <div className="pointer-events-none absolute left-[8%] top-40 h-52 w-52 rounded-full bg-cyan-400/5 blur-[90px]" />
        <div className="pointer-events-none absolute right-[8%] top-20 h-64 w-64 rounded-full bg-violet-400/5 blur-[100px]" />

        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            Live evidence · OpenAI intelligence · Private workspace
          </div>

          <h1 className="mx-auto max-w-5xl font-heading text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-[5.8rem]">
            Turn a research question into
            <span className="block eyra-text-gradient">credible action.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-muted-foreground sm:text-xl sm:leading-8">
            EYLO connects scientific evidence, researchers, projects, funding and AI reasoning in one workspace built for people creating new knowledge and real-world impact.
          </p>

          <form onSubmit={discover} className="mx-auto mt-11 max-w-4xl rounded-[1.8rem] border border-cyan-200/15 bg-slate-950/70 p-2.5 shadow-[0_30px_100px_-35px_rgba(56,189,248,0.35)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="ml-4 hidden text-cyan-300 sm:block" size={19} />
              <input
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                placeholder="Describe a research question, technology or problem…"
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base outline-none placeholder:text-muted-foreground/70 sm:text-lg"
                aria-label="Describe the research question you want to explore"
              />
              <button type="submit" className="flex items-center gap-2 rounded-2xl eyra-gradient px-5 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:px-7">
                <span className="hidden sm:inline">Discover with EYRA</span>
                <span className="sm:hidden">Discover</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </form>

          <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => setIdea(example)}
                className="rounded-full border border-border/70 bg-card/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map(({ name, detail, icon: Icon }) => (
              <div key={name} className="rounded-2xl border border-white/5 bg-white/[0.025] p-4 backdrop-blur">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/5 text-cyan-300">
                  <Icon size={14} />
                </div>
                <p className="text-xs font-semibold text-slate-100">{name}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-card/20 px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">One continuous research workflow</p>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-5xl">From “what if?” to the next defensible move.</h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">No disconnected chat, static dashboard or pile of links. Every stage feeds the same living workspace.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            {WORKFLOW.map(({ step, icon: Icon, title, text }) => (
              <article key={step} className="group relative overflow-hidden rounded-3xl border border-border/70 bg-background/70 p-6 transition-colors hover:border-cyan-300/25">
                <span className="font-mono text-[10px] text-cyan-300/60">{step}</span>
                <div className="mt-8 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/10 bg-cyan-300/5 text-cyan-300">
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 rounded-[2.5rem] border border-primary/20 bg-card/60 p-7 shadow-2xl shadow-violet-500/5 sm:p-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
            <img src="/brand/eyra.png" alt="EYRA — the intelligence inside EYLO" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-4 bottom-4 grid grid-cols-3 gap-2">
              {['Evidence-aware', 'Workspace-aware', 'Action-ready'].map((label) => (
                <span key={label} className="rounded-xl border border-white/10 bg-slate-950/80 px-2 py-2 text-center font-mono text-[8px] uppercase tracking-wider text-cyan-200 backdrop-blur">{label}</span>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Ask EYRA</p>
            <h2 className="mt-4 font-heading text-3xl font-bold sm:text-5xl">AI that works with your research workspace.</h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">
              EYRA can reason across your projects, saved papers, researchers, opportunities and ideas. It uses real structured AI for research, strategy, funding, team and impact tools—then lets you save useful outputs back into the workspace.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                ['Research', 'Gaps, methods and literature strategy'],
                ['Funding', 'Programme fit and application path'],
                ['Team', 'Missing expertise and collaborators'],
                ['Impact', 'Assumptions, scenarios and confidence'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-border/70 bg-background/60 p-4">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>

            <Link to="/register" className="mt-8 inline-flex items-center gap-2 rounded-2xl eyra-gradient px-6 py-3.5 text-sm font-semibold text-white">
              Build your research workspace <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-card/20 px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">The workspace</p>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-5xl">Powerful tools. One evidence trail.</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">Each tool works on the same project context, so discoveries become decisions instead of disappearing across tabs.</p>
            </div>
            <Link to="/discover" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Try public discovery <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ icon: Icon, title, text, label, href }) => (
              <Link key={title} to={href} className="group rounded-3xl border border-border/70 bg-background/70 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon size={19} />
                </div>
                <h3 className="mt-5 font-heading text-lg font-semibold">{title}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{text}</p>
                <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  {label} <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-300/5 text-emerald-300">
              <ShieldCheck size={22} />
            </div>
            <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300">Trust by design</p>
            <h2 className="mt-4 font-heading text-3xl font-bold sm:text-5xl">Impressive is useful. Credible is essential.</h2>
            <p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">EYLO is designed to help researchers think and act faster without hiding uncertainty or manufacturing authority.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {TRUST_POINTS.map((point) => (
              <div key={point} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/50 p-5">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
                <p className="text-sm leading-6 text-foreground/85">{point}</p>
              </div>
            ))}
            <div className="sm:col-span-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-5">
              <div className="flex items-start gap-3">
                <Target size={18} className="mt-0.5 shrink-0 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-cyan-100">Built for research judgment, not blind automation.</p>
                  <p className="mt-2 text-xs leading-5 text-cyan-50/60">EYRA accelerates discovery and planning; researchers remain responsible for verifying sources, methodology, eligibility and final decisions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] border border-cyan-300/15 bg-slate-950 px-7 py-14 text-center shadow-[0_35px_120px_-45px_rgba(56,189,248,0.4)] sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.16),transparent_55%)]" />
          <div className="relative">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl eyra-gradient text-white"><Sparkles size={21} /></div>
            <h2 className="mx-auto mt-6 max-w-3xl font-heading text-3xl font-bold tracking-tight text-white sm:text-5xl">Your next research breakthrough deserves a working system.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Start with one question. Build the evidence, team and execution path around it.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-2xl eyra-gradient px-7 py-4 text-sm font-semibold text-white">Start building free <ArrowRight size={14} /></Link>
              <Link to="/discover" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-7 py-4 text-sm font-semibold text-white">Explore evidence first <BookOpen size={14} /></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>EYLO · Research & Innovation Operating System</p>
          <div className="flex items-center gap-5">
            <Link to="/discover" className="hover:text-foreground">Public discovery</Link>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <Link to="/register" className="hover:text-foreground">Create account</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
