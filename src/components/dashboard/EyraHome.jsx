import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ChevronRight, Compass, FolderOpen, Lightbulb, Loader2, Plus, Search, Users, Zap } from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import { getLocalGreeting } from '@/lib/local-greeting';
import { useCapabilities } from '@/lib/capabilities';
import { useAuth } from '@/lib/AuthContext';

const START_POINTS = [
  { title: 'Explore the literature', description: 'Search real academic indexes and inspect original papers.', href: '/discover', icon: BookOpen },
  { title: 'Find researchers', description: 'Discover researchers and inspect their scholarly profiles.', href: '/researchers', icon: Users },
  { title: 'Explore funding', description: 'Review opportunities with links to their official sources.', href: '/opportunities', icon: Zap },
  { title: 'Capture an idea', description: 'Keep an early research direction in your workspace.', href: '/ideas', icon: Lightbulb },
];

function ProjectRow({ project }) {
  const date = project.updated_date && !Number.isNaN(new Date(project.updated_date).getTime())
    ? new Date(project.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
  return (
    <Link to={'/projects/' + encodeURIComponent(project.id)} className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-secondary/50">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><FolderOpen size={18} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{project.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{project.status || 'Project'}{date ? ' · Updated ' + date : ''}</span>
      </span>
      <ChevronRight size={17} className="shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
    </Link>
  );
}

export default function EyraHome({ onSearch }) {
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { user: authUser } = useAuth();

  const loadProfile = () => {
    let active = true;
    // Returned cleanup prevents a stale request updating a navigated-away page.
    const request = buildUserProfile();
    request.then(next => { if (active) { setProfile(next); setProfileError(false); } })
      .catch(() => { if (active) setProfileError(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  };
  useEffect(() => loadProfile(), []);

  const projects = profile?.activeProjects || [];
  const displayName = profile?.user?.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
  const greeting = getLocalGreeting(displayName);
  const userType = profile?.user?.user_type;
  const defaultLevel = userType === 'student' ? 'student'
    : ['masters', 'phd'].includes(userType) ? 'researcher'
      : userType === 'professor' ? 'expert' : '';
  const eyraReady = !capabilitiesLoading && Boolean(capabilities?.ai);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border/70 pb-7">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.13em] text-primary">Your research workspace</p>
            <p className="text-sm text-muted-foreground">{greeting.greeting}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-foreground sm:text-[2.75rem] sm:leading-[1.14]">What would you like to research?</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">Start with a topic. EYLO helps you find papers, understand evidence, connect with researchers and build a project.</p>
          </div>
          <Link to="/projects" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-secondary">
            <Plus size={17} aria-hidden="true" /> New project
          </Link>
        </header>

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.9fr)]">
          <section aria-labelledby="ask-heading" className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-5 shadow-[0_24px_72px_-48px_rgba(15,23,42,0.3)] sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Compass size={19} aria-hidden="true" /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Start with a question</p>
                <h2 id="ask-heading" className="mt-1 text-xl font-semibold tracking-tight text-foreground">Search academic research</h2>
              </div>
            </div>
            <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
            <p className="mt-5 border-t border-border/60 pt-4 text-xs leading-5 text-muted-foreground">Search results come from academic sources. EYRA interpretations are labeled separately from retrieved evidence.</p>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-sm" aria-labelledby="eyra-title">
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Search size={19} aria-hidden="true" /></span>
                <span className="text-xs text-muted-foreground">{eyraReady ? 'AI available' : 'AI unavailable'}</span>
              </div>
              <h2 id="eyra-title" className="text-xl font-semibold tracking-tight">Ask EYRA</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask questions about papers, research methods and your next steps.</p>
              <button type="button" disabled={!eyraReady} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))} className="mt-6 inline-flex min-h-11 w-full items-center justify-between rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                Ask EYRA <ArrowRight size={16} aria-hidden="true" />
              </button>
              {!eyraReady && <p className="mt-3 text-xs text-muted-foreground">AI tools are not available for this workspace right now.</p>}
            </section>
            <Link to="/library" className="group flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/70 bg-secondary/40 px-5 py-4 text-sm font-semibold hover:bg-secondary">
              <span className="inline-flex items-center gap-3"><BookOpen size={18} className="text-primary" aria-hidden="true" /> Open saved library</span>
              <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </Link>
          </aside>
        </div>

        <section className="mt-10" aria-labelledby="projects-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pick up where you left off</p><h2 id="projects-heading" className="mt-2 text-2xl font-semibold tracking-tight">Your projects</h2></div>
            <Link to="/projects" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline">View all projects <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          {!loaded ? (
            <div className="grid min-h-28 place-items-center rounded-2xl border border-border bg-card" role="status"><Loader2 className="animate-spin text-primary" /><span className="sr-only">Loading your projects</span></div>
          ) : profileError ? (
            <div className="rounded-2xl border border-border bg-card p-6"><p className="font-medium">Your projects could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">The workspace data service may be temporarily unavailable.</p><button type="button" onClick={() => { setLoaded(false); setProfileError(false); buildUserProfile().then(setProfile).catch(() => setProfileError(true)).finally(() => setLoaded(true)); }} className="mt-3 text-sm font-semibold text-primary hover:underline">Try again</button></div>
          ) : projects.length ? (
            <div className="grid gap-3 md:grid-cols-2">{projects.slice(0, 4).map(project => <ProjectRow key={project.id} project={project} />)}</div>
          ) : (
            <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Your first project starts here</h3><p className="mt-1 text-sm text-muted-foreground">Connect papers, people and decisions as your research develops.</p></div><Link to="/projects" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Create project <ArrowRight size={15} aria-hidden="true" /></Link></div>
          )}
        </section>

        <section className="mt-10" aria-labelledby="explore-heading">
          <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">A connected research journey</p><h2 id="explore-heading" className="mt-2 text-2xl font-semibold tracking-tight">Explore your next step</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {START_POINTS.map(({ title, description, href, icon: Icon }) => (
              <Link key={href} to={href} className="group flex min-h-48 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-secondary/30">
                <span className="mb-6 grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon size={19} aria-hidden="true" /></span>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{description}</p>
                <ArrowRight size={17} className="mt-4 self-end text-muted-foreground group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
