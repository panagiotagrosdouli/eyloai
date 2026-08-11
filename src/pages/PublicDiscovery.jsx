import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Building2, ExternalLink, Loader2,
  RefreshCw, Search, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import { searchAllPapersWithStatus, searchOpenAlexAuthors, searchOpenAlexInstitutions } from '@/lib/eyra-api';
import GuidedSearch, { normalizeDiscoveryRequest } from '@/components/discovery/GuidedSearch';

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function PaperCard({ paper }) {
  return (
    <article className="group rounded-3xl border border-border bg-card/80 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_22px_60px_-40px_hsl(var(--primary))] sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{paper.source_index || paper.source}</span>
        <span className="text-[10px] text-muted-foreground">{paper.year || 'Year unavailable'}</span>
        {paper.open_access && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-400">Open access</span>}
      </div>
      <h3 className="font-heading text-base font-semibold leading-6 text-foreground sm:text-lg">{paper.title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'}</p>
      {paper.summary && <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{paper.summary}</p>}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground">{(paper.cited_by_count || 0).toLocaleString()} citations · context, not a quality score</span>
        <a href={paper.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-primary">Open record <ExternalLink size={12} /></a>
      </div>
    </article>
  );
}

function PaperGroup({ title, eyebrow, description, papers }) {
  if (!papers.length) return null;
  return (
    <section>
      <div className="mb-5 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 font-heading text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{papers.map(paper => <PaperCard key={paper._dedupeKey || paper.id || paper.title} paper={paper} />)}</div>
    </section>
  );
}

export default function PublicDiscovery() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') || '';
  const level = params.get('level') || '';
  const goal = params.get('goal') || '';
  const recency = params.get('recency') || '';
  const refined = Boolean(initialQuery && level && goal && recency);
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState({ papers: [], researchers: [], institutions: [] });
  const [loading, setLoading] = useState(refined);
  const [error, setError] = useState('');
  const [sourceStatus, setSourceStatus] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    if (!refined) return;
    let active = true;
    const profile = normalizeDiscoveryRequest({ topic: initialQuery, level, goal, recency });

    const retrieve = async () => {
      setLoading(true);
      setError('');
      setSourceStatus([]);
      setData({ papers: [], researchers: [], institutions: [] });

      const [paperResult, researcherResult, institutionResult] = await Promise.allSettled([
        searchAllPapersWithStatus(initialQuery, { ...profile, limit: 24 }),
        searchOpenAlexAuthors(initialQuery, 8, { throwOnError: true }),
        searchOpenAlexInstitutions(initialQuery, 6, { throwOnError: true }),
      ]);
      if (!active) return;

      const paperBundle = paperResult.status === 'fulfilled'
        ? paperResult.value
        : { papers: [], source_status: [
            { id: 'paper_indexes', label: 'Scholarly paper indexes', status: 'unavailable', count: 0 },
          ] };
      const researchers = researcherResult.status === 'fulfilled' ? researcherResult.value : [];
      const institutions = institutionResult.status === 'fulfilled' ? institutionResult.value : [];
      const nextSourceStatus = [
        ...(paperBundle.source_status || []),
        {
          id: 'researchers',
          label: 'OpenAlex researchers',
          status: researcherResult.status === 'fulfilled' ? 'available' : 'unavailable',
          count: researchers.length,
        },
        {
          id: 'institutions',
          label: 'OpenAlex institutions',
          status: institutionResult.status === 'fulfilled' ? 'available' : 'unavailable',
          count: institutions.length,
        },
      ];
      const nextData = { papers: paperBundle.papers || [], researchers, institutions };
      const totalRecords = nextData.papers.length + researchers.length + institutions.length;
      const availableCount = nextSourceStatus.filter(source => source.status === 'available').length;

      setSourceStatus(nextSourceStatus);
      setData(nextData);
      if (!totalRecords) {
        setError(availableCount
          ? 'No strong live records matched this exact framing. Add a method, application, population or date range.'
          : 'The live research indexes are temporarily unavailable. No records have been invented.');
      }
      setLoading(false);
    };

    retrieve().catch(() => {
      if (!active) return;
      setError('The live research indexes could not be reached. No records have been invented.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [attempt, goal, initialQuery, level, recency, refined]);

  const submitHeader = event => {
    event.preventDefault();
    const value = query.trim();
    if (value) setParams({ q: value });
  };

  const runGuidedSearch = request => {
    const profile = normalizeDiscoveryRequest(request);
    setParams({
      q: profile.topic,
      level: profile.level,
      goal: profile.goal,
      recency: profile.recency,
    });
  };

  const groups = useMemo(() => {
    const papers = data.papers || [];
    const start = papers.filter(paper => paper.discovery_category === 'start_here').slice(0, 3);
    const latest = papers.filter(paper => paper.discovery_category === 'latest' && !start.includes(paper)).slice(0, 8);
    const foundational = papers.filter(paper => paper.discovery_category === 'foundational' && !start.includes(paper)).slice(0, 6);
    const used = new Set([...start, ...latest, ...foundational].map(paper => paper._dedupeKey || paper.id));
    const relevant = papers.filter(paper => !used.has(paper._dedupeKey || paper.id)).slice(0, 6);
    return { start, latest, foundational, relevant };
  }, [data.papers]);

  const sourceIndexes = [...new Set((data.papers || []).map(paper => paper.source_index || paper.source).filter(Boolean))];
  const unavailableSources = sourceStatus.filter(source => source.status === 'unavailable');
  const availableSources = sourceStatus.filter(source => source.status === 'available');

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold" aria-label="Back to EYLO"><ArrowLeft size={15} /><img src="/brand/eylo-logo.svg" alt="EYLO" className="h-10 w-14 rounded-xl border border-white/10 bg-white/[0.03] object-contain p-1" /></Link>
          <form onSubmit={submitHeader} className="ml-auto flex w-full max-w-2xl items-center rounded-2xl border border-border bg-card p-1.5">
            <Search className="ml-3 text-muted-foreground" size={15} />
            <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Research topic" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" placeholder="Search a research topic…" />
            <button type="submit" className="rounded-xl eyra-gradient px-4 py-2 text-xs font-semibold text-white">Refine</button>
          </form>
          <Link to="/register" className="hidden rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background sm:block">Save research</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        {!initialQuery && (
          <section className="mx-auto max-w-5xl py-12 text-center sm:py-20">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl eyra-gradient text-white"><Sparkles size={22} /></div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Guided evidence discovery</p>
            <h1 className="mt-3 font-heading text-4xl font-black tracking-tight sm:text-6xl">One topic. A research path built for you.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">Tell EYLO your level and goal. The discovery flow retrieves, deduplicates and organizes papers instead of dropping an unexplained list on you.</p>
            <div className="mx-auto mt-8 max-w-5xl text-left"><GuidedSearch onSearch={runGuidedSearch} /></div>
          </section>
        )}

        {initialQuery && !refined && (
          <section className="mx-auto max-w-5xl py-8 sm:py-14">
            <div className="mb-7 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Before the search</p>
              <h1 className="mt-2 font-heading text-3xl font-black sm:text-5xl">Make “{initialQuery}” useful for you.</h1>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">The same topic needs a different result set for a beginner, a thesis student, and a faculty researcher.</p>
            </div>
            <GuidedSearch initialTopic={initialQuery} initialRefine onSearch={runGuidedSearch} />
          </section>
        )}

        {loading && (
          <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
            <div className="relative mb-6 grid h-20 w-20 place-items-center rounded-3xl eyra-gradient text-white shadow-2xl shadow-primary/20"><Loader2 className="animate-spin" size={28} /></div>
            <p className="font-semibold">Searching and organizing scholarly indexes…</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Records from OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar are being retrieved, deduplicated and organized for your level.</p>
          </div>
        )}

        {!loading && refined && unavailableSources.length > 0 && availableSources.length > 0 && (
          <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <p className="leading-6">
                <strong>Partial live retrieval.</strong> Showing verified records from {availableSources.length} available sources.
                {' '}{unavailableSources.map(source => source.label).join(', ')} did not respond.
              </p>
            </div>
            <button type="button" onClick={() => setAttempt(value => value + 1)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10">
              <RefreshCw size={13} aria-hidden="true" /> Retry missing sources
            </button>
          </div>
        )}

        {!loading && error && (
          <EmptyState>
            <AlertTriangle className="mx-auto mb-3 text-amber-400" size={22} aria-hidden="true" />
            <p className="mx-auto max-w-xl leading-6">{error}</p>
            <button type="button" onClick={() => setAttempt(value => value + 1)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:border-primary/40">
              <RefreshCw size={13} aria-hidden="true" /> Retry live retrieval
            </button>
          </EmptyState>
        )}

        {!loading && !error && refined && (
          <div className="space-y-14">
            <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/10 bg-slate-950/70 p-6 sm:p-9">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  <ShieldCheck size={12} /> Guided discovery report
                </div>
                <h1 className="mt-3 font-heading text-3xl font-black sm:text-5xl">A path through “{initialQuery}”</h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                  Tuned for <strong className="text-slate-200">{level}</strong> level · goal <strong className="text-slate-200">{goal}</strong> · <strong className="text-slate-200">{recency.replace('_', ' ')}</strong> evidence.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">{sourceIndexes.map(source => <span key={source} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] text-slate-300">{source}</span>)}</div>
                <p className="mt-4 text-[10px] text-slate-500">{data.papers.length} deduplicated papers · {data.researchers.length} researchers · {data.institutions.length} institutions</p>
              </div>
            </section>

            <PaperGroup eyebrow="Your entry point" title="Start here" description="Three papers selected as an intelligible entry path for your level. Survey and overview records are preferred when available." papers={groups.start} />
            <PaperGroup eyebrow="Frontier scan" title="What is new now" description="Recent records are kept separate so you can see current directions without losing the field's foundations." papers={groups.latest} />
            <PaperGroup eyebrow="Context that matters" title="Foundational & survey work" description="Highly cited or broad synthesis papers for terminology, historical context, and established methods." papers={groups.foundational} />
            <PaperGroup eyebrow="Broaden the map" title="More relevant evidence" description="Additional deduplicated records from across the connected scholarly indexes." papers={groups.relevant} />

            <section>
              <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">People behind the evidence</p><h2 className="mt-1 font-heading text-2xl font-bold">Researchers</h2><p className="mt-2 text-sm text-muted-foreground">Profiles indicate publication activity, not availability or endorsement.</p></div>
              {data.researchers.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.researchers.map(researcher => (
                <article key={researcher.id} className="rounded-3xl border border-border bg-card p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users size={18} /></div>
                  <h3 className="font-heading font-semibold">{researcher.name}</h3><p className="mt-1 text-xs text-muted-foreground">{researcher.institution}</p>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">{researcher.works_count} works · {researcher.citation_count} citations</p>
                  <a href={researcher.profile_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">OpenAlex profile <ArrowRight size={11} /></a>
                </article>
              ))}</div> : <EmptyState>No researcher profiles found for this phrase.</EmptyState>}
            </section>

            <section>
              <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Research ecosystem</p><h2 className="mt-1 font-heading text-2xl font-bold">Institutions</h2></div>
              {data.institutions.length ? <div className="grid gap-4 md:grid-cols-3">{data.institutions.map(institution => (
                <a key={institution.id} href={institution.url} target="_blank" rel="noopener noreferrer" className="rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <Building2 className="mb-4 text-primary" size={20} /><h3 className="font-heading font-semibold">{institution.name}</h3><p className="mt-2 text-xs text-muted-foreground">{institution.country || 'International'} · {institution.works_count} works</p>
                </a>
              ))}</div> : <EmptyState>No institutions found for this phrase.</EmptyState>}
            </section>

            <section className="rounded-[2rem] eyra-gradient p-8 text-white sm:p-12">
              <div className="max-w-2xl"><BookOpen className="mb-5" size={26} /><h2 className="font-heading text-3xl font-bold">Keep the path, not just the links.</h2><p className="mt-3 text-sm leading-6 text-white/80">Create an EYLO workspace to save evidence, compare researchers, build milestones, and ask EYRA follow-up questions with the same context.</p><Link to={`/register?idea=${encodeURIComponent(initialQuery)}`} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Create free project <ArrowRight size={14} /></Link></div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
