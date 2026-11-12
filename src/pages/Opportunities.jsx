import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { searchFundingOpportunities } from '@/lib/funding-api';
import { getFundingComparisonRecords, toggleFundingComparisonSelection } from '@/lib/funding-comparison.mjs';
import { promiseWithTimeout } from '@/lib/promise-timeout';
import {
  Bookmark, Award, Loader2, DollarSign, Trophy,
  Rocket, GraduationCap, Sparkles,
  ExternalLink, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const TYPE_CONFIG = {
  grant: { icon: DollarSign, color: 'bg-primary/15 text-primary', label: 'Grant' },
  competition: { icon: Trophy, color: 'bg-amber-500/15 text-amber-400', label: 'Competition' },
  accelerator: { icon: Rocket, color: 'bg-green-500/15 text-green-400', label: 'Accelerator' },
  scholarship: { icon: GraduationCap, color: 'bg-accent/15 text-accent', label: 'Scholarship' },
  call: { icon: Award, color: 'bg-chart-3/15 text-chart-3', label: 'Call' },
};

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'grant', label: 'Grants' },
  { key: 'competition', label: 'Competitions' },
  { key: 'accelerator', label: 'Accelerators' },
  { key: 'scholarship', label: 'Scholarships' },
  { key: 'call', label: 'Calls' },
];

const QUICK_SEARCHES = [
  'AI and machine learning research',
  'Climate change innovation',
  'Healthcare technology',
  'Startup funding Europe',
  'University research grants',
  'Deep tech acceleration',
];

const FUNDING_SEARCH_TIMEOUT_MS = 20_000;
const EYRA_RANKING_TIMEOUT_MS = 15_000;

