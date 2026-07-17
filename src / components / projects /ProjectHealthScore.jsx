import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, Shield, TrendingUp, Users, FileText, DollarSign, Zap } from 'lucide-react';
import { EyraSectionLabel } from '@/components/eyra/EyraBadge';

const DIMENSIONS = [
  { key: 'research_score', label: 'Research', icon: FileText, color: 'text-primary bg-primary/10' },
  { key: 'team_score', label: 'Team', icon: Users, color: 'text-accent bg-accent/10' },
  { key: 'funding_score', label: 'Funding', icon: DollarSign, color: 'text-amber-400 bg-amber-500/10' },
  { key: 'execution_score', label: 'Execution', icon: Zap, color: 'text-green-400 bg-green-500/10' },
  { key: 'innovation_score', label: 'Innovation', icon: TrendingUp, color: 'text-chart-5 bg-chart-5/10' },
];

function ScoreBar({ score, color }) {
  const pct = Math.max(0, Math.min(100, score || 0));
  const barColor = pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-amber-400' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground w-7 text-right">{pct}</span>
    </div>
  );
}

export default function ProjectHealthScore({ project, savedPapers, savedResearchers, meetings }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);

  const computeScore = async () => {
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA. Compute a Project Health Score for this project.

Project: ${project.title}
Goal: ${project.goal}
Description: ${project.description || 'Not provided'}
Status: ${project.status}
Has EYRA Analysis: ${!!project.eyra_analysis}
Saved Papers: ${savedPapers?.length || 0}
Saved Researchers: ${savedResearchers?.length || 0}
Meetings held: ${meetings?.length || 0}
Milestones defined: ${project.milestones ? 'Yes' : 'No'}
Tasks defined: ${project.tasks ? 'Yes' : 'No'}

Score each dimension 0-100 and give a brief verdict. Be strict — most new projects should score 20-50.

Respond as JSON:
- overall_score: number 0-100
- overall_label: "Needs Work"|"Developing"|"Good"|"Strong"|"Excellent"
- research_score: number
- team_score: number
- funding_score: number
- execution_score: number
- innovation_score: number
- top_strength: string (1 sentence)
- top_gap: string (1 sentence — the biggest missing piece)
- verdict: string (2 sentences max — honest, direct, actionable)`,
      response_json_schema: {
        type: 'object',
        properties: {
          overall_score: { type: 'number' },
          overall_label: { type: 'string' },
          research_score: { type: 'number' },
          team_score: { type: 'number' },
          funding_score: { type: 'number' },
          execution_score: { type: 'number' },
          innovation_score: { type: 'number' },
          top_strength: { type: 'string' },
          top_gap: { type: 'string' },
          verdict: { type: 'string' },
        },
      },
    });
    setScore(result);
    setLoading(false);
  };

  const overallColor = (s) => {
    if (!s) return 'text-muted-foreground';
    if (s >= 70) return 'text-green-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-destructive';
  };

  return (
    <div className="p-5 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <EyraSectionLabel label="EYRA Project Health Score" />
        <button
          onClick={computeScore}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg eyra-gradient text-white text-xs font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          {loading ? 'Computing...' : score ? 'Refresh' : 'Compute Score'}
        </button>
      </div>

      {!score && !loading && (
        <p className="text-xs text-muted-foreground">
          EYRA evaluates research readiness, team, funding, execution, and innovation across 5 dimensions.
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 size={13} className="animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">EYRA is evaluating your project...</span>
        </div>
      )}

      {score && !loading && (
        <div className="space-y-4">
          {/* Overall */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30">
            <div className="text-center flex-shrink-0">
              <p className={`text-4xl font-bold font-heading ${overallColor(score.overall_score)}`}>{score.overall_score}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">/100</p>
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold mb-1 ${overallColor(score.overall_score)}`}>{score.overall_label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{score.verdict}</p>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-2.5">
            {DIMENSIONS.map(d => {
              const Icon = d.icon;
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${d.color}`}>
                    <Icon size={10} />
                  </div>
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{d.label}</span>
                  <div className="flex-1">
                    <ScoreBar score={score[d.key]} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Strength & Gap */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl border border-green-500/20 bg-green-500/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-400 mb-1">Top Strength</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{score.top_strength}</p>
            </div>
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">Biggest Gap</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{score.top_gap}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
