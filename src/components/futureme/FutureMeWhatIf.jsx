import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, TrendingUp, AlertTriangle, CheckCircle2, BarChart2 } from 'lucide-react';
import { motion } from 'framer-motion';

const WHATIF_EXAMPLES = [
  'What if I publish 2 papers this year?',
  'What if I join a startup?',
  'What if I complete a master\'s degree?',
  'What if I apply for an ERC grant?',
  'What if I collaborate with 3 researchers?',
  'What if I build an open-source project?',
  'What if I attend a major conference?',
  'What if I get a PhD position?',
];

export default function FutureMeWhatIf({ profile, goal }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const simulate = async (q) => {
    const question = q || query;
    if (!question.trim()) return;
    setQuery(question);
    setLoading(true);
    setResult(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA What-If Simulator. A researcher asks you to simulate a possible future action.

Their current goal: "${goal.text}" (timeframe: ${goal.timeframe})
Their activity score: ${profile.stats.activityScore}/100
Projects: ${profile.stats.projects}, Papers: ${profile.stats.papers}, Researchers: ${profile.stats.researchers}

WHAT IF QUESTION: "${question}"

Simulate the impact of this action on their journey toward their goal. Be realistic, specific, and honest.

Respond as JSON:
{
  "summary": "2-3 sentence direct answer to what would happen",
  "probability": number (0-100, likelihood this leads to positive outcome),
  "impact_level": "transformative|high|medium|low",
  "benefits": ["benefit 1", "benefit 2", "benefit 3"],
  "risks": ["risk 1", "risk 2"],
  "timeline_change": "How this would affect their ${goal.timeframe} timeline (speeds up / slows down / no change + explanation)",
  "recommended_actions": ["specific action 1", "specific action 2", "specific action 3"],
  "eyra_verdict": "One clear sentence — EYRA's honest recommendation on whether to pursue this"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          probability: { type: 'number' },
          impact_level: { type: 'string' },
          benefits: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          timeline_change: { type: 'string' },
          recommended_actions: { type: 'array', items: { type: 'string' } },
          eyra_verdict: { type: 'string' },
        }
      }
    });

    setResult(res);
    setLoading(false);
  };

  const impactColor = {
    transformative: 'text-primary',
    high: 'text-green-400',
    medium: 'text-amber-400',
    low: 'text-muted-foreground',
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">What If Simulator</p>
        <p className="text-xs text-muted-foreground">Ask EYRA to simulate any action or decision and see how it would affect your path to <span className="text-foreground/70">{goal.text}</span>.</p>
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); simulate(); }} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="What if I...?"
          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Simulate
        </button>
      </form>

      {/* Examples */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {WHATIF_EXAMPLES.map(ex => (
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-6">
          <Loader2 size={16} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">EYRA is simulating this scenario...</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Header */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Simulating: "{query}"</p>
            <p className="text-sm text-foreground/85 leading-relaxed mb-3">{result.summary}</p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[9px] text-muted-foreground">Success Probability</p>
                <p className="text-2xl font-black text-primary">{result.probability}%</p>
              </div>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full eyra-gradient" style={{ width: `${result.probability}%` }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground">Impact</p>
                <p className={`text-xs font-bold uppercase ${impactColor[result.impact_level] || 'text-muted-foreground'}`}>{result.impact_level}</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* Benefits */}
            <div className="p-4 rounded-xl border border-green-400/20 bg-green-400/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-2">Benefits</p>
              <div className="space-y-1.5">
                {result.benefits?.map((b, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={10} className="text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{b}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks */}
            <div className="p-4 rounded-xl border border-rose-400/20 bg-rose-400/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-2">Risks</p>
              <div className="space-y-1.5">
                {result.risks?.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle size={10} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/80">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline impact */}
          <div className="p-4 rounded-xl border border-border bg-card flex items-start gap-3">
            <BarChart2 size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Timeline Impact</p>
              <p className="text-xs text-foreground/80">{result.timeline_change}</p>
            </div>
          </div>

          {/* EYRA Verdict */}
          {result.eyra_verdict && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
              <Sparkles size={13} className="text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">EYRA Verdict</p>
                <p className="text-sm text-foreground/85 font-medium">{result.eyra_verdict}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {result.recommended_actions?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Recommended Actions</p>
              <div className="space-y-1.5">
                {result.recommended_actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-card border border-border">
                    <span className="text-[10px] font-bold text-primary mt-0.5">{i + 1}.</span>
                    <p className="text-xs text-foreground/80">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setResult(null); setQuery(''); }}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ← Try another scenario
          </button>
        </motion.div>
      )}
    </div>
  );
}
