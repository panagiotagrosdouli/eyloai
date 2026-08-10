import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchAllPapers } from '@/lib/eyra-api';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles, Loader2, TrendingUp, Zap, Rocket, ChevronRight,
  Users, DollarSign, Calendar, AlertTriangle, Target, RefreshCw
} from 'lucide-react';

const PATHS = [
  {
    key: 'conservative',
    label: 'Conservative Path',
    icon: TrendingUp,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/25',
    glow: 'border-primary/40',
    desc: 'Safe, steady, validated approach',
  },
  {
    key: 'growth',
    label: 'Growth Path',
    icon: Zap,
    color: 'text-accent',
    bg: 'bg-accent/10 border-accent/25',
    glow: 'border-accent/40',
    desc: 'Balanced risk with strong momentum',
  },
  {
    key: 'aggressive',
    label: 'Aggressive Path',
    icon: Rocket,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/25',
    glow: 'border-amber-500/40',
    desc: 'High risk, high reward, fast execution',
  },
];

const EXAMPLES = [
  'AI-powered early cancer detection platform',
  'Federated learning for privacy-preserving healthcare',
  'Quantum cryptography startup',
  'Carbon capture technology company',
  'EdTech platform for personalized learning',
];

const scenarioSchema = () => ({
  type: 'object',
  properties: {
    label: { type: 'string' },
    tagline: { type: 'string' },
    success_probability: { type: 'number', minimum: 0, maximum: 100 },
    timeline: { type: 'string' },
    funding_required: { type: 'string' },
    team_size: { type: 'string' },
    key_milestones: { type: 'array', items: { type: 'string' } },
    top_risks: { type: 'array', items: { type: 'string' } },
    key_strengths: { type: 'array', items: { type: 'string' } },
    ideal_team: { type: 'array', items: { type: 'string' } },
    funding_path: { type: 'string' },
    strategic_insight: { type: 'string' },
  },
});

