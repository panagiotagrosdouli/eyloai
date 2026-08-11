import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { runEyraDiscovery } from '@/lib/eyra-engine';
import { useToast } from '@/components/ui/use-toast';
import { useSearchParams } from 'react-router-dom';
import { SearchHeroCompact } from '@/components/discovery/SearchHero';
import DiscoveryResults from '@/components/discovery/DiscoveryResults';
import LoadingState from '@/components/discovery/LoadingState';
import EyraHome from '@/components/dashboard/EyraHome';

export default function Home() {
  const [state, setState] = useState('dashboard'); // dashboard | loading | results
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const handleSearch = async (request) => {
    const topic = typeof request === 'string' ? request.trim() : String(request?.topic || request?.query || '').trim();
    if (!topic) return;
    setState('loading');
    setCurrentQuery(topic);
    setProgress({ status: 'loading', papers: [], researchers: [], institutions: [] });

    try {
      const finalResults = await runEyraDiscovery(request, (partial) => {
        setProgress({ ...partial });
        // As soon as we have real data + AI done, switch to results view
        if (partial.status === 'complete') {
          setResults(partial);
          setState('results');
          const profile = partial.discovery_profile || {};
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
            if (entry?.id) {
              setResults(current => ({ ...(current || partial), search_history_id: entry.id }));
            }
          }).catch(() => {});

        }
      });
      // Keep any history id that completed during the final progress update.
      setResults(current => ({
        ...finalResults,
        ...(current?.search_history_id ? { search_history_id: current.search_history_id } : {}),
      }));
      setState('results');
    } catch (err) {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
      setState('dashboard');
    }
  };

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
        <SearchHeroCompact onSearch={handleSearch} currentQuery={currentQuery} onBack={() => setState('dashboard')} />
        <DiscoveryResults results={results} onNewSearch={handleSearch} />
      </div>
    );
  }

  return <EyraHome onSearch={handleSearch} />;
}
