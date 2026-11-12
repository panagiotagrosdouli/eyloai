import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { UNIVERSAL_SEARCH_PAGE_SIZE, UNIVERSAL_SEARCH_SOURCES } from '@/lib/universal-search-domain.mjs';
import { searchWorkspaceSource } from '@/services/universal-search';

const LABELS = { all: 'All sources', Project: 'Projects', Note: 'Notes', LifeTask: 'Tasks and study', LifeGoal: 'Goals', FlashcardDeck: 'Flashcards', CalendarEvent: 'Calendar', SavedPaper: 'Saved research', Idea: 'Ideas' };

export default function UniversalSearch() {
  const { user } = useAuth();
  const generation = useRef(0);
  const [sourcePages, setSourcePages] = useState({});
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [pages, setPages] = useState({});
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState([]);
  const eligibleSources = source === 'all' ? UNIVERSAL_SEARCH_SOURCES : [source];

  useEffect(() => {
    generation.current += 1;
    setSourcePages({}); setFailed([]);
    const currentGeneration = generation.current;
    const term = query.trim();
    if (!user?.id || term.length < 2) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      const results = await Promise.allSettled(eligibleSources.map(name => searchWorkspaceSource({
        source: name, query: term, page: pages[name] || 1, pageSize: UNIVERSAL_SEARCH_PAGE_SIZE, signal: controller.signal,
      })));
      if (currentGeneration !== generation.current || controller.signal.aborted) return;
      const next = {};
      const failures = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') next[eligibleSources[index]] = result.value;
        else failures.push(eligibleSources[index]);
      });
      setSourcePages(next); setFailed(failures); setLoading(false);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [user?.id, query, source, pages]);

  const availableTotal = Object.values(sourcePages).reduce((sum, result) => sum + result.total, 0);

  return <div className="eylo-page max-w-5xl">
    <header className="mb-6"><p className="eylo-eyebrow">Private workspace</p><h1 className="eylo-page-heading">Search your workspace</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Find saved notes, projects, tasks, study items, events, flashcards, ideas and research. Search uses your signed-in account's saved records.</p></header>
    <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
      <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3"><Search size={16} className="text-muted-foreground"/><span className="sr-only">Search your records</span><input autoFocus type="search" value={query} onChange={event => { setQuery(event.target.value); setPages({}); }} placeholder="Search at least 2 characters" className="min-h-11 w-full bg-transparent text-sm outline-none"/></label>
      <label className="sr-only" htmlFor="universal-source">Filter by source</label><select id="universal-source" value={source} onChange={event => { setSource(event.target.value); setPages({}); }} className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="all">All sources</option>{UNIVERSAL_SEARCH_SOURCES.map(name => <option key={name} value={name}>{LABELS[name]}</option>)}</select>
    </div>
    {failed.length > 0 && <div role="alert" className="mb-4 rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive">Partial results: {failed.map(name => LABELS[name]).join(', ')} could not be searched. The result count excludes these sources. <button type="button" onClick={() => { setPages(current => ({ ...current })); }} className="ml-2 underline">Retry</button></div>}
    {loading ? <p role="status" className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Searching your private workspace…</p>
      : query.trim().length < 2 ? <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Enter at least two characters to search {eligibleSources.length} sources.</p>
        : availableTotal ? <div className="space-y-4" aria-label="Search results">{eligibleSources.filter(name => sourcePages[name]).map(name => {
          const pageData = sourcePages[name];
          return <section key={name} className="rounded-xl border border-border bg-card p-4" aria-label={`${LABELS[name]} search results`}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{LABELS[name]} <span className="font-normal text-muted-foreground">({pageData.total})</span></p><span className="text-xs text-muted-foreground">Page {pageData.page} of {pageData.pages}</span></div><ul className="divide-y divide-border">{pageData.items.map(item => <li key={item.id} className="py-3 first:pt-0 last:pb-0"><Link to={item.href} className="rounded-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.title}</Link>{item.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.snippet}</p>}</li>)}</ul><div className="mt-4 flex justify-between"><button type="button" disabled={pageData.page <= 1 || loading} onClick={() => setPages(current => ({ ...current, [name]: pageData.page - 1 }))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-50"><ChevronLeft size={15}/>Previous</button><button type="button" disabled={pageData.page >= pageData.pages || loading} onClick={() => setPages(current => ({ ...current, [name]: pageData.page + 1 }))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Next<ChevronRight size={15}/></button></div></section>;
        })}</div>
          : !failed.length && <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No saved records match “{query.trim()}”.</p>}
  </div>;
}

