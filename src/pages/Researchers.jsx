import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchOpenAlexAuthors } from '@/lib/eyra-api';
import {
  Bookmark, BookOpen, CheckCircle2, ExternalLink, Search, Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const QUICK_SEARCHES = [
  'Artificial intelligence', 'Cancer biology', 'Climate science',
  'Quantum physics', 'Genomics', 'Robotics', 'Neuroscience', 'NLP',
];

export default function Researchers() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());
  const { toast } = useToast();

  const handleSearch = async (searchQuery) => {
    const q = String(searchQuery || query).trim();
    if (!q) return;

    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    setSearchError('');
    setResults([]);

    try {
      const data = await searchOpenAlexAuthors(q, 16);
      setResults(data);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Could not reach OpenAlex.');
    } finally {
      setLoading(false);
    }
  };

  const saveResearcher = async (researcher) => {
    const stableId = researcher.profile_url || researcher.openalex_id || researcher.id || researcher.name;
    if (savingIds.has(stableId) || savedIds.has(stableId)) return;

    setSavingIds(previous => new Set([...previous, stableId]));
    try {
      const existing = researcher.profile_url
        ? (await base44.entities.SavedResearcher.filter({ profile_url: researcher.profile_url }, '-created_date', 1))[0]
        : null;

      const payload = {
        name: researcher.name,
        institution: researcher.institution,
        research_areas: researcher.research_areas,
        works_count: researcher.works_count,
        citation_count: researcher.citation_count,
        profile_url: researcher.profile_url,
        openalex_id: researcher.openalex_id || researcher.id || '',
      };

      if (existing) {
        await base44.entities.SavedResearcher.update(existing.id, payload);
      } else {
        await base44.entities.SavedResearcher.create(payload);
      }

      setSavedIds(previous => new Set([...previous, stableId]));
      toast({ title: existing ? 'Researcher already in your library' : 'Researcher saved to library' });
    } catch (error) {
      toast({
        title: 'Could not save this researcher',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingIds(previous => {
        const next = new Set(previous);
        next.delete(stableId);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">People & expertise</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Researchers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Find researchers by topic, field or name. Profiles come from OpenAlex; publication activity is context, not a signal of availability.
        </p>
      </header>

      <form
        onSubmit={event => {
          event.preventDefault();
          handleSearch();
        }}
        className="mb-4 flex max-w-3xl flex-col gap-2 sm:flex-row"
      >
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search researchers</span>
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Research field, topic, institution or name…"
            className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </label>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="min-h-12 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {!hasSearched && (
        <div className="mb-8 flex flex-wrap gap-2">
          {QUICK_SEARCHES.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => handleSearch(item)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {searchError && (
        <div role="alert" className="mb-6 max-w-3xl rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs leading-5 text-destructive">
          Researcher search could not complete: {searchError}
        </div>
      )}

      {loading && <ResearcherSkeleton />}

      {!loading && hasSearched && results.length === 0 && !searchError && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Users size={20} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-sm font-semibold text-foreground">No researchers matched this search</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
            Try a broader topic, a method name, an institution, or the researcher’s full name.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{results.length} researcher records · OpenAlex</p>
            <p className="text-[10px] text-muted-foreground">Works and citation counts describe indexed activity, not researcher quality.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((researcher, index) => {
              const stableId = researcher.profile_url || researcher.openalex_id || researcher.id || researcher.name || index;
              const saving = savingIds.has(stableId);
              const saved = savedIds.has(stableId);

              return (
                <article key={stableId} className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-foreground">{researcher.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{researcher.institution || 'Institution unavailable'}</p>
                      {researcher.country && <p className="mt-0.5 text-[10px] text-muted-foreground">{researcher.country}</p>}
                      {researcher.research_areas && (
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{researcher.research_areas}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <BookOpen size={10} aria-hidden="true" />
                          {(researcher.works_count || 0).toLocaleString()} works
                        </span>
                        <span>{(researcher.citation_count || 0).toLocaleString()} citations</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => saveResearcher(researcher)}
                        disabled={saving || saved}
                        aria-label={saved ? `${researcher.name} saved` : `Save ${researcher.name} to library`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-default"
                      >
                        {saving
                          ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                          : saved
                            ? <CheckCircle2 size={14} className="text-green-400" aria-hidden="true" />
                            : <Bookmark size={14} aria-hidden="true" />}
                      </button>
                      {researcher.profile_url && (
                        <a
                          href={researcher.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${researcher.name} on OpenAlex`}
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </motion.div>
      )}

      {!hasSearched && !loading && (
        <section className="mt-8 border-t border-border pt-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <h2 className="text-xs font-semibold text-foreground">Source</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Profiles and indexed publication activity come from OpenAlex.</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-foreground">What to verify</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Open the profile and inspect recent works before deciding that expertise fits your project.</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-foreground">What EYLO does not infer</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Publication activity does not imply availability, interest in collaboration, or endorsement.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ResearcherSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="status" aria-live="polite">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5">
          <div className="h-4 w-2/5 animate-pulse rounded bg-secondary" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-secondary/80" />
          <div className="mt-5 h-3 w-full animate-pulse rounded bg-secondary/60" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-secondary/60" />
        </div>
      ))}
      <span className="sr-only">Searching OpenAlex for researchers</span>
    </div>
  );
}
