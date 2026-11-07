import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, BookOpen, CheckCircle2, FolderOpen, Sparkles, CalendarCheck, ShieldCheck, LibraryBig, Users, FileText } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;

export default function Landing() {
  const [question, setQuestion] = useState('');
  const [previewTab, setPreviewTab] = useState('Literature');
  const navigate = useNavigate();

  const explore = event => {
    event?.preventDefault();
    const query = question.trim();
    if (query) trackSearchStarted('homepage');
    navigate(query ? `/discover?q=${encodeURIComponent(query)}` : '/discover');
  };



  return (
    <main id="main-content" className="min-h-screen bg-[#F7F9FC] text-[#142D49]">
      <a href="#research-question" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:shadow-lg">Skip to research search</a>

      <header className="border-b border-[#DFE7EF] bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-3 px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home" className="mr-auto shrink-0"><img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="180" height="54" className="h-10 w-auto max-w-[130px] object-contain sm:h-12 sm:max-w-[180px]" fetchPriority="high" /></Link>
          <Link to="/discover" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] sm:inline-flex">Discover</Link>
          <a href="#how-it-works" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] sm:inline-flex">How it works</a>
          <a href="#methodology" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] md:inline-flex">Methodology</a>
          <Link to="/contact" className="hidden px-2 py-2 text-sm text-[#405B77] hover:text-[#174C7C] lg:inline-flex">Contact</Link>
          <Link to="/login" className="rounded-lg border border-[#B9CADB] bg-white px-4 py-2 text-sm font-medium text-[#173D67] transition hover:bg-[#F1F6FB]">Sign in</Link>
        </div>
      </header>
      <section className="border-b border-[#E3EAF1] bg-white px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-24" aria-labelledby="eylo-hero-title">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#276A99]">AI-powered scientific research</p>
          <h1 id="eylo-hero-title" className="mx-auto mt-6 max-w-4xl font-serif text-[clamp(2.6rem,5.5vw,5rem)] font-normal leading-[1.08] tracking-[-0.045em] text-[#102B49]">Research begins with evidence.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#526A82] sm:text-lg">Discover scientific literature, explore researchers, and transform evidence into structured research projects — with AI assistance.</p>
          <form role="search" onSubmit={explore} className="mx-auto mt-10 flex w-full max-w-2xl items-center gap-2 rounded-xl border border-[#BFCFDB] bg-white p-2 shadow-[0_12px_32px_-24px_rgba(16,43,73,0.3)] focus-within:ring-2 focus-within:ring-[#347BA8]">
            <Search className="ml-3 shrink-0 text-[#567895]" size={20} aria-hidden="true" />
            <label htmlFor="research-question" className="sr-only">Research question</label>
            <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="What would you like to research?" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#142D49] outline-none placeholder:text-[#788CA0]" />
            <button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#174672] text-white transition hover:bg-[#245D91]"><ArrowRight size={19} /></button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[#526B83]">
            <span>Try a topic:</span>
            {['Climate adaptation', 'Public health', 'Machine learning'].map(topic => (
              <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate(`/discover?q=${encodeURIComponent(topic)}`); }} className="min-h-9 rounded-full border border-[#D6E1EB] bg-[#F6F9FC] px-3 font-medium hover:bg-[#EAF2F8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c68a0]">{topic}</button>
            ))}
          </div>
          <div className="mx-auto mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/discover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#174672] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#245D91]">Explore research <ArrowRight size={16} /></Link>
            <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#B9CADB] bg-white px-6 py-3 text-sm font-semibold text-[#174672] hover:bg-[#F2F7FB]">Create workspace <ArrowRight size={16} /></Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#61778E]">Explore scholarly sources without creating an account. Sign in to save evidence and manage projects.</p>
        </div>
      </section>

      <section id="research-preview" aria-labelledby="preview-title" className="border-b border-[#DFE7EF] bg-[#F6F9FC] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[0.83fr_1.17fr] lg:gap-14">
          <div className="lg:pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">Research discovery</p>
            <h2 id="preview-title" className="mt-4 max-w-md font-serif text-4xl leading-tight text-[#102B49] sm:text-5xl">Explore research across disciplines.</h2>
            <p className="mt-5 max-w-md text-base leading-8 text-[#536B82]">Inspect scholarly records, explore research context and identify the next step — without mistaking an AI suggestion for verified evidence.</p>
            <Link to="/discover" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#174672] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245D91]">Explore scholarly research <ArrowRight size={16}/></Link>
            <p className="mt-5 max-w-sm text-xs leading-6 text-[#697D90]">Interface preview showing the workflow, not live results or research-quality claims.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#D9E4EF] bg-white shadow-[0_20px_70px_-48px_rgba(16,43,73,0.35)]">
            <div className="border-b border-[#E3EAF2] px-6 py-5 sm:px-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6D8498]">Research workspace preview</p>
              <h3 className="mt-2 text-xl font-semibold text-[#173A5D]">Your research journey</h3>
              <div role="tablist" aria-label="Example research views" className="mt-5 flex gap-1 border-b border-[#E4EBF1]">
                {['Literature', 'Researchers', 'Projects'].map(tab => <button key={tab} id={'preview-tab-' + tab.toLowerCase()} type="button" role="tab" aria-controls="preview-tab-panel" aria-selected={previewTab === tab} onClick={()=>setPreviewTab(tab)} className={'min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition ' + (previewTab === tab ? 'border-[#205986] text-[#153C62]' : 'border-transparent text-[#647A90] hover:text-[#153C62]')}>{tab}</button>)}
              </div>
            </div>
            <div id="preview-tab-panel" role="tabpanel" aria-labelledby={'preview-tab-' + previewTab.toLowerCase()} className="space-y-4 p-5 sm:p-7">
              {previewTab === 'Literature' && <>
                <article className="rounded-xl border border-[#DCE6EF] bg-[#FBFCFE] p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#356E98]">Discover scholarly literature</p>
                  <h4 className="mt-3 text-base font-semibold leading-7 text-[#173452]">Find publications relevant to your research question</h4>
                  <p className="mt-2 text-sm leading-6 text-[#61788E]">Review titles, authors, publication dates and source links before deciding what evidence is useful.</p>
                  <Link to="/discover" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Search the literature <ArrowRight size={15}/></Link>
                </article>
                <article className="rounded-xl border border-[#DCE6EF] bg-white p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#356E98]">Evaluate research evidence</p>
                  <h4 className="mt-3 text-base font-semibold text-[#173452]">Follow sources. Assess relevance. Keep context.</h4>
                  <p className="mt-2 text-sm leading-6 text-[#61788E]">Examine original records and distinguish reported findings from AI-assisted interpretations.</p>
                </article>
              </>}
              {previewTab === 'Researchers' && <div className="rounded-xl border border-[#DCE6EF] bg-[#FBFCFE] p-6"><Users size={22} className="text-[#28658D]" aria-hidden="true"/><h4 className="mt-4 text-base font-semibold text-[#173452]">Explore researchers behind the literature</h4><p className="mt-2 text-sm leading-6 text-[#61788E]">Review public scholarly author records and follow their publications. Names and affiliations must be checked against original sources.</p><Link to="/discover" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Explore public discovery <ArrowRight size={15}/></Link></div>}
              {previewTab === 'Projects' && <div className="rounded-xl border border-[#DCE6EF] bg-[#FBFCFE] p-6"><FolderOpen size={22} className="text-[#28658D]" aria-hidden="true"/><h4 className="mt-4 text-base font-semibold text-[#173452]">Turn a research question into a project</h4><p className="mt-2 text-sm leading-6 text-[#61788E]">Save sources, organize research milestones and use EYRA to explore next steps while reviewing the evidence yourself.</p><Link to={PROJECT_SIGNUP_HREF} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Create a workspace <ArrowRight size={15}/></Link></div>}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="border-b border-[#E3EAF1] bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">How EYLO works</p>
          <h2 id="how-title" className="mt-4 font-serif text-4xl text-[#102B49] sm:text-5xl">Question. Evidence. Project.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#587187]">A focused research journey, from asking a question to organizing the findings you can examine and build upon.</p>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {icon: Search, title:'Ask', text:'Start with a research question, topic or methodological challenge.'},
              {icon: BookOpen, title:'Discover', text:'Explore scholarly literature, source records and relevant research context.'},
              {icon: FolderOpen, title:'Build', text:'Organize sources and next steps into a structured research project.'}
            ].map(({icon:Icon,title,text},index)=><li key={title} className="rounded-xl border border-[#DDE7F0] bg-white p-7"><div className="flex items-center justify-between"><Icon size={24} className="text-[#2C719C]" aria-hidden="true"/><span className="text-xs font-semibold text-[#8A9BAC]">0{index+1}</span></div><h3 className="mt-6 text-xl font-semibold text-[#173452]">{title}</h3><p className="mt-3 text-sm leading-7 text-[#61778B]">{text}</p></li>)}
          </ol>
        </div>
      </section>

      <section id="methodology" aria-labelledby="methodology-title" className="border-b border-[#E3EAF1] bg-[#F6F9FC] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">Built for transparent research</p>
              <h2 id="methodology-title" className="mt-4 font-serif text-4xl leading-tight text-[#102B49] sm:text-5xl">Transparency is part of the workflow.</h2>
              <p className="mt-5 text-sm leading-7 text-[#587187]">EYLO helps researchers investigate evidence. It does not independently verify studies or replace scientific judgment.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {icon:BookOpen,title:'Scholarly sources',text:'Discover public records through sources such as OpenAlex, arXiv, Crossref, Semantic Scholar and Europe PMC.'},
                {icon:ShieldCheck,title:'Traceable evidence',text:'Inspect original records and keep source information distinct from AI-generated interpretation.'},
                {icon:CheckCircle2,title:'Research judgment',text:'Review the methods, limitations and conclusions in original studies before relying on a finding.'},
                {icon:FileText,title:'Clear limitations',text:'Coverage and availability vary by provider; AI suggestions can be inaccurate or incomplete.'}
              ].map(({icon:Icon,title,text})=><article key={title} className="rounded-xl border border-[#DEE7F0] bg-white p-6"><Icon className="text-[#2D6B94]" size={23} aria-hidden="true"/><h3 className="mt-4 text-base font-semibold text-[#173452]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#5B7187]">{text}</p></article>)}
            </div>
          </div>
        </div>
      </section>

      <section id="research-workspace" aria-labelledby="workspace-title" className="border-b border-[#E3EAF1] bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">Research workspace</p>
            <h2 id="workspace-title" className="mt-4 max-w-lg font-serif text-4xl leading-tight text-[#102B49] sm:text-5xl">From discovery to structured research work.</h2>
            <p className="mt-5 max-w-lg text-sm leading-8 text-[#587187]">Keep your scholarly evidence connected to the questions, notes and milestones that move your research forward.</p>
            <Link to={PROJECT_SIGNUP_HREF} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#174672] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245D91]">Create a research workspace <ArrowRight size={16}/></Link>
          </div>
          <div className="rounded-2xl border border-[#DCE6EF] bg-[#F8FAFD] p-5 sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67839B]">Workspace overview · illustrative</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {icon:LibraryBig,title:'Library',text:'Save and revisit source records'},
                {icon:Sparkles,title:'EYRA',text:'Explore evidence and uncertainty'},
                {icon:FolderOpen,title:'Projects',text:'Connect sources to research goals'},
                {icon:CalendarCheck,title:'Milestones',text:'Plan concrete next steps'}
              ].map(({icon:Icon,title,text})=><article key={title} className="rounded-lg border border-[#DFE8F0] bg-white p-5"><Icon size={20} className="text-[#2D6B94]" aria-hidden="true"/><h3 className="mt-3 text-sm font-semibold text-[#183C5C]">{title}</h3><p className="mt-2 text-xs leading-5 text-[#65798C]">{text}</p></article>)}
            </div>
          </div>
        </div>
      </section>

      <section id="about-eylo" aria-labelledby="about-title" className="bg-[#F6F9FC] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">About EYLO</p>
          <h2 id="about-title" className="mt-4 font-serif text-4xl text-[#102B49] sm:text-5xl">Research begins with a question. Progress needs evidence.</h2>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#587187]">EYLO is an independently developed research software platform designed to support scientific discovery, source-aware analysis and structured research workflows. Our goal is to help researchers move from questions to evidence to meaningful projects.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/discover" className="inline-flex items-center gap-2 font-semibold text-[#1B5B8A] hover:underline">Explore EYLO <ArrowRight size={16}/></Link>
            <Link to="/contact" className="inline-flex items-center gap-2 font-semibold text-[#1B5B8A] hover:underline">Contact <ArrowRight size={16}/></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img src={`${import.meta.env.BASE_URL}brand/eylo-light.svg`} alt="EYLO" width="160" height="48" loading="lazy" className="h-10 w-auto max-w-[150px] object-contain" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link to="/discover" className="hover:text-slate-900">Discover</Link><a href="#methodology" className="hover:text-slate-900">Methodology</a><a href="#about-eylo" className="hover:text-slate-900">About</a><Link to="/contact" className="hover:text-slate-900">Contact</Link><Link to="/login" className="hover:text-slate-900">Sign in</Link><span>© {new Date().getFullYear()} EYLO</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}
