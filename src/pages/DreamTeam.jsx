import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Sparkles, Loader2, Users, Brain, Code, Briefcase,
  Star, ChevronRight, Target, Lightbulb,
  Building2, UserPlus, RefreshCw, FolderOpen
} from 'lucide-react';

const EXAMPLES = [
  'AI drug discovery startup targeting rare diseases',
  'Federated learning platform for hospital networks',
  'Climate tech startup using satellite data',
];

const ROLE_ICONS = {
  'AI/ML': Brain,
  'Research': Star,
  'Engineering': Code,
  'Business': Briefcase,
  'Clinical': Building2,
  default: UserPlus,
};

export default function DreamTeam() {
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    base44.entities.Project.list('-updated_date', 10).then(projs => {
      setProjects(projs);
      // Auto-select the first active project
      const active = projs.find(p => p.status === 'active') || projs[0];
      if (active) {
        setSelectedProjectId(active.id);
        setQuery(`${active.title}: ${active.goal}`);
      }
    });
  }, []);

  const handleProjectSelect = (e) => {
    const pid = e.target.value;
    setSelectedProjectId(pid);
    if (pid) {
      const proj = projects.find(p => p.id === pid);
      if (proj) setQuery(`${proj.title}: ${proj.goal}`);
    } else {
      setQuery('');
    }
  };

  const build = async (q) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setQuery(searchQuery);
    setLoading(true);
    setTeam(null);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA Dream Team Builder — an AI system that identifies exactly who you need on your team and how to find them.

Project/Startup: "${searchQuery}"

Build a comprehensive dream team analysis. Output ONLY valid JSON:

