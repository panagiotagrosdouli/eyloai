import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark, ChevronRight, FolderOpen, Lightbulb, Loader2, Plus, Search, Zap } from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import { getLocalGreeting } from '@/lib/local-greeting';
import { promiseWithTimeout } from '@/lib/promise-timeout';
import { useCapabilities } from '@/lib/capabilities';
import { useAuth } from '@/lib/AuthContext';

const HOME_PROFILE_TIMEOUT_MS = 12_000;


function ProjectRow({ project }) {
  const date = project.updated_date && !Number.isNaN(new Date(project.updated_date).getTime())
    ? new Date(project.updated_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
  return (
    <Link to={'/projects/' + encodeURIComponent(project.id)} className="group flex min-h-28 min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
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
  const [homeQuery, setHomeQuery] = useState('');
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { user: authUser } = useAuth();
  const ownerId = authUser?.id ?? null;
  // Keep every visible result tied to its signed-in owner, including the
  // first render after a browser session or account changes.
  const [workspaceState, setWorkspaceState] = useState({ ownerId: null, profile: null, loaded: false, error: false });
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setWorkspaceState({ ownerId, profile: null, loaded: false, error: false });
    if (!ownerId) return () => { active = false; };
    promiseWithTimeout(buildUserProfile(), HOME_PROFILE_TIMEOUT_MS, 'Workspace data took too long to load.')
      .then(next => {
        if (active) setWorkspaceState({ ownerId, profile: next, loaded: true, error: false });
      })
      .catch(() => {
        if (active) setWorkspaceState({ ownerId, profile: null, loaded: true, error: true });
      });
    return () => { active = false; };
  }, [ownerId, loadAttempt]);
  const profile = workspaceState.ownerId === ownerId ? workspaceState.profile : null;
  const loaded = workspaceState.ownerId === ownerId && workspaceState.loaded;
  const profileError = workspaceState.ownerId === ownerId && workspaceState.error;
  const retryProfile = () => setLoadAttempt(attempt => attempt + 1);

  const projects = profile?.activeProjects || [];
  const papers = profile?.papers || [];
  const ideas = profile?.ideas || [];
  const workspaceWarnings = profile?.workspaceWarnings || [];
  const hasSourceWarning = source => workspaceWarnings.some(warning => warning.source === source);
  const displayName = profile?.user?.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
  const greeting = getLocalGreeting(displayName);
  const eyraReady = !capabilitiesLoading && Boolean(capabilities?.ai);

  const recentSearches = (profile?.searches || []).filter(item => item.query).slice(0, 3);
  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const upcoming = (profile?.tasks || [])
    .filter(task => task.due_date && task.due_date >= todayKey && task.status !== 'done')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  return (
    <div className="eylo-home min-h-[calc(100vh-4.5rem)] bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 sm:pt-8">
        <div className="grid items-start gap-6 xl:grid-cols-12">
          <div className="min-w-0 space-y-6 xl:col-span-8">
            <section aria-labelledby="home-title" className="relative isolate overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-9">
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
              <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-36 w-2/3 bg-gradient-to-tl from-primary/10 via-secondary/30 to-transparent" />
              <div className="relative z-10">
                <p className="text-sm font-semibold text-primary">{greeting.greeting}</p>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Your research · Sources · Next steps</p>
                <h1 id="home-title" className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                  Find the evidence.<span className="block text-primary">Keep the context.</span>
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">Begin with source-linked research. Always check the original papers. Keep your real papers, ideas and projects together, and return to them whenever you need.</p>
                <form aria-label="Analyze a research topic" onSubmit={event => { event.preventDefault(); if (homeQuery.trim()) onSearch(homeQuery.trim()); }} className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <label htmlFor="home-research-query" className="sr-only">Research topic or question</label>
                  <input id="home-research-query" type="search" value={homeQuery} onChange={event => setHomeQuery(event.target.value)}
                    placeholder="Enter a topic or research question…" className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-base text-foreground placeholder:text-muted-foreground" />
                  <button type="submit" disabled={!homeQuery.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    <Search size={17} aria-hidden="true" /> Analyze topic
                  </button>
                </form>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-muted-foreground">Topic analysis may use EYRA. Original-source search works independently.</p>
                  <Link to="/search" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-primary hover:underline">Discover publications <ArrowRight size={15} aria-hidden="true" /></Link>
                </div>
              </div>
            </section>
            <section aria-labelledby="start-here-title">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Simple actions, real research</p>
                  <h2 id="start-here-title" className="mt-1 text-xl font-semibold text-foreground">What would you like to do today?</h2>
                </div>
                <Link to="/tools" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary">Browse all tools <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
              <nav aria-label="Common starting actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: 'Find publications', hint: 'Explore scientific papers and their original sources.', href: '/search', Icon: Search, tint: 'bg-primary/10' },
                  { title: 'My saved papers', hint: 'Return to your saved research and notes.', href: '/library', Icon: Bookmark, tint: 'bg-violet-500/10' },
                  { title: 'Create a project', hint: 'Organize your ideas and next steps.', href: '/projects?new=1', Icon: FolderOpen, tint: 'bg-emerald-500/10' },
                ].map(({ title, hint, href, Icon, tint }) => (
                  <Link key={href} to={href} className="group flex min-h-36 min-w-0 flex-col items-start rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span className={'grid h-11 w-11 place-items-center rounded-xl text-primary ' + tint}><Icon size={21} aria-hidden="true" /></span>
                    <span className="mt-4 text-sm font-semibold text-foreground">{title}</span>
                    <span className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{hint}</span>
                    <ArrowRight size={17} className="mt-2 self-end text-primary" aria-hidden="true" />
                  </Link>
                ))}
              </nav>
              <details className="mt-4 rounded-xl border border-border bg-card/60 px-4 py-3">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">More things you can do — research, studies and funding</summary>
                <nav aria-label="More starting actions" className="mt-3 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  {[
                    { title: 'Research journey', href: '/research-journey', hint: 'Follow a question toward a review or thesis.', Icon: BookOpen },
                    { title: 'Study planner', href: '/study-planner', hint: 'Organize lessons and exams.', Icon: BookOpen },
                    { title: 'Funding opportunities', href: '/opportunities', hint: 'Explore research grants and calls.', Icon: Zap },
                    { title: 'All tools', href: '/tools', hint: 'See every available EYLO feature.', Icon: Search },
                  ].map(({ title, href, hint, Icon }) => (
                    <Link key={href} to={href} className="flex min-h-20 items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-secondary/30">
                      <Icon size={19} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                      <span><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{hint}</span></span>
                    </Link>
                  ))}
                </nav>
              </details>
            </section>
          </div>
          <aside aria-label="Research assistant and continuation" className="min-w-0 space-y-4 xl:col-span-4">
            <section aria-labelledby="home-eyra-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Lightbulb size={22} aria-hidden="true" /></span>
                <span role="status" className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  {capabilitiesLoading ? 'Checking AI setup' : eyraReady ? 'AI configured' : 'AI unavailable'}
                </span>
              </div>
              <h2 id="home-eyra-title" className="mt-4 text-xl font-semibold text-foreground">EYRA</h2>
              <p className="mt-1 text-xs font-medium text-primary">Your optional research assistant</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Ask about your research or next step when the external AI service is available.</p>
              <button type="button" disabled={!eyraReady} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <Lightbulb size={17} aria-hidden="true" /> Ask EYRA <ArrowRight size={16} aria-hidden="true" />
              </button>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">AI configured does not guarantee a live response. Discover works without EYRA.</p>
            </section>
            <section aria-labelledby="home-resume-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 id="home-resume-title" className="text-base font-semibold text-foreground">Continue where you left off</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Your saved projects, never sample data.</p>
              {!loaded ? (
                <p role="status" className="mt-4 flex min-h-16 items-center gap-3 text-sm text-muted-foreground"><Loader2 size={17} className="animate-spin text-primary" aria-hidden="true" /> Loading your workspace…</p>
              ) : profileError || hasSourceWarning('projects') ? (
                <div className="mt-4 rounded-xl bg-secondary/50 p-4"><p className="text-sm text-muted-foreground">Your projects could not be loaded.</p>
                  <button type="button" onClick={retryProfile} className="mt-3 min-h-10 text-sm font-semibold text-primary hover:underline">Retry loading data</button>
                </div>
              ) : projects.length && projects[0]?.id ? (
                <Link to={'/projects/' + encodeURIComponent(projects[0].id)} className="group mt-4 flex min-h-20 items-center gap-3 rounded-xl border border-border bg-background p-4 hover:border-primary/40">
                  <FolderOpen size={20} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{projects[0].title || 'Untitled project'}</span><span className="mt-1 block text-xs text-muted-foreground">Open project</span></span>
                  <ArrowRight size={17} className="shrink-0 text-primary" aria-hidden="true" />
                </Link>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-border p-4">
                  <p className="text-sm text-muted-foreground">No active project saved yet.</p>
                  <Link to="/projects?new=1" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline"><Plus size={16} aria-hidden="true" /> Create your first project</Link>
                </div>
              )}
              <Link to="/projects" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline">View all projects <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <h2 className="text-base font-semibold text-foreground">New to EYLO? Start here.</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">A short guide to searching, saving and organizing your work. No technical experience needed.</p>
              <Link to="/start" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline">Open the beginner guide <ArrowRight size={16} aria-hidden="true" /></Link>
            </section>
          </aside>
        </div>

        {loaded && workspaceWarnings.length > 0 && (
          <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
            <span>Some workspace data is temporarily unavailable. Retry to refresh the items that did not load.</span>
            <button type="button" onClick={retryProfile} className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold text-primary hover:bg-secondary">Retry loading data</button>
          </div>
        )}

        <div className="mt-10">
          <section aria-labelledby="continue-heading">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Your work</p>
                <h2 id="continue-heading" className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Pick up where you left off</h2>
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
              <div className="space-y-7">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active projects</h3>
                    <Link to="/projects" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">View all</Link>
                  </div>
                  {hasSourceWarning('projects') ? (
                    <p className="rounded-2xl border border-border bg-card px-4 py-4 text-xs text-muted-foreground">Projects are temporarily unavailable.</p>
                  ) : projects.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
      </div>
    </div>
  );
}
