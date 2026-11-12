import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookmarkPlus, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { searchAllPapersWithStatus } from '@/lib/eyra-api';
import { isSafeLiteratureSourceUrl } from '@/lib/literature-review-protocol.mjs';
import { deriveRecommendationQueries, mergeRecommendationResults } from '@/lib/for-you-recommendations.mjs';
import { useToast } from '@/components/ui/use-toast';

export default function ForYouResearchFeed({ profile }) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({ status: 'idle', recommendations: [], sources: [], error: '' });
  const [saving, setSaving] = useState('');
  const { toast } = useToast();
  const signals = useMemo(() => deriveRecommendationQueries(profile), [profile]);

  useEffect(() => {
    if (!signals.length) {
      setState({ status: 'empty', recommendations: [], sources: [], error: '' });
      return undefined;
    }
    const controller = new AbortController();
    let current = true;
    setState({ status: 'loading', recommendations: [], sources: [], error: '' });
    Promise.all(signals.map(async (signal) => {
      const result = await searchAllPapersWithStatus(signal.query, { limit: 8, signal: controller.signal });
      return { ...result, signal };
    })).then((results) => {
      if (!current) return;
      const sourceMap = new Map();
      results.forEach((result) => (result.source_status || []).forEach((source) => {
        const prior = sourceMap.get(source.id);
        if (!prior) sourceMap.set(source.id, { ...source, count: source.count || 0 });
        else {
          prior.status = prior.status === 'available' || source.status === 'available' ? 'available' : 'unavailable';
          prior.count += source.count || 0;
        }
      }));
      setState({
        status: 'ready',
        recommendations: mergeRecommendationResults(results).slice(0, 12),
        sources: [...sourceMap.values()],
        error: '',
      });
    }).catch((error) => {
      if (!current || error?.name === 'AbortError') return;
      setState({ status: 'error', recommendations: [], sources: [], error: error?.message || 'The literature search could not be completed.' });
    });
    return () => { current = false; controller.abort(); };
  }, [signals, refresh]);

  const savePaper = async ({ paper }) => {
    const sourceId = paper.id || paper.doi || paper.url || paper.title;
    if (!sourceId) return;
    setSaving(String(sourceId));
    try {
      const matches = await base44.entities.SavedPaper.filter({ source_id: sourceId }, '-created_date', 1);
      const existing = Array.isArray(matches) ? matches.find((item) => item.source_id === sourceId) : null;
      if (!existing) {
        await base44.entities.SavedPaper.create({
          source_id: sourceId,
          doi: paper.doi || '',
          title: paper.title,
          authors: paper.authors || '',
          summary: paper.summary || paper.abstract || '',
          year: paper.year || '',
          source: paper.source || paper.source_index || '',
          source_index: paper.source_index || paper.source || '',
          cited_by_count: paper.cited_by_count,
          authorships: paper.authorships || [],
          openalex_topics: paper.openalex_topics || [],
          referenced_work_ids: paper.referenced_work_ids || [],
          open_access: paper.open_access,
          url: isSafeLiteratureSourceUrl(paper.url) ? paper.url : '',
        });
      }
      toast({ title: existing ? 'Already in your Library' : 'Saved to your Library' });
    } catch (error) {
      toast({ title: 'Could not save this paper', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving('');
    }
  };

  const available = state.sources.filter((source) => source.status === 'available').length;
  return (
    <section aria-labelledby="for-you-research-title" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Live literature</p>
          <h2 id="for-you-research-title" className="mt-1 text-base font-semibold">Research picked from your work</h2>
          <p className="mt-1 text-xs text-muted-foreground">Real records from scholarly indexes, matched to your projects, interests and recent searches.</p>
        </div>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={!signals.length || state.status === 'loading'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50" aria-label="Refresh research recommendations">
          {state.status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      {state.status === 'loading' && <div role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin"/> Searching scholarly sources for your actual research signals…</div>}
      {state.status === 'error' && <div role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle size={15} className="mr-2 inline"/>{state.error}</div>}
      {state.status === 'empty' && <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Add a research interest, project or search to get recommendations grounded in your own work.</p>}

      {state.sources.length > 0 && <p className="mt-4 text-[11px] text-muted-foreground" role="status">Source coverage: {available} of {state.sources.length} indexes responded. {state.sources.filter((source) => source.status === 'unavailable').map((source) => source.label).join(', ') ? `Unavailable: ${state.sources.filter((source) => source.status === 'unavailable').map((source) => source.label).join(', ')}.` : 'All queried indexes responded.'}</p>}
      {state.status === 'ready' && state.recommendations.length === 0 && <p className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground">The connected indexes returned no matching records for these signals. Try a more specific project goal or research interest.</p>}

      <div className="mt-4 space-y-3">
        {state.recommendations.map((item, index) => {
          const paper = item.paper;
          const key = `${paper.doi || paper.id || paper.title}-${index}`;
          const safeUrl = isSafeLiteratureSourceUrl(paper.url) ? paper.url : '';
          return <article key={key} className="rounded-xl border border-border/80 p-4">
            <div className="flex items-start gap-3">
              <FileText size={16} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold leading-5">{paper.title}</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">{[paper.authors, paper.year, paper.source_index || paper.source].filter(Boolean).join(' · ')}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.reason}: <span className="text-foreground">{item.query}</span></p>
                {paper.abstract && <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{paper.abstract}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {safeUrl && <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium">Open source <ExternalLink size={12}/></a>}
                  <button type="button" onClick={() => savePaper(item)} disabled={saving === String(paper.id || paper.doi || paper.url || paper.title)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium disabled:opacity-50"><BookmarkPlus size={13}/>{saving === String(paper.id || paper.doi || paper.url || paper.title) ? 'Saving…' : 'Save to Library'}</button>
                </div>
              </div>
            </div>
          </article>;
        })}
      </div>
      <p className="mt-4 text-[10px] leading-4 text-muted-foreground">Recommendations are search results relevant to your saved signals, not endorsements or a complete literature review. Provider coverage can vary.</p>
    </section>
  );
}
