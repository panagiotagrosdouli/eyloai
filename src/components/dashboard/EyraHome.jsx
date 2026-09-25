import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, FolderOpen, Plus,
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
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">Your research copilot for finding evidence, understanding what it means and deciding what to do next.</p>
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
  { label: 'Create a project', href: '/projects', icon: FolderOpen },
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
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">{localGreeting.greeting}</p>
            <h1 className="max-w-3xl font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{localGreeting.question}</h1>
            <p className="mt-2 text-xs text-muted-foreground">Your workspace is ready for the next research question.</p>
          </div>
          <ServiceStatus compact />
        </header>

        <section className="rounded-[1.75rem] border border-border bg-card p-5 sm:p-7">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Research</p>
            <h2 className="mt-2 text-lg font-semibold text-foreground">What are you researching?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Search live scholarly sources, inspect the evidence, and save what matters into a project.</p>
          </div>
          <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">Projects</h2>
              <Link to="/projects" className="text-xs font-medium text-primary hover:underline">All</Link>
            </div>

            {!loaded ? (
              <div className="space-y-2" role="status" aria-live="polite">
                {[0, 1, 2].map(item => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <span className="h-9 w-9 animate-pulse rounded-xl bg-secondary" />
                    <span className="min-w-0 flex-1">
                      <span className="block h-3 w-1/2 animate-pulse rounded bg-secondary" />
                      <span className="mt-2 block h-2.5 w-1/3 animate-pulse rounded bg-secondary/70" />
                    </span>
                  </div>
                ))}
                <span className="sr-only">Loading workspace</span>
              </div>
            ) : activeProjects.length ? (
              <div className="space-y-2">
                {activeProjects.slice(0, 4).map(project => <ProjectCard key={project.id} project={project} />)}
                <Link to="/projects" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary"><Plus size={13} />New project</Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-muted-foreground"><FolderOpen size={17} /></div>
                <h3 className="mt-4 text-sm font-semibold">No projects yet</h3>
                <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">Create a workspace around a research question and keep its evidence, notes and next actions together.</p>
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

        <section className="mt-8 flex flex-col justify-between gap-5 border-t border-border pt-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold">Reason over your research with EYRA</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Use saved evidence and project context to compare findings, challenge assumptions and choose a next action.</p>
          </div>
          <button type="button" disabled={capabilitiesLoading || !capabilities.ai} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45">
            Ask EYRA
          </button>
        </section>
      </div>
    </div>
  );
}