{
  "project_summary": "One sentence on the project.",
  "team_health_score": 0,
  "current_gaps": ["Gap 1: Missing domain expertise", "Gap 2: Missing skill", "Gap 3: Missing role"],
  "dream_team": [
    {
      "role": "Lead AI Researcher",
      "category": "AI/ML",
      "priority": "Critical",
      "why_needed": "Will own the core model architecture and training pipeline",
      "key_skills": ["Deep learning", "PyTorch", "Research publications"],
      "ideal_background": "PhD in ML/CV, 3+ years research experience, ideally from a top lab",
      "where_to_find": "NeurIPS/ICML community, academic lab alumni networks, LinkedIn AI groups",
      "outreach_hook": "Strong research culture, real-world impact, equity upside",
      "seniority": "Senior / Principal",
      "equity_range": "1-3%"
    }
  ],
  "hiring_sequence": ["Role to hire first and why", "Role to hire second", "Role to hire third"],
  "consortium_partners": [
    {"type": "University Partner", "role": "Research validation and academic credibility", "ideal": "Top-10 university in your field"}
  ],
  "eyra_team_insight": "One paragraph: EYRA's honest assessment of the most critical team decisions for this specific project.",
  "first_hire_advice": "One concrete piece of advice on making the first critical hire."
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          project_summary: { type: 'string' },
          team_health_score: { type: 'number' },
          current_gaps: { type: 'array' },
          dream_team: { type: 'array' },
          hiring_sequence: { type: 'array' },
          consortium_partners: { type: 'array' },
          eyra_team_insight: { type: 'string' },
          first_hire_advice: { type: 'string' },
        }
      }
    });

    setTeam(result);
    setLoading(false);
  };

  const priorityColor = {
    Critical: 'text-red-400 bg-red-500/10 border-red-500/20',
    High: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Medium: 'text-green-400 bg-green-500/10 border-green-500/20',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg eyra-gradient flex items-center justify-center">
            <Users size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Dream Team Builder</span>
        </div>
        <h1 className="font-heading font-black text-2xl sm:text-3xl mb-2 text-foreground">
          Build Your <span className="impact-gradient">Dream Team</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          EYRA identifies every missing skill, recommends specific profiles, and tells you where to find them.
        </p>
      </div>

      {/* Project selector — connect to existing projects */}
      {projects.length > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen size={13} className="text-primary" />
            <p className="text-xs font-semibold text-foreground">Use an existing project</p>
          </div>
          <select
            value={selectedProjectId}
            onChange={handleProjectSelect}
            className="w-full h-10 px-3 rounded-lg border border-border bg-secondary text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">Select a project…</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.status || 'planning'})</option>
            ))}
          </select>
        </div>
      )}

      {/* Manual input */}
      <div className="mb-6">
        <form onSubmit={e => { e.preventDefault(); build(); }} className="flex gap-2">
          <div className="flex-1 relative">
            <Target size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedProjectId(''); }}
              placeholder="Or describe your project / startup..."
              className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Build Team
          </button>
        </form>
        {!team && !loading && !selectedProjectId && (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => build(ex)}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mb-5 animate-pulse-glow">
            <Users size={26} className="text-white" />
          </div>
          <p className="text-sm font-semibold mb-1">Building your dream team...</p>
          <p className="text-xs text-muted-foreground">Identifying gaps, roles, profiles, and where to find them</p>
          <div className="flex gap-1.5 mt-4">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      )}

      {team && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 p-4 rounded-xl border border-border/60 bg-secondary/20">
              <p className="text-sm text-foreground/80">{team.project_summary}</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Team Score</p>
              <p className="text-4xl font-black text-primary">{team.team_health_score}</p>
              <p className="text-[10px] text-muted-foreground">/ 100 today</p>
            </div>
          </div>

          {/* Gaps */}
          {team.current_gaps?.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-2">Critical Gaps Detected</p>
              <div className="space-y-1">
                {team.current_gaps.map((g, i) => (
                  <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <ChevronRight size={11} className="text-amber-400 mt-0.5 flex-shrink-0" /> {g}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Dream Team */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Your Dream Team</p>
            <div className="space-y-4">
              {team.dream_team?.map((member, i) => {
                const CategoryIcon = ROLE_ICONS[member.category] || ROLE_ICONS.default;
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }} className="p-5 rounded-xl border border-border bg-card">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                        <CategoryIcon size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                          <h4 className="font-semibold text-sm text-foreground">{member.role}</h4>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${priorityColor[member.priority] || 'border-border text-muted-foreground'}`}>
                              {member.priority}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{member.seniority}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">{member.why_needed}</p>
                        <div className="grid sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Background</p>
                            <p className="text-foreground/80 leading-relaxed">{member.ideal_background}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Where to Find</p>
                            <p className="text-foreground/80 leading-relaxed">{member.where_to_find}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Outreach Hook</p>
                            <p className="text-foreground/80 leading-relaxed">{member.outreach_hook}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/40">
                          <div className="flex flex-wrap gap-1.5">
                            {member.key_skills?.map(s => (
                              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-secondary/50 text-muted-foreground">{s}</span>
                            ))}
                          </div>
                          {member.equity_range && (
                            <span className="ml-auto text-[10px] font-semibold text-green-400 flex-shrink-0">Equity: {member.equity_range}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Hiring sequence */}
          {team.hiring_sequence?.length > 0 && (
            <div className="p-5 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Hiring Sequence</p>
              <div className="space-y-2">
                {team.hiring_sequence.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full eyra-gradient flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                    <p className="text-xs text-foreground/80">{h}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consortium Partners */}
          {team.consortium_partners?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Consortium Partners to Recruit</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {team.consortium_partners.map((p, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs font-bold text-primary mb-1">{p.type}</p>
                    <p className="text-xs text-foreground/80 mb-2">{p.role}</p>
                    <p className="text-[10px] text-muted-foreground italic">{p.ideal}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EYRA insight */}
          <div className="grid sm:grid-cols-2 gap-4">
            {team.eyra_team_insight && (
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={12} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">EYRA Team Insight</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{team.eyra_team_insight}</p>
              </div>
            )}
            {team.first_hire_advice && (
              <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={12} className="text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">First Hire Advice</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{team.first_hire_advice}</p>
              </div>
            )}
          </div>

          <button onClick={() => build()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw size={11} /> Rebuild with different parameters
          </button>
        </motion.div>
      )}
    </div>
  );
}
