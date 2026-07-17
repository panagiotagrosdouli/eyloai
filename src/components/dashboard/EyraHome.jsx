import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { buildUserProfile } from '@/lib/second-brain';
import { getPersona } from '@/lib/persona';
import UserTypeOnboarding from '@/components/eyra/UserTypeOnboarding';
import {
  ArrowRight, Sparkles, Loader2,
  FolderOpen, Plus, ChevronRight, BookOpen, Zap,
  TrendingUp, Play, Brain, Lightbulb
} from 'lucide-react';
import moment from 'moment';

/* ─── Welcome screen ─────────────────────────────────────── */
function WelcomeScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="flex justify-center mb-10">
          <div className="w-20 h-20 rounded-3xl overflow-hidden bg-white shadow-lg">
            <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
          </div>
        </div>
        <h1 className="font-heading font-bold text-4xl text-foreground mb-4 leading-tight">
          Meet <span className="eyra-text-gradient">EYRA</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Your AI co-founder for research, startups, and innovation — from first idea to funded project.
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
        properties: { message: { type: 'string' }, action: { type: 'string' }, href: { type: 'string' } }
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
        <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
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

/* ─── Search Bar ──────────────────────────────────────────── */
function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 200); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const examples = [
    'Quantum machine learning',
    'Climate change startups',
    'CRISPR gene editing',
    'Federated learning',
  ];

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center p-1.5 rounded-2xl border border-border/60 bg-card focus-within:border-primary/40 transition-all shadow-sm">
          <Sparkles size={15} className="ml-3 text-primary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search papers, researchers, funding..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none py-3.5 px-3"
          />
          <button type="submit" disabled={!query.trim()}
            className="flex items-center gap-1.5 px-5 py-3 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-30 hover:opacity-90 transition-opacity flex-shrink-0">
            Search <ArrowRight size={13} />
          </button>
        </div>
      </form>
      <div className="flex flex-wrap gap-2 mt-3">
        {examples.map(ex => (
          <button key={ex} onClick={() => onSearch(ex)}
            className="px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Quick Start (no projects) ───────────────────────────── */
function QuickStart({ onSearch }) {
  const steps = [
    { icon: Brain, title: 'Ask EYRA anything', desc: 'Search papers, researchers, funding', action: 'Start searching', onClick: () => onSearch('recent AI breakthroughs') },
    { icon: FolderOpen, title: 'Create a project', desc: 'Keep everything in one place', action: 'New project', href: '/projects' },
    { icon: Zap, title: 'Find funding', desc: 'Grants, accelerators & calls', action: 'Explore', href: '/radar' },
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">

        {/* Greeting */}
        <div className="mb-10 text-center">
          <h1 className="font-heading font-bold text-3xl sm:text-4xl text-foreground leading-tight mb-2">
            {userName ? (
              <>{greeting}, <span className="eyra-text-gradient">{userName}</span></>
            ) : (
              <>What are we <span className="eyra-text-gradient">building today?</span></>
            )}
          </h1>
          {userName && (
            <p className="text-muted-foreground text-base">What are we building today?</p>
          )}
        </div>

        {/* Primary Search */}
        <div className="mb-8">
          <SearchBar onSearch={onSearch} />
        </div>

        {/* EYRA Suggestion (returning users with projects) */}
        {hasProjects && profile && (
          <div className="mb-8">
            <EyraSuggestion profile={profile} persona={persona} />
          </div>
        )}

        {/* Projects or Quick Start */}
        {hasProjects ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Continue where you left off</p>
              <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
                All projects <ChevronRight size={11} />
              </Link>
            </div>
            <div className="space-y-2">
              {activeProjects.slice(0, 3).map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
            <Link to="/projects" className="mt-3 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
              <Plus size={13} /> New Project
            </Link>
          </div>
        ) : (
          loaded && <div className="mb-8"><QuickStart onSearch={onSearch} /></div>
        )}

        {/* Secondary shortcuts — always visible, compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Daily Briefing', href: '/foryou', icon: Sparkles },
            { label: 'Opportunities', href: '/radar', icon: Zap },
            { label: 'Library', href: '/library', icon: BookOpen },
            { label: 'Future Me', href: '/futureme', icon: TrendingUp },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={href} to={href}>
              <div className="p-3 rounded-xl border border-border bg-card hover:border-primary/25 hover:bg-primary/3 transition-all group text-center">
                <Icon size={14} className="text-primary mx-auto mb-1.5" />
                <p className="text-xs font-medium text-foreground">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Intelligence score — only once meaningful */}
        {profile && profile.stats.activityScore > 15 && (
          <div className="mt-8 p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">EYRA Intelligence Score</p>
              <span className="text-xs font-bold text-primary">{profile.stats.activityScore}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
              <div className="h-full rounded-full eyra-gradient transition-all" style={{ width: `${profile.stats.activityScore}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {profile.stats.projects} projects · {profile.stats.papers} papers · {profile.stats.researchers} researchers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
