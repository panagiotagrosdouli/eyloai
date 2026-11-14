import ThemeToggle from '@/components/marketing/ThemeToggle';
import '@/pages/landing.css';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Building2, ExternalLink, Loader2,
  RefreshCw, Search, ShieldCheck, Users, Download, Bookmark, BookmarkCheck, Clock3, GraduationCap, Trash2,
} from 'lucide-react';
import { searchAllPapersWithStatus, searchOpenAlexAuthors, searchResearchPeopleByPublications, searchOpenAlexInstitutions } from '@/lib/eyra-api';
import { buildResearchWorkspaceSignupHref } from '@/lib/discovery/workspaceSignup';
import { countAvailablePaperIndexes, formatUnavailableSource, PAPER_INDEX_SOURCE_IDS } from '@/lib/discovery-source-status';
import { publicationTypeLabel } from '@/lib/publication-type-label';
import GuidedSearch, { normalizeDiscoveryRequest } from '@/components/discovery/GuidedSearch';
import BrandLogo from '@/components/brand/BrandLogo';
import VoiceSearchButton from '@/components/discovery/VoiceSearchButton';
import { toBibTeX, toRIS } from '@/utils/citation-export';

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

const SAVED_KEY = 'eylo-public-saved-papers-v1';
const HISTORY_KEY = 'eylo-public-search-history-v1';

function readBrowserList(key) {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.slice(0, 100) : [];
  } catch { return []; }
}

function writeBrowserList(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Browser storage may be unavailable. */ }
}

