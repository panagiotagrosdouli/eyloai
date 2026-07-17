import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Sparkles, Loader2, Globe, Users, Building2, FlaskConical,
  DollarSign, TrendingUp, Target, ChevronRight, Search, ExternalLink, AlertCircle
} from 'lucide-react';
import { searchOpenAlexAuthors, searchOpenAlexInstitutions, searchOpenAlexWorks } from '@/lib/eyra-api';

const EXAMPLES = [
  'AI for drug discovery',
  'Large language models',
  'Quantum machine learning',
  'CRISPR gene editing',
  'Federated learning',
];

const CATEGORY_CONFIG = {
  top_researchers: { icon: Users, label: 'Real Researchers', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  leading_institutions: { icon: Building2, label: 'Real Institutions', color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  top_papers: { icon: FlaskConical, label: 'Top Papers', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  major_funders: { icon: DollarSign, label: 'Funders & Grants', color: 'text-chart-3', bg: 'bg-chart-3/10 border-chart-3/20' },
  research_gaps: { icon: Target, label: 'Research Gaps', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
};

export default function ResearchBattlefield() {
  const [query, setQuery] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('top_researchers');

  const analyze = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setReport(null);

    // Step 1: Fetch REAL data from OpenAlex
    const [researchers, institutions, papers] = await Promise.all([
      searchOpenAlexAuthors(searchQuery, 10),
      searchOpenAlexInstitutions(searchQuery, 6),
      searchOpenAlexWorks(searchQuery, 8),
    ]);

    // Step 2: AI analyzes ONLY the real data
    const researcherContext = researchers.map((r, i) =>
      `[R${i + 1}] ${r.name} — ${r.institution} — ${r.works_count} works, ${r.citation_count} citations — Areas: ${r.research_areas}`
    ).join('\n');

    const institutionContext = institutions.map((inst, i) =>
      `[I${i + 1}] ${inst.name} (${inst.country}) — ${inst.works_count} works, ${inst.cited_by_count} citations`
    ).join('\n');

    const paperContext = papers.map((p, i) =>
      `[P${i + 1}] "${p.title}" by ${p.authors} (${p.year}) — ${p.cited_by_count} citations`
    ).join('\n');

    const hasSufficientData = researchers.length > 0 || institutions.length > 0 || papers.length > 0;

    let aiAnalysis = null;
    if (hasSufficientData) {
      aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA Research Battlefield Analyzer. Analyze ONLY the real data below — do NOT invent any names, institutions, or statistics.

Field: "${searchQuery}"

REAL RESEARCHERS (from OpenAlex):
${researcherContext || 'None found'}

REAL INSTITUTIONS (from OpenAlex):
${institutionContext || 'None found'}

REAL TOP PAPERS (from OpenAlex):
${paperContext || 'None found'}

Based ONLY on this real data:

1. field_summary: 2 sentences about the field based on what the data shows
2. competition_level: "Highly Competitive"|"Competitive"|"Emerging"|"Limited Data" (base on how many results were found)
3. maturity: "Early Stage"|"Growing"|"Mature" (based on publication years in the data)
4. opportunity_score: 1-100 based on the gap between citation counts and research coverage
5. trend_direction: "Rising"|"Stable"|"Declining" (based on recency of papers)
6. research_gaps: array of 3-4 specific gaps visible from what the papers DO NOT cover (based on the real papers found). Each as a string.
7. major_funders: array of 4-5 REAL funding programs suitable for this field. Only use real program names (Horizon Europe, NSF, NIH, ERC, Wellcome Trust, etc.). Each: {name, type, focus, typical_amount}
8. key_trends: array of 3-4 trends visible from the real paper titles and years
9. strategic_entry_points: one paragraph on where opportunity exists based on the real data gaps
10. eyra_verdict: one honest sentence summarizing the competitive landscape`,
        response_json_schema: {
          type: 'object',
          properties: {
            field_summary: { type: 'string' },
            competition_level: { type: 'string' },
            maturity: { type: 'string' },
            opportunity_score: { type: 'number' },
            trend_direction: { type: 'string' },
            research_gaps: { type: 'array', items: { type: 'string' } },
            major_funders: { type: 'array' },
            key_trends: { type: 'array', items: { type: 'string' } },
            strategic_entry_points: { type: 'string' },
            eyra_verdict: { type: 'string' },
          },
        },
      });
    }

    setReport({
      researchers,
      institutions,
      papers,
      ...(aiAnalysis || {}),
      has_data: hasSufficientData,
    });
    setLoading(false);
  };

  const competitionColor = {
    'Highly Competitive': 'text-red-400 bg-red-500/10 border-red-500/20',
    'Competitive': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    'Emerging': 'text-green-400 bg-green-500/10 border-green-500/20',
    'Limited Data': 'text-muted-foreground bg-secondary border-border',
  };

  const trendColor = { Rising: 'text-green-400', Stable: 'text-primary', Declining: 'text-red-400' };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg eyra-gradient flex items-center justify-center">
            <Globe size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Research Battlefield</span>
        </div>
        <h1 className="font-heading font-black text-2xl sm:text-3xl mb-2 text-foreground">
          Global <span className="impact-gradient">Intelligence Map</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Real researchers, institutions, and papers from OpenAlex — analyzed by EYRA. No invented names.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <form onSubmit={e => { e.preventDefault(); analyze(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Globe size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter a research field, technology, or topic..."
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button type="submit" disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Map Field
          </button>
        </form>
        {!report && !loading && (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => analyze(ex)} className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mb-5 animate-pulse-glow">
            <Globe size={26} className="text-white" />
          </div>
          <p className="text-sm font-semibold mb-1">Fetching real data from OpenAlex...</p>
          <p className="text-xs text-muted-foreground">Researchers, institutions, and papers — then EYRA analyzes</p>
          <div className="flex gap-1.5 mt-4">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      {report && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

          {/* Data source notice */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/15 bg-primary/5">
            <AlertCircle size={12} className="text-primary flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Data sourced from <span className="text-primary font-medium">OpenAlex</span> — {report.researchers.length} researchers, {report.institutions.length} institutions, {report.papers.length} papers found.
            </p>
          </div>

          {!report.has_data && (
            <div className="p-5 rounded-xl border border-border bg-card text-center">
              <p className="text-sm text-muted-foreground">No data found in OpenAlex for this query. Try a broader or different search term.</p>
            </div>
          )}

          {report.has_data && (
            <>
              {/* Overview bar */}
              {report.competition_level && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-3 rounded-xl border text-center ${competitionColor[report.competition_level] || 'text-muted-foreground border-border bg-secondary'}`}>
                    <p className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">Competition</p>
                    <p className="text-xs font-bold">{report.competition_level}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-card text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Maturity</p>
                    <p className="text-xs font-bold text-foreground">{report.maturity || '—'}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-green-500/20 bg-green-500/10 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Opportunity</p>
                    <p className="text-xl font-black text-green-400">{report.opportunity_score || '—'}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-card text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Trend</p>
                    <p className={`text-xs font-bold ${trendColor[report.trend_direction] || 'text-foreground'}`}>
                      {report.trend_direction === 'Rising' ? '↑' : report.trend_direction === 'Declining' ? '↓' : '→'} {report.trend_direction || '—'}
                    </p>
                  </div>
                </div>
              )}

              {report.field_summary && (
                <div className="p-4 rounded-xl border border-border/60 bg-secondary/20">
                  <p className="text-sm text-foreground/80 leading-relaxed">{report.field_summary}</p>
                </div>
              )}

              {/* Category tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setActiveCategory(key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                        activeCategory === key ? `${cfg.bg} ${cfg.color}` : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                      }`}>
                      <Icon size={11} /> {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Category content — all REAL data */}
              <div className="space-y-3">
                {activeCategory === 'top_researchers' && (
                  report.researchers.length > 0 ? report.researchers.map((r, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
                      <div className="w-9 h-9 rounded-full eyra-gradient flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">{i + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-foreground">{r.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{r.citation_count.toLocaleString()} citations</span>
                        </div>
                        <p className="text-xs text-primary mb-0.5">{r.institution}</p>
                        <p className="text-xs text-muted-foreground mb-1">{r.research_areas}</p>
                        <p className="text-[10px] text-muted-foreground">{r.works_count} publications</p>
                      </div>
                      <a href={r.profile_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0">
                        <ExternalLink size={11} className="text-muted-foreground" />
                      </a>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-6">No researchers found for this query in OpenAlex.</p>
                )}

                {activeCategory === 'leading_institutions' && (
                  report.institutions.length > 0 ? report.institutions.map((inst, i) => (
                    <div key={i} className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{inst.name}</p>
                          <p className="text-xs text-muted-foreground">{inst.country} · {inst.type}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold flex-shrink-0">{inst.works_count.toLocaleString()} works</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{inst.cited_by_count.toLocaleString()} total citations</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-6">No institutions found for this query in OpenAlex.</p>
                )}

                {activeCategory === 'top_papers' && (
                  report.papers.length > 0 ? report.papers.map((p, i) => (
                    <div key={i} className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-semibold text-foreground line-clamp-2">{p.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-semibold flex-shrink-0">{p.cited_by_count} citations</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">{p.authors?.slice(0, 80)} · {p.year}</p>
                      {p.summary && <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{p.summary}</p>}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[10px] text-primary hover:underline">
                          View paper <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-6">No papers found for this query.</p>
                )}

                {activeCategory === 'major_funders' && (
                  (report.major_funders || []).length > 0 ? report.major_funders.map((f, i) => (
                    <div key={i} className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.type} · {f.focus}</p>
                        </div>
                        {f.typical_amount && <p className="text-xs font-bold text-chart-3 flex-shrink-0">{f.typical_amount}</p>}
                      </div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-6">Run analysis to see funding recommendations.</p>
                )}

                {activeCategory === 'research_gaps' && (
                  (report.research_gaps || []).length > 0 ? report.research_gaps.map((gap, i) => (
                    <div key={i} className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                      <p className="text-sm text-foreground flex items-start gap-2">
                        <ChevronRight size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                        {gap}
                      </p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-6">Research gaps identified from real paper analysis will appear here.</p>
                )}
              </div>

              {/* Trends + entry points */}
              {(report.key_trends?.length > 0 || report.strategic_entry_points) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {report.key_trends?.length > 0 && (
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <TrendingUp size={10} /> Key Trends (from real papers)
                      </p>
                      <div className="space-y-1.5">
                        {report.key_trends.map((t, i) => (
                          <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                            <ChevronRight size={11} className="text-primary mt-0.5 flex-shrink-0" /> {t}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.strategic_entry_points && (
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                        <Sparkles size={10} /> Strategic Entry Points
                      </p>
                      <p className="text-xs text-foreground/80 leading-relaxed">{report.strategic_entry_points}</p>
                    </div>
                  )}
                </div>
              )}

              {report.eyra_verdict && (
                <div className="p-4 rounded-xl border border-border/60 bg-secondary/20 flex items-start gap-3">
                  <Sparkles size={13} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground/80 italic">"{report.eyra_verdict}"</p>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
