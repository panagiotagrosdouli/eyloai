import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchFundingOpportunities } from '@/lib/funding-api';
import {
  Award, Bookmark, CheckCircle2, DollarSign, ExternalLink, GraduationCap,
  Rocket, Search, ShieldCheck, Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  FUNDING_RELEVANCE_LABELS,
  fundingRelevanceWeight,
} from '@/lib/evidence-presentation';

const TYPE_CONFIG = {
  grant: { icon: DollarSign, label: 'Grant' },
  competition: { icon: Trophy, label: 'Competition' },
  accelerator: { icon: Rocket, label: 'Accelerator' },
  scholarship: { icon: GraduationCap, label: 'Scholarship' },
  call: { icon: Award, label: 'Call' },
};

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'grant', label: 'Grants' },
  { key: 'call', label: 'Calls' },
  { key: 'competition', label: 'Competitions' },
  { key: 'accelerator', label: 'Accelerators' },
  { key: 'scholarship', label: 'Scholarships' },
];

const QUICK_SEARCHES = [
  'AI and machine learning research',
  'Climate change innovation',
  'Healthcare technology',
  'Startup funding Europe',
  'University research grants',
  'Deep tech acceleration',
];

const RELEVANCE_STYLE = {
  strong: 'border-primary/25 bg-primary/10 text-primary',
  moderate: 'border-border bg-secondary text-foreground',
  possible: 'border-border bg-secondary/50 text-muted-foreground',
  unranked: 'border-border bg-background text-muted-foreground',
};

