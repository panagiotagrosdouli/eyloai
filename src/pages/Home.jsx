import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { runEyraDiscovery } from '@/lib/eyra-engine';
import { useToast } from '@/components/ui/use-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchHeroCompact } from '@/components/discovery/SearchHero';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import DiscoveryResults from '@/components/discovery/DiscoveryResults';
import LoadingState from '@/components/discovery/LoadingState';
import EyraHome from '@/components/dashboard/EyraHome';
import PersonalizedDashboard from '@/components/dashboard/PersonalizedDashboard';

const HOME_PATHS = [
  { id: 'academic', label: 'Research & teaching', intro: 'Build a source-backed research foundation.', examples: [
    { label: 'Find publications', to: '/search', desc: 'Start with a research question' },
    { label: 'Find researchers', to: '/academics', desc: 'Explore authors and institutions' },
    { label: 'My research library', to: '/library', desc: 'Return to saved evidence' },
  ] },
  { id: 'professional', label: 'Professional decision', intro: 'Check the evidence behind a work-related question.', examples: [
    { label: 'Check the research', to: '/search', desc: 'Open and verify scientific records' },
    { label: 'Explore experts', to: '/researchers', desc: 'Find people working on the topic' },
    { label: 'Organize a project', to: '/projects', desc: 'Keep notes and next steps together' },
  ] },
  { id: 'founder', label: 'New venture or idea', intro: 'Investigate an idea before making a major commitment.', examples: [
    { label: 'Explore existing research', to: '/search', desc: 'Discover what is already known' },
    { label: 'Find potential collaborators', to: '/researchers', desc: 'Identify relevant research expertise' },
    { label: 'Find funding records', to: '/opportunities', desc: 'US Grants.gov coverage; verify eligibility' },
  ] },
];

