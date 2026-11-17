import React from 'react';
import { Link } from 'react-router-dom';
import './landing.css';
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, FolderOpen, HelpCircle, Search, Users } from 'lucide-react';

const GOALS = [
  { label:'I want to find a scientific paper', text:'Enter a research topic and open records from the original scholarly sources.',path:'/search',button:'Search publications',Icon:Search,kind:'No account needed to search' },
  { label:'I want to find a researcher',text:'Look for academic experts and check their public research records.',path:'/academics',button:'Find researchers',Icon:Users,kind:'Public researcher discovery' },
  { label:'I want to find a PhD or research job',text:'Explore available research careers and follow the official opportunity links.',path:'/careers',button:'Explore careers',Icon:Briefcase,kind:'Some upstream sources may be unavailable' },
  { label:'I want to organize my work',text:'Use a private project for saved papers, notes, tasks and decisions.',path:'/projects',button:'Open my workspace',Icon:FolderOpen,kind:'Sign-in required for private work' },
];
const STEPS = [
  {title:'Explore',text:'Start with a topic. Look at the original research sources before drawing conclusions.',path:'/search',action:'Try research search'},
  {title:'Save',text:'Keep important papers in your private Library. Sign in first when you are ready.',path:'/library',action:'Open my Library'},
  {title:'Continue',text:'Create a project for your question, notes and next steps. Return whenever you want.',path:'/projects',action:'Open projects'},
];

export default function GettingStarted() {
  return <main id="main-content" tabIndex={-1} className="eylo-company min-h-screen bg-[var(--company-surface)] px-4 py-8 text-[var(--company-ink)] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" aria-label="Back to EYLO home" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--company-action)] hover:bg-[var(--company-soft)]"><ArrowLeft size={16} aria-hidden="true"/> EYLO home</Link>
        <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] px-4 text-sm font-medium hover:bg-[var(--company-soft)]">Already have an account? Sign in</Link>
      </header>

      <section aria-labelledby="start-title" className="mt-8 rounded-3xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--company-action)]">Welcome to EYLO</p>
        <h1 id="start-title" className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">What would you like to do?</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--company-muted)]">Start with a question, explore source-linked research, and keep your next step in one workspace. You can try public search before signing in.</p>
        <a href="#choose-goal" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--company-action)] px-5 text-sm font-semibold text-[var(--company-on-action)] hover:opacity-90">Choose a goal <ArrowRight size={16} aria-hidden="true"/></a>
      </section>

      <section id="choose-goal" aria-labelledby="choose-title" className="scroll-mt-8 pt-12">
        <h2 id="choose-title" className="text-2xl font-semibold">Start with a goal</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--company-muted)]">These options take you to real EYLO features. Research links and your private workspace remain separate from AI availability.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {GOALS.map(({label,text,path,button,Icon,kind}) => <article key={path} className="flex min-w-0 flex-col rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--company-tint)] text-[var(--company-action)]"><Icon size={21} aria-hidden="true"/></span>
            <h3 className="mt-4 text-lg font-semibold">{label}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[var(--company-muted)]">{text}</p>
            <p className="mt-3 text-xs text-[var(--company-muted)]">{kind}</p>
            <Link to={path} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--company-border)] px-4 text-sm font-semibold text-[var(--company-action)] hover:bg-[var(--company-action)]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#237eb5]">{button} <ArrowRight size={16} aria-hidden="true"/></Link>
          </article>)}
        </div>
      </section>

      <section aria-labelledby="steps-title" className="pt-12">
        <div className="flex items-center gap-3"><BookOpen size={22} className="text-[var(--company-action)]" aria-hidden="true"/><h2 id="steps-title" className="text-2xl font-semibold">Three simple steps</h2></div>
        <p className="mt-2 text-sm text-[var(--company-muted)]">You can stop or come back at any point.</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(({title,text,path,action},index) => <li key={title} className="flex min-w-0 flex-col rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5">
            <span className="text-xs font-bold text-[var(--company-action)]">STEP {index+1}</span>
            <h3 className="mt-2 text-lg font-semibold">{title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[var(--company-muted)]">{text}</p>
            <Link to={path} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--company-action)] hover:underline">{action}<ArrowRight size={15} aria-hidden="true"/></Link>
          </li>)}
        </ol>
      </section>

      <section aria-labelledby="help-title" className="my-12 rounded-2xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 sm:p-8">
        <div className="flex items-center gap-2"><HelpCircle size={21} className="text-[var(--company-action)]" aria-hidden="true"/><h2 id="help-title" className="text-xl font-semibold">A few things to know</h2></div>
        <div className="mt-5 space-y-3">
          <details className="rounded-xl border border-[var(--company-border)] px-4 py-3"><summary className="min-h-10 cursor-pointer py-2 font-medium">Do I need an account?</summary><p className="pb-2 text-sm leading-6 text-[var(--company-muted)]">You can search public academic records without signing in. Saving papers, notes or projects needs an account.</p></details>
          <details className="rounded-xl border border-[var(--company-border)] px-4 py-3"><summary className="min-h-10 cursor-pointer py-2 font-medium">What if EYRA AI is unavailable?</summary><p className="pb-2 text-sm leading-6 text-[var(--company-muted)]">You can still explore source-linked publications and return to your saved work. Always examine original sources; an AI answer is not proof.</p></details>
          <details className="rounded-xl border border-[var(--company-border)] px-4 py-3"><summary className="min-h-10 cursor-pointer py-2 font-medium">Can I go back?</summary><p className="pb-2 text-sm leading-6 text-[var(--company-muted)]">Use Back in your browser on public pages. Inside your workspace, Home and My workspace help you return to your work.</p></details>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/search" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--company-action)] px-5 text-sm font-semibold text-[var(--company-on-action)]"><Search size={16} aria-hidden="true"/>Try public research search</Link>
          <Link to="/company" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--company-border)] px-5 text-sm font-semibold hover:bg-[var(--company-soft)]">Learn more about EYLO</Link>
        </div>
      </section>
    </div>
  </main>;
}
