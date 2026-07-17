import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Sparkles, ArrowRight, FolderOpen, ChevronRight,
  Plus, Clock, Zap, FileText, Users, Award, Brain,
  Target, TrendingUp, Lightbulb, Shield
} from 'lucide-react';
import EyraCommandCenter from '@/components/eyra/EyraCommandCenter';
import { EyraPoweredBy, EyraSectionLabel } from '@/components/eyra/EyraBadge';
import EyraDailyBriefing from '@/components/eyra/EyraDailyBriefing';
import DailyMission from '@/components/dashboard/DailyMission';
import { buildUserProfile } from '@/lib/second-brain';
import moment from 'moment';

const EXAMPLES = [
  'AI for early cancer detection',
  'Quantum computing for drug discovery',
  'Federated learning in healthcare',
  'NLP for low-resource languages',
  'Sustainable energy storage',
];

const EYRA_TOOLS = [
  { label: 'For You Feed', desc: 'Personalized intelligence', href: '/foryou', icon: Sparkles },
  { label: 'Idea Vault', desc: 'Capture & monitor ideas', href: '/ideas', icon: Lightbulb },
  { label: 'Opportunity Radar', desc: 'Find grants & investors', href: '/radar', icon: Zap },
  { label: 'Executive Briefing', desc: 'Board-level advisor', href: '/briefing', icon: Brain },
  { label: 'Dream Team Builder', desc: 'Find collaborators', href: '/dreamteam', icon: Users },
];

function getEyraNextAction(projects, stats) {
  if (projects.length === 0) {
    return {
      priority: 'Get started',
      action: 'Describe your research idea above',
      detail: 'EYRA will discover papers, researchers, funding, and build your roadmap in seconds.',
      cta: null,
    };
  }
  const activeProject = projects.find(p => p.status === 'active') || projects[0];
  if (!activeProject.eyra_analysis) {
    return {
      priority: 'Recommended next step',
      action: `Run EYRA analysis on "${activeProject.title}"`,
      detail: 'Identify research gaps, suggest collaborators, and map funding opportunities.',
      cta: { label: 'Open project', href: `/projects/${activeProject.id}` },
    };
  }
  if (stats.researchers === 0) {
    return {
      priority: 'Recommended next step',
      action: 'Discover collaborators for your research',
      detail: 'EYRA has identified expertise gaps. Finding the right collaborators accelerates everything.',
      cta: { label: 'Find researchers', href: '/researchers' },
    };
  }
  if (stats.opportunities === 0) {
    return {
      priority: 'Funding opportunity',
      action: 'Run Opportunity Radar to find funding',
      detail: 'EYRA scans grants, accelerators, and investors — personalized to your goals.',
      cta: { label: 'Run radar', href: '/radar' },
    };
  }
  return {
    priority: 'This week',
    action: 'Review your Executive Briefing',
    detail: 'EYRA has prioritized actions, funding alerts, and project health checks ready for you.',
    cta: { label: 'View briefing', href: '/briefing' },
  };
}

