import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { searchFundingOpportunities } from '@/lib/funding-api';
import {
  Search, Bookmark, Award, Loader2, DollarSign, Trophy,
  Rocket, GraduationCap, Sparkles, TrendingUp, Target,
  CheckCircle2, Filter, ExternalLink, ShieldCheck
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
];

const QUICK_SEARCHES = [
  'AI and machine learning research',
  'Climate change innovation',
  'Healthcare technology',
  'Startup funding Europe',
  'University research grants',
  'Deep tech acceleration',
];

export default function Opportunities() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sourceMeta, setSourceMeta] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [rankingError, setRankingError] = useState('');
  const { toast } = useToast();

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    setActiveCategory('all');
    setSearchError('');
    setRankingError('');
    setSourceMeta(null);
    setResults([]);

    try {
      // Retrieval first: these fields come directly from the official source.
      const sourceResult = await searchFundingOpportunities(q, 12);
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
        const ranking = await base44.integrations.Core.InvokeLLM({
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
        });

        const byId = new Map((ranking.ranked || []).map((item) => [item.id, item]));
        const ranked = verified
          .map((item) => ({ ...item, ...(byId.get(item.id) || {}) }))
          .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
        setResults(ranked);
      } catch (error) {
        setRankingError(
          `Verified opportunities loaded, but EYRA ranking is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Funding search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const saveOpportunity = async (opp) => {
    await base44.entities.SavedOpportunity.create({
      title: opp.title,
      type: opp.type,
      description: opp.description,
      deadline: opp.deadline,
    });
    toast({ title: 'Opportunity saved to library' });
  };

  const filteredResults = activeCategory === 'all'
    ? results
    : results.filter(r => r.type === activeCategory);

  const difficultyColor = { Low: 'text-green-400', Medium: 'text-amber-400', High: 'text-red-400' };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-1 text-foreground">Funding Intelligence</h1>
        <p className="text-muted-foreground text-sm">Official funding records first; EYRA then ranks their relevance to your project</p>
      </div>

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
          className="w-full h-12 pl-11 pr-36 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg eyra-gradient text-white text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center gap-2"
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
          <span>Retrieved {new Date(sourceMeta.retrieved_at).toLocaleString()}</span>
        </div>
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
                <div key={i} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${config.color}`}>
                          <Icon size={9} /> {config.label}
                        </span>
                        {opp.match_score && (
                          <span className="text-[10px] font-semibold text-primary">{opp.match_score}/10 match</span>
                        )}
                        {opp.difficulty && (
                          <span className={`text-[10px] font-medium ${difficultyColor[opp.difficulty] || 'text-muted-foreground'}`}>
                            {opp.difficulty} difficulty
                          </span>
                        )}
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
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
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
