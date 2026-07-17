import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Search, Bookmark, Award, Loader2, DollarSign, Trophy,
  Rocket, GraduationCap, Sparkles, TrendingUp, Target,
  CheckCircle2, Filter
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
  const { toast } = useToast();

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    setActiveCategory('all');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, an AI specialized in research and innovation funding intelligence.

The user is interested in: "${q}"

Find and describe 12 specific, realistic funding opportunities, grants, competitions, accelerators, scholarships, and innovation programs that would match this interest. Be specific about real program names, funding amounts, and deadlines where known.

For each opportunity provide:
- title: Specific name of the program
- type: one of "grant", "competition", "accelerator", "scholarship", "call"
- description: What it funds and who it's for (2-3 sentences)
- eligibility: Who can apply (students, startups, researchers, companies)
- typical_amount: Funding amount or benefit (e.g. "$50,000", "€200,000", "Equity + $120k")
- deadline: Approximate deadline or cycle (e.g. "Rolling", "March 2025", "Annual")
- match_score: How well it matches the query (1-10)
- difficulty: "Low" | "Medium" | "High"`,
      response_json_schema: {
        type: 'object',
        properties: {
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                eligibility: { type: 'string' },
                typical_amount: { type: 'string' },
                deadline: { type: 'string' },
                match_score: { type: 'number' },
                difficulty: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const sorted = (result.opportunities || []).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    setResults(sorted);
    setLoading(false);
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
        <p className="text-muted-foreground text-sm">EYRA discovers and ranks grants, accelerators, and competitions matched to your project</p>
      </div>

      {/* Reality disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4 max-w-2xl">
        <span className="text-amber-400 text-[11px] flex-shrink-0 mt-0.5">⚠️</span>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-amber-400">🧠 EYRA Analysis</span> — Opportunities are AI-matched based on real program knowledge. Always verify deadlines and eligibility at the official source before applying.
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

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 rounded-full eyra-gradient flex items-center justify-center mb-4 animate-pulse-glow">
            <Sparkles size={20} className="text-white" />
          </div>
          <p className="text-sm font-medium text-foreground">EYRA is matching opportunities...</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzing grants, programs, and competitions</p>
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
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{opp.description}</p>
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
                    <button
                      onClick={() => saveOpportunity(opp)}
                      className="p-2.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                      title="Save to library"
                    >
                      <Bookmark size={14} className="text-muted-foreground" />
                    </button>
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