export default function Dashboard({ onSearch }) {
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [stats, setStats] = useState({ papers: 0, researchers: 0, opportunities: 0 });
  const [loading, setLoading] = useState(true);
  const [eyraOpen, setEyraOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const profile = await buildUserProfile();
    setUserProfile(profile);
    setProjects(profile.projects.slice(0, 5));
    setRecentSearches(profile.searches.slice(0, 4));
    setStats({ papers: profile.stats.papers, researchers: profile.stats.researchers, opportunities: profile.stats.opportunities });
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const nextAction = !loading ? getEyraNextAction(projects, stats) : null;
  const userName = userProfile?.user?.full_name?.split(' ')[0] || null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <div className="hero-bg border-b border-border/40 px-4 py-12 sm:py-18">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <img
              src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/a8ecbf98b_ChatGPTImage21202609_26_48.png"
              alt="EYLO"
              className="h-12 sm:h-16 w-auto object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 mb-5">
            <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="h-3.5 w-auto object-contain" />
            <span className="text-[10px] font-semibold tracking-widest text-primary uppercase">EYRA · AI Research Intelligence</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>

          {userName && !loading ? (
            <h1 className="font-heading font-bold text-3xl sm:text-4xl leading-tight text-foreground mb-2">
              {greeting}, <span className="impact-gradient">{userName}</span>
            </h1>
          ) : (
            <h1 className="font-heading font-bold text-3xl sm:text-4xl leading-tight text-foreground mb-2">
              What are you <span className="impact-gradient">building today?</span>
            </h1>
          )}
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-7 leading-relaxed">
            Describe your idea. EYRA discovers papers, researchers, funding, and builds your roadmap.
          </p>

          {/* Search */}
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex items-center gap-2 p-2 rounded-2xl border border-border/60 bg-secondary/60 backdrop-blur-sm eyra-glow">
              <Sparkles size={16} className="ml-3 text-primary flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. AI system for early cancer detection..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none py-3 pr-1"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex items-center gap-2 px-5 py-3 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                Discover <ArrowRight size={14} />
              </button>
            </div>
          </form>

          <EyraPoweredBy label="Powered by EYRA · Real data from OpenAlex, arXiv & Europe PMC" className="mb-4" />

          <div className="flex flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => onSearch(ex)}
                className="px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        {/* EYRA Daily Briefing */}
        {!loading && (
          <EyraDailyBriefing stats={stats} recentSearches={recentSearches} projects={projects} />
        )}

        {/* Daily Mission */}
        {!loading && userProfile && (
          <DailyMission profile={userProfile} />
        )}

        {/* EYRA Next Action */}
        {!loading && nextAction && (
          <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-white flex items-center justify-center flex-shrink-0 animate-pulse-glow">
                <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{nextAction.priority}</p>
                <p className="font-semibold text-sm text-foreground mb-1">{nextAction.action}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{nextAction.detail}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {nextAction.cta && (
                    <Link to={nextAction.cta.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg eyra-gradient text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                      {nextAction.cta.label} <ArrowRight size={11} />
                    </Link>
                  )}
                  <button onClick={() => setEyraOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
                    <Sparkles size={11} /> Ask EYRA anything
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Two columns */}
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Projects */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <EyraSectionLabel label="Your Projects" />
              <Link to="/projects" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                All <ChevronRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-secondary/30 animate-pulse" />)}
              </div>
            ) : projects.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-border/50 text-center">
                <FolderOpen size={20} className="text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No projects yet</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">
                  Search for your idea above — EYRA generates a full intelligence report.
                </p>
                <button
                  onClick={() => onSearch('AI research innovation project')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl eyra-gradient text-white text-xs font-semibold"
                >
                  <Sparkles size={12} /> Start your first discovery
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`}>
                    <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/25 transition-all group card-glow">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              p.status === 'active' ? 'bg-green-500/15 text-green-400' :
                              p.status === 'completed' ? 'bg-primary/15 text-primary' :
                              p.status === 'paused' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-secondary text-muted-foreground'
                            }`}>{p.status || 'planning'}</span>
                            <span className="text-[10px] text-muted-foreground">{moment(p.updated_date).fromNow()}</span>
                            {p.eyra_analysis && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                                <Shield size={7} /> AI Active
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-sm text-foreground truncate">{p.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.goal}</p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                      </div>
                    </div>
                  </Link>
                ))}
                <Link to="/projects">
                  <div className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-border/50 hover:border-primary/30 transition-colors text-xs text-muted-foreground hover:text-primary">
                    <Plus size={13} /> New project
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">

            {/* EYRA Tools */}
            <div>
              <EyraSectionLabel label="EYRA Tools" className="mb-3" />
              <div className="space-y-1">
                {EYRA_TOOLS.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} to={item.href}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                        <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <Icon size={12} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <ChevronRight size={11} className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3 flex items-center gap-1.5">
                  <Clock size={10} /> Recent Discoveries
                </p>
                <div className="space-y-1">
                  {recentSearches.map(s => (
                    <button key={s.id} onClick={() => onSearch(s.query)}
                      className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                      <Sparkles size={11} className="text-muted-foreground/50 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate flex-1 group-hover:text-foreground transition-colors">{s.query}</p>
                      <ArrowRight size={10} className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Library stats */}
            {!loading && (stats.papers > 0 || stats.researchers > 0 || stats.opportunities > 0) && (
              <div>
                <EyraSectionLabel label="EYRA Second Brain" className="mb-3" />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Papers', value: stats.papers, icon: FileText, href: '/library' },
                    { label: 'Researchers', value: stats.researchers, icon: Users, href: '/library' },
                    { label: 'Funding', value: stats.opportunities, icon: Award, href: '/library' },
                  ].map(s => {
                    const Icon = s.icon;
                    return (
                      <Link key={s.label} to={s.href}>
                        <div className="p-3 rounded-xl border border-border bg-card text-center hover:border-primary/25 transition-colors">
                          <p className="font-bold text-base font-heading">{s.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Talk to EYRA */}
            <button onClick={() => setEyraOpen(true)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/8 transition-colors text-left group">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-white flex-shrink-0">
                <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">Talk to EYRA</p>
                <p className="text-[10px] text-muted-foreground">Ask anything about your research</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
            </button>
          </div>
        </div>
      </div>

      <EyraCommandCenter open={eyraOpen} onClose={() => setEyraOpen(false)} />
    </div>
  );
}
