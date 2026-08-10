import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { buildUserProfile } from '@/lib/second-brain';
import { getPersona } from '@/lib/persona';
import UserTypeOnboarding from '@/components/eyra/UserTypeOnboarding';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import {
  ArrowRight, Sparkles,
  FolderOpen, Plus, ChevronRight, BookOpen, Zap,
  TrendingUp, Play, Brain, Activity, ShieldCheck, Radio
} from 'lucide-react';
import moment from 'moment';

/* ─── Welcome screen ─────────────────────────────────────── */
function WelcomeScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="flex justify-center mb-10">
          <div className="w-20 h-20 rounded-3xl overflow-hidden bg-white shadow-lg">
            <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
          </div>
        </div>
        <h1 className="font-heading font-bold text-4xl text-foreground mb-4 leading-tight">
          Meet <span className="eyra-text-gradient">EYRA</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Your AI copilot for turning an idea into sourced research, a project plan and concrete next actions.
        </p>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl eyra-gradient text-white font-semibold text-base hover:opacity-90 transition-opacity"
        >
          Get Started <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Active project card ─────────────────────────────────── */
function ProjectCard({ project }) {
  return (
    <Link to={`/projects/${project.id}`}>
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all group">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Play size={13} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{project.status} · {moment(project.updated_date).fromNow()}</p>
        </div>
        <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}

/* ─── EYRA Suggestion ─────────────────────────────────────── */
function EyraSuggestion({ profile, persona }) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const key = `eyra_home_suggestion_${new Date().toDateString()}`;
    const cached = localStorage.getItem(key);
    if (cached) { try { setSuggestion(JSON.parse(cached)); return; } catch {} }

    setLoading(true);
    const ctx = [
      profile.activeProjects.length ? `Projects: ${profile.activeProjects.map(p => p.title).join(', ')}` : 'No projects yet',
      `Activity score: ${profile.stats.activityScore}/100`,
    ].join('. ');

    base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA. Give ONE clear action for today.
Context: ${ctx}
User type: ${persona?.label || 'researcher'}
Return JSON: { "message": "One sentence, max 18 words, what to focus on today", "action": "2-3 word label", "href": "one of: /projects, /foryou, /briefing, /ideas, /radar, /library" }`,
      response_json_schema: {
        type: 'object',
        properties: { message: { type: 'string' }, action: { type: 'string' }, href: { type: 'string', enum: ['/projects', '/foryou', '/briefing', '/ideas', '/radar', '/library'] } }
      }
    }).then(r => {
      setSuggestion(r);
      localStorage.setItem(key, JSON.stringify(r));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [profile]);

  if (loading) return (
    <div className="h-16 rounded-2xl border border-border bg-card animate-pulse" />
  );
  if (!suggestion) return null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5">
      <div className="w-8 h-8 rounded-xl overflow-hidden bg-white flex-shrink-0 mt-0.5">
        <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">EYRA suggests</p>
        <p className="text-sm text-foreground/90 leading-relaxed">{suggestion.message}</p>
      </div>
      {suggestion.href && (
        <Link to={suggestion.href} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap">
          {suggestion.action} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

/* ─── Quick Start (no projects) ───────────────────────────── */
function QuickStart({ onSearch }) {
  const steps = [
    { icon: Brain, title: 'Ask EYRA anything', desc: 'Search papers, researchers, funding', action: 'Start searching', onClick: () => onSearch('recent AI breakthroughs') },
    { icon: FolderOpen, title: 'Create a project', desc: 'Keep everything in one place', action: 'New project', href: '/projects' },
    { icon: Zap, title: 'Find funding', desc: 'Official grants and calls', action: 'Explore', href: '/radar' },
  ];
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-4">Where would you like to start?</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const inner = (
            <div className={`p-5 rounded-2xl border transition-all cursor-pointer group h-full ${i === 0 ? 'border-primary/30 bg-primary/5 hover:bg-primary/8' : 'border-border bg-card hover:border-primary/20'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${i === 0 ? 'bg-primary/10' : 'bg-secondary'}`}>
                <Icon size={15} className={i === 0 ? 'text-primary' : 'text-muted-foreground'} />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{s.title}</p>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{s.desc}</p>
              <p className={`flex items-center gap-1 text-xs font-medium ${i === 0 ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'} transition-colors`}>
                {s.action} <ChevronRight size={11} />
              </p>
            </div>
          );
          return s.href
            ? <Link key={i} to={s.href} className="flex">{inner}</Link>
            : <button key={i} onClick={s.onClick} className="text-left flex">{inner}</button>;
        })}
      </div>
    </div>
  );
}