export default function Opportunities() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sourceMeta, setSourceMeta] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [rankingError, setRankingError] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('all');
  const [fieldFilter, setFieldFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [comparisonIds, setComparisonIds] = useState([]);
  const searchSequence = useRef(0);
  const searchController = useRef(null);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const term = searchParams.get('q');
    if (term) handleSearch(term);
  }, [searchParams]);

  useEffect(() => () => {
    searchSequence.current += 1;
    searchController.current?.abort();
  }, []);

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    searchController.current?.abort();
    const requestId = ++searchSequence.current;
    const controller = new AbortController();
    searchController.current = controller;
    const sourceTimeout = setTimeout(() => {
      controller.abort(new DOMException('Funding source request timed out.', 'TimeoutError'));
    }, FUNDING_SEARCH_TIMEOUT_MS);
    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    setActiveCategory('all');
    setSearchError('');
    setRankingError('');
    setSourceMeta(null);
    setResults([]);
    setComparisonIds([]);

    try {
      // Retrieval first: these fields come directly from the official source.
      const sourceResult = await searchFundingOpportunities(q, 12, { signal: controller.signal });
      clearTimeout(sourceTimeout);
      if (requestId !== searchSequence.current) return;
      setSourceMeta(sourceResult);

      const verified = sourceResult.items.map((item) => ({
        ...item,
        typical_amount: item.amount,
        match_score: null,
        match_reason: '',
        difficulty: 'Unranked',
      }));
      setResults(verified);

      if (verified.length === 0) return;

      try {
        // AI may rank and explain verified records, but cannot create or rewrite them.
        const ranking = await promiseWithTimeout(base44.integrations.Core.InvokeLLM({
          prompt: `You are EYRA Funding Intelligence. Rank ONLY the verified funding records below for this user query.

USER QUERY: "${q}"
RETRIEVED AT: ${sourceResult.retrieved_at}
OFFICIAL SOURCE: ${sourceResult.source}

VERIFIED RECORDS:
${verified.map((item) => JSON.stringify({
  id: item.id,
  title: item.title,
  agency: item.agency,
  description: item.description,
  eligibility: item.eligibility,
  deadline: item.deadline,
  amount: item.amount,
  categories: item.categories,
})).join('\n')}

Return one ranking object for every supplied id. Do not add opportunities or change factual fields. match_score measures relevance to the query, not probability of winning. difficulty is an eligibility/application-complexity assessment.`,
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
                    id: { type: 'string', enum: verified.map((item) => item.id) },
                    match_score: { type: 'number', minimum: 0, maximum: 100 },
                    match_reason: { type: 'string' },
                    difficulty: { type: 'string', enum: ['Low', 'Medium', 'High'] },
                  },
                },
              },
            },
          },
          signal: controller.signal,
        }), EYRA_RANKING_TIMEOUT_MS, 'EYRA ranking timed out.', () => controller.abort());

        if (requestId !== searchSequence.current) return;

        const byId = new Map((ranking.ranked || []).map((item) => [item.id, item]));
        const ranked = verified
          .map((item) => ({ ...item, ...(byId.get(item.id) || {}) }))
          .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
        setResults(ranked);
      } catch (error) {
        if (requestId === searchSequence.current) {
          setRankingError(
            `Verified opportunities loaded, but EYRA ranking is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }
    } catch (error) {
      if (requestId === searchSequence.current) {
        setSearchError(controller.signal.aborted
          ? 'Funding search timed out or was cancelled. Please retry.'
          : error instanceof Error ? error.message : 'Funding search failed.');
        setResults([]);
      }
    } finally {
      clearTimeout(sourceTimeout);
      if (requestId === searchSequence.current) {
        if (searchController.current === controller) searchController.current = null;
        setLoading(false);
      }
    }
  };

  const saveOpportunity = async (opp) => {
    const sourceId = opp.source_id || opp.id || opp.source_url || opp.url || opp.title;
    const projectId = searchParams.get('project_id');
    try {
      const project = projectId ? await base44.entities.Project.get(projectId) : null;
      let existing = null;
      try {
        const matches = await base44.entities.SavedOpportunity.filter({ source_id: sourceId }, '-created_date', 1);
        existing = Array.isArray(matches) ? matches.find(item => item.source_id === sourceId) || matches[0] : null;
      } catch {
        // Continue with a new library record if the duplicate lookup is unavailable.
      }
      if (existing) {
        if (project && existing.project_id && existing.project_id !== project.id) {
          toast({ title: 'Already linked to another project', description: 'The opportunity was left in its current project.' });
          return;
        }
        if (project && !existing.project_id) {
          await base44.entities.SavedOpportunity.update(existing.id, { project_id: project.id, project_title: project.title || '' });
          toast({ title: `Added to ${project.title || 'project'}`, description: 'Opportunity saved to your Library.' });
          return;
        }
        toast({ title: project ? 'Already in this project' : 'Opportunity already in Library' });
        return;
      }
      await base44.entities.SavedOpportunity.create({
        title: opp.title,
        type: opp.type,
        description: opp.description,
        source: opp.source || sourceMeta?.source,
        source_id: sourceId,
        url: opp.source_url || opp.url,
        source_url: opp.source_url || opp.url,
        agency: opp.agency,
        eligibility: opp.eligibility,
        country: opp.country || '',
        categories: opp.categories || [],
        deadline: opp.deadline,
        deadline_days: opp.deadline_days,
        amount: opp.amount,
        status: opp.status,
        ...(project ? { project_id: project.id, project_title: project.title || '' } : {}),
      });
      toast({ title: project ? `Added to ${project.title || 'project'}` : 'Opportunity saved to library' });
    } catch (error) {
      toast({
        title: 'Could not save this opportunity',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const filteredResults = results.filter((record) => {
    const categoryMatch = activeCategory === 'all' || record.type === activeCategory;
    const expired = record.deadline_days !== null && record.deadline_days < 0;
    const deadlineMatch = deadlineFilter === 'all' || (deadlineFilter === 'expired' ? expired : !expired);
    const terms = [record.title, record.description, ...(record.categories || [])].join(' ').toLowerCase();
    const fieldMatch = !fieldFilter.trim() || terms.includes(fieldFilter.trim().toLowerCase());
    const countryMatch = !countryFilter.trim() || String(record.country || record.eligibility || '').toLowerCase().includes(countryFilter.trim().toLowerCase());
    return categoryMatch && deadlineMatch && fieldMatch && countryMatch;
  });

  const difficultyColor = { Low: 'text-green-400', Medium: 'text-amber-400', High: 'text-red-400' };
  const comparisonRecords = getFundingComparisonRecords(results, comparisonIds);
  const comparisonFields = [
    ['agency', 'Agency / programme'],
    ['status', 'Status'],
    ['deadline', 'Deadline'],
    ['eligibility', 'Eligibility'],
    ['amount', 'Funding amount'],
    ['country', 'Country / region'],
    ['categories', 'Research fields'],
  ];
  const comparisonValue = (record, field) => {
    const value = field === 'categories' ? (record.categories || []).join(', ') : record[field];
    return typeof value === 'string' && value.trim() ? value : 'Not provided by source';
  };

  return (
    <div className="eylo-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="eylo-page-heading">Funding</h1>
      </div>
      {searchParams.get('project_id') && (
        <div className="mb-5 max-w-2xl rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-foreground">
          Searching for <strong>{searchParams.get('project_title') || 'your project'}</strong>. Saved opportunities are added to this project and your Library.
        </div>
      )}

      {/* Source contract */}
      <div className="flex items-start gap-2 p-3 rounded-xl border border-green-500/20 bg-green-500/5 mb-4 max-w-2xl">
        <ShieldCheck size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Opportunity names, agencies, statuses and deadlines are retrieved from the official source. EYRA only ranks relevance and explains fit. Always open the source record before applying.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="relative max-w-2xl mb-4">
        <Sparkles size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Describe your research area or project goal..."
          aria-label="Funding search"
          className="w-full h-12 pl-11 pr-36 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center gap-2"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          Find
        </button>
      </form>

      {/* Quick search chips */}
      {!hasSearched && (
        <div className="flex flex-wrap gap-2 mb-8">
          {QUICK_SEARCHES.map(qs => (
            <button
              key={qs}
              onClick={() => handleSearch(qs)}
              className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              {qs}
            </button>
          ))}
        </div>
      )}

      {searchError && (
        <div role="alert" className="mb-5 max-w-2xl rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {searchError}
        </div>
      )}

      {rankingError && (
        <div role="status" className="mb-5 max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          {rankingError}
        </div>
      )}

      {sourceMeta && !loading && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded-full border border-green-500/20 bg-green-500/5 px-2 py-1 text-green-300">
            {results.length} verified records
          </span>
          <span>Source: {sourceMeta.source}</span>
          {sourceMeta.partial_results && <span className="text-amber-300">One official provider was unavailable; results may be incomplete.</span>}
          <span>Retrieved {new Date(sourceMeta.retrieved_at).toLocaleString()}</span>
        </div>
      )}

      {hasSearched && !loading && results.length > 0 && <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <select value={deadlineFilter} onChange={(event) => setDeadlineFilter(event.target.value)} aria-label="Filter calls by deadline" className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground">
          <option value="all">All deadlines</option><option value="active">Not expired / deadline unknown</option><option value="expired">Expired</option>
        </select>
        <input value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)} placeholder="Filter by research field" aria-label="Filter by research field" className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground" />
        <input value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} placeholder="Filter by country or eligibility" aria-label="Filter by country" className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-foreground" />
      </div>}

      {comparisonRecords.length > 0 && (
        <section aria-labelledby="funding-comparison-heading" className="mb-6 overflow-hidden rounded-xl border border-primary/25 bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 id="funding-comparison-heading" className="text-sm font-semibold text-foreground">Compare official opportunities</h2>
              <p className="mt-1 text-[11px] text-muted-foreground">Source-provided fields only. Missing values are marked explicitly.</p>
            </div>
            <button type="button" onClick={() => setComparisonIds([])} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              Clear
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th scope="col" className="w-36 p-3 text-muted-foreground">Field</th>
                  {comparisonRecords.map((record) => (
                    <th scope="col" key={record.id} className="min-w-52 border-l border-border p-3 align-top">
                      <div className="font-semibold text-foreground">{record.title}</div>
                      <a href={record.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
                        Open official source <ExternalLink size={11} />
                      </a>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFields.map(([field, label]) => (
                  <tr key={field} className="border-t border-border">
                    <th scope="row" className="p-3 font-medium text-muted-foreground">{label}</th>
                    {comparisonRecords.map((record) => (
                      <td key={record.id} className="border-l border-border p-3 align-top text-foreground">
                        {comparisonValue(record, field)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full eyra-gradient flex items-center justify-center mb-4 animate-pulse-glow">
            <Sparkles size={20} className="text-white" />
          </div>
          <p className="text-sm font-medium text-foreground">Searching the official funding database...</p>
          <p className="text-xs text-muted-foreground mt-1">Retrieving active records, then EYRA ranks their relevance</p>
        </div>
      )}

      {!loading && hasSearched && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Category filter */}
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeCategory === c.key
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                }`}
              >
                {c.label}
                {c.key !== 'all' && (
                  <span className="ml-1.5 opacity-50">{results.filter(r => r.type === c.key).length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredResults.map((opp, i) => {
              const config = TYPE_CONFIG[opp.type] || TYPE_CONFIG.call;
              const Icon = config.icon;
              return (
                <div key={opp.id || i} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${config.color}`}>
                          <Icon size={9} /> {config.label}
                        </span>
                        {Number.isFinite(opp.match_score) && (
                          <span className="text-[10px] font-semibold text-primary">{Math.round(opp.match_score)}/100 relevance</span>
                        )}
                        {opp.difficulty && (
                          <span className={`text-[10px] font-medium ${difficultyColor[opp.difficulty] || 'text-muted-foreground'}`}>
                            {opp.difficulty} difficulty
                          </span>
                        )}
                        {opp.deadline_days !== null && opp.deadline_days < 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">Expired</span>}
                        {opp.country && <span className="text-[10px] text-muted-foreground">{opp.country}</span>}
                      </div>
                      <h4 className="font-semibold text-sm text-foreground mb-1">{opp.title}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{opp.description || 'Open the official record for the full announcement.'}</p>
                      {opp.match_reason && <p className="text-[11px] text-primary/90 mb-3"><span className="font-semibold">EYRA fit:</span> {opp.match_reason}</p>}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        {opp.eligibility && (
                          <span><span className="font-medium text-foreground">Eligible:</span> {opp.eligibility}</span>
                        )}
                        {opp.typical_amount && (
                          <span className="text-primary font-semibold">{opp.typical_amount}</span>
                        )}
                        {opp.deadline && (
                          <span><span className="font-medium text-foreground">Deadline:</span> {opp.deadline}</span>
                        )}
                        {opp.categories?.length > 0 && <span><span className="font-medium text-foreground">Field:</span> {opp.categories.join(', ')}</span>}
                        {opp.agency && <span><span className="font-medium text-foreground">Organization:</span> {opp.agency}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const next = toggleFundingComparisonSelection(comparisonIds, opp.id);
                          if (next === null) {
                            toast({ title: 'Comparison limit reached', description: 'Compare up to three opportunities at a time.' });
                          } else {
                            setComparisonIds(next);
                          }
                        }}
                        disabled={!comparisonIds.includes(opp.id) && comparisonIds.length >= 3}
                        aria-pressed={comparisonIds.includes(opp.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${comparisonIds.includes(opp.id) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {comparisonIds.includes(opp.id) ? 'Remove comparison' : 'Compare'}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveOpportunity(opp)}
                        className="p-2.5 rounded-lg hover:bg-secondary transition-colors"
                        title="Save to library"
                      >
                        <Bookmark size={14} className="text-muted-foreground" />
                      </button>
                      <a
                        href={opp.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg hover:bg-secondary transition-colors"
                        title="Open official source"
                      >
                        <ExternalLink size={14} className="text-primary" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Award size={24} className="text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No opportunities found. Try a different search.</p>
        </div>
      )}

      {!hasSearched && !loading && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { icon: DollarSign, title: 'Research Grants', desc: 'Government and foundation funding for academic research', color: 'text-primary' },
            { icon: Rocket, title: 'Accelerators', desc: 'Equity + mentorship for early-stage startups and spinouts', color: 'text-green-400' },
            { icon: Trophy, title: 'Competitions', desc: 'Innovation challenges with prizes and visibility', color: 'text-amber-400' },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="p-5 rounded-xl border border-border bg-card">
                <Icon size={18} className={`${c.color} mb-3`} />
                <h4 className="font-semibold text-sm text-foreground mb-1">{c.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
