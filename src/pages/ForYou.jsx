import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { buildUserProfile } from '@/lib/second-brain';
import { markVisit } from '@/lib/eyra-monitor';
import {
  Sparkles, RefreshCw, Loader2, FileText, Users,
  DollarSign, TrendingUp, Zap, ArrowRight, Brain,
  Clock, ChevronRight, Lightbulb, BookOpen, Award,
  CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import EyraDigitalTwin from '@/components/eyra/EyraDigitalTwin';
import DailyMissions from '@/components/eyra/DailyMissions';
import WhileYouWereAway from '@/components/eyra/WhileYouWereAway';
import moment from 'moment';

const EYRA_STATUS = [
  'Monitoring OpenAlex for new papers',
  'Scanning arXiv for preprints',
  'Tracking funding opportunities',
  'Analyzing collaboration matches',
  'Detecting research gaps',
  'Watching Europe PMC for publications',
];

function EyraStatusBar() {
  const [statusIdx, setStatusIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setStatusIdx(i => (i + 1) % EYRA_STATUS.length); setVisible(true); }, 300);
    }, 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/20 bg-green-500/5">
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
      <p className="text-xs text-muted-foreground transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }}>
        <span className="text-green-400 font-semibold">EYRA</span> · {EYRA_STATUS[statusIdx]}
      </p>
    </div>
  );
}

export default function ForYou() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    buildUserProfile().then(p => {
      setProfile(p);
      setLoading(false);
      // Mark visit AFTER we've loaded the "while you were away" data
      setTimeout(() => markVisit(), 3000);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
            <Sparkles size={20} className="text-white" />
          </div>
          <p className="text-sm font-medium">EYRA is scanning your field...</p>
          <p className="text-xs text-muted-foreground mt-1">Fetching real data from OpenAlex · arXiv · Europe PMC</p>
        </div>
      </div>
    );
  }

  const activeProjects = profile?.activeProjects || [];
  const searches = profile?.searches || [];
  const activeProject = activeProjects[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-white">
              <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-heading font-bold text-xl text-foreground">EYRA Intelligence</h1>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Real-time monitoring · OpenAlex · arXiv · Europe PMC · No fabricated data</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main feed */}
        <div className="lg:col-span-2 space-y-5">

          {/* EYRA Live Status */}
          <EyraStatusBar />

          {/* WHILE YOU WERE AWAY — primary section */}
          {(activeProjects.length > 0 || searches.length > 0) ? (
            <WhileYouWereAway
              projects={activeProjects}
              searchHistory={searches}
            />
          ) : (
            <div className="p-8 rounded-2xl border border-dashed border-border text-center">
              <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                <Sparkles size={20} className="text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-2">EYRA needs a project to monitor</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed mb-4">
                Create a project and EYRA will autonomously monitor OpenAlex, arXiv, and Europe PMC for relevant papers, researchers, and opportunities.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link to="/projects" className="px-4 py-2 rounded-xl eyra-gradient text-white text-xs font-semibold">Create a Project</Link>
                <Link to="/" className="px-4 py-2 rounded-xl border border-border text-xs font-medium">Discover Research</Link>
              </div>
            </div>
          )}

          {/* Digital Twin for active project */}
          {activeProject && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
                Project Twin · {activeProject.title}
              </p>
              <EyraDigitalTwin project={activeProject} />
            </div>
          )}

          {/* Daily Missions */}
          {activeProjects.length > 0 && (
            <DailyMissions projects={activeProjects} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Second Brain stats */}
          {profile && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">EYRA Intelligence Score</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Projects', value: profile.stats.projects },
                  { label: 'Papers', value: profile.stats.papers },
                  { label: 'Funding', value: profile.stats.opportunities },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-secondary/30">
                    <p className="font-bold text-sm font-heading">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-muted-foreground">Intelligence</p>
                <p className="text-[10px] font-semibold text-primary">{profile.stats.activityScore}/100</p>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full eyra-gradient transition-all" style={{ width: `${profile.stats.activityScore}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-2 text-center">
                Based on your real library activity
              </p>
            </div>
          )}

          {/* Data sources */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Live Data Sources</p>
            <div className="space-y-2">
              {[
                { name: 'OpenAlex', desc: 'Papers · Researchers · Institutions', active: true },
                { name: 'arXiv', desc: 'Preprints · Latest research', active: true },
                { name: 'Europe PMC', desc: 'Biomedical · Life sciences', active: true },
                { name: 'CORDIS / Horizon', desc: 'EU grants · Funding', active: false, label: 'Coming' },
                { name: 'PubMed', desc: 'Medical · Clinical research', active: false, label: 'Coming' },
              ].map(src => (
                <div key={src.name} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${src.active ? 'bg-green-400 animate-pulse' : 'bg-border'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground">{src.name}</p>
                    <p className="text-[9px] text-muted-foreground">{src.desc}</p>
                  </div>
                  {src.label && <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{src.label}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Quick nav */}
          <div className="space-y-1">
            {[
              { label: 'Executive Briefing', desc: 'Board-level strategy', href: '/briefing', icon: Brain },
              { label: 'Opportunity Radar', desc: 'Find grants & funding', href: '/radar', icon: Award },
              { label: 'Idea Vault', desc: 'Capture & develop ideas', href: '/ideas', icon: Lightbulb },
              { label: 'Dream Team', desc: 'Find collaborators', href: '/dreamteam', icon: Users },
            ].map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.href} to={a.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <Icon size={12} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{a.label}</p>
                      <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                    </div>
                    <ChevronRight size={11} className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
