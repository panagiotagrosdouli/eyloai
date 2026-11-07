import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, BookOpen, CheckCircle2, FolderOpen, Sparkles, CalendarCheck, ShieldCheck, LibraryBig, Users, FileText } from 'lucide-react';
import { trackSearchStarted } from '@/lib/product-analytics';
import { searchOpenAlexWorks } from '@/lib/eyra-api';

const PROJECT_SIGNUP_HREF = `/register?from=${encodeURIComponent('/projects?new=1')}`;

export default function Landing() {
  const [question, setQuestion] = useState('');
  const [previewTab, setPreviewTab] = useState('Connections');
  const [liveRecords, setLiveRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState('');

  useEffect(() => {
    let active = true;
    searchOpenAlexWorks('climate adaptation', 3, 'recent', { throwOnError: true })
      .then(records => {
        if (active) setLiveRecords(records);
      })
      .catch(() => {
        if (active) setRecordsError('Live sample is temporarily unavailable.');
      })
      .finally(() => {
        if (active) setRecordsLoading(false);
      });
    return () => { active = false; };
  }, []);
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
      <section className="relative overflow-hidden border-b border-[#E3EAF1] bg-white px-5 py-12 sm:px-8 sm:py-16 lg:py-20" aria-labelledby="eylo-hero-title">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#DCEBF6] opacity-70 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-80 w-80 rounded-full bg-[#E7F1EC] opacity-60 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#D9E6EF] bg-white/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#276A99]"><span className="h-1.5 w-1.5 rounded-full bg-[#5C9C76]" />Research, connected</p>
            <h1 id="eylo-hero-title" className="mt-6 max-w-xl font-serif text-[clamp(2.8rem,6vw,5rem)] font-normal leading-[1.02] tracking-[-0.055em] text-[#102B49]">Find your people. Move your research forward.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#526A82] sm:text-lg">Connect shared interests to papers, research gaps, PhD supervisors and roles that fit your experience.</p>
            <form role="search" onSubmit={explore} className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-xl border border-[#BFCFDB] bg-white p-2 shadow-[0_12px_32px_-24px_rgba(16,43,73,0.3)] focus-within:ring-2 focus-within:ring-[#347BA8]">
              <Search className="ml-3 shrink-0 text-[#567895]" size={20} aria-hidden="true" />
              <label htmlFor="research-question" className="sr-only">Research question</label>
              <input id="research-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask a research question" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-[#142D49] outline-none placeholder:text-[#788CA0]" />
              <button type="submit" aria-label="Explore research" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#174672] text-white transition hover:bg-[#245D91]"><ArrowRight size={19} /></button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#526B83]">
              {['Climate adaptation', 'Public health', 'Machine learning'].map(topic => (
                <button key={topic} type="button" onClick={() => { trackSearchStarted('homepage_suggestion'); navigate('/discover?q=' + encodeURIComponent(topic)); }} className="min-h-9 rounded-full border border-[#D6E1EB] bg-white/80 px-3 font-medium transition hover:border-[#9DB8CF] hover:bg-[#F2F7FB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c68a0]">{topic}</button>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/discover" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#174672] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245D91]">Explore research <ArrowRight size={16} /></Link>
              <Link to={PROJECT_SIGNUP_HREF} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#B9CADB] bg-white/80 px-5 py-3 text-sm font-semibold text-[#174672] hover:bg-[#F2F7FB]">Build a workspace <ArrowRight size={16} /></Link>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#61778E]">Search public records without signing in.</p>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#DDECF7] via-white to-[#E3F0E8] opacity-80 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-[#D8E4EE] bg-white/95 shadow-[0_32px_90px_-48px_rgba(17,48,78,0.42)] backdrop-blur">
              <div className="flex items-center justify-between border-b border-[#E6EDF3] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF2F8] text-[#1D5986]"><BookOpen size={19} aria-hidden="true" /></span>
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71869A]">Live research preview</p><h2 className="mt-0.5 text-sm font-semibold text-[#173A5D]">Climate adaptation</h2></div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDF7F0] px-2.5 py-1 text-[10px] font-semibold text-[#3D7654]"><span className="h-1.5 w-1.5 rounded-full bg-[#64A678]" />OpenAlex</span>
              </div>
              <div className="space-y-3 p-4 sm:p-5" aria-live="polite">
                {recordsLoading && <div role="status" className="space-y-3"><div className="h-20 animate-pulse rounded-xl bg-[#F1F5F8]" /><div className="h-20 animate-pulse rounded-xl bg-[#F1F5F8]" /><span className="sr-only">Loading live papers</span></div>}
                {recordsError && <p role="status" className="rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#65798D]">{recordsError}</p>}
                {!recordsLoading && !recordsError && liveRecords.map(record => (
                  <article key={record.id} className="rounded-xl border border-[#E4EBF1] bg-[#FBFCFE] p-4 transition hover:border-[#BDD0DE]">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[#173A5D]">{record.title}</h3>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#75889B]">{record.year || '—'}</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-xs text-[#61788E]">{record.authors || 'Authors not listed'}</p>
                    <p className="mt-3 flex items-center gap-2 text-[10px] text-[#74879A]"><span className="rounded bg-[#EAF2F8] px-2 py-1 text-[#356E98]">{record.source}</span><span>{(record.cited_by_count || 0).toLocaleString()} citations</span></p>
                  </article>
                ))}
                {!recordsLoading && !recordsError && liveRecords.length === 0 && <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#65798D]">No records returned for this sample topic.</p>}
              </div>
              <div className="flex items-center justify-between border-t border-[#E6EDF3] px-5 py-3 sm:px-6">
                <p className="text-[10px] text-[#7B8FA1]">{recordsLoading ? 'Retrieving source records…' : liveRecords.length + ' source records · retrieved live'}</p>
                <Link to="/discover?q=climate%20adaptation" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C5B8B] hover:underline">Open in Discover <ArrowRight size={13} /></Link>
              </div>
            </div>
            <div className="relative mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#6D8498]">
              <span>Evidence</span><span aria-hidden="true">→</span><span>People</span><span aria-hidden="true">→</span><span>Opportunity</span><span aria-hidden="true">→</span><span>Project</span>
            </div>
          </div>
        </div>
      </section>

      <section id="research-preview" aria-labelledby="preview-title" className="border-b border-[#DFE7EF] bg-[#F6F9FC] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[0.83fr_1.17fr] lg:gap-14">
          <div className="lg:pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">Your next research move</p>
            <h2 id="preview-title" className="mt-4 max-w-md font-serif text-4xl leading-tight text-[#102B49] sm:text-5xl">One profile. More ways forward.</h2>
            <p className="mt-5 max-w-md text-base leading-8 text-[#536B82]">Find people, ideas and opportunities that connect to your interests.</p>
            <Link to="/discover" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#174672] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245D91]">Explore scholarly research <ArrowRight size={16}/></Link>
            <p className="mt-5 max-w-sm text-xs leading-6 text-[#697D90]">Illustrative preview. People and gap signals are suggestions to investigate; verify research in the original sources.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#D9E4EF] bg-white shadow-[0_20px_70px_-48px_rgba(16,43,73,0.35)]">
            <div className="border-b border-[#E3EAF2] px-6 py-5 sm:px-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6D8498]">EYLO research workspace</p>
              <h3 className="mt-2 text-xl font-semibold text-[#173A5D]">Your research map</h3>
              <div role="tablist" aria-label="Explore EYLO workflows" className="mt-5 flex gap-1 border-b border-[#E4EBF1]">
                {['Connections', 'Research gaps', 'Papers', 'PhD & jobs', 'Calls'].map(tab => <button key={tab} id={'preview-tab-' + tab.toLowerCase()} type="button" role="tab" aria-controls="preview-tab-panel" aria-selected={previewTab === tab} onClick={()=>setPreviewTab(tab)} className={'min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition ' + (previewTab === tab ? 'border-[#205986] text-[#153C62]' : 'border-transparent text-[#647A90] hover:text-[#153C62]')}>{tab}</button>)}
              </div>
            </div>
            <div id="preview-tab-panel" role="tabpanel" aria-labelledby={'preview-tab-' + previewTab.toLowerCase()} className="space-y-4 p-5 sm:p-7">
              {previewTab === 'Connections' && <div className="space-y-3">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#173A5D]">Researchers with shared interests</p><span className="rounded-full bg-[#EDF7F0] px-2.5 py-1 text-[10px] font-medium text-[#3D7654]">3 topic overlaps</span></div>
                {[
                  {initials:'AM',name:'A. Morgan',field:'Climate adaptation · coastal cities',shared:'Shared: resilience planning'},
                  {initials:'JL',name:'J. Lee',field:'Public health · heat exposure',shared:'Shared: community data'},
                  {initials:'SK',name:'S. Khan',field:'Environmental policy · equity',shared:'Shared: local adaptation'}
                ].map(person=><article key={person.initials} className="flex items-center gap-3 rounded-xl border border-[#E2EAF1] bg-[#FBFCFE] p-3.5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E7F0F7] text-xs font-semibold text-[#1D5986]">{person.initials}</div><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold text-[#173452]">{person.name}</h4><p className="truncate text-xs text-[#61788E]">{person.field}</p><p className="mt-1 text-[10px] font-medium text-[#37749B]">{person.shared}</p></div><ArrowRight size={15} className="shrink-0 text-[#7890A4]" aria-hidden="true"/></article>)}
                <Link to="/login?from=%2Fresearchers" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Explore researcher connections <ArrowRight size={15}/></Link>
              </div>}
              {previewTab === 'Research gaps' && <div className="space-y-3">
                <p className="text-xs font-semibold text-[#173A5D]">Questions the literature may leave open</p>
                {[
                  {label:'Understudied populations',detail:'Whose experience is missing?'},
                  {label:'Methods rarely compared',detail:'Which approach works best, and where?'},
                  {label:'Evidence gaps by place',detail:'Do findings hold across regions?'}
                ].map((gap,index)=><article key={gap.label} className="flex items-center gap-3 rounded-xl border border-[#E2EAF1] bg-[#FBFCFE] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EDF4F8] text-xs font-semibold text-[#356E98]">0{index+1}</span><div><h4 className="text-sm font-semibold text-[#173452]">{gap.label}</h4><p className="mt-0.5 text-xs text-[#61788E]">{gap.detail}</p></div></article>)}
                <p className="rounded-lg bg-[#F4F8FB] px-3 py-2 text-[10px] text-[#61788E]">Exploratory signals to verify in the original studies.</p>
                <Link to="/labs/research-landscape" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Map a research landscape <ArrowRight size={15}/></Link>
              </div>}
              {previewTab === 'Papers' && <div className="space-y-3">
                <p className="text-xs font-semibold text-[#173A5D]">Follow a question through its evidence</p>
                {[
                  {label:'Read the work',detail:'Relevant papers with source links'},
                  {label:'See the connections',detail:'Authors, topics and related studies'},
                  {label:'Keep the context',detail:'Save evidence to a research project'}
                ].map((item,index)=><article key={item.label} className="flex items-center gap-3 rounded-xl border border-[#E2EAF1] bg-[#FBFCFE] p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EDF4F8] text-xs font-semibold text-[#356E98]">0{index+1}</span><div><h4 className="text-sm font-semibold text-[#173452]">{item.label}</h4><p className="mt-0.5 text-xs text-[#61788E]">{item.detail}</p></div></article>)}
                <Link to="/discover" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Explore scholarly research <ArrowRight size={15}/></Link>
              </div>}
              {previewTab === 'PhD & jobs' && <div className="space-y-3">
                <div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#173A5D]">Opportunities shaped around your profile</p><FileText size={18} className="text-[#28658D]" aria-hidden="true"/></div>
                <article className="rounded-xl border border-[#E2EAF1] bg-[#FBFCFE] p-4"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-[#173452]">PhD supervisors & research labs</h4><span className="rounded-full bg-[#EAF2F8] px-2 py-1 text-[10px] text-[#356E98]">Interest match</span></div><p className="mt-1 text-xs text-[#61788E]">Find researchers working on the questions you care about.</p></article>
                <article className="rounded-xl border border-[#E2EAF1] bg-[#FBFCFE] p-4"><div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-[#173452]">Research roles & fellowships</h4><span className="rounded-full bg-[#EDF7F0] px-2 py-1 text-[10px] text-[#3D7654]">CV match</span></div><p className="mt-1 text-xs text-[#61788E]">Surface roles connected to your skills and experience.</p></article>
                <p className="text-[10px] text-[#71869A]">Add your CV privately; review every suggested match.</p>
                <Link to="/labs/professional-path" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Explore your next step <ArrowRight size={15}/></Link>
              </div>}
              {previewTab === 'Calls' && <div className="space-y-3">
                <p className="text-xs font-semibold text-[#173A5D]">Calls that can move your idea forward</p>
                {[
                  {type:'RESEARCH CALL',title:'Collaborative research funding',detail:'Eligibility · scope · deadline'},
                  {type:'FELLOWSHIP',title:'Early-career researcher support',detail:'Fit your project to the call'},
                  {type:'OPEN CALL',title:'Research challenges & partnerships',detail:'Find collaborators and next steps'}
                ].map(item=><article key={item.title} className="rounded-xl border border-[#E2EAF1] bg-[#FBFCFE] p-4"><p className="text-[9px] font-semibold tracking-[0.14em] text-[#477B9D]">{item.type}</p><h4 className="mt-1 text-sm font-semibold text-[#173452]">{item.title}</h4><p className="mt-1 text-xs text-[#61788E]">{item.detail}</p></article>)}
                <Link to="/login?from=%2Fopportunities" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#1C5B8B] hover:underline">Explore calls & funding <ArrowRight size={15}/></Link>
              </div>}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-title" className="border-b border-[#E3EAF1] bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#37749B]">How EYLO works</p>
          <h2 id="how-title" className="mt-4 font-serif text-4xl text-[#102B49] sm:text-5xl">Question. Evidence. People. Progress.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#587187]">One path from your research question to the people and opportunities that can move it forward.</p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              {icon: Search, title:'Explore', text:'Start with an interest, question or CV.'},
              {icon: BookOpen, title:'Spot gaps', text:'See what is known and what may be missing.'},
              {icon: Users, title:'Connect', text:'Meet researchers with overlapping interests.'},
              {icon: FileText, title:'Find your fit', text:'Explore PhDs, supervisors and research roles.'},
              {icon: Sparkles, title:'Take the next step', text:'Find calls, funding and collaborators.'}
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
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-[#587187]">EYLO connects your interests to research, people and opportunities — so the next step is easier to find.</p>
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
