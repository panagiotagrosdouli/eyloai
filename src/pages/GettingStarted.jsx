import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './landing.css';
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, FolderOpen, HelpCircle, Search, Users } from 'lucide-react';

const AUDIENCES = [
  {id:'ask',name:'Ask & explore',Icon:HelpCircle,problem:'I have a question and want to explore a topic.',actions:[
    {label:'Ask EYRA',path:'/login?from=%2Fhome',detail:'Sign in to use AI assistance when available',Icon:HelpCircle},
    {label:'Find trustworthy sources',path:'/search',detail:'Discover scientific records without signing in',Icon:Search},
    {label:'Learn a new subject',path:'/learn',detail:'Open learning tools in your workspace',Icon:BookOpen},
  ]},
  {id:'create',name:'Create & learn',Icon:BookOpen,problem:'I want to write, study or turn an idea into something useful.',actions:[
    {label:'Create a document',path:'/documents/new',detail:'Write and organize content in your workspace',Icon:BookOpen},
    {label:'Explore learning tools',path:'/learn',detail:'Build knowledge with learning activities',Icon:HelpCircle},
    {label:'Organize my ideas',path:'/projects',detail:'Keep progress and decisions in one place',Icon:FolderOpen},
  ]},
  {id:'organize',name:'Plan & organize',Icon:FolderOpen,problem:'I want to manage projects, tasks and next steps.',actions:[
    {label:'My projects',path:'/projects',detail:'Keep work, milestones and ideas connected',Icon:FolderOpen},
    {label:'My tasks',path:'/life',detail:'Track what matters next',Icon:Briefcase},
    {label:'Explore opportunities',path:'/opportunities',detail:'Specialized research funding records; eligibility varies',Icon:Users},
  ]},
  {id:'research',name:'Research & evidence',Icon:Search,problem:'I need scientific evidence and reliable original sources.',actions:[
    {label:'Search scientific literature',path:'/search',detail:'Trace records to scholarly indexes',Icon:Search},
    {label:'Find researchers',path:'/academics',detail:'Discover academic authors and institutions',Icon:Users},
    {label:'Save my evidence',path:'/library',detail:'Keep important research together',Icon:FolderOpen},
  ]},
];
const STEPS = [
  {title:'Explore',text:'Start with a topic. Look at the original research sources before drawing conclusions.',path:'/search',action:'Try research search'},
  {title:'Save',text:'Keep important papers in your private Library. Sign in first when you are ready.',path:'/library',action:'Open my Library'},
  {title:'Continue',text:'Create a project for your question, notes and next steps. Return whenever you want.',path:'/projects',action:'Open projects'},
];

export default function GettingStarted() {
  const [audience, setAudience] = useState('ask');
  const selected = AUDIENCES.find(item => item.id === audience) || AUDIENCES[0];
  return <main id="main-content" tabIndex={-1} className="eylo-company min-h-screen bg-[var(--company-surface)] px-4 py-8 text-[var(--company-ink)] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" aria-label="Back to EYLO home" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--company-action)] hover:bg-[var(--company-soft)]"><ArrowLeft size={16} aria-hidden="true"/> EYLO home</Link>
        <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] px-4 text-sm font-medium hover:bg-[var(--company-soft)]">Already have an account? Sign in</Link>
      </header>

      <section aria-labelledby="start-title" className="mt-8 rounded-3xl border border-[var(--company-border)] bg-[var(--company-surface)] p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--company-action)]">Welcome to EYLO</p>
        <h1 id="start-title" className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">What would you like to do?</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--company-muted)]">EYLO brings together AI assistance, learning, creation, planning and research tools. Choose what you want to do first; some features require an account.</p>
        <a href="#choose-goal" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--company-action)] px-5 text-sm font-semibold text-[var(--company-on-action)] hover:opacity-90">Choose a goal <ArrowRight size={16} aria-hidden="true"/></a>
      </section>

      <section id="choose-goal" aria-labelledby="choose-title" className="scroll-mt-8 pt-12">
        <h2 id="choose-title" className="text-2xl font-semibold">What would you like help with?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--company-muted)]">Choose a goal. This changes suggestions on this page, not your account settings.</p>
        <div role="group" aria-label="Your goal" className="mt-6 flex flex-wrap gap-3">
          {AUDIENCES.map(item => <button key={item.id} type="button" aria-pressed={audience === item.id} onClick={() => setAudience(item.id)} className={`inline-flex min-h-12 items-center gap-2 rounded-xl border px-5 text-sm font-semibold ${audience === item.id ? 'border-[#237eb5] bg-[var(--company-tint)] text-[var(--company-ink)]' : 'border-[var(--company-border)]'}`}><item.Icon size={18} aria-hidden="true" />{item.name}</button>)}
        </div>
        <div className="mt-5 rounded-2xl border border-[var(--company-border)] bg-[var(--company-soft)] p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--company-muted)]">Your starting point</p>
          <h3 className="mt-2 text-xl font-semibold">{selected.problem}</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {selected.actions.map(({label, path, detail, Icon}) => <Link key={path} to={path} className="group flex flex-col rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#237eb5]">
              <Icon size={24} className="text-[var(--company-action)]" aria-hidden="true" />
              <span className="mt-4 text-base font-semibold">{label}</span>
              <span className="mt-2 flex-1 text-sm leading-6 text-[var(--company-muted)]">{detail}</span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--company-action)]">Open feature <ArrowRight size={16} aria-hidden="true"/></span>
            </Link>)}
          </div>
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
