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

  useEffect(() => {
    const cacheKey = `eyra_future_me_analysis_v2`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { setAnalysis(JSON.parse(cached)); setLoading(false); return; } catch {}
    }
    generate(cacheKey);
  }, [goal.text]);

  const generate = async (cacheKey) => {
    setLoading(true);
    const key = cacheKey || `eyra_future_me_analysis_v2`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA Future Me Engine. Analyze this user's profile and generate a comprehensive Future Me plan.

GOAL: "${goal.text}"
TIMEFRAME: ${goal.timeframe}
MOTIVATION: "${goal.motivation || 'Not specified'}"

USER PROFILE:
- Projects: ${profile.stats.projects} projects (${profile.activeProjects.map(p => p.title).join(', ') || 'none'})
- Papers Saved: ${profile.stats.papers}
- Researchers Saved: ${profile.stats.researchers}
- Opportunities Saved: ${profile.stats.opportunities}
- Recent Searches: ${profile.searches.slice(0,5).map(s => s.query).join(', ') || 'none'}
- Activity Score: ${profile.stats.activityScore}/100

Generate a structured JSON analysis:

{
  "current_summary": "2-sentence honest summary of where this user is today",
  "future_summary": "2-sentence vivid description of who they'll become if they hit the goal",
  "overall_progress": number (0-100, current % toward their goal based on profile),
  "scores": {
    "learning": number (0-100),
    "research": number (0-100),
    "collaboration": number (0-100),
    "funding": number (0-100),
    "innovation": number (0-100),
    "leadership": number (0-100)
  },
  "score_labels": {
    "learning": "1 sentence on learning status",
    "research": "1 sentence",
    "collaboration": "1 sentence",
    "funding": "1 sentence",
    "innovation": "1 sentence",
    "leadership": "1 sentence"
  },
  "gaps": [
    {
      "area": "area name",
      "current": "current state",
      "target": "target state",
      "priority": "high|medium|low",
      "actions": ["action 1", "action 2"]
    }
  ],
  "milestones": [
    { "phase": "6 Months", "title": "milestone title", "goals": ["goal 1", "goal 2", "goal 3"], "expected_outcome": "what success looks like" },
    { "phase": "1 Year", "title": "milestone title", "goals": ["goal 1", "goal 2", "goal 3"], "expected_outcome": "what success looks like" },
    { "phase": "3 Years", "title": "milestone title", "goals": ["goal 1", "goal 2", "goal 3"], "expected_outcome": "what success looks like" },
    { "phase": "5 Years", "title": "milestone title", "goals": ["goal 1", "goal 2", "goal 3"], "expected_outcome": "what success looks like" }
  ],
  "top_recommendations": [
    { "type": "paper|skill|person|grant|project|event", "title": "recommendation title", "reason": "why this helps reach their goal", "action": "specific action to take" }
  ],
  "mentor_message": "A warm, encouraging, strategic 2-3 sentence message from EYRA as a mentor. Be specific to their goal.",
  "daily_action": "The single most impactful thing they can do TODAY to move toward their goal"
}

Generate exactly 5 gaps, 5 top_recommendations. Be specific and realistic.`,
      response_json_schema: {
        type: 'object',
        properties: {
          current_summary: { type: 'string' },
          future_summary: { type: 'string' },
          overall_progress: { type: 'number' },
          scores: { type: 'object' },
          score_labels: { type: 'object' },
          gaps: { type: 'array', items: { type: 'object' } },
          milestones: { type: 'array', items: { type: 'object' } },
          top_recommendations: { type: 'array', items: { type: 'object' } },
          mentor_message: { type: 'string' },
          daily_action: { type: 'string' },
        }
      }
    });

    localStorage.setItem(key, JSON.stringify(result));
    setAnalysis(result);
    setLoading(false);
  };

  const refresh = () => {
    localStorage.removeItem(`eyra_future_me_analysis_v2`);
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
              <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Future Me Engine</span>
          </div>
          <h1 className="font-heading font-black text-2xl text-foreground">
            Your Future: <span className="eyra-text-gradient">{goal.text}</span>
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">Goal timeframe: {goal.timeframe} · EYRA is your personal strategist</p>
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

      {/* EYRA Mentor Message */}
      {analysis?.mentor_message && (
        <div className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
            <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
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