export default function FutureSimulator() {
  const [query, setQuery] = useState('');
  const [futures, setFutures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePath, setActivePath] = useState('growth');
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [simulationError, setSimulationError] = useState('');

  const simulate = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setFutures(null);
    setSimulationError('');

    try {
      const papers = await searchAllPapers(searchQuery);
      setEvidenceCount(papers.length);
      const evidenceContext = papers.slice(0, 10).map((paper, index) =>
        `[P${index + 1}] "${paper.title}" — ${paper.authors || 'Unknown'} (${paper.year || 'n/a'}) — ${paper.cited_by_count || 0} citations — ${paper.url}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA Scenario Planner.

PROJECT OR IDEA: "${searchQuery}"

VERIFIED SCHOLARLY RECORDS:
${evidenceContext || 'No matching records were retrieved.'}

Build three conditional planning scenarios: conservative, growth, and aggressive.

Important:
- These are scenarios, not forecasts or guarantees.
- The JSON field success_probability is retained for interface compatibility, but its value must mean model-assessed feasibility (0-100), not empirical probability.
- Base research claims only on supplied [P] records.
- Funding, timelines, team sizes and milestones are planning estimates. Label uncertainty in strategic_insight.
- Do not invent specific grants, deadlines, researchers, customers or market statistics.

Return project_summary, conservative, growth, aggressive, eyra_recommendation, and critical_decision. Each scenario needs label, tagline, success_probability, timeline, funding_required, team_size, key_milestones, top_risks, key_strengths, ideal_team, funding_path, and strategic_insight.`,
        response_json_schema: {
          type: 'object',
          properties: {
            project_summary: { type: 'string' },
            conservative: scenarioSchema(),
            growth: scenarioSchema(),
            aggressive: scenarioSchema(),
            eyra_recommendation: { type: 'string' },
            critical_decision: { type: 'string' },
          },
        },
      });

      setFutures(result);
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : 'Scenario analysis did not complete.');
    } finally {
      setLoading(false);
    }
  };

  const activeFuture = futures?.[activePath];
  const pathConfig = PATHS.find(p => p.key === activePath);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg eyra-gradient flex items-center justify-center">
            <Rocket size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">EYRA Future Simulator</span>
        </div>
        <h1 className="font-heading font-black text-2xl sm:text-3xl mb-2 text-foreground">
          Explore Your <span className="impact-gradient">Scenarios</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Describe your idea or project. EYRA retrieves relevant research and builds three conditional planning paths with assumptions, risks, resources, and milestones.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-muted-foreground">
        Scenario scores are model-assessed feasibility estimates, not statistical probabilities or guarantees.
      </div>
      {simulationError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {simulationError}
        </div>
      )}

      {/* Input */}
      <div className="mb-6">
        <form onSubmit={e => { e.preventDefault(); simulate(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Sparkles size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Describe your project or startup idea..."
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Simulate
          </button>
        </form>

        {!futures && !loading && (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => simulate(ex)}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
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
            <Rocket size={26} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">EYRA is building evidence-informed scenarios...</p>
          <p className="text-xs text-muted-foreground mb-4">Retrieving scholarly records, then mapping assumptions, risks and milestones</p>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {futures && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-[11px] text-muted-foreground">
            <Target size={11} className="text-green-400" />
            Scenario analysis used {evidenceCount} retrieved scholarly records. Resource and feasibility values remain planning estimates.
          </div>

          {/* Project summary */}
          <div className="p-4 rounded-xl border border-border/60 bg-secondary/20 flex items-start gap-3">
            <Target size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground/80">{futures.project_summary}</p>
          </div>

          {/* Path selector */}
          <div className="grid grid-cols-3 gap-3">
            {PATHS.map(path => {
              const Icon = path.icon;
              const data = futures[path.key];
              const isActive = activePath === path.key;
              return (
                <button
                  key={path.key}
                  onClick={() => setActivePath(path.key)}
                  className={`p-4 rounded-xl border text-left transition-all ${isActive ? `${path.bg} ${path.glow}` : 'border-border bg-card hover:border-border/80'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className={isActive ? path.color : 'text-muted-foreground'} />
                    <span className={`text-xs font-bold ${isActive ? path.color : 'text-muted-foreground'}`}>{path.label}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="text-[10px] text-muted-foreground leading-tight">{path.desc}</p>
                    <span className={`text-xl font-black ${isActive ? path.color : 'text-muted-foreground'}`}>
                      {data?.success_probability}%
                    </span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${path.key === 'conservative' ? 'bg-primary' : path.key === 'growth' ? 'bg-accent' : 'bg-amber-400'}`}
                      style={{ width: `${data?.success_probability}%`, transition: 'width 0.8s ease' }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active path detail */}
          {activeFuture && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activePath}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-5 rounded-2xl border ${pathConfig.bg} ${pathConfig.glow}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest ${pathConfig.color}`}>{activeFuture.label}</p>
                    <p className="text-[10px] text-muted-foreground">{activeFuture.tagline}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black ${pathConfig.color}`}>{activeFuture.success_probability}%</p>
                    <p className="text-[10px] text-muted-foreground">feasibility estimate</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { icon: Calendar, label: 'Timeline', value: activeFuture.timeline },
                    { icon: DollarSign, label: 'Funding', value: activeFuture.funding_required },
                    { icon: Users, label: 'Team Size', value: activeFuture.team_size },
                    { icon: TrendingUp, label: 'Funding Path', value: activeFuture.funding_path },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="p-3 rounded-xl bg-background/40 border border-white/5">
                        <Icon size={11} className={`${pathConfig.color} mb-1`} />
                        <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                        <p className="text-xs font-semibold text-foreground leading-tight">{item.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  {/* Milestones */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Milestones</p>
                    <div className="space-y-1.5">
                      {activeFuture.key_milestones?.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${pathConfig.key === 'conservative' ? 'bg-primary' : pathConfig.key === 'growth' ? 'bg-accent' : 'bg-amber-400'}`}>{i + 1}</div>
                          <p className="text-xs text-foreground/80">{m}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team + Risks */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ideal Team</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeFuture.ideal_team?.map((r, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-secondary/50 text-muted-foreground">{r}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                        <AlertTriangle size={9} /> Top Risks
                      </p>
                      <div className="space-y-1">
                        {activeFuture.top_risks?.map((r, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5">·</span> {r}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {activeFuture.strategic_insight && (
                  <div className="p-3 rounded-xl bg-background/40 border border-white/5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">EYRA Strategic Insight</p>
                    <p className="text-sm text-foreground/85 leading-relaxed">{activeFuture.strategic_insight}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* EYRA Recommendation */}
          <div className="grid sm:grid-cols-2 gap-4">
            {futures.eyra_recommendation && (
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={13} className="text-primary" />
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">EYRA Recommends</span>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed">{futures.eyra_recommendation}</p>
              </div>
            )}
            {futures.critical_decision && (
              <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Critical Decision</span>
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed">{futures.critical_decision}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => simulate()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <RefreshCw size={11} /> Rebuild scenarios with new parameters
          </button>
        </motion.div>
      )}
    </div>
  );
}
