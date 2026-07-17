import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Radar, Sparkles, Bookmark, TrendingUp, AlertCircle, Clock,
  DollarSign, Rocket, Trophy, GraduationCap, Award, Building2,
  Zap, RefreshCw, Filter, ChevronRight, Star, FolderOpen
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const TYPE_CONFIG = {
  grant: { icon: DollarSign, color: 'bg-primary/15 text-primary', label: 'Grant' },
  competition: { icon: Trophy, color: 'bg-amber-500/15 text-amber-400', label: 'Competition' },
  accelerator: { icon: Rocket, color: 'bg-green-500/15 text-green-400', label: 'Accelerator' },
  scholarship: { icon: GraduationCap, color: 'bg-accent/15 text-accent', label: 'Scholarship' },
  call: { icon: Award, color: 'bg-chart-3/15 text-chart-3', label: 'Call' },
  investor: { icon: Building2, color: 'bg-blue-500/15 text-blue-400', label: 'Investor' },
  fellowship: { icon: Star, color: 'bg-purple-500/15 text-purple-400', label: 'Fellowship' },
};

const FEED_FILTERS = ['All', 'New', 'Expiring', 'High Match', 'Grants', 'Accelerators', 'Investors'];

export default function OpportunityRadar() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [filter, setFilter] = useState('All');
  const [boardReport, setBoardReport] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => { loadContext(); }, []);

  const loadContext = async () => {
    const [me, projs] = await Promise.all([
      base44.auth.me(),
      base44.entities.Project.list('-updated_date', 10),
    ]);
    setUser(me);
    setProjects(projs);
    // Auto-select active project
    const active = projs.find(p => p.status === 'active') || projs[0];
    if (active) setSelectedProjectId(active.id);
  };

  const runRadar = async () => {
    setLoading(true);
    setHasRun(true);

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const projectFocus = selectedProject
      ? `\nFocused Project:\n- ${selectedProject.title}: ${selectedProject.goal}${selectedProject.description ? '\n  Description: ' + selectedProject.description : ''}`
      : '';

    const profileContext = `
User Profile:
- Name: ${user?.full_name || 'Researcher'}
- Research Interests: ${user?.research_interests || 'Not specified'}
- Skills: ${user?.skills || 'Not specified'}
- Organization: ${user?.organization || 'Not specified'}
- Country: ${user?.country || 'Not specified'}
- Career Goal: ${user?.career_goal || 'Not specified'}
- Startup Interest: ${user?.startup_interest || 'Not specified'}
${projectFocus}

All Projects:
${projects.map(p => `- ${p.title}: ${p.goal}`).join('\n') || '- No active projects'}
    `.trim();

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, a proactive intelligence system that discovers opportunities for researchers and innovators.

${profileContext}

Based on this profile and projects, discover 15 highly relevant opportunities. Include a mix of:
- Research grants (Horizon Europe, ERC, national programs)
- Accelerators and startup programs
- Innovation competitions
- Fellowships and scholarships
- Investor programs (VCs, angels)
- Industry partnership calls

For each opportunity calculate a match_score (0-100) based on profile alignment.
Mark is_expiring: true if deadline is within 60 days.
Mark is_new: true for recently opened opportunities.
Mark priority: "high" | "medium" | "low" based on match + deadline urgency.

Be specific with real program names, amounts in EUR/USD, and concrete deadlines.`,
      response_json_schema: {
        type: 'object',
        properties: {
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                amount: { type: 'string' },
                deadline: { type: 'string' },
                deadline_days: { type: 'number' },
                match_score: { type: 'number' },
                match_reason: { type: 'string' },
                difficulty: { type: 'string' },
                priority: { type: 'string' },
                is_expiring: { type: 'boolean' },
                is_new: { type: 'boolean' },
                url_hint: { type: 'string' },
              },
            },
          },
        },
      },
      add_context_from_internet: true,
      model: 'gemini_3_flash',
    });

    const sorted = (result.opportunities || []).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    setFeed(sorted);
    setLoading(false);
    toast({ title: `EYRA Radar found ${sorted.length} opportunities` });
  };

  const generateBoardReport = async () => {
    setLoadingReport(true);
    const profileContext = `
User: ${user?.full_name || 'Researcher'} | ${user?.organization || ''} | ${user?.country || ''}
Interests: ${user?.research_interests || 'Not set'}
Goal: ${user?.career_goal || 'Not set'}
Projects: ${projects.map(p => `${p.title} (${p.status})`).join(', ') || 'None'}
Top opportunities found: ${feed.slice(0, 5).map(o => o.title).join(', ')}
    `.trim();

    const report = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, acting as a Personal Board Member and strategic advisor.

${profileContext}

Generate a Weekly Strategic Board Report with:

## Executive Summary
(2-3 sentence overview of this week's strategic position)

## Priority Actions This Week
(Top 3-5 specific, actionable recommendations with urgency)

## Funding Opportunities to Act On Now
(Which 2-3 opportunities to prioritize and why)

## Research & Innovation Alerts
(Key trends, risks, or breakthroughs to be aware of)

## Project Health Check
(Brief status of each project with green/yellow/red assessment)

## Strategic Warnings
(Any risks, blockers, or directions to avoid)

## 30-Day Roadmap
(What to accomplish in the next 30 days)

Write as a seasoned advisor to a top researcher/entrepreneur. Be direct, opinionated, and specific.`,
    });

    setBoardReport(report);
    setLoadingReport(false);
  };

  const saveOpportunity = async (opp) => {
    await base44.entities.SavedOpportunity.create({
      title: opp.title,
      type: opp.type || 'grant',
      description: opp.description,
      deadline: opp.deadline,
    });
    toast({ title: 'Saved to library' });
  };

  const filteredFeed = feed.filter(o => {
    if (filter === 'All') return true;
    if (filter === 'New') return o.is_new;
    if (filter === 'Expiring') return o.is_expiring;
    if (filter === 'High Match') return o.match_score >= 80;
    if (filter === 'Grants') return o.type === 'grant' || o.type === 'call' || o.type === 'fellowship';
    if (filter === 'Accelerators') return o.type === 'accelerator';
    if (filter === 'Investors') return o.type === 'investor';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg eyra-gradient flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <h1 className="font-heading font-bold text-2xl">EYRA Opportunity Radar</h1>
          </div>
          <p className="text-sm text-muted-foreground">EYRA continuously scans grants, funding, accelerators & investors — personalized to your profile & projects</p>
        </div>
        <button
          onClick={runRadar}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex-shrink-0"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Scanning...' : hasRun ? 'Re-scan' : 'Run Radar'}
        </button>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card">
          <FolderOpen size={14} className="text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground flex-shrink-0">Focus on:</p>
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="flex-1 bg-transparent text-xs text-foreground focus:outline-none"
          >
            <option value="">All projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">EYRA will tailor results to this project</span>
        </div>
      )}

      {/* Status bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Opportunities Found', value: feed.length, icon: Award, color: 'text-primary' },
          { label: 'High Match (80%+)', value: feed.filter(o => o.match_score >= 80).length, icon: Star, color: 'text-amber-400' },
          { label: 'Expiring Soon', value: feed.filter(o => o.is_expiring).length, icon: Clock, color: 'text-red-400' },
          { label: 'New This Week', value: feed.filter(o => o.is_new).length, icon: Zap, color: 'text-green-400' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={s.color} />
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
              <p className="font-heading font-bold text-xl">{s.value}</p>
            </div>
          );
        })}
      </div>

      {!hasRun && !loading && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Explainer */}
          <div className="p-6 rounded-2xl border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0">
                <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="font-semibold text-sm">EYRA doesn't wait.</p>
                <p className="text-[10px] text-muted-foreground">EYRA discovers. EYRA advises. EYRA acts.</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                'Analyzes your profile, interests & projects',
                'Scans Horizon Europe, ERC, national programs',
                'Discovers accelerators, investors & competitions',
                'Calculates personalized match scores',
                'Alerts you to expiring deadlines',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
            <button onClick={runRadar} className="mt-5 w-full py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Run Your First Radar Scan →
            </button>
          </div>

          {/* Radar types */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What EYRA monitors</p>
            {[
              { icon: DollarSign, label: 'Research Grants', desc: 'Horizon Europe, ERC, NSF, national programs', color: 'text-primary' },
              { icon: Rocket, label: 'Accelerators & Startup Programs', desc: 'Y Combinator, EIT, Deep Tech programs', color: 'text-green-400' },
              { icon: Building2, label: 'Investors & VCs', desc: 'Angel investors, VC firms, innovation funds', color: 'text-blue-400' },
              { icon: Trophy, label: 'Innovation Competitions', desc: 'Prizes, challenges, hackathons', color: 'text-amber-400' },
              { icon: Star, label: 'Fellowships & Scholarships', desc: 'Marie Curie, DAAD, Fulbright & more', color: 'text-purple-400' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  <Icon size={15} className={item.color} />
                  <div>
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full eyra-gradient flex items-center justify-center mb-4 animate-pulse-glow">
            <Sparkles size={24} className="text-white" />
          </div>
          <p className="font-semibold text-sm mb-1">EYRA is scanning the landscape...</p>
          <p className="text-xs text-muted-foreground">Analyzing your profile against grants, accelerators & investors</p>
          <div className="mt-4 flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {hasRun && !loading && feed.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {FEED_FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    filter === f ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground hover:text-foreground border border-transparent hover:border-border'
                  }`}>
                  {f}
                  {f !== 'All' && (
                    <span className="ml-1.5 opacity-50">
                      {f === 'New' ? feed.filter(o => o.is_new).length :
                       f === 'Expiring' ? feed.filter(o => o.is_expiring).length :
                       f === 'High Match' ? feed.filter(o => o.match_score >= 80).length :
                       f === 'Grants' ? feed.filter(o => ['grant','call','fellowship'].includes(o.type)).length :
                       f === 'Accelerators' ? feed.filter(o => o.type === 'accelerator').length :
                       feed.filter(o => o.type === 'investor').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredFeed.map((opp, i) => {
                const cfg = TYPE_CONFIG[opp.type] || TYPE_CONFIG.call;
                const Icon = cfg.icon;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${cfg.color}`}>
                            <Icon size={9} /> {cfg.label}
                          </span>
                          {opp.priority === 'high' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-semibold">High Priority</span>
                          )}
                          {opp.is_new && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-semibold">New</span>
                          )}
                          {opp.is_expiring && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold flex items-center gap-1">
                              <Clock size={8} /> Expiring
                            </span>
                          )}
                        </div>

                        <h4 className="font-semibold text-sm mb-1">{opp.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{opp.description}</p>

                        {/* Match reason */}
                        {opp.match_reason && (
                          <div className="flex items-start gap-1.5 mb-2">
                            <Sparkles size={10} className="text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-primary italic">{opp.match_reason}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {opp.amount && <span className="text-primary font-semibold">{opp.amount}</span>}
                          {opp.deadline && <span>📅 {opp.deadline}</span>}
                          {opp.difficulty && <span className={opp.difficulty === 'Low' ? 'text-green-400' : opp.difficulty === 'High' ? 'text-red-400' : 'text-amber-400'}>{opp.difficulty} difficulty</span>}
                        </div>
                      </div>

                      {/* Match score */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                          opp.match_score >= 85 ? 'bg-green-500/15 text-green-400' :
                          opp.match_score >= 70 ? 'bg-primary/15 text-primary' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          {opp.match_score}%
                        </div>
                        <button onClick={() => saveOpportunity(opp)}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                          <Bookmark size={12} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Board Report sidebar */}
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                  <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-xs font-bold">Personal Board Member</p>
                  <p className="text-[10px] text-muted-foreground">Weekly strategic report</p>
                </div>
              </div>

              {!boardReport ? (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    EYRA acts as your personal board advisor — reviewing your progress and delivering strategic recommendations.
                  </p>
                  <button onClick={generateBoardReport} disabled={loadingReport}
                    className="w-full py-2.5 rounded-xl eyra-gradient text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2">
                    {loadingReport ? <><RefreshCw size={11} className="animate-spin" /> Generating...</> : <><Sparkles size={11} /> Generate Board Report</>}
                  </button>
                </>
              ) : (
                <>
                  <div className="prose prose-xs prose-invert max-w-none text-xs leading-relaxed max-h-96 overflow-y-auto">
                    <ReactMarkdown>{boardReport}</ReactMarkdown>
                  </div>
                  <button onClick={generateBoardReport} disabled={loadingReport}
                    className="mt-3 w-full py-2 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5">
                    <RefreshCw size={10} /> Refresh Report
                  </button>
                </>
              )}
            </div>

            {/* Top 3 urgent */}
            {feed.filter(o => o.is_expiring || o.priority === 'high').length > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle size={10} /> Act Now
                </p>
                <div className="space-y-2">
                  {feed.filter(o => o.is_expiring || o.priority === 'high').slice(0, 3).map((o, i) => (
                    <div key={i} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <p className="text-xs font-medium">{o.title}</p>
                      <p className="text-[10px] text-muted-foreground">{o.deadline} · {o.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