/* ─── Main EyraHome ───────────────────────────────────────── */
export default function EyraHome({ onSearch }) {
  const [profile, setProfile] = useState(null);
  const [userType, setUserType] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    buildUserProfile().then(p => {
      setProfile(p);
      const type = p.user?.user_type;
      const hasVisited = localStorage.getItem('eylo_has_visited');
      if (!type && !hasVisited) {
        setShowWelcome(true);
      } else if (!type) {
        setShowOnboarding(true);
      } else {
        setUserType(type);
      }
      setLoaded(true);
    });
  }, []);

  if (showWelcome) return <WelcomeScreen onStart={() => { localStorage.setItem('eylo_has_visited', '1'); setShowWelcome(false); setShowOnboarding(true); }} />;
  if (showOnboarding) return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur">
      <UserTypeOnboarding onComplete={(type) => { setUserType(type); setShowOnboarding(false); buildUserProfile().then(setProfile); }} />
    </div>
  );

  const persona = getPersona(userType);
  const userName = profile?.user?.full_name?.split(' ')[0];
  const activeProjects = profile?.activeProjects || [];
  const hasProjects = activeProjects.length > 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const shortcuts = [
    { label: 'Daily Briefing', desc: 'Your intelligence feed', href: '/foryou', icon: Sparkles },
    { label: 'Opportunity Radar', desc: 'Funding and active calls', href: '/radar', icon: Zap },
    { label: 'Knowledge Library', desc: 'Saved evidence', href: '/library', icon: BookOpen },
    { label: 'Future Me', desc: 'Your strategic trajectory', href: '/futureme', icon: TrendingUp },
  ];

  return (
    <div className="hero-bg min-h-screen overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="eylo-command-deck relative overflow-hidden rounded-[2rem] border border-cyan-200/10 px-5 py-7 sm:px-10 sm:py-10">
          <div className="relative z-10">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/75">
                <Radio size={12} className="text-emerald-400" aria-hidden="true" />
                EYLO Intelligence Workspace
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-3 py-1.5 text-[10px] text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Authenticated AI workspace
              </div>
            </div>

            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-medium text-slate-400">{userName ? `${greeting}, ${userName}` : greeting}</p>
              <h1 className="font-heading text-4xl font-bold leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">
                Turn one idea into
                <span className="block eyra-text-gradient">research, momentum, impact.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Ask EYRA what you want to build. EYLO connects the evidence, people, projects and opportunities needed to move forward.
              </p>
            </div>

            <div className="mt-8 max-w-5xl">
              <GuidedSearch
                onSearch={onSearch}
                defaultLevel={userType === 'student' ? 'student' : ['masters', 'phd'].includes(userType) ? 'researcher' : userType === 'professor' ? 'expert' : ''}
              />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
          <div className="space-y-5">
            {hasProjects && profile && <EyraSuggestion profile={profile} persona={persona} />}

            <section className="eylo-glass-panel rounded-3xl p-5 sm:p-6">
              {hasProjects ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/60">Active execution</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">Continue where you left off</h2>
                    </div>
                    <Link to="/projects" className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-100">All projects <ChevronRight size={12} /></Link>
                  </div>
                  <div className="space-y-2">{activeProjects.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)}</div>
                  <Link to="/projects" className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-200/15 py-3.5 text-xs text-slate-400 hover:border-cyan-300/35 hover:text-cyan-200 transition-all"><Plus size={13} /> New Project</Link>
                </>
              ) : (
                loaded && <QuickStart onSearch={onSearch} />
              )}
            </section>
          </div>

          <aside className="eylo-glass-panel rounded-3xl p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-violet-200/60">Intelligence deck</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Your command paths</h2>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/10 bg-cyan-300/5"><Activity size={16} className="text-cyan-300" /></div>
            </div>

            <div className="space-y-2">
              {shortcuts.map(({ label, desc, href, icon: Icon }) => (
                <Link key={href} to={href} className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] p-3 hover:border-cyan-200/15 hover:bg-cyan-300/[0.04] transition-all">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-cyan-300"><Icon size={15} /></div>
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-100">{label}</p><p className="mt-0.5 text-[10px] text-slate-500">{desc}</p></div>
                  <ChevronRight size={13} className="text-slate-600 group-hover:text-cyan-300" />
                </Link>
              ))}
            </div>

            <div className="mt-5 border-t border-white/5 pt-5">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs text-slate-300"><ShieldCheck size={14} className="text-emerald-400" /> Workspace activity</span><strong className="text-sm text-cyan-300">{profile?.stats.activityScore || 0}/100</strong></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full eyra-gradient transition-all" style={{ width: `${profile?.stats.activityScore || 0}%` }} /></div>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">{profile?.stats.projects || 0} projects · {profile?.stats.papers || 0} papers · {profile?.stats.researchers || 0} researchers</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