function GoalPaths() {
  const [audience, setAudience] = useState('academic');
  const selected = HOME_PATHS.find(item => item.id === audience) || HOME_PATHS[0];
  return <section aria-labelledby="goal-path-title" className="eylo-page mx-auto max-w-7xl pb-7">
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">A simpler way to start</p>
      <h2 id="goal-path-title" className="mt-2 text-xl font-semibold sm:text-2xl">What are you trying to achieve?</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose a path for useful next steps. This does not change your account settings.</p>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose your goal">
        {HOME_PATHS.map(item => <button key={item.id} type="button" aria-pressed={audience === item.id} onClick={() => setAudience(item.id)} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold ${audience === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-secondary'}`}>{item.label}</button>)}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{selected.intro}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {selected.examples.map(item => <Link key={item.to} to={item.to} className="group flex min-h-28 flex-col rounded-xl border border-border bg-background p-4 hover:border-primary/50">
          <span className="text-sm font-semibold">{item.label}</span>
          <span className="mt-2 flex-1 text-xs leading-5 text-muted-foreground">{item.desc}</span>
          <span className="mt-3 text-xs font-semibold text-primary">Open feature →</span>
        </Link>)}
      </div>
    </div>
  </section>;
}

export default function Home({ searchOnly = false }) {
  const [state, setState] = useState(searchOnly ? 'search' : 'dashboard'); // dashboard | search | loading | results
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSearchId = useRef(0);
  const activeSearchController = useRef(null);
  const savedHistorySearchId = useRef(null);
  const { toast } = useToast();

  const handleSearch = async (request) => {
    const topic = typeof request === 'string' ? request.trim() : String(request?.topic || request?.query || '').trim();
    if (!topic) return;
    activeSearchController.current?.abort();
    const controller = new AbortController();
    activeSearchController.current = controller;
    const searchId = ++activeSearchId.current;
    savedHistorySearchId.current = null;
    setResults(null);
    setState('loading');
    setCurrentQuery(topic);
    setProgress({ status: 'loading', papers: [], researchers: [], institutions: [] });

    try {
      const finalResults = await runEyraDiscovery(request, (partial) => {
        if (controller.signal.aborted) return;
        if (searchId !== activeSearchId.current) return;
        setProgress({ ...partial });
        // As soon as we have real data + AI done, switch to results view
        if (partial.status === 'complete') {
          setResults(partial);
          setState('results');
          const profile = partial.discovery_profile || {};
          if (savedHistorySearchId.current === searchId) return;
          savedHistorySearchId.current = searchId;
          base44.entities.SearchHistory.create({
            query: topic,
            level: profile.level || 'researcher',
            goal: profile.goal || 'review',
            recency: profile.recency || 'balanced',
            source_indexes: partial.source_indexes || [],
            retrieval_status: partial.retrieval_status || 'complete',
            results_summary: `${partial.papers?.length || 0} papers, ${partial.researchers?.length || 0} researchers`,
            saved: false,
          }).then((entry) => {
            if (entry?.id && searchId === activeSearchId.current) {
              setResults(current => ({ ...(current || partial), search_history_id: entry.id }));
            }
          }).catch(() => {});

        }
      }, { signal: controller.signal });
      if (searchId !== activeSearchId.current) return;
      // Keep any history id that completed during the final progress update.
      setResults(current => ({
        ...finalResults,
        ...(current?.search_history_id ? { search_history_id: current.search_history_id } : {}),
      }));
      setState('results');
    } catch (err) {
      if (controller.signal.aborted || searchId !== activeSearchId.current) return;
      toast({ title: 'Research request failed', description: err instanceof Error ? err.message : 'Please try your research request again.', variant: 'destructive' });
      setState(searchOnly ? 'search' : 'dashboard');
    } finally {
      if (activeSearchController.current === controller) activeSearchController.current = null;
    }
  };

  useEffect(() => () => {
    activeSearchId.current += 1;
    activeSearchController.current?.abort();
  }, []);

  useEffect(() => {
    const sharedQuery = searchParams.get('q')?.trim();
    if (!sharedQuery) return;
    const sharedRequest = {
      topic: sharedQuery,
      level: searchParams.get('level') || 'researcher',
      goal: searchParams.get('goal') || 'review',
      recency: searchParams.get('recency') || 'balanced',
    };
    setSearchParams({}, { replace: true });
    handleSearch(sharedRequest);
  // This handoff runs once for each URL-provided query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (state === 'loading') {
    return <LoadingState query={currentQuery} progress={progress} />;
  }

  if (state === 'results') {
    return (
      <div>
        <SearchHeroCompact onSearch={handleSearch} currentQuery={currentQuery} onBack={() => { activeSearchId.current += 1; activeSearchController.current?.abort(); activeSearchController.current = null; setState(searchOnly ? 'search' : 'dashboard'); }} />
        <DiscoveryResults results={results} onNewSearch={handleSearch} />
      </div>
    );
  }

  if (state === 'search') {
    return (
      <div className="eylo-page">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">EYRA-assisted literature analysis</p>
            <h1 className="eylo-page-heading mt-2">Build your evidence base.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Search scholarly work, set the scope, then follow the papers and researchers behind each result.</p>
          </div>
          <Link to="/home" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:text-primary">
            <span aria-hidden="true">←</span> Workspace
          </Link>
        </div>
        <nav aria-label="EYLO academic tools" className="mb-5 grid gap-3 sm:grid-cols-3">
          <Link to="/search" className="rounded-xl border border-primary/40 bg-primary/5 px-5 py-4 text-sm font-semibold">Papers <span className="mt-1 block text-xs font-normal text-muted-foreground">Search scientific publications</span></Link>
          <Link to="/academics" className="rounded-xl border border-border bg-card px-5 py-4 text-sm font-semibold">Academics <span className="mt-1 block text-xs font-normal text-muted-foreground">Find researchers and supervisors</span></Link>
          <Link to="/find-phd" className="rounded-xl border border-border bg-card px-5 py-4 text-sm font-semibold">Find a PhD <span className="mt-1 block text-xs font-normal text-muted-foreground">Explore doctoral research roles</span></Link>
        </nav>
        <section aria-label="Research search" className="eylo-surface p-5 sm:p-8">
          <GuidedSearch key={currentQuery || "new-search"} onSearch={handleSearch} initialTopic={currentQuery} defaultLevel="researcher" />
          <p className="mt-4 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">Retrieved papers link to their academic sources. EYLO retrieves source-linked academic records independently. EYRA can help interpret them, but AI availability does not determine whether the evidence remains accessible.</p>
        </section>
      </div>
    );
  }

  return <><EyraHome onSearch={handleSearch} /><GoalPaths /><details className="eylo-page mx-auto max-w-7xl pb-12"><summary className="min-h-11 cursor-pointer rounded-xl border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">More from your workspace — tasks, calendar and saved work</summary><div className="pt-6"><PersonalizedDashboard /></div></details></>;
}
