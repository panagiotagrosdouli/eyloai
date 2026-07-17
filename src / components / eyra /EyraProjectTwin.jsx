import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles, Loader2, RefreshCw, Zap, Bell, TrendingUp,
  AlertTriangle, FileText, Users, Award, Lightbulb, ChevronRight
} from 'lucide-react';
import { EyraSectionLabel } from '@/components/eyra/EyraBadge';

export default function EyraProjectTwin({ project }) {
  const [twinReport, setTwinReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (project?.twin_report) {
      try { setTwinReport(JSON.parse(project.twin_report)); } catch {}
    }
    // Generate alerts from existing analysis
    generateAlerts();
  }, [project]);

  const generateAlerts = () => {
    const now = new Date();
    const created = new Date(project?.created_date);
    const daysSinceCreated = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const generatedAlerts = [];

    if (daysSinceCreated > 7 && !project?.eyra_analysis) {
      generatedAlerts.push({ type: 'action', icon: Sparkles, text: 'Run EYRA analysis to unlock project intelligence', color: 'text-primary', bg: 'bg-primary/10' });
    }
    if (!project?.description || project.description.length < 50) {
      generatedAlerts.push({ type: 'warning', icon: AlertTriangle, text: 'Project description is thin — add more context for better AI insights', color: 'text-amber-400', bg: 'bg-amber-500/10' });
    }
    if (!project?.milestones) {
      generatedAlerts.push({ type: 'suggestion', icon: Lightbulb, text: 'No milestones defined — EYRA recommends setting 3-5 key milestones', color: 'text-chart-3', bg: 'bg-chart-3/10' });
    }
    generatedAlerts.push({ type: 'monitor', icon: TrendingUp, text: 'Twin is monitoring for new papers, researchers & opportunities in your field', color: 'text-green-400', bg: 'bg-green-500/10' });

    setAlerts(generatedAlerts);
  };

  const runTwinScan = async () => {
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA Project Twin — an autonomous monitoring and intelligence system for a specific research project.

Project: ${project.title}
Goal: ${project.goal}
Description: ${project.description || 'Not provided'}
Current Status: ${project.status || 'planning'}
Milestones: ${project.milestones || 'None defined'}

You are the project's living intelligence system. Perform a full autonomous scan and output ONLY valid JSON:

{
  "scan_date": "${new Date().toISOString()}",
  "overall_health": "Strong|Good|Needs Attention|At Risk",
  "health_score": 72,
  "health_reasoning": "One sentence on overall project health.",
  "new_paper_directions": [
    {"title": "Paper/Research Direction 1", "relevance": "Why it matters to this project"},
    {"title": "Paper/Research Direction 2", "relevance": "Why it matters"},
    {"title": "Paper/Research Direction 3", "relevance": "Why it matters"}
  ],
  "emerging_researchers": [
    {"profile": "Type of researcher profile 1", "why": "How they'd help the project"},
    {"profile": "Type of researcher profile 2", "why": "How they'd help"}
  ],
  "new_opportunities": [
    {"name": "Funding/Grant opportunity 1", "type": "grant|competition|accelerator", "urgency": "Apply now|This quarter|Ongoing"},
    {"name": "Opportunity 2", "type": "grant", "urgency": "This quarter"}
  ],
  "risk_alerts": [
    {"risk": "Risk 1 description", "severity": "High|Medium|Low", "mitigation": "What to do"}
  ],
  "strategic_insight": "One paragraph of strategic intelligence — what EYRA thinks about the project direction, what's working, what needs to change, and one bold recommendation.",
  "next_action": "The single most important action to take right now."
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          scan_date: { type: 'string' },
          overall_health: { type: 'string' },
          health_score: { type: 'number' },
          health_reasoning: { type: 'string' },
          new_paper_directions: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, relevance: { type: 'string' } } } },
          emerging_researchers: { type: 'array', items: { type: 'object', properties: { profile: { type: 'string' }, why: { type: 'string' } } } },
          new_opportunities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, urgency: { type: 'string' } } } },
          risk_alerts: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, severity: { type: 'string' }, mitigation: { type: 'string' } } } },
          strategic_insight: { type: 'string' },
          next_action: { type: 'string' },
        }
      }
    });

    setTwinReport(result);
    await base44.entities.Project.update(project.id, { twin_report: JSON.stringify(result) });
    setLoading(false);
  };

  const healthColor = {
    'Strong': 'text-green-400 bg-green-500/15 border-green-500/25',
    'Good': 'text-primary bg-primary/15 border-primary/25',
    'Needs Attention': 'text-amber-400 bg-amber-500/15 border-amber-500/25',
    'At Risk': 'text-red-400 bg-red-500/15 border-red-500/25',
  };

  const urgencyColor = {
    'Apply now': 'text-red-400',
    'This quarter': 'text-amber-400',
    'Ongoing': 'text-green-400',
  };

  const severityColor = { High: 'text-red-400', Medium: 'text-amber-400', Low: 'text-muted-foreground' };

  return (
    <div className="space-y-5">
      {/* Twin Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl eyra-gradient flex items-center justify-center animate-pulse-glow">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <EyraSectionLabel label="EYRA Project Twin" />
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">Active</span>
            </div>
            <p className="text-xs text-muted-foreground">Monitoring continuously · Discovered by EYRA</p>
          </div>
        </div>
        <button
          onClick={runTwinScan}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {loading ? 'Scanning...' : twinReport ? 'Rescan' : 'Run Twin Scan'}
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && !twinReport && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Twin Alerts</p>
          {alerts.map((alert, i) => {
            const Icon = alert.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${alert.bg} border border-white/5`}>
                <Icon size={13} className={`${alert.color} mt-0.5 flex-shrink-0`} />
                <p className="text-xs text-foreground/80">{alert.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-8 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card">
          <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center animate-pulse-glow">
            <Zap size={22} className="text-white" />
          </div>
          <p className="text-sm font-semibold">Twin is scanning your project...</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Searching for new papers, researchers, opportunities, and risks relevant to your project
          </p>
          <div className="flex gap-1.5 mt-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* Twin Report */}
      {twinReport && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Health Score */}
          <div className={`flex items-center justify-between p-4 rounded-xl border ${healthColor[twinReport.overall_health] || 'text-muted-foreground bg-secondary border-border'}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-0.5">Project Health</p>
              <p className="font-bold text-lg">{twinReport.overall_health}</p>
              <p className="text-xs opacity-70 mt-0.5">{twinReport.health_reasoning}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{twinReport.health_score}</p>
              <p className="text-[10px] opacity-60">/ 100</p>
            </div>
          </div>

          {/* Strategic Insight */}
          {twinReport.strategic_insight && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
              <EyraSectionLabel label="EYRA Strategic Insight" className="mb-2" />
              <p className="text-sm text-foreground/85 leading-relaxed">{twinReport.strategic_insight}</p>
              {twinReport.next_action && (
                <div className="mt-3 pt-3 border-t border-primary/15 flex items-start gap-2">
                  <ChevronRight size={12} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-primary font-semibold">{twinReport.next_action}</p>
                </div>
              )}
            </div>
          )}

          {/* New Papers */}
          {twinReport.new_paper_directions?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText size={10} /> New Research Directions Detected
              </p>
              <div className="space-y-2">
                {twinReport.new_paper_directions.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText size={10} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{p.relevance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Researchers */}
          {twinReport.emerging_researchers?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Users size={10} /> Collaboration Opportunities
              </p>
              <div className="space-y-2">
                {twinReport.emerging_researchers.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Users size={10} className="text-accent" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{r.profile}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {twinReport.new_opportunities?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Award size={10} /> New Opportunities Detected
              </p>
              <div className="space-y-2">
                {twinReport.new_opportunities.map((o, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-lg bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                        <Award size={10} className="text-chart-3" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{o.type}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold ${urgencyColor[o.urgency] || 'text-muted-foreground'}`}>{o.urgency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Alerts */}
          {twinReport.risk_alerts?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle size={10} /> Risk Alerts
              </p>
              <div className="space-y-2">
                {twinReport.risk_alerts.map((r, i) => (
                  <div key={i} className="p-3 rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-foreground">{r.risk}</p>
                      <span className={`text-[10px] font-semibold ${severityColor[r.severity]}`}>{r.severity}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{r.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {twinReport.scan_date && (
            <p className="text-[10px] text-muted-foreground text-right">
              Last scan: {new Date(twinReport.scan_date).toLocaleString()}
            </p>
          )}
        </motion.div>
      )}

      {/* Idle state */}
      {!twinReport && !loading && alerts.length === 0 && (
        <div className="p-8 rounded-2xl border border-dashed border-border/60 text-center">
          <Zap size={24} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Digital Twin not yet activated</p>
          <p className="text-xs text-muted-foreground">Run a Twin Scan to start monitoring your project for new papers, researchers, opportunities, and risks.</p>
        </div>
      )}
    </div>
  );
}
