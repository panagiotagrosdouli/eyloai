import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark, ChevronRight, FolderOpen, Lightbulb, Loader2, Plus, Search, Sparkles, Zap } from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import { getLocalGreeting } from '@/lib/local-greeting';
import { promiseWithTimeout } from '@/lib/promise-timeout';
import { useCapabilities } from '@/lib/capabilities';
import { useAuth } from '@/lib/AuthContext';
import { visibleOwnerProfileState } from '@/lib/auth/owner-scoped-profile.mjs';

const HOME_PROFILE_TIMEOUT_MS = 12_000;


function ProjectRow({ project }) {
  const date = project.updated_date && !Number.isNaN(new Date(project.updated_date).getTime())
    ? new Date(project.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
  return (
    <Link to={'/projects/' + encodeURIComponent(project.id)} className="group flex min-h-[4.5rem] items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-secondary/40">
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
  // Never render a cached research profile for a different authenticated owner.
  // In-flight responses are also discarded when the account or load attempt changes.
  const [profileState, setProfileState] = useState({ ownerId: null, data: null, loaded: false, error: false });
  const [homeQuery, setHomeQuery] = useState('');
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { user: authUser } = useAuth();
  const ownerId = authUser?.id ?? null;

  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setProfileState({ ownerId, data: null, loaded: false, error: false });
    if (!ownerId) return () => { active = false; };
    promiseWithTimeout(buildUserProfile(), HOME_PROFILE_TIMEOUT_MS, 'Workspace data took too long to load.')
      .then(next => {
        if (active) setProfileState({ ownerId, data: next, loaded: true, error: false });
      })
      .catch(() => {
        if (active) setProfileState({ ownerId, data: null, loaded: true, error: true });
      });
    return () => { active = false; };
  }, [loadAttempt, ownerId]);

  const retryProfile = () => setLoadAttempt(attempt => attempt + 1);
  // The render-time check closes the gap before React effects run on account change.
  const ownedProfileState = visibleOwnerProfileState(profileState, ownerId);
  const profile = ownedProfileState?.data ?? null;
  const loaded = ownedProfileState?.loaded ?? false;
  const profileError = ownedProfileState?.error ?? false;

  const projects = profile?.activeProjects || [];
  const papers = profile?.papers || [];
  const ideas = profile?.ideas || [];
  const workspaceWarnings = profile?.workspaceWarnings || [];
  const hasSourceWarning = source => workspaceWarnings.some(warning => warning.source === source);
  const displayName = profile?.user?.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
  const greeting = getLocalGreeting(displayName);
  const eyraReady = !capabilitiesLoading && Boolean(capabilities?.ai);

  const seenQueries = new Set();
  const recentSearches = (profile?.searches || []).filter(item => {
    const query = String(item.query || '').trim();
    if (!query || seenQueries.has(query.toLocaleLowerCase())) return false;
    seenQueries.add(query.toLocaleLowerCase());
    return true;
  }).slice(0, 3);
  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const upcoming = (profile?.tasks || [])
    .filter(task => task.due_date && task.due_date >= todayKey && task.status !== 'done')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  return (
    <div className="eylo-home min-h-[calc(100vh-4.5rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-5 sm:px-8 sm:pt-7 lg:px-10">
        <section aria-labelledby="home-title" className="relative isolate overflow-hidden rounded-[24px] border border-border/80 bg-card p-5 shadow-sm sm:p-7 lg:p-8">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary"><Sparkles size={16} aria-hidden="true" /> EYLO · Your AI workspace</p>
          <p className="text-sm font-medium text-muted-foreground">{greeting.greeting}</p>
          <h1 id="home-title" className="mt-2 max-w-4xl text-[1.8rem] font-semibold leading-tight tracking-tight sm:text-4xl lg:text-[2.7rem]">What can EYLO help you do today?</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Ask EYRA, explore a topic, create something, or organize your work. Start with a question; choose a tool only when you need it.</p>
          {eyraReady ? (
            <form onSubmit={event => { event.preventDefault(); const prompt = homeQuery.trim(); if (!prompt) return; window.dispatchEvent(new CustomEvent('eylo:open-eyra', { detail: { prompt } })); setHomeQuery(''); }} className="mt-7 flex flex-col gap-2 rounded-2xl border border-primary/25 bg-background p-2 shadow-sm sm:flex-row sm:items-center">
              <label htmlFor="home-research-query" className="sr-only">Your question for EYRA</label>
              <input id="home-research-query" type="text" value={homeQuery} onChange={event => setHomeQuery(event.target.value)}
                placeholder="Ask EYRA anything…" className="min-h-12 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary/30 focus:outline-none" />
              <button type="submit" disabled={!homeQuery.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">
                <Sparkles size={17} aria-hidden="true" /> Continue with EYRA
              </button>
            </form>
          ) : (
            <div className="mt-7 rounded-xl border border-border bg-background p-5" role="status">
              <p className="text-sm font-semibold text-foreground">{capabilitiesLoading ? 'Checking AI availability…' : 'EYRA is not available right now'}</p>
              <p className="mt-2 text-sm text-muted-foreground">You can still search scholarly sources, learn and use your workspace tools.</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to="/search" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:border-primary/40"><Search size={16} /> Research sources <ArrowRight size={15} /></Link>
            <Link to="/documents/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:border-primary/40"><BookOpen size={16} /> Create a document</Link>
            <Link to="/projects" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground hover:border-primary/40"><FolderOpen size={16} /> My projects</Link>
            {eyraReady && <button type="button" onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary/5"><Lightbulb size={16} /> Open EYRA</button>}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">AI answers may be inaccurate. Review important results before relying on them. Sending a question to EYRA requires your confirmation in the chat.</p>
        </section>


        {loaded && workspaceWarnings.length > 0 && (
          <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
            <span>Some workspace data is temporarily unavailable. Retry to refresh the items that did not load.</span>
            <button type="button" onClick={retryProfile} className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold text-primary hover:bg-secondary">Retry loading data</button>
          </div>
        )}

        <div className="mt-7 sm:mt-8">
          <section aria-labelledby="continue-heading">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Your work</p>
                <h2 id="continue-heading" className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Pick up where you left off</h2>
              </div>
              <Link to="/projects" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline">All projects <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>

            {!loaded ? (
              <div className="grid min-h-28 place-items-center rounded-2xl border border-border bg-card" role="status"><Loader2 className="animate-spin text-primary" /><span className="sr-only">Loading your workspace</span></div>
            ) : profileError ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm font-medium text-foreground">Your workspace could not be loaded.</p>
                <p className="mt-1 text-xs text-muted-foreground">The data service may be temporarily unavailable.</p>
                <button type="button" onClick={retryProfile} className="mt-3 text-xs font-semibold text-primary hover:underline">Try again</button>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold tracking-tight text-foreground">Active projects</h3>
                    <Link to="/projects" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">View all</Link>
                  </div>
                  {hasSourceWarning('projects') ? (
                    <p className="rounded-2xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground">Projects are temporarily unavailable.</p>
                  ) : projects.length ? (
                    <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card px-4">
                      {projects.slice(0, 3).map(project => <ProjectRow key={project.id} project={project} />)}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-5">
                      <div><h3 className="text-sm font-semibold text-foreground">Make space for your next idea.</h3><p className="mt-1 text-xs text-muted-foreground">Keep papers, people and decisions together in a project.</p></div>
                      <Link to="/projects" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Plus size={14} aria-hidden="true" /> Create project</Link>
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Upcoming deadlines</h3>
                    <Link to="/calendar" className="text-xs font-semibold text-primary hover:underline">Open calendar</Link>
                  </div>
                  {hasSourceWarning('tasks') ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Deadlines could not be loaded.</p>
                    : upcoming.length ? <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
                      {upcoming.map(task => <li key={task.id} className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
                        <span className="min-w-0 truncate text-foreground">{task.title}</span><time dateTime={task.due_date} className="shrink-0 text-xs text-muted-foreground">{task.due_date}</time>
                      </li>)}
                    </ul> : <p className="rounded-xl border border-border/70 bg-card p-4 text-sm text-muted-foreground">No upcoming deadlines in your saved tasks.</p>}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Recent searches</h3>
                    <Link to="/history" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Search history</Link>
                  </div>
                  {hasSourceWarning('searches') ? (
                    <p className="rounded-2xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground">Recent searches are temporarily unavailable.</p>
                  ) : recentSearches.length ? (
                    <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card px-4">
                      {recentSearches.map((search, index) => (
                        <Link key={search.id || search.query + index} to={'/home?q=' + encodeURIComponent(search.query)} className="group flex min-h-12 items-center gap-3 py-2 text-sm">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"><Search size={13} aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground group-hover:text-primary">{search.query}</span>
                          <ArrowRight size={14} className="shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-border/70 bg-card px-4 py-4 text-xs text-muted-foreground">Your searches will appear here so you can return to them quickly.</p>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Saved papers</h3>
                    <Link to="/library" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Open library</Link>
                  </div>
                  {hasSourceWarning('papers') ? (
                    <p className="rounded-2xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground">Saved papers are temporarily unavailable.</p>
                  ) : papers.length ? (
                    <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card px-4">
                      {papers.slice(0, 3).map((paper, index) => (
                        <Link key={paper.id || paper.paper_id || paper.title + index} to="/library" className="flex min-h-12 items-center gap-3 py-2 text-sm">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Bookmark size={13} aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">{paper.title || 'Untitled paper'}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{paper.authors || paper.year || 'Saved publication'}</span>
                          </span>
                          <ArrowRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-border/70 bg-card px-4 py-4 text-xs text-muted-foreground">Saved publications will appear here when you add them to your library.</p>
                  )}
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Research ideas</h3>
                    <Link to="/ideas" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Open ideas</Link>
                  </div>
                  {hasSourceWarning('ideas') ? (
                    <p className="rounded-2xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground">Research ideas are temporarily unavailable.</p>
                  ) : ideas.length ? (
                    <div className="divide-y divide-border rounded-2xl border border-border/70 bg-card px-4">
                      {ideas.slice(0, 3).map((idea, index) => (
                        <Link key={idea.id || idea.title + index} to="/ideas" className="flex min-h-12 items-center gap-3 py-2 text-sm">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-primary"><Lightbulb size={13} aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-foreground">{idea.title || 'Untitled idea'}</span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{idea.category || idea.status || 'Research idea'}</span>
                          </span>
                          <ArrowRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-border/70 bg-card px-4 py-4 text-xs text-muted-foreground">Ideas you save will be ready here when you return.</p>
                  )}
                </div>
              </div>
            )}
          </section>


        </div>

        <section aria-labelledby="start-here-title" className="mt-9 border-t border-border/70 pt-7">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="start-here-title" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">New to EYLO? Start here.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                You do not need technical or research experience. Choose a simple task, and use Back or Home whenever you want.
              </p>
            </div>
            <Link to="/tools" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary">Browse all tools <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <nav aria-label="Common starting actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {step:'1', title:'Find a publication', help:'Search scientific papers and open their original sources.', href: '/search', Icon:Search},
              {step:'2', title:'Save and review papers', help:'See your saved papers. To save a new one, start in Discover.', href: '/library', Icon:Bookmark},
              {step:'3', title:'Create a project', help:'Keep papers, ideas and next steps together.', href: '/projects?new=1', Icon:FolderOpen},
            ].map(({step,title,help,href,Icon}) => (
              <Link key={href} to={href} className="group flex min-h-24 items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary" aria-hidden="true">{step}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">{title}</span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{help}</span></span>
                <Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <details className="mt-4 rounded-2xl border border-border/80 bg-card/60 px-4 py-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">More things you can do — research, studies and funding</summary>
            <nav aria-label="More starting actions" className="mt-3 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {[
                {title:'Start a research journey', help:'Follow a question from sources to a review or thesis.', href: '/research-journey', Icon:BookOpen},
                {title:'Plan my studies', help:'Organize sessions, courses and exams.', href: '/study-planner', Icon:BookOpen},
                {title:'Find research funding', help:'Browse funding calls and eligibility.', href: '/opportunities', Icon:Zap},
                {title:'View all tools', help:'See every other feature whenever you need it.', href: '/tools', Icon:Search},
              ].map(({title,help,href,Icon}) => (
                <Link key={href} to={href} className="group flex min-h-20 items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-secondary/30">
                  <Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{help}</span></span>
                  <ArrowRight size={15} className="mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </details>
        </section>
      </div>
    </div>
  );
}
