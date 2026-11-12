import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { paginateSearchResults, searchWorkspaceRecords, UNIVERSAL_SEARCH_SOURCES } from '@/lib/universal-search-domain.mjs';

const LABELS = { all: 'All sources', Project: 'Projects', Note: 'Notes', LifeTask: 'Tasks and study', LifeGoal: 'Goals', FlashcardDeck: 'Flashcards', CalendarEvent: 'Calendar', SavedPaper: 'Saved research', Idea: 'Ideas' };

export default function UniversalSearch() {
  const { user } = useAuth();
  const owner = useRef(user?.id || null);
  const [records, setRecords] = useState({});
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (ownerId = owner.current) => {
    if (!ownerId || ownerId !== owner.current) return;
    setLoading(true); setError('');
    const names = ['Project', 'Note', 'LifeTask', 'LifeGoal', 'FlashcardDeck', 'CalendarEvent', 'SavedPaper', 'Idea'];
    const results = await Promise.allSettled(names.map(name => base44.entities[name].list('-updated_date', 1000)));
    if (ownerId !== owner.current) return;
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [names[index]] : []);
    const loaded = Object.fromEntries(results.flatMap((result, index) => result.status === 'fulfilled' ? [[names[index], result.value]] : []));
    setRecords(loaded);
    if (failed.length) setError(`Some sources could not be loaded: ${failed.map(name => LABELS[name]).join(', ')}. Results below include only successfully loaded sources.`);
    setLoading(false);
  };

  useEffect(() => {
    owner.current = user?.id || null; setRecords({}); setQuery(''); setSource('all'); setPage(1); setError('');
    if (user?.id) void load(user.id); else setLoading(false);
  }, [user?.id]);

  const results = useMemo(() => searchWorkspaceRecords(records, query, source), [records, query, source]);
  const pageData = useMemo(() => paginateSearchResults(results, page, 20), [results, page]);
  const loadedSources = Object.keys(records);

  return <div className="eylo-page max-w-5xl">
    <header className="mb-6"><p className="eylo-eyebrow">Private workspace</p><h1 className="eylo-page-heading">Search your workspace</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Find saved notes, projects, tasks, study items, events, flashcards, ideas and research. Search uses your signed-in account's saved records.</p></header>
    <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-border bg-card p-4">
      <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3"><Search size={16} className="text-muted-foreground"/><span className="sr-only">Search your records</span><input autoFocus type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search at least 2 characters" className="min-h-11 w-full bg-transparent text-sm outline-none"/></label>
      <label className="sr-only" htmlFor="universal-source">Filter by source</label><select id="universal-source" value={source} onChange={event => { setSource(event.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="all">All sources</option>{UNIVERSAL_SEARCH_SOURCES.filter(name => loadedSources.includes(name)).map(name => <option key={name} value={name}>{LABELS[name]}</option>)}</select>
    </div>
    {error && <div role="alert" className="mb-4 flex justify-between gap-3 rounded-lg border border-destructive/30 px-4 py-3 text-sm text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">Retry sources</button></div>}
    {loading ? <p role="status" className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading private workspace records…</p>
      : query.trim().length < 2 ? <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Enter at least two characters to search {loadedSources.length} available sources.</p>
        : pageData.total ? <section className="rounded-xl border border-border bg-card p-4" aria-label="Search results"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{pageData.total} result{pageData.total === 1 ? '' : 's'}</p><span className="text-xs text-muted-foreground">Page {pageData.page} of {pageData.pages}</span></div><ul className="divide-y divide-border">{pageData.items.map(item => <li key={item.id} className="py-3 first:pt-0 last:pb-0"><Link to={item.href} className="rounded-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.title}</Link><span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{item.sourceLabel}</span>{item.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.snippet}</p>}</li>)}</ul><div className="mt-4 flex justify-between"><button type="button" disabled={pageData.page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-50"><ChevronLeft size={15}/>Previous</button><button type="button" disabled={pageData.page >= pageData.pages} onClick={() => setPage(value => Math.min(pageData.pages, value + 1))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Next<ChevronRight size={15}/></button></div></section>
          : <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">No saved records match “{query.trim()}”.</p>}
  </div>;
}
