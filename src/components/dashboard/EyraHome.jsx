import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, FolderOpen, Lightbulb, Loader2, Plus,
  Users, Zap,
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
    <div className="grid min-h-[calc(100vh-5rem)] place-items-center px-5 py-16 text-center">
      <div className="max-w-lg">
        <BrandLogo brand="eyra" size="hero" className="mx-auto" priority />
        <h1 className="mt-8 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Meet EYRA.</h1>
        <p className="mx-auto mt-4 text-base text-muted-foreground">Search. Decide. Move.</p>
        <button type="button" onClick={onStart} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Continue <ArrowRight size={14} />
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
  { label: 'Find researchers', href: '/researchers', icon: Users },
  { label: 'Search funding', href: '/opportunities', icon: Zap },
  { label: 'Open library', href: '/library', icon: BookOpen },
  { label: 'Capture an idea', href: '/ideas', icon: Lightbulb },
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

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-foreground">{localGreeting.greeting}</p>
            <h1 className="mt-2 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{localGreeting.question}</h1>
            <p className="mt-2 text-xs text-muted-foreground">{localGreeting.localTime} in {localGreeting.place} · based on your device time zone</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <BrandLogo brand="eyra" size="panel" />
            <ServiceStatus />
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Search</h2>
            </div>
            <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">Projects</h2>
              <Link to="/projects" className="text-xs font-medium text-primary hover:underline">All</Link>
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
                <h3 className="mt-4 font-semibold">No projects yet.</h3>
                <Link to="/projects" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Create project <ArrowRight size={12} /></Link>
              </div>
            )}
          </section>

          <aside>
            <h2 className="mb-3 text-lg font-semibold">Actions</h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {CORE_ACTIONS.map(({ label, href, icon: Icon }) => (
                <Link key={href} to={href} className="group flex items-center gap-3 p-4 hover:bg-secondary/35">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground group-hover:text-primary"><Icon size={15} /></span>
                  <span className="min-w-0 flex-1 text-xs font-semibold">{label}</span>
                  <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-8 flex flex-col justify-between gap-5 rounded-2xl border border-border bg-secondary/25 p-5 sm:flex-row sm:items-center">
          <h2 className="text-sm font-semibold">Need a second opinion?</h2>
          <button type="button" disabled={capabilitiesLoading || !capabilities.ai} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-45">
            Ask EYRA <span className="font-mono text-[9px] opacity-60">⌘K</span>
          </button>
        </section>
      </div>
    </div>
  );
}