export default function Opportunities() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sourceMeta, setSourceMeta] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [rankingNotice, setRankingNotice] = useState('');
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());
  const { toast } = useToast();

  const handleSearch = async (searchQuery) => {
    const q = String(searchQuery || query).trim();
    if (!q) return;

    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    setActiveCategory('all');
    setSearchError('');
    setRankingNotice('');
    setSourceMeta(null);
    setResults([]);

    try {
      const sourceResult = await searchFundingOpportunities(q, 12);
      setSourceMeta(sourceResult);

      const verified = sourceResult.items.map(item => ({
        ...item,
        relevance_band: 'unranked',
        match_reason: '',
        application_complexity: '',
      }));
      setResults(verified);

      if (!verified.length) return;

      try {
        const ranking = await base44.integrations.Core.InvokeLLM({
          prompt: `You are EYRA Funding Intelligence. Compare ONLY the verified funding records below with the user's query.

USER QUERY: "${q}"
RETRIEVED AT: ${sourceResult.retrieved_at}
OFFICIAL SOURCE: ${sourceResult.source}

VERIFIED RECORDS:
${verified.map(item => JSON.stringify({
  id: item.id,
  title: item.title,
  agency: item.agency,
  description: item.description,
  eligibility: item.eligibility,
  deadline: item.deadline,
  amount: item.amount,
  categories: item.categories,
})).join('\n')}

For every supplied id:
- assign relevance_band as strong, moderate, or possible;
- explain the relevance using only the supplied record and query;
- estimate application_complexity as Low, Medium, or High only from the supplied requirements/description.

These are qualitative decision aids, not probabilities of success and not eligibility determinations.
Do not add opportunities or change any factual field.`,
          response_json_schema: {
            type: 'object',
            properties: {
              ranked: {
                type: 'array',
                minItems: verified.length,
                maxItems: verified.length,
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', enum: verified.map(item => item.id) },
                    relevance_band: { type: 'string', enum: ['strong', 'moderate', 'possible'] },
                    match_reason: { type: 'string' },
                    application_complexity: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                  },
                },
              },
            },
          },
        });

        const byId = new Map((ranking.ranked || []).map(item => [item.id, item]));
        setResults(
          verified
            .map(item => ({ ...item, ...(byId.get(item.id) || {}) }))
            .sort((a, b) => fundingRelevanceWeight(b.relevance_band) - fundingRelevanceWeight(a.relevance_band)),
        );
      } catch (error) {
        setRankingNotice(
          `Verified opportunities loaded. EYRA relevance labels are unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Funding search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const saveOpportunity = async (opportunity) => {
    const stableId = opportunity.source_url || opportunity.id || opportunity.title;
    if (savingIds.has(stableId) || savedIds.has(stableId)) return;

    setSavingIds(previous => new Set([...previous, stableId]));
    try {
      const existing = opportunity.source_url
        ? (await base44.entities.SavedOpportunity.filter({ url: opportunity.source_url }, '-created_date', 1))[0]
        : null;

      const payload = {
        title: opportunity.title,
        type: opportunity.type,
        description: opportunity.description,
        source: opportunity.agency || sourceMeta?.source || 'Official funding source',
        url: opportunity.source_url || '',
        deadline: opportunity.deadline || '',
        amount: opportunity.amount || '',
        eligibility: opportunity.eligibility || '',
        status: opportunity.status || '',
        categories: opportunity.categories || [],
        relevance_band: opportunity.relevance_band || 'unranked',
        match_reason: opportunity.match_reason || '',
        application_complexity: opportunity.application_complexity || '',
        retrieved_at: sourceMeta?.retrieved_at || '',
      };

      if (existing) {
        await base44.entities.SavedOpportunity.update(existing.id, payload);
      } else {
        await base44.entities.SavedOpportunity.create(payload);
      }

      setSavedIds(previous => new Set([...previous, stableId]));
      toast({ title: existing ? 'Opportunity already in your library' : 'Opportunity saved to library' });
    } catch (error) {
      toast({
        title: 'Could not save this opportunity',
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

  const filteredResults = activeCategory === 'all'
    ? results
    : results.filter(item => item.type === activeCategory);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Official opportunities</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Funding</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Search official funding records, inspect the source notice, and use EYRA relevance as a qualitative aid — never as a probability of success.
        </p>
      </header>

      <div className="mb-5 flex max-w-3xl items-start gap-3 rounded-xl border border-border bg-secondary/25 px-4 py-3">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-[11px] leading-5 text-muted-foreground">
          Titles, agencies, deadlines, amounts and eligibility text come from the retrieved official record when supplied. Always open the source notice before deciding whether to apply.
        </p>
      </div>

      <form
        onSubmit={event => {
          event.preventDefault();
          handleSearch();
        }}
        className="mb-4 flex max-w-3xl flex-col gap-2 sm:flex-row"
      >
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search funding opportunities</span>
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Research area, project goal or funding need…"
            className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </label>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="min-h-12 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Searching…' : 'Find funding'}
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
          Funding search could not complete: {searchError}
        </div>
      )}

      {rankingNotice && (
        <div role="status" className="mb-6 max-w-3xl rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-200">
          {rankingNotice}
        </div>
      )}

      {sourceMeta && !loading && (
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>{results.length} official records</span>
          <span>Source: {sourceMeta.source}</span>
          <span>Retrieved {new Date(sourceMeta.retrieved_at).toLocaleString()}</span>
        </div>
      )}

      {loading && <FundingSkeleton />}

      {!loading && hasSearched && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-border pb-4">
            {CATEGORIES.map(category => (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
                  activeCategory === category.key
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {category.label}
                {category.key !== 'all' && (
                  <span className="ml-1 opacity-60">{results.filter(item => item.type === category.key).length}</span>
                )}
              </button>
            ))}
          </div>

          {filteredResults.length ? (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {filteredResults.map((opportunity, index) => {
                const config = TYPE_CONFIG[opportunity.type] || TYPE_CONFIG.call;
                const Icon = config.icon;
                const stableId = opportunity.source_url || opportunity.id || opportunity.title || index;
                const saving = savingIds.has(stableId);
                const saved = savedIds.has(stableId);
                const relevance = String(opportunity.relevance_band || 'unranked').toLowerCase();

                return (
                  <article key={stableId} className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                            <Icon size={9} aria-hidden="true" /> {config.label}
                          </span>
                          <span
                            title="EYRA qualitative relevance to your query, not a probability of success."
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${RELEVANCE_STYLE[relevance] || RELEVANCE_STYLE.unranked}`}
                          >
                            {FUNDING_RELEVANCE_LABELS[relevance] || FUNDING_RELEVANCE_LABELS.unranked}
                          </span>
                          {opportunity.application_complexity && (
                            <span
                              title="EYRA estimate based only on the retrieved record."
                              className="text-[10px] text-muted-foreground"
                            >
                              Application complexity: {opportunity.application_complexity}
                            </span>
                          )}
                        </div>

                        <h2 className="text-sm font-semibold leading-6 text-foreground">{opportunity.title}</h2>
                        {opportunity.agency && <p className="mt-1 text-xs text-muted-foreground">{opportunity.agency}</p>}
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                          {opportunity.description || 'Open the official record for the full announcement.'}
                        </p>

                        {opportunity.match_reason && (
                          <div className="mt-3 border-l-2 border-primary/30 pl-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">EYRA relevance note</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{opportunity.match_reason}</p>
                          </div>
                        )}

                        <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide">Deadline</dt>
                            <dd className="mt-0.5 text-foreground">{opportunity.deadline || 'Not supplied'}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide">Amount</dt>
                            <dd className="mt-0.5 text-foreground">{opportunity.amount || 'Not supplied'}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] uppercase tracking-wide">Eligibility</dt>
                            <dd className="mt-0.5 line-clamp-2 text-foreground">{opportunity.eligibility || 'Verify official notice'}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => saveOpportunity(opportunity)}
                          disabled={saving || saved}
                          aria-label={saved ? `${opportunity.title} saved` : `Save ${opportunity.title} to library`}
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-default"
                        >
                          {saving
                            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                            : saved
                              ? <CheckCircle2 size={14} className="text-green-400" aria-hidden="true" />
                              : <Bookmark size={14} aria-hidden="true" />}
                        </button>
                        {opportunity.source_url && (
                          <a
                            href={opportunity.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open official source for ${opportunity.title}`}
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
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <Award size={20} className="mx-auto text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 text-sm font-semibold">No records in this category</h2>
              <button type="button" onClick={() => setActiveCategory('all')} className="mt-3 text-xs font-semibold text-primary hover:underline">
                Show all opportunities
              </button>
            </div>
          )}
        </motion.div>
      )}

      {!loading && hasSearched && results.length === 0 && !searchError && (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Award size={20} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-sm font-semibold text-foreground">No official opportunities matched this search</h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
            Try a broader research area, remove a location term, or search for the project outcome rather than the technology name.
          </p>
        </div>
      )}

      {!hasSearched && !loading && (
        <section className="mt-8 border-t border-border pt-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <h2 className="text-xs font-semibold text-foreground">Official first</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">The source notice remains the authority for status, deadline, amount and eligibility.</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-foreground">Relevance, not odds</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">EYRA can organize records by qualitative fit, but it does not estimate the probability of winning.</p>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-foreground">Verify before planning</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Open the official record before committing partners, budget or application work.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function FundingSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-secondary" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-secondary/70" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-secondary/60" />
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="h-8 animate-pulse rounded bg-secondary/50" />
            <div className="h-8 animate-pulse rounded bg-secondary/50" />
            <div className="h-8 animate-pulse rounded bg-secondary/50" />
          </div>
        </div>
      ))}
      <span className="sr-only">Searching the official funding source</span>
    </div>
  );
}
