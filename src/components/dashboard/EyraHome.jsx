import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, Clock3, FolderOpen, Loader2, Plus,
  Radar, Search, Sparkles, Users, Zap,
} from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import UserTypeOnboarding from '@/components/eyra/UserTypeOnboarding';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import ServiceStatus from '@/components/system/ServiceStatus';
import { getLocalGreeting } from '@/lib/local-greeting';
import { useCapabilities } from '@/lib/capabilities';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/brand/BrandLogo';

function WelcomeScreen({ onStart }) {
  return (
    <div className="relative grid min-h-[calc(100vh-5rem)] place-items-center overflow-hidden px-5 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,hsl(var(--primary)/0.14),transparent_36%)]" />
      <div className="relative max-w-xl">
        <div className="mx-auto mb-8 flex w-fit items-center gap-3 rounded-full border border-border bg-card/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Research operating system
        </div>
        <BrandLogo brand="eyra" size="hero" className="mx-auto" priority />
        <h1 className="mt-8 font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Meet EYRA.</h1>
        <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-muted-foreground">
          Your research copilot for finding evidence, connecting context and moving from an open question to the next defensible action.
        </p>
        <button type="button" onClick={onStart} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90">
          Enter workspace <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project }) {
  const updated = project.updated_date ? new Date(project.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recently';
  return (
    <Link to={`/projects/${project.id}`} className="group flex items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-secondary/70 text-muted-foreground group-hover:text-primary"><FolderOpen size={15} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{project.title}</span>
        <span className="mt-0.5 block text-[10px] capitalize text-muted-foreground">{project.status || 'active'} · {updated}</span>
      </span>
      <ChevronRight size={14} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

const CORE_ACTIONS = [
  { label: 'Discover evidence', description: 'Search live scholarly sources', href: '/home', icon: Search },
  { label: 'Find researchers', description: 'Map authors and expertise', href: '/researchers', icon: Users },
  { label: 'Scan funding', description: 'Review active opportunities', href: '/opportunities', icon: Zap },
  { label: 'Open library', description: 'Return to saved evidence', href: '/library', icon: BookOpen },
];

export default function EyraHome({ onSearch }) {
  const [profile, setProfile] = useState(null);
  const [userType, setUserType] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [localNow, setLocalNow] = useState(() => new Date());
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { user: authUser } = useAuth();

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

  useEffect(() => {
    const refreshLocalTime = () => setLocalNow(new Date());
    const timer = window.setInterval(refreshLocalTime, 60_000);
    document.addEventListener('visibilitychange', refreshLocalTime);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshLocalTime);
    };
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

  const activeProjects = profile?.activeProjects || [];
  const displayName = profile?.user?.full_name
    || authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || '';
  const localGreeting = getLocalGreeting(displayName, localNow);
  const defaultLevel = userType === 'student' ? 'student' : ['masters', 'phd'].includes(userType) ? 'researcher' : userType === 'professor' ? 'expert' : '';

  const workspaceSignals = useMemo(() => [
    { label: 'Active projects', value: loaded ? activeProjects.length : '—', icon: FolderOpen },
    { label: 'Research mode', value: userType ? userType.replace('_', ' ') : 'adaptive', icon: Radar },
    { label: 'EYRA', value: !capabilitiesLoading && capabilities.ai ? 'online' : 'limited', icon: Sparkles },
  ], [activeProjects.length, capabilities.ai, capabilitiesLoading, loaded, userType]);

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <div className="mx-auto max-w-[90rem] px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-card/70 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,hsl(var(--primary)/0.16),transparent_28%),radial-gradient(circle_at_15%_90%,hsl(var(--accent)/0.08),transparent_32%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.55fr)] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> EYLO workspace
                </span>
                <ServiceStatus />
              </div>
              <p className="mt-7 text-sm font-medium text-muted-foreground">{localGreeting.greeting}</p>
              <h1 className="mt-2 max-w-4xl font-heading text-4xl font-semibold tracking-[-0.05em] sm:text-6xl xl:text-7xl">{localGreeting.question}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
                Search the literature, capture what matters, connect it to a project and keep moving. EYLO is designed to become the place you return to every day.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock3 size={13} /> {localGreeting.localTime} in {localGreeting.place}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {workspaceSignals.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-2xl border border-border bg-background/55 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
                    <Icon size={14} className="text-primary" />
                  </div>
                  <p className="mt-3 text-xl font-semibold capitalize">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
          <section className="rounded-[1.75rem] border border-border bg-card p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Command bar</p>
                <h2 className="mt-2 text-xl font-semibold">What are you researching?</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Start with a question. EYLO retrieves source-backed evidence and keeps the context reusable.</p>
              </div>
              <BrandLogo brand="eyra" size="panel" />
            </div>
            <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
          </section>

          <aside className="rounded-[1.75rem] border border-border bg-card p-4 sm:p-5">
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Launchpad</p>
              <h2 className="mt-2 text-lg font-semibold">Move faster</h2>
            </div>
            <div className="space-y-2">
              {CORE_ACTIONS.map(({ label, description, href, icon: Icon }) => (
                <Link key={label} to={href} className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-border hover:bg-secondary/45">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground group-hover:text-primary"><Icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Continuity</p>
                <h2 className="mt-1 text-lg font-semibold">Continue your projects</h2>
              </div>
              <Link to="/projects" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </div>

            {!loaded ? (
              <div className="grid min-h-44 place-items-center rounded-[1.75rem] border border-border bg-card" role="status"><Loader2 className="animate-spin text-primary" /><span className="sr-only">Loading workspace</span></div>
            ) : activeProjects.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {activeProjects.slice(0, 4).map(project => <ProjectCard key={project.id} project={project} />)}
                <Link to="/projects" className="flex min-h-[4.25rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary"><Plus size={13} />New project</Link>
              </div>
            ) : (
              <div className="rounded-[1.75rem] border border-border bg-card p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><FolderOpen size={18} /></div>
                <h3 className="mt-4 font-semibold">Build your first research thread.</h3>
                <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Create a project to keep evidence, people, funding and decisions connected over time.</p>
                <Link to="/projects" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Create project <ArrowRight size={12} /></Link>
              </div>
            )}
          </section>

          <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-primary/[0.06] p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary"><Sparkles size={13} /> EYRA intelligence</div>
              <h2 className="mt-5 max-w-sm text-2xl font-semibold tracking-[-0.03em]">Reason over your workspace, not an empty chat.</h2>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Use saved evidence and project context to challenge assumptions, compare directions and decide the next action.</p>
              <button type="button" disabled={capabilitiesLoading || !capabilities.ai} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45">
                Ask EYRA <span className="font-mono text-[9px] opacity-60">⌘K</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
