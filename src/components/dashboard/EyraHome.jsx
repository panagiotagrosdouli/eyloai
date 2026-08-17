import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, FolderOpen, Lightbulb, Loader2, Plus,
  Search, Sparkles, Users, Zap,
} from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import UserTypeOnboarding from '@/components/eyra/UserTypeOnboarding';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import ServiceStatus from '@/components/system/ServiceStatus';

function WelcomeScreen({ onStart }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] place-items-center px-5 py-16 text-center">
      <div className="max-w-lg">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-border bg-card">
          <img src="/brand/eyra.png" alt="" className="h-11 w-11 object-contain" />
        </div>
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Your research workspace</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Meet EYRA.</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">Search live evidence, keep the useful records, and turn them into a project with clear next actions.</p>
        <button type="button" onClick={onStart} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Set up my workspace <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const updated = project.updated_date ? new Date(project.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';
  return (
    <Link to={`/projects/${project.id}`} className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground group-hover:text-primary"><FolderOpen size={15} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{project.title}</span><span className="mt-0.5 block text-[10px] capitalize text-muted-foreground">{project.status || 'active'} · {updated}</span></span>
      <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary" />
    </Link>
  );
}

const CORE_ACTIONS = [
  { label: 'Find researchers', detail: 'Search authors and collaborators', href: '/researchers', icon: Users },
  { label: 'Search funding', detail: 'Official opportunities and calls', href: '/opportunities', icon: Zap },
  { label: 'Open library', detail: 'Return to saved evidence', href: '/library', icon: BookOpen },
  { label: 'Capture an idea', detail: 'Start a research thread', href: '/ideas', icon: Lightbulb },
];

export default function EyraHome({ onSearch }) {
  const [profile, setProfile] = useState(null);
  const [userType, setUserType] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    buildUserProfile().then(nextProfile => {
      if (!active) return;
      setProfile(nextProfile);
      const type = nextProfile.user?.user_type;
      const hasVisited = localStorage.getItem('eylo_has_visited');
      if (!type && !hasVisited) setShowWelcome(true);
      else if (!type) setShowOnboarding(true);
      else setUserType(type);
      setLoaded(true);
    }).catch(() => {
      if (active) setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  if (showWelcome) {
    return <WelcomeScreen onStart={() => { localStorage.setItem('eylo_has_visited', '1'); setShowWelcome(false); setShowOnboarding(true); }} />;
  }

  if (showOnboarding) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur">
        <UserTypeOnboarding onComplete={type => { setUserType(type); setShowOnboarding(false); buildUserProfile().then(setProfile); }} />
      </div>
    );
  }

  const userName = profile?.user?.full_name?.trim().split(' ')[0];
  const activeProjects = profile?.activeProjects || [];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const defaultLevel = userType === 'student' ? 'student' : ['masters', 'phd'].includes(userType) ? 'researcher' : userType === 'professor' ? 'expert' : '';

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{userName ? `${greeting}, ${userName}` : greeting}</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">What are you researching?</h1>
          </div>
          <ServiceStatus />
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-4 shadow-[0_28px_90px_-55px_hsl(var(--primary))] sm:p-7">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_66%)]" />
          <div className="relative">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><Search size={13} />Live evidence discovery</div>
            <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">EYLO checks scholarly sources live, labels partial retrieval, removes duplicate records and never invents missing results.</p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p><h2 className="mt-1 text-lg font-semibold">Continue your work</h2></div>
              <Link to="/projects" className="text-xs font-medium text-primary hover:underline">All projects</Link>
            </div>

            {!loaded ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-border bg-card" role="status"><Loader2 className="animate-spin text-primary" /><span className="sr-only">Loading workspace</span></div>
            ) : activeProjects.length ? (
              <div className="space-y-2">
                {activeProjects.slice(0, 4).map(project => <ProjectCard key={project.id} project={project} />)}
                <Link to="/projects" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary"><Plus size={13} />New project</Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><FolderOpen size={17} /></div>
                <h3 className="mt-4 font-semibold">Your first project starts with evidence.</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Run a search above and save the useful records, or create an empty project and define the question yourself.</p>
                <Link to="/projects" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Create project <ArrowRight size={12} /></Link>
              </div>
            )}
          </section>

          <aside>
            <div className="mb-3"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick actions</p><h2 className="mt-1 text-lg font-semibold">Move one step forward</h2></div>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {CORE_ACTIONS.map(({ label, detail, href, icon: Icon }) => (
                <Link key={href} to={href} className="group flex items-center gap-3 p-4 hover:bg-secondary/35">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground group-hover:text-primary"><Icon size={15} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{label}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{detail}</span></span>
                  <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-8 flex flex-col justify-between gap-5 rounded-2xl border border-border bg-secondary/25 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles size={15} /></span><div><h2 className="text-sm font-semibold">Need synthesis instead of a search?</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Ask EYRA from the header. It retrieves context first and separates evidence, inference and uncertainty.</p></div></div>
          <span className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground">Ctrl / ⌘ + K</span>
        </section>
      </div>
    </div>
  );
}
