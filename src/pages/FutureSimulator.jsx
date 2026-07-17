import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
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

export default function FutureSimulator() {
  const [query, setQuery] = useState('');
  const [futures, setFutures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePath, setActivePath] = useState('growth');

  const simulate = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setFutures(null);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA Future Simulator — an advanced AI system that models possible futures for research and innovation projects.

Project/Idea: "${searchQuery}"

Simulate 3 distinct future scenarios. Output ONLY valid JSON:

{
  "project_summary": "One sentence describing the project.",
  "simulation_date": "${new Date().toISOString()}",
  "conservative": {
    "label": "Conservative Path",
    "tagline": "Safe, validated, steady growth",
    "success_probability": 72,
    "timeline": "4-6 years to impact",
    "funding_required": "$500K - $2M",
    "team_size": "3-5 people",
    "key_milestones": ["Milestone 1 at 6mo", "Milestone 2 at 18mo", "Milestone 3 at 36mo", "Milestone 4 at 60mo"],
    "top_risks": ["Risk A", "Risk B"],
    "key_strengths": ["Strength 1", "Strength 2"],
    "ideal_team": ["Role 1", "Role 2", "Role 3"],
    "funding_path": "Grants → Angel round → Series A",
    "strategic_insight": "Two sentences on why this path makes sense and what it requires to succeed."
  },
  "growth": {
    "label": "Growth Path",
    "tagline": "Balanced risk with strong momentum",
    "success_probability": 58,
    "timeline": "2-4 years to impact",
    "funding_required": "$2M - $8M",
    "team_size": "8-15 people",
    "key_milestones": ["Milestone 1 at 3mo", "Milestone 2 at 9mo", "Milestone 3 at 18mo", "Milestone 4 at 36mo"],
    "top_risks": ["Risk A", "Risk B"],
    "key_strengths": ["Strength 1", "Strength 2"],
    "ideal_team": ["Role 1", "Role 2", "Role 3", "Role 4"],
    "funding_path": "Pre-seed → Seed → Series A",
    "strategic_insight": "Two sentences on why this path makes sense and what it requires to succeed."
  },
  "aggressive": {
    "label": "Aggressive Path",
    "tagline": "High risk, high reward, fast execution",
    "success_probability": 31,
    "timeline": "12-24 months to market",
    "funding_required": "$8M - $25M",
    "team_size": "20-40 people",
    "key_milestones": ["Milestone 1 at 1mo", "Milestone 2 at 4mo", "Milestone 3 at 9mo", "Milestone 4 at 18mo"],
    "top_risks": ["Risk A", "Risk B", "Risk C"],
    "key_strengths": ["Strength 1", "Strength 2"],
    "ideal_team": ["Role 1", "Role 2", "Role 3", "Role 4", "Role 5"],
    "funding_path": "Series A → Series B fast track",
    "strategic_insight": "Two sentences on why this path makes sense and what it requires to succeed."
  },
  "eyra_recommendation": "Which path EYRA recommends and why — one clear paragraph.",
  "critical_decision": "The single most important decision that will determine which path succeeds."
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          project_summary: { type: 'string' },
          conservative: { type: 'object' },
          growth: { type: 'object' },
          aggressive: { type: 'object' },
          eyra_recommendation: { type: 'string' },
          critical_decision: { type: 'string' },
        }
      }
    });

    setFutures(result);
    setLoading(false);
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
          Simulate Your <span className="impact-gradient">Future</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Describe your idea or project. EYRA models 3 possible futures — Conservative, Growth, and Aggressive — with probabilities, team needs, funding, and timelines.
        </p>
      </div>

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
          <p className="text-sm font-semibold text-foreground mb-1">EYRA is simulating your futures...</p>
          <p className="text-xs text-muted-foreground mb-4">Modeling 3 scenarios with probability, team, funding & timeline</p>
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
                    <p className="text-[10px] text-muted-foreground">success probability</p>
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
            <RefreshCw size={11} /> Resimulate with new parameters
          </button>
        </motion.div>
      )}
    </div>
  );
}
