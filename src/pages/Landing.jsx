import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Building2,
  CheckCircle2,
  Database,
  FileSearch,
  FolderKanban,
  Globe2,
  Lightbulb,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

const EXAMPLES = [
  'AI for early cancer detection',
  'Robotics for independent ageing',
  'Climate adaptation for coastal cities',
  'Trustworthy AI in higher education',
];

const JOURNEY = [
  { label: 'Question', detail: 'A focused research problem', icon: Search },
  { label: 'Evidence', detail: 'Live source records', icon: BookOpen },
  { label: 'Reasoning', detail: 'Evidence, inference and uncertainty', icon: Brain },
  { label: 'People', detail: 'Relevant authors and institutions', icon: Users },
  { label: 'Funding', detail: 'Official programme records', icon: Target },
  { label: 'Project', detail: 'Saved context and milestones', icon: FolderKanban },
  { label: 'Action', detail: 'A defensible next step', icon: ArrowRight },
];

const SOURCES = [
  { name: 'OpenAlex', detail: 'Works, authors and institutions', icon: Globe2 },
  { name: 'arXiv', detail: 'Open research preprints', icon: BookOpen },
  { name: 'Europe PMC', detail: 'Biomedical literature records', icon: Database },
  { name: 'Crossref', detail: 'DOIs and publication metadata', icon: Building2 },
];

const EYRA_OUTPUT = [
  {
    label: 'Verified evidence',
    tone: 'text-cyan-200',
    text: 'Claims remain linked to the retrieved source records.',
  },
  {
    label: 'Inference',
    tone: 'text-violet-200',
    text: 'A methodological gap is suggested by the available evidence.',
  },
  {
    label: 'Uncertainty',
    tone: 'text-amber-200',
    text: 'Coverage for the target population appears limited.',
  },
  {
    label: 'Suggested next step',
    tone: 'text-emerald-200',
    text: 'Validate the assumption against an appropriate dataset.',
  },
];

const WORKSPACE_AREAS = [
  { label: 'Evidence Library', icon: BookOpen },
  { label: 'Researcher Intelligence', icon: Users },
  { label: 'Opportunity Radar', icon: Target },
  { label: 'Project Workspace', icon: FolderKanban },
  { label: 'Idea Vault', icon: Lightbulb },
];

const TRUST_POINTS = [
  'Evidence and model inference are labelled separately.',
  'Researcher profiles and citations come from connected sources.',
  'Uncertainty is surfaced when the evidence does not support certainty.',
  'Saved workspace data remains private to the signed-in user.',
  'Researchers remain responsible for final scientific and methodological decisions.',
];

