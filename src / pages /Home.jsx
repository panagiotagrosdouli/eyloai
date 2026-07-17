import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { runEyraDiscovery } from '@/lib/eyra-engine';
import { useToast } from '@/components/ui/use-toast';
import { SearchHeroCompact } from '@/components/discovery/SearchHero';
import DiscoveryResults from '@/components/discovery/DiscoveryResults';
import LoadingState from '@/components/discovery/LoadingState';
import EyraHome from '@/components/dashboard/EyraHome';

export default function Home() {
  const [state, setState] = useState('dashboard'); // dashboard | loading | results
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const { toast } = useToast();

  const handleSearch = async (query) => {
    setState('loading');
    setCurrentQuery(query);
    setProgress({ status: 'loading', papers: [], researchers: [], institutions: [] });

    try {
      const finalResults = await runEyraDiscovery(query, (partial) => {
        setProgress({ ...partial });
        // As soon as we have real data + AI done, switch to results view
        if (partial.status === 'complete') {
          setResults(partial);
          setState('results');
          base44.entities.SearchHistory.create({
            query,
            results_summary: `${partial.papers?.length || 0} papers, ${partial.researchers?.length || 0} researchers`,
          }).catch(() => {});
        }
      });
      // Fallback in case onProgress didn't fire complete
      if (state !== 'results') {
        setResults(finalResults);
        setState('results');
      }
    } catch (err) {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
      setState('dashboard');
    }
  };

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

  return <EyraHome onSearch={handleSearch} onEyraOpen={() => {}} />;
}
