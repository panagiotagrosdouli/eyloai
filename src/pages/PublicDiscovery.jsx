import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Building2, ExternalLink, Loader2, Search, Sparkles, Users } from 'lucide-react';
import { searchAllPapers, searchOpenAlexAuthors, searchOpenAlexInstitutions } from '@/lib/eyra-api';

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export default function PublicDiscovery() {
  const [params, setParams] = useSearchParams();
  const initialQuery = params.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [data, setData] = useState({ papers: [], researchers: [], institutions: [] });
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialQuery) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      searchAllPapers(initialQuery),
      searchOpenAlexAuthors(initialQuery, 8),
      searchOpenAlexInstitutions(initialQuery, 6),
    ]).then(([papers, researchers, institutions]) => {
      if (active) setData({ papers, researchers, institutions });
    }).catch(() => {
      if (active) setError('EYRA could not reach the research indexes. Please try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [initialQuery]);

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (value) setParams({ q: value });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={15} /><img src="/brand/eylo.png" alt="EYLO" className="h-8 w-8 rounded-xl object-cover object-top" /></Link>
          <form onSubmit={submit} className="ml-auto flex w-full max-w-2xl items-center rounded-2xl border border-border bg-card p-1.5">
            <Search className="ml-3 text-muted-foreground" size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none" placeholder="What would you like to build?" />
            <button className="rounded-xl eyra-gradient px-4 py-2 text-xs font-semibold text-white">Discover</button>
          </form>
          <Link to="/register" className="hidden rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background sm:block">Save research</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <div className="mb-10 max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary"><img src="/brand/eyra.png" alt="EYRA" className="h-7 w-10 rounded-md object-cover" /> EYRA Discovery</div>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-5xl">Real evidence for “{initialQuery}”</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">Live discovery from OpenAlex, arXiv, Crossref and Europe PMC. EYRA never invents papers or researchers.</p>
        </div>

        {loading && (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <Loader2 className="mb-5 animate-spin text-primary" size={30} />
            <p className="font-semibold">EYRA is searching real research indexes…</p>
            <p className="mt-2 text-sm text-muted-foreground">Papers, researchers and institutions are being verified.</p>
          </div>
        )}

        {!loading && error && <EmptyState>{error}</EmptyState>}

        {!loading && !error && initialQuery && (
          <div className="space-y-14">
            <section>
              <div className="mb-5 flex items-end justify-between">
                <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Research found</p><h2 className="mt-1 font-heading text-2xl font-bold">Scientific papers</h2></div>
                <span className="text-sm text-muted-foreground">{data.papers.length} verified results</span>
              </div>
              {data.papers.length ? <div className="grid gap-4 lg:grid-cols-2">{data.papers.map((paper) => (
                <article key={`${paper.id}-${paper.title}`} className="rounded-3xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                  <div className="mb-4 flex items-center justify-between gap-3"><span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">{paper.source}</span><span className="text-xs text-muted-foreground">{paper.year || 'Year unavailable'} · {paper.cited_by_count || 0} citations</span></div>
                  <h3 className="font-heading text-lg font-semibold leading-6">{paper.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{paper.authors || 'Authors unavailable'}</p>
                  {paper.summary && <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{paper.summary}</p>}
                  <a href={paper.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary">Open source <ExternalLink size={12} /></a>
                </article>
              ))}</div> : <EmptyState>No papers found. Try a more specific research phrase.</EmptyState>}
            </section>

            <section>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-wider text-primary">People found</p><h2 className="mt-1 font-heading text-2xl font-bold">Researchers</h2></div>
              {data.researchers.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{data.researchers.map((researcher) => (
                <article key={researcher.id} className="rounded-3xl border border-border bg-card p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users size={18} /></div>
                  <h3 className="font-heading font-semibold">{researcher.name}</h3><p className="mt-1 text-xs text-muted-foreground">{researcher.institution}</p>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">{researcher.works_count} works · {researcher.citation_count} citations</p>
                  <a href={researcher.profile_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">OpenAlex profile <ArrowRight size={11} /></a>
                </article>
              ))}</div> : <EmptyState>No researcher profiles found for this phrase.</EmptyState>}
            </section>

            <section>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-wider text-primary">Institutions found</p><h2 className="mt-1 font-heading text-2xl font-bold">Universities & research organizations</h2></div>
              {data.institutions.length ? <div className="grid gap-4 md:grid-cols-3">{data.institutions.map((institution) => (
                <a key={institution.id} href={institution.url} target="_blank" rel="noreferrer" className="rounded-3xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                  <Building2 className="mb-4 text-primary" size={20} /><h3 className="font-heading font-semibold">{institution.name}</h3><p className="mt-2 text-xs text-muted-foreground">{institution.country || 'International'} · {institution.works_count} works</p>
                </a>
              ))}</div> : <EmptyState>No institutions found for this phrase.</EmptyState>}
            </section>

            <section className="rounded-[2rem] eyra-gradient p-8 text-white sm:p-12">
              <div className="max-w-2xl"><BookOpen className="mb-5" size={26} /><h2 className="font-heading text-3xl font-bold">Turn this discovery into a project.</h2><p className="mt-3 text-sm leading-6 text-white/80">Create an EYLO workspace to save evidence, contact researchers, build milestones and let EYRA develop your roadmap.</p><Link to={`/register?idea=${encodeURIComponent(initialQuery)}`} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Create free project <ArrowRight size={14} /></Link></div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