function Eyebrow({ children, className = '' }) {
  return (
    <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300 ${className}`}>
      {children}
    </p>
  );
}

export default function Landing() {
  const [question, setQuestion] = useState('');
  const navigate = useNavigate();

  const explore = (event) => {
    event?.preventDefault();
    const query = question.trim();
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#050810] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050810]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="EYLO home">
            <img
              src="/brand/eylo-logo.svg"
              alt=""
              className="h-10 w-14 rounded-xl border border-white/10 bg-white/[0.03] object-contain p-1"
            />
            <span>
              <span className="block text-sm font-semibold tracking-[0.08em]">EYLO</span>
              <span className="hidden text-[8px] uppercase tracking-[0.2em] text-slate-500 sm:block">
                Research workspace
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary navigation">
            <Link
              to="/discover"
              className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white sm:inline-flex"
            >
              Explore
            </Link>
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-50 sm:px-4"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[34rem] max-w-6xl bg-[radial-gradient(circle_at_50%_12%,rgba(37,99,235,0.16),transparent_54%)]" />
        <div className="relative mx-auto max-w-6xl text-center">
          <Eyebrow>Live scientific evidence · AI-assisted reasoning · Private research workspace</Eyebrow>

          <h1 className="mx-auto mt-7 max-w-5xl font-heading text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-7xl lg:text-[5.6rem]">
            Turn a research question
            <span className="block text-slate-400">into a defensible next step.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-slate-400 sm:text-xl sm:leading-8">
            Search papers, researchers, institutions and funding across live research sources — then use EYRA to turn the evidence into a project, collaboration plan or next research decision.
          </p>

          <form
            onSubmit={explore}
            className="mx-auto mt-11 max-w-4xl rounded-[1.6rem] border border-cyan-200/15 bg-[#090e1a] p-2 shadow-[0_30px_100px_-45px_rgba(34,211,238,0.34)]"
          >
            <label htmlFor="research-question" className="sr-only">
              Try a research question
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center">
                <Search className="ml-4 shrink-0 text-cyan-300" size={18} aria-hidden="true" />
                <input
                  id="research-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Try a research question"
                  className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-white outline-none placeholder:text-slate-500 sm:text-lg"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-blue-400"
              >
                Explore evidence <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </form>

          <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2" aria-label="Example research questions">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuestion(example)}
                className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-cyan-300/30 hover:text-white"
              >
                {example}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
            >
              Create your workspace <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <span className="hidden text-slate-700 sm:block" aria-hidden="true">·</span>
            <span className="text-xs text-slate-500">No account required to explore public evidence</span>
          </div>

          <div className="mx-auto mt-12 max-w-5xl border-y border-white/[0.06] py-5">
            <p className="mb-4 text-[10px] uppercase tracking-[0.18em] text-slate-600">
              Powered by live source records
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SOURCES.map(({ name, icon: Icon }) => (
                <div key={name} className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
                  <Icon size={14} className="text-cyan-300/70" aria-hidden="true" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <Eyebrow>One continuous research journey</Eyebrow>
              <h2 className="mt-5 max-w-xl font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                See how a question becomes work you can defend.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                EYLO keeps evidence, reasoning, people, funding and execution connected to the same research context.
              </p>
              <div className="mt-9 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Example question</p>
                <p className="mt-3 text-lg leading-7 text-white">How can robots support independent ageing?</p>
              </div>
            </div>

            <div className="relative rounded-[2rem] border border-white/[0.08] bg-[#080d17] p-5 sm:p-8">
              <div className="absolute bottom-10 left-[2.4rem] top-10 w-px bg-gradient-to-b from-cyan-300/50 via-violet-300/40 to-emerald-300/50 sm:left-[3.9rem]" aria-hidden="true" />
              <ol className="relative space-y-2">
                {JOURNEY.map(({ label, detail, icon: Icon }, index) => (
                  <li key={label} className="grid grid-cols-[2.3rem_1fr] items-center gap-4 rounded-2xl px-1 py-3 sm:grid-cols-[3.5rem_0.7fr_1.3fr] sm:px-2">
                    <span className="relative z-10 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-[#0b1220] text-cyan-200 sm:h-11 sm:w-11">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-white">
                      <span className="mr-2 font-mono text-[9px] text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                      {label}
                    </span>
                    <span className="col-start-2 text-xs leading-5 text-slate-500 sm:col-start-auto sm:text-sm">{detail}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-white/[0.06] pt-5 text-[10px] leading-5 text-slate-600">
                Illustrative workflow. Source records, availability and recommendations depend on the research question.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] border border-violet-300/15 bg-[radial-gradient(circle_at_18%_5%,rgba(124,58,237,0.2),transparent_34%),linear-gradient(135deg,#0b1020,#070a12)]">
          <div className="grid gap-12 p-7 sm:p-12 lg:grid-cols-[0.8fr_1.2fr] lg:p-16">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[0.06] px-3 py-1.5 text-xs text-violet-200">
                <Sparkles size={13} aria-hidden="true" /> EYRA intelligence layer
              </div>
              <h2 className="mt-6 font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Reasoning that shows its boundaries.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                EYRA works across research, funding, team and impact context. Its role is to structure what the evidence supports, identify uncertainty and propose a useful next action.
              </p>
              <div className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08]">
                {['Research', 'Funding', 'Team', 'Impact'].map((label) => (
                  <div key={label} className="bg-[#090e1a] px-4 py-3 text-xs font-medium text-slate-300">{label}</div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/[0.09] bg-black/20 p-5 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-400/10 text-violet-200">
                    <Brain size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">Structured research judgment</p>
                    <p className="text-[10px] text-slate-500">Example EYRA output</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-2 py-1 text-[9px] uppercase tracking-wider text-emerald-200">
                  Evidence aware
                </span>
              </div>

              <dl className="divide-y divide-white/[0.06]">
                {EYRA_OUTPUT.map(({ label, tone, text }) => (
                  <div key={label} className="grid gap-2 py-5 sm:grid-cols-[9rem_1fr] sm:gap-5">
                    <dt className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>{label}</dt>
                    <dd className="text-sm leading-6 text-slate-300">{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <Eyebrow>Unified research workspace</Eyebrow>
            <h2 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              One workspace. One evidence trail.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-400">
              The tools share the same project context, so a discovery can become a decision instead of disappearing in another tab.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#080d17]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold text-white">Robotics for independent ageing</p>
                <p className="mt-1 text-[10px] text-slate-500">Example workspace context</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300">
                <ShieldCheck size={12} aria-hidden="true" /> Private workspace
              </span>
            </div>

            <div className="grid lg:grid-cols-[16rem_1fr]">
              <div className="border-b border-white/[0.07] p-3 lg:border-b-0 lg:border-r">
                <div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
                  {WORKSPACE_AREAS.map(({ label, icon: Icon }, index) => (
                    <div
                      key={label}
                      className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-xs ${index === 0 ? 'bg-cyan-300/[0.07] text-cyan-100' : 'text-slate-500'}`}
                    >
                      <Icon size={14} aria-hidden="true" /> {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
                {[
                  ['Evidence', 'Source-backed records saved with provenance', FileSearch, 'cyan'],
                  ['People', 'Authors and institutions linked to relevant work', Users, 'violet'],
                  ['Opportunity', 'Official notices with eligibility still to verify', Target, 'amber'],
                  ['Project', 'Decisions, milestones and the next validation step', FolderKanban, 'emerald'],
                ].map(([title, text, Icon, tone]) => (
                  <div key={title} className="min-h-44 bg-[#080d17] p-6 sm:p-8">
                    <Icon
                      size={18}
                      className={{
                        cyan: 'text-cyan-300',
                        violet: 'text-violet-300',
                        amber: 'text-amber-300',
                        emerald: 'text-emerald-300',
                      }[tone]}
                      aria-hidden="true"
                    />
                    <p className="mt-6 text-[10px] uppercase tracking-[0.16em] text-slate-600">{title}</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-slate-300">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <Eyebrow>Live evidence infrastructure</Eyebrow>
              <h2 className="mt-5 font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                Source records in. Traceable decisions out.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-400">
                EYLO retrieves scholarly metadata, normalizes records and carries their source context into the workspace. Retrieved records are evidence inputs, not automatic scientific truth.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/[0.08] bg-[#080d17] p-5 sm:p-8">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SOURCES.map(({ name }) => (
                  <div key={name} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 text-center text-xs text-slate-300">
                    {name}
                  </div>
                ))}
              </div>
              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.15em] text-slate-600">
                <span className="h-px flex-1 bg-white/[0.07]" />
                normalized with source context
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                {[
                  ['EYLO evidence layer', Network],
                  ['Structured records', Database],
                  ['Workspace decisions', CheckCircle2],
                ].map(([label, Icon], index) => (
                  <React.Fragment key={label}>
                    <div className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4 text-center">
                      <Icon size={17} className="text-cyan-300" aria-hidden="true" />
                      <p className="mt-3 text-xs font-medium text-slate-200">{label}</p>
                    </div>
                    {index < 2 && <ArrowRight className="mx-auto rotate-90 text-slate-700 sm:rotate-0" size={16} aria-hidden="true" />}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-violet-200/70">
                <Brain size={12} aria-hidden="true" /> EYRA reasoning operates on this structured context
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#e9edf4] px-5 py-24 text-slate-950 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-700">Research judgment</p>
            <h2 className="mt-5 max-w-xl font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Built for judgment, not blind automation.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              EYLO helps people inspect evidence and move work forward. It does not replace source verification, methodological review or scientific responsibility.
            </p>
          </div>

          <ul className="divide-y divide-slate-300 border-y border-slate-300">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-4 py-5 text-sm leading-6 text-slate-700">
                <CheckCircle2 className="mt-0.5 shrink-0 text-blue-700" size={17} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-heading text-4xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
            Your next research question deserves a working system.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400">
            Start with one question. Build the evidence, people and execution path around it.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-50"
            >
              Start building free <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link
              to="/discover"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Explore evidence first <BookOpen size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>EYLO · Evidence, reasoning and research execution</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/discover" className="transition-colors hover:text-white">Explore evidence</Link>
            <Link to="/login" className="transition-colors hover:text-white">Sign in</Link>
            <Link to="/register" className="transition-colors hover:text-white">Create workspace</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
