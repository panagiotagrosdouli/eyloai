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
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Literature discovery</p>
            <h1 className="eylo-page-heading mt-2">Build your evidence base.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Search scholarly work, set the scope, then follow the papers and researchers behind each result.</p>
          </div>
          <Link to="/home" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:text-primary">
            <span aria-hidden="true">←</span> Workspace
          </Link>
        </div>
        <section aria-label="Research search" className="eylo-surface p-5 sm:p-8">
          <GuidedSearch key={currentQuery || "new-search"} onSearch={handleSearch} initialTopic={currentQuery} defaultLevel="researcher" />
          <p className="mt-4 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">Retrieved papers link to their academic sources. EYRA’s interpretations are shown separately from source evidence.</p>
        </section>
      </div>
    );
  }

  return <EyraHome onSearch={handleSearch} />;
}
