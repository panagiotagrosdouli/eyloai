import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, ChevronRight, FolderOpen, Loader2, Search,
  Sparkles, Users, Zap,
} from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import { getLocalGreeting } from '@/lib/local-greeting';
import { useCapabilities } from '@/lib/capabilities';
import { useAuth } from '@/lib/AuthContext';

const QUICK_LINKS = [
  { label: 'Researchers', href: '/researchers', icon: Users },
  { label: 'Funding', href: '/opportunities', icon: Zap },
  { label: 'Library', href: '/library', icon: BookOpen },
];

function ProjectCard({ project }) {
  const updated = project.updated_date
    ? new Date(project.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <Link to={`/projects/${project.id}`} className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30 hover:bg-secondary/30">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground group-hover:text-primary"><FolderOpen size={15} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{project.title}</span>
        <span className="mt-1 block text-xs capitalize text-muted-foreground">{project.status || 'active'}{updated ? ` · ${updated}` : ''}</span>
      </span>
      <ChevronRight size={15} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
    </Link>
  );
}

export default function EyraHome({ onSearch }) {
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { user: authUser } = useAuth();

  useEffect(() => {
    let active = true;
    buildUserProfile()
      .then(nextProfile => { if (active) setProfile(nextProfile); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const activeProjects = profile?.activeProjects || [];
  const displayName = profile?.user?.full_name
    || authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || '';
  const greeting = getLocalGreeting(displayName);
  const userType = profile?.user?.user_type;
  const defaultLevel = userType === 'student' ? 'student'
    : ['masters', 'phd'].includes(userType) ? 'researcher'
      : userType === 'professor' ? 'expert' : '';
  const eyraReady = !capabilitiesLoading && capabilities.ai;

  return (
    <div className="min-h-[calc(100vh-5rem)]">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting.greeting}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{greeting.question}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Pick up a project or start with a question.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${eyraReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            EYRA {eyraReady ? 'ready' : 'limited'}
            {loaded && <span className="border-l border-border pl-2">{activeProjects.length} active {activeProjects.length === 1 ? 'project' : 'projects'}</span>}
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="research-prompt-title">
          <div className="mb-4 flex items-center gap-2 text-primary"><Search size={16} aria-hidden="true" /><h2 id="research-prompt-title" className="text-base font-semibold text-foreground">What are you researching?</h2></div>
          <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="mr-1 text-xs text-muted-foreground">Go to</span>
            {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
              <Link key={label} to={href} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <Icon size={14} aria-hidden="true" />{label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="continue-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Continue</p><h2 id="continue-title" className="mt-1 text-xl font-semibold">Your active projects</h2></div>
            <Link to="/projects" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/10">All projects <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          {!loaded ? (
            <div className="grid min-h-24 place-items-center rounded-xl border border-border bg-card" role="status"><Loader2 className="animate-spin text-primary" /><span className="sr-only">Loading projects</span></div>
          ) : activeProjects.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {activeProjects.slice(0, 4).map(project => <ProjectCard key={project.id} project={project} />)}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h3 className="text-sm font-semibold">No active projects yet</h3><p className="mt-1 text-sm text-muted-foreground">Save evidence to a project to keep your research together.</p></div>
              <Link to="/projects" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Create project <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        <section className="mt-8 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Sparkles size={16} aria-hidden="true" /></span>
            <div><h2 className="text-sm font-semibold">Reason over your workspace</h2><p className="mt-1 text-sm text-muted-foreground">Ask EYRA about your saved evidence and project context.</p></div>
          </div>
          <button type="button" disabled={!eyraReady} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/25 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
            Ask EYRA <span className="font-mono text-xs opacity-70">⌘K</span>
          </button>
        </section>
      </div>
    </div>
  );
}