function PaperCard({ paper, saved = false, onToggleSave }) {
  return (
    <article className="group rounded-xl border border-[var(--company-border)] bg-card p-5 transition-colors hover:border-[var(--company-border)] hover:shadow-[0_18px_45px_-34px_rgba(16,43,73,0.35)] sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{paper.source_index || paper.source}</span>
        <span className="text-[10px] text-muted-foreground">{paper.year || 'Year unavailable'}</span>
        <span className="text-[10px] text-muted-foreground">{publicationTypeLabel(paper.type)}</span>
        {paper.open_access && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-400">Open access</span>}
      </div>
      <h3 className="font-serif text-lg font-normal leading-7 text-foreground sm:text-xl">{paper.title}</h3>
      <p className="mt-2 text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'}</p>
      {paper.summary && <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{paper.summary}</p>}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[10px] text-muted-foreground">{(paper.cited_by_count || 0).toLocaleString()} citations · context, not a quality score</span>
        <div className="flex items-center gap-3">
          {onToggleSave && <button type="button" onClick={() => onToggleSave(paper)} aria-label={saved ? 'Remove saved paper' : 'Save paper'} aria-pressed={saved} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--company-border)] px-2.5 py-2 text-xs font-semibold text-[var(--company-muted)] hover:bg-[var(--company-soft)]">{saved ? <BookmarkCheck size={15}/> : <Bookmark size={15}/>} {saved ? 'Saved' : 'Save'}</button>}
          {paper.url && <a href={paper.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-primary">Open record <ExternalLink size={12} /></a>}
        </div>
      </div>
    </article>
  );
}

function PaperGroup({ title, eyebrow, description, papers, savedIds, onToggleSave }) {
  if (!papers.length) return null;
  return (
    <section>
      <div className="mb-5 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 font-heading text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">{papers.map(paper => <PaperCard key={paper._dedupeKey || paper.id || paper.title} paper={paper} saved={savedIds?.has(paper.url || paper.id || paper.title)} onToggleSave={onToggleSave} />)}</div>
    </section>
  );
}

export default function PublicDiscovery() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') || '';
  const level = params.get('level') || 'researcher';
  const goal = params.get('goal') || 'review';
  const recency = params.get('recency') || 'balanced';
  const refined = Boolean(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState({ papers: [], researchers: [], institutions: [] });
  const [loading, setLoading] = useState(refined);
  const [error, setError] = useState('');
  const [sourceStatus, setSourceStatus] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const [activePanel, setActivePanel] = useState('discover');
  const [savedPapers, setSavedPapers] = useState(() => readBrowserList(SAVED_KEY));
  const [searchHistory, setSearchHistory] = useState(() => readBrowserList(HISTORY_KEY));
  const savedIds = useMemo(() => new Set(savedPapers.map(paper => paper.url || paper.id || paper.title)), [savedPapers]);

  const toggleSavedPaper = paper => {
    const identity = paper.url || paper.id || paper.title;
    if (!identity) return;
    setSavedPapers(previous => {
      const exists = previous.some(item => (item.url || item.id || item.title) === identity);
      const next = exists ? previous.filter(item => (item.url || item.id || item.title) !== identity) : [{ id: paper.id, url: paper.url, title: paper.title, authors: paper.authors, year: paper.year, source: paper.source, source_index: paper.source_index, type: paper.type, summary: paper.summary, cited_by_count: paper.cited_by_count, open_access: paper.open_access }, ...previous].slice(0, 100);
      writeBrowserList(SAVED_KEY, next);
      return next;
    });
  };

  const navigatePanel = panel => {
    setActivePanel(panel);
    if (panel !== 'saved' && panel !== 'history') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    const queryValue = initialQuery.trim();
    if (!queryValue) return;
    setSearchHistory(previous => {
      const next = [{ query: queryValue, date: new Date().toISOString() }, ...previous.filter(item => item.query.toLowerCase() !== queryValue.toLowerCase())].slice(0, 25);
      writeBrowserList(HISTORY_KEY, next);
      return next;
    });
  }, [initialQuery]);

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
        Promise.allSettled([
          searchOpenAlexAuthors(initialQuery, 8, { throwOnError: true }),
          searchResearchPeopleByPublications(initialQuery, 12),
        ]).then(outcomes => {
          if (outcomes.every(outcome => outcome.status === 'rejected')) throw new Error('Researcher sources unavailable');
          const direct = outcomes[0].status === 'fulfilled' ? outcomes[0].value : [];
          const fromPapers = outcomes[1].status === 'fulfilled' ? outcomes[1].value : [];
          return [...direct, ...fromPapers.filter(person => !direct.some(author => author.id === person.id))].slice(0, 12);
        }),
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
      const availablePaperIndexCount = countAvailablePaperIndexes(nextSourceStatus);

      setSourceStatus(nextSourceStatus);
      setData(nextData);
      if (!totalRecords) {
        const paperStatuses = nextSourceStatus.filter(source => PAPER_INDEX_SOURCE_IDS.includes(source.id));
        if (paperStatuses.length === PAPER_INDEX_SOURCE_IDS.length && paperStatuses.every(source => 'error_code' in source && source.error_code === 'DISCOVERY_RATE_LIMIT_UNAVAILABLE')) {
          setError('EYLO’s research connection is temporarily unavailable. Please try again later. This does not establish that the scholarly sources themselves are unavailable.');
        } else if (paperStatuses.length === PAPER_INDEX_SOURCE_IDS.length && paperStatuses.every(source => 'error_code' in source && source.error_code === 'DISCOVERY_RATE_LIMITED')) {
          setError('EYLO’s search request limit has been reached. Please wait before retrying.');
        } else if (availablePaperIndexCount === PAPER_INDEX_SOURCE_IDS.length) {
          setError('No strong live records matched this exact framing. Add a method, application, population or date range.');
        } else if (availablePaperIndexCount > 0) {
          setError(`No records came back from the ${availablePaperIndexCount} of ${PAPER_INDEX_SOURCE_IDS.length} paper indexes that responded. Other indexes were unavailable, so this does not establish that no literature exists.`);
        } else {
          setError('The scholarly paper indexes are temporarily unavailable. No records have been invented.');
        }
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
    if (value) {
      setActivePanel('discover');
      setParams({ q: value, level, goal, recency });
    }
  };

  const runGuidedSearch = request => {
    setActivePanel('discover');
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

  const exportCitations = format => {
    const papers = data.papers || [];
    if (!papers.length) return;
    const content = format === 'bib' ? toBibTeX(papers) : toRIS(papers);
    const blob = new Blob([content], { type: format === 'bib' ? 'application/x-bibtex;charset=utf-8' : 'application/x-research-info-systems;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eylo-references.' + format;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const sourceIndexes = [...new Set((data.papers || []).map(paper => paper.source_index || paper.source).filter(Boolean))];
  const unavailableSources = sourceStatus.filter(source => source.status === 'unavailable');
  const availableSources = sourceStatus.filter(source => source.status === 'available');
  const availablePaperIndexCount = countAvailablePaperIndexes(sourceStatus);

  return (
    <main className="eylo-company eylo-public-discovery min-h-screen bg-[var(--company-surface)] text-[var(--company-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--company-border)] bg-[var(--company-surface)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-8 sm:py-0">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold" aria-label="Back to EYLO"><ArrowLeft size={15} /><BrandLogo brand="eylo" size="nav" priority /></Link>
          <form onSubmit={submitHeader} className="order-last ml-auto flex min-w-0 w-full max-w-2xl sm:order-none items-center rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] p-1.5 shadow-sm">
            <Search className="ml-3 text-muted-foreground" size={15} />
            <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Research topic" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" placeholder="Ask anything: topic, question or researcher…" />
            <VoiceSearchButton onTranscript={text => setQuery(text)} />
            <button type="submit" className="rounded-lg company-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--company-soft)]">Refine</button>
          </form>
          <Link to={buildResearchWorkspaceSignupHref(initialQuery)} className="hidden rounded-xl bg-[var(--company-soft)] px-4 py-2 text-sm font-semibold text-[var(--company-muted)] sm:block">Save research</Link>
          <div className="ml-auto sm:ml-0"><ThemeToggle /></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside aria-label="EYLO research navigation" className="hidden border-r border-[var(--company-border)] bg-[var(--company-soft)] px-5 py-8 lg:block">
          <div className="sticky top-[110px]">
            <div className="mb-7 px-3"><BrandLogo brand="eylo" size="nav" /></div>
            <nav className="space-y-1 text-[13px] text-[var(--company-muted)]">
              <button type="button" onClick={() => navigatePanel('discover')} aria-current={activePanel === 'discover' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activePanel === 'discover' ? 'bg-[var(--company-soft)] font-semibold text-[var(--company-muted)]' : 'hover:bg-[var(--company-soft)]'}`}><Search size={17}/> Discover</button>
              <button type="button" onClick={() => navigatePanel('papers')} aria-current={activePanel === 'papers' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activePanel === 'papers' ? 'bg-[var(--company-soft)] font-semibold text-[var(--company-muted)]' : 'hover:bg-[var(--company-soft)]'}`}><BookOpen size={17}/> Papers</button>
              <Link to="/find-researchers" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--company-soft)]"><Users size={17}/> Researchers</Link>
              <Link to="/careers" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[var(--company-soft)]"><GraduationCap size={17}/> Careers</Link>
            </nav>
            <div className="mt-7 border-t border-[var(--company-border)] pt-5 text-[13px] text-[var(--company-muted)]">
              <button type="button" onClick={() => navigatePanel('saved')} aria-current={activePanel === 'saved' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activePanel === 'saved' ? 'bg-[var(--company-soft)] font-semibold text-[var(--company-muted)]' : 'hover:bg-[var(--company-soft)]'}`}><Bookmark size={17}/> Saved <span className="ml-auto text-[11px]">{savedPapers.length || ''}</span></button>
              <button type="button" onClick={() => navigatePanel('history')} aria-current={activePanel === 'history' ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${activePanel === 'history' ? 'bg-[var(--company-soft)] font-semibold text-[var(--company-muted)]' : 'hover:bg-[var(--company-soft)]'}`}><Clock3 size={17}/> History</button>
            </div>
          </div>
        </aside>
        <div id="papers" className="min-w-0 px-4 py-10 sm:px-8 lg:px-10">
        <div className="mb-5 flex flex-wrap gap-2 text-xs lg:hidden" aria-label="Research sections">
          {['discover', 'papers', 'saved', 'history'].map(panel => <button key={panel} type="button" onClick={() => navigatePanel(panel)} aria-pressed={activePanel === panel} className={`rounded-full border px-4 py-2.5 capitalize ${activePanel === panel ? 'border-[var(--company-border)] bg-[var(--company-soft)] font-semibold text-[var(--company-muted)]' : 'border-[var(--company-border)] bg-[var(--company-surface)] text-[var(--company-muted)]'}`}>{panel}</button>)}
          <Link to="/find-researchers" className="rounded-full border border-[var(--company-border)] px-4 py-2.5">Researchers</Link>
          <Link to="/careers" className="rounded-full border border-[var(--company-border)] px-4 py-2.5">Careers</Link>
        </div>
        {activePanel === 'saved' && <section aria-label="Saved papers" className="mx-auto max-w-5xl pb-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--company-muted)]">Your browser library</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Saved papers</h1><p className="mt-2 text-sm text-[var(--company-muted)]">Saved only on this device and browser. Sign in to access your research workspace.</p></div>{savedPapers.length > 0 && <button type="button" onClick={() => { setSavedPapers([]); writeBrowserList(SAVED_KEY, []); }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--company-border)] px-3 py-2 text-xs font-medium"><Trash2 size={14}/> Clear saved</button>}</div>
          {savedPapers.length ? <div className="grid gap-4 lg:grid-cols-2">{savedPapers.map(paper => <PaperCard key={paper.url || paper.id || paper.title} paper={paper} saved onToggleSave={toggleSavedPaper}/>)}</div> : <EmptyState>Save a paper from your research results to see it here.</EmptyState>}
        </section>}
        {activePanel === 'history' && <section aria-label="Search history" className="mx-auto max-w-5xl pb-12">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--company-muted)]">Your browser history</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Recent searches</h1><p className="mt-2 text-sm text-[var(--company-muted)]">Stored in this browser only. You can clear these searches any time.</p></div>{searchHistory.length > 0 && <button type="button" onClick={() => { setSearchHistory([]); writeBrowserList(HISTORY_KEY, []); }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--company-border)] px-3 py-2 text-xs font-medium"><Trash2 size={14}/> Clear history</button>}</div>
          {searchHistory.length ? <div className="divide-y divide-[#E5EBF0] rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)]">{searchHistory.map(item => <button type="button" key={item.query} onClick={() => { setActivePanel('discover'); setParams({ q: item.query, level, goal, recency }); }} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[var(--company-soft)]"><Clock3 className="shrink-0 text-[var(--company-muted)]" size={17}/><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--company-muted)]">{item.query}</span><ArrowRight size={16} className="text-[var(--company-muted)]"/></button>)}</div> : <EmptyState>Search a topic to build your history on this device.</EmptyState>}
        </section>}
        {(activePanel === 'discover' || activePanel === 'papers') && <div>
        {!initialQuery && (
          <section className="mx-auto max-w-5xl py-8 text-center sm:py-12">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Evidence discovery</p>
            <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-bold leading-tight tracking-[-.055em] text-[var(--company-muted)] sm:text-6xl">Explore science with confidence.</h1>
            <div className="mx-auto mt-8 max-w-5xl text-left"><GuidedSearch onSearch={runGuidedSearch} /></div>
            <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2" aria-label="Example research searches">
              <span className="text-xs text-muted-foreground">Try an example:</span>
              {[
                'Climate change adaptation',
                'Public health interventions',
                'Machine learning interpretability',
              ].map(example => (
                <button key={example} type="button" onClick={() => setParams({ q: example })}
                  className="rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5">
                  {example}
                </button>
              ))}
            </div>
            <div className="mx-auto mt-6 flex justify-center"><Link to="/find-researchers" className="inline-flex items-center gap-2 rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] px-5 py-3 text-sm font-semibold text-[var(--company-muted)]">Find researchers & professors <ArrowRight size={15}/></Link></div>
            <p className="mx-auto mt-4 max-w-xl text-xs text-muted-foreground">
              Search any academic subject by typing or speaking. Results depend on verified scholarly indexes; refine filters whenever needed.
            </p>
          </section>
        )}

        {initialQuery && !refined && (
          <section className="mx-auto max-w-5xl py-8 sm:py-14">
            <div className="mb-7 max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{initialQuery}</p>
              <h1 className="mt-2 font-serif text-3xl font-normal tracking-tight sm:text-5xl">Refine your research question.</h1>
            </div>
            <GuidedSearch initialTopic={initialQuery} initialRefine onSearch={runGuidedSearch} />
          </section>
        )}

        {loading && (
          <div className="flex min-h-[480px] flex-col items-center justify-center text-center">
            <div className="relative mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/20"><Loader2 className="animate-spin" size={28} /></div>
            <p className="font-semibold">Searching and organizing scholarly indexes…</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Records from OpenAlex, arXiv, Europe PMC, Crossref and Semantic Scholar are being retrieved, deduplicated and organized for your level.</p>
          </div>
        )}

        {!loading && refined && unavailableSources.length > 0 && availableSources.length > 0 && (
          <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
              <p className="leading-6">
                <strong>Partial live retrieval.</strong> {availablePaperIndexCount} of {PAPER_INDEX_SOURCE_IDS.length} scholarly paper indexes are available.
                {' '}{unavailableSources.map(formatUnavailableSource).join('; ')}.
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
            <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--company-border)] bg-[var(--company-soft)] p-6 sm:p-9">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--company-soft)]/50 blur-3xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--company-muted)]"><ShieldCheck size={12} /> Source-linked discovery results</div>
                <h1 className="mt-3 text-3xl font-bold tracking-[-.055em] sm:text-5xl">{initialQuery}</h1>
                <p className="mt-4 text-xs text-[var(--company-muted)]">{level} · {goal} · {recency.replace('_', ' ')}</p>
                <div className="mt-5 flex flex-wrap gap-2">{sourceIndexes.map(source => <span key={source} className="rounded-full border border-[var(--company-border)] bg-[var(--company-surface)] px-3 py-1.5 text-[10px] text-[var(--company-muted)]">{source}</span>)}</div>
                <p className="mt-4 text-[10px] text-[var(--company-muted)]">{data.papers.length} deduplicated papers · {data.researchers.length} researchers · {data.institutions.length} institutions</p>
                <p className="mt-3 max-w-3xl text-xs leading-5 text-slate-400">Bibliographic records come from external indexes. EYLO does not independently verify peer review, claims, findings, or publication quality. Open the original source before relying on a result.</p>
                {data.papers.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => exportCitations('bib')} className="inline-flex items-center gap-2 rounded-xl border border-[var(--company-border)] bg-[var(--company-surface)] px-3 py-2 text-xs font-semibold text-[var(--company-muted)] hover:bg-[var(--company-soft)]"><Download size={14} /> Export BibTeX</button>
                    <button type="button" onClick={() => exportCitations('ris')} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[var(--company-surface)]/10 px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--company-surface)]/20"><Download size={14} /> Export RIS</button>
                    <span className="text-[11px] text-slate-400">Metadata only. Check author names, publication details and DOI against the source before citing.</span>
                  </div>
                )}
              </div>
            </section>

            <PaperGroup savedIds={savedIds} onToggleSave={toggleSavedPaper} eyebrow="Your entry point" title="Start here" description="Selected as an intelligible entry path for your level; survey and overview records are preferred when available." papers={groups.start} />
            <PaperGroup savedIds={savedIds} onToggleSave={toggleSavedPaper} eyebrow="Frontier scan" title="What is new now" description="Recent records are kept separate so you can see current directions without losing the field's foundations." papers={groups.latest} />
            <PaperGroup savedIds={savedIds} onToggleSave={toggleSavedPaper} eyebrow="Context that matters" title="Foundational & survey work" description="Highly cited or broad synthesis papers for terminology, historical context, and established methods." papers={groups.foundational} />
            <PaperGroup savedIds={savedIds} onToggleSave={toggleSavedPaper} eyebrow="Broaden the map" title="More relevant evidence" description="Additional deduplicated records from across the connected scholarly indexes." papers={groups.relevant} />

            <section>
              <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">People behind the evidence</p><h2 className="mt-1 font-heading text-2xl font-bold">Researchers</h2><p className="mt-2 text-sm text-muted-foreground">Profiles come from author and topic-matched publication records; this is not an exhaustive directory or a guarantee of expertise, availability or endorsement.</p><Link to={`/find-researchers?q=${encodeURIComponent(initialQuery)}`} className="mt-3 inline-flex text-sm font-semibold text-primary">Explore more researchers <ArrowRight size={13} className="ml-1 mt-1" /></Link></div>
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

            <section className="rounded-[2rem] company-primary p-8 text-white sm:p-12">
              <div className="max-w-2xl"><BookOpen className="mb-5" size={26} /><h2 className="font-heading text-3xl font-bold">Keep the path, not just the links.</h2><p className="mt-3 text-sm leading-6 text-white/80">Create an EYLO workspace to save evidence, compare researchers, build milestones, and ask EYRA follow-up questions with the same context.</p><Link to={buildResearchWorkspaceSignupHref(initialQuery)} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[var(--company-surface)] px-5 py-3 text-sm font-semibold text-slate-950">Create free project <ArrowRight size={14} /></Link></div>
            </section>
          </div>
        )}
        </div>}
        </div>
      </div>
    </main>
  );
}
