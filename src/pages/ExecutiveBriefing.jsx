import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Sparkles, RefreshCw, AlertTriangle, TrendingUp, DollarSign,
  Target, CheckSquare, Brain, Zap, Shield, ChevronRight, Star
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import moment from 'moment';

export default function ExecutiveBriefing() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);

  useEffect(() => { loadAndGenerate(); }, []);

  const loadAndGenerate = async () => {
    const [me, projs] = await Promise.all([
      base44.auth.me(),
      base44.entities.Project.list('-updated_date', 10),
    ]);
    setUser(me);
    setProjects(projs);
    // Check cache — regenerate once per day
    const today = new Date().toDateString();
    const cachedDate = localStorage.getItem('eyra_briefing_full_date');
    const cachedBriefing = localStorage.getItem('eyra_briefing_full');
    if (cachedDate === today && cachedBriefing) {
      try {
        setBriefing(JSON.parse(cachedBriefing));
        setLastGenerated(new Date(localStorage.getItem('eyra_briefing_full_ts') || Date.now()));
        return;
      } catch {}
    }
    // Auto-generate
    setTimeout(() => generateBriefing(me), 100);
  };

  const generateBriefing = async (userOverride) => {
    setLoading(true);
    const currentUser = userOverride || user;
    const [projs, opps, papers, meetings] = await Promise.all([
      base44.entities.Project.list('-updated_date', 10),
      base44.entities.SavedOpportunity.list('-created_date', 20),
      base44.entities.SavedPaper.list('-created_date', 10),
      base44.entities.Meeting.list('-date', 10),
    ]);

    const context = `
User: ${currentUser?.full_name || 'Researcher'} | ${currentUser?.organization || 'Independent'} | ${currentUser?.country || ''}
Research Interests: ${currentUser?.research_interests || 'Not specified'}
Career Goal: ${currentUser?.career_goal || 'Not specified'}
Startup Interest: ${currentUser?.startup_interest || 'Not specified'}

Projects (${projs.length}):
${projs.map(p => `- ${p.title} [${p.status}]: ${p.goal}`).join('\n') || '- None'}

Saved Opportunities (${opps.length}):
${opps.slice(0, 5).map(o => `- ${o.title} (${o.type})`).join('\n') || '- None'}

Saved Papers (${papers.length}):
${papers.slice(0, 5).map(p => `- ${p.title}`).join('\n') || '- None'}

Upcoming Meetings (${meetings.filter(m => moment(m.date).isSameOrAfter(moment())).length}):
${meetings.filter(m => moment(m.date).isSameOrAfter(moment())).slice(0,3).map(m => `- ${m.title} on ${m.date}`).join('\n') || '- None'}
    `.trim();

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, acting as an executive board intelligence system for a researcher/innovator.

${context}

Generate an EYRA Executive Briefing with structured sections. Be direct, specific, and use a board-level advisory tone.

Respond as JSON with these fields:
- top_opportunities: array of {title, reason, urgency} (top 3)
- critical_risks: array of {risk, mitigation} (top 3)
- new_discoveries: array of {item, significance} (research/tech trends)
- funding_alerts: array of {alert, action}
- project_health: array of {project, status, note} where status is "green"|"yellow"|"red"
- priority_actions: array of {action, deadline, impact} (top 5)
- strategic_summary: string (3-4 sentence executive summary)
- weekly_focus: string (single most important thing to focus on this week)`,
      response_json_schema: {
        type: 'object',
        properties: {
          strategic_summary: { type: 'string' },
          weekly_focus: { type: 'string' },
          top_opportunities: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, reason: { type: 'string' }, urgency: { type: 'string' } } } },
          critical_risks: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, mitigation: { type: 'string' } } } },
          new_discoveries: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, significance: { type: 'string' } } } },
          funding_alerts: { type: 'array', items: { type: 'object', properties: { alert: { type: 'string' }, action: { type: 'string' } } } },
          project_health: { type: 'array', items: { type: 'object', properties: { project: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' } } } },
          priority_actions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, deadline: { type: 'string' }, impact: { type: 'string' } } } },
        },
      },
    });

    setBriefing(result);
    const now = new Date();
    setLastGenerated(now);
    // Cache for the day
    localStorage.setItem('eyra_briefing_full_date', now.toDateString());
    localStorage.setItem('eyra_briefing_full', JSON.stringify(result));
    localStorage.setItem('eyra_briefing_full_ts', now.toISOString());
    setLoading(false);
  };

  const statusColors = { green: 'text-green-400 bg-green-500/10', yellow: 'text-amber-400 bg-amber-500/10', red: 'text-red-400 bg-red-500/10' };
  const statusDots = { green: 'bg-green-400', yellow: 'bg-amber-400', red: 'bg-red-400' };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-xl eyra-gradient flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <h1 className="font-heading font-bold text-2xl">EYRA Executive Briefing</h1>
          </div>
          <p className="text-sm text-muted-foreground">Your personal intelligence board — what matters most right now</p>
          {lastGenerated && (
            <p className="text-[10px] text-muted-foreground mt-0.5">Last generated: {moment(lastGenerated).fromNow()}</p>
          )}
        </div>
        <button onClick={() => generateBriefing()} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex-shrink-0">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Generating...' : briefing ? 'Refresh' : 'Generate Briefing'}
        </button>
      </div>



      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mb-4 animate-pulse-glow">
            <Brain size={26} className="text-white" />
          </div>
          <p className="font-semibold text-sm mb-1">EYRA is preparing your briefing...</p>
          <p className="text-xs text-muted-foreground">Analyzing projects, opportunities, risks & priorities</p>
        </div>
      )}

      {briefing && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* Weekly focus — hero card */}
          <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 eyra-glow">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-primary" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">This Week's #1 Focus</p>
            </div>
            <p className="text-lg font-heading font-bold text-foreground">{briefing.weekly_focus}</p>
          </div>

          {/* Strategic summary */}
          {briefing.strategic_summary && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Brain size={10} /> Strategic Summary
              </p>
              <p className="text-sm text-foreground leading-relaxed">{briefing.strategic_summary}</p>
            </div>
          )}

          {/* 3-col grid: opportunities, risks, funding */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Top Opportunities */}
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-3 flex items-center gap-1.5">
                <Star size={10} /> Top Opportunities
              </p>
              <div className="space-y-3">
                {(briefing.top_opportunities || []).map((o, i) => (
                  <div key={i} className="pb-2 border-b border-border/40 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold">{o.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{o.reason}</p>
                    {o.urgency && <span className="text-[10px] text-amber-400">{o.urgency}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Risks */}
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle size={10} /> Critical Risks
              </p>
              <div className="space-y-3">
                {(briefing.critical_risks || []).map((r, i) => (
                  <div key={i} className="pb-2 border-b border-red-500/10 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold text-foreground">{r.risk}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Funding Alerts */}
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <DollarSign size={10} /> Funding Alerts
              </p>
              <div className="space-y-3">
                {(briefing.funding_alerts || []).map((f, i) => (
                  <div key={i} className="pb-2 border-b border-amber-500/10 last:border-0 last:pb-0">
                    <p className="text-xs font-semibold">{f.alert}</p>
                    <p className="text-[10px] text-primary mt-0.5">→ {f.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project Health */}
          {(briefing.project_health || []).length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Target size={10} /> Project Health Check
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {briefing.project_health.map((p, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${p.status === 'green' ? 'border-green-500/20' : p.status === 'red' ? 'border-red-500/20' : 'border-amber-500/20'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${statusDots[p.status] || 'bg-muted'}`} />
                      <p className="text-xs font-semibold truncate">{p.project}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{p.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Actions */}
          {(briefing.priority_actions || []).length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <CheckSquare size={10} /> Priority Actions
              </p>
              <div className="space-y-2">
                {briefing.priority_actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40">
                    <span className="text-[10px] font-bold text-primary mt-0.5 w-4 flex-shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{a.action}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {a.deadline && <span className="text-[10px] text-muted-foreground">{a.deadline}</span>}
                        {a.impact && <span className="text-[10px] text-primary">{a.impact}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Discoveries */}
          {(briefing.new_discoveries || []).length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp size={10} /> Research & Innovation Signals
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {briefing.new_discoveries.map((d, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs font-semibold">{d.item}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{d.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
