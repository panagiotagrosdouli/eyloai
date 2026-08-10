import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2, RefreshCw, Target, TrendingUp, Zap, Brain, Users, DollarSign, Award, ChevronRight, RotateCcw, CheckCircle2, Clock, ArrowRight, Lightbulb, BookOpen, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import FutureMeScores from './FutureMeScores';
import FutureMeRoadmap from './FutureMeRoadmap';
import FutureMeWhatIf from './FutureMeWhatIf';
import FutureMeGapAnalysis from './FutureMeGapAnalysis';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'roadmap', label: 'Roadmap' },
  { key: 'gaps', label: 'Gap Analysis' },
  { key: 'whatif', label: 'What If?' },
];

export default function FutureMeDashboard({ profile, goal, onResetGoal }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [analysisError, setAnalysisError] = useState('');
  const goalCacheKey = `eyra_future_me_analysis_v3_${encodeURIComponent(goal.text).slice(0, 100)}`;

  useEffect(() => {
    const cacheKey = goalCacheKey;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setAnalysis(JSON.parse(cached)); setLoading(false); return; } catch {}
    }
    generate(cacheKey);
  }, [goal.text]);

  const generate = async (cacheKey) => {
    setLoading(true);
    setAnalysisError('');
    const key = cacheKey || goalCacheKey;

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA Future Me Planner. Build a conditional, evidence-honest development plan from the user's saved workspace activity.

GOAL: "${goal.text}"
TIMEFRAME: ${goal.timeframe}
MOTIVATION: "${goal.motivation || 'Not specified'}"

WORKSPACE PROFILE:
- Projects: ${profile.stats.projects} (${profile.activeProjects.map(p => p.title).join(', ') || 'none'})
- Papers saved: ${profile.stats.papers}
- Researchers saved: ${profile.stats.researchers}
- Opportunities saved: ${profile.stats.opportunities}
- Recent searches: ${profile.searches.slice(0,5).map(s => s.query).join(', ') || 'none'}
- Workspace activity score: ${profile.stats.activityScore}/100

Rules:
- overall_progress and category scores are model-assessed planning indicators based only on these workspace signals, not objective measurements or forecasts.
- Do not invent named papers, people, grants, events, employers, statistics, or achievements.
- Recommendations must be actions, skills, or projects; never fabricated external records.
- Clearly describe missing information as a gap.
- Produce exactly five gaps and five recommendations.

Return current_summary, future_summary, overall_progress, scores, score_labels, gaps, milestones, top_recommendations, mentor_message, and daily_action.`,
        response_json_schema: {
          type: 'object',
          properties: {
            current_summary: { type: 'string' },
            future_summary: { type: 'string' },
            overall_progress: { type: 'number', minimum: 0, maximum: 100 },
            scores: {
              type: 'object',
              properties: {
                learning: { type: 'number', minimum: 0, maximum: 100 },
                research: { type: 'number', minimum: 0, maximum: 100 },
                collaboration: { type: 'number', minimum: 0, maximum: 100 },
                funding: { type: 'number', minimum: 0, maximum: 100 },
                innovation: { type: 'number', minimum: 0, maximum: 100 },
                leadership: { type: 'number', minimum: 0, maximum: 100 },
              },
            },
            score_labels: {
              type: 'object',
              properties: {
                learning: { type: 'string' },
                research: { type: 'string' },
                collaboration: { type: 'string' },
                funding: { type: 'string' },
                innovation: { type: 'string' },
                leadership: { type: 'string' },
              },
            },
            gaps: {
              type: 'array',
              minItems: 5,
              maxItems: 5,
              items: {
                type: 'object',
                properties: {
                  area: { type: 'string' },
                  current: { type: 'string' },
                  target: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                  actions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            milestones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  phase: { type: 'string' },
                  title: { type: 'string' },
                  goals: { type: 'array', items: { type: 'string' } },
                  expected_outcome: { type: 'string' },
                },
              },
            },
            top_recommendations: {
              type: 'array',
              minItems: 5,
              maxItems: 5,
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['action', 'skill', 'project'] },
                  title: { type: 'string' },
                  reason: { type: 'string' },
                  action: { type: 'string' },
                },
              },
            },
            mentor_message: { type: 'string' },
            daily_action: { type: 'string' },
          },
        },
      });

      localStorage.setItem(key, JSON.stringify(result));
      setAnalysis(result);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Future Me plan did not complete.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    localStorage.removeItem(goalCacheKey);
    setAnalysis(null);
    generate();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-5 animate-pulse-glow">
            <Sparkles size={24} className="text-white" />
          </div>
          <p className="text-sm font-semibold">Building your Future Me...</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzing your profile, gaps, and {goal.timeframe} roadmap</p>
          <div className="flex gap-1.5 justify-center mt-4">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-white">
              <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Future Me Engine</span>
          </div>
          <h1 className="font-heading font-black text-2xl text-foreground">
            Your Future: <span className="eyra-text-gradient">{goal.text}</span>
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">Goal timeframe: {goal.timeframe} · Planning indicators are based on saved workspace activity</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={refresh} className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground" title="Refresh analysis">
            <RefreshCw size={13} />
          </button>
          <button onClick={onResetGoal} className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground" title="Change goal">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-muted-foreground">
        Progress scores are AI planning indicators, not objective measurements or predictions.
      </div>
      {analysisError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {analysisError}
        </div>
      )}

      {/* EYRA Mentor Message */}
      {analysis?.mentor_message && (
        <div className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
            <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">EYRA · Your Mentor</p>
            <p className="text-sm text-foreground/85 leading-relaxed">{analysis.mentor_message}</p>
          </div>
        </div>
      )}

      {/* Current Me → Future Me visual */}
      <div className="mb-6 grid sm:grid-cols-3 gap-3 items-center">
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Current Me</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{analysis?.current_summary}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${analysis?.overall_progress || 0}%` }} />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{analysis?.overall_progress || 0}%</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <ArrowRight size={20} className="text-primary" />
          <span className="text-[10px] text-muted-foreground">{goal.timeframe}</span>
        </div>
        <div className="p-4 rounded-xl border border-primary/25 bg-primary/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">Future Me</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{analysis?.future_summary}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full eyra-gradient" style={{ width: '100%' }} />
            </div>
            <span className="text-xs font-bold text-primary">100%</span>
          </div>
        </div>
      </div>

      {/* Daily Action */}
      {analysis?.daily_action && (
        <div className="mb-6 p-4 rounded-xl border border-amber-400/20 bg-amber-400/5 flex items-start gap-3">
          <Zap size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-0.5">Today's Most Impactful Action</p>
            <p className="text-sm text-foreground/85">{analysis.daily_action}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && analysis && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <FutureMeScores scores={analysis.scores} labels={analysis.score_labels} overallProgress={analysis.overall_progress} />
          
          {/* Top Recommendations */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Personalized Recommendations</p>
            <div className="space-y-2">
              {analysis.top_recommendations?.map((rec, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={11} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase">{rec.type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-1">{rec.reason}</p>
                    <p className="text-xs text-primary font-medium">→ {rec.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {tab === 'roadmap' && analysis && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FutureMeRoadmap milestones={analysis.milestones} goal={goal} />
        </motion.div>
      )}

      {tab === 'gaps' && analysis && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FutureMeGapAnalysis gaps={analysis.gaps} overallProgress={analysis.overall_progress} />
        </motion.div>
      )}

      {tab === 'whatif' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <FutureMeWhatIf profile={profile} goal={goal} />
        </motion.div>
      )}
    </div>
  );
}
