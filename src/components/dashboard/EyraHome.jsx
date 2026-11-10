import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Bookmark, Briefcase, ChevronRight, FolderOpen, Lightbulb, Loader2, Plus, Search, Users, Zap } from 'lucide-react';
import { buildUserProfile } from '@/lib/second-brain';
import GuidedSearch from '@/components/discovery/GuidedSearch';
import { getLocalGreeting } from '@/lib/local-greeting';
import { promiseWithTimeout } from '@/lib/promise-timeout';
import { useCapabilities } from '@/lib/capabilities';
import { useAuth } from '@/lib/AuthContext';

const HOME_PROFILE_TIMEOUT_MS = 12_000;

const START_POINTS = [
  { eyebrow: 'Evidence', title: 'Explore the literature', description: 'Search academic sources and open the original papers.', action: 'Search papers', href: '/discover', icon: BookOpen },
  { eyebrow: 'Connections', title: 'Find your people', description: 'Discover researchers through their published work.', action: 'Explore researchers', href: '/researchers', icon: Users },
  { eyebrow: 'Next step', title: 'Find a research role', description: 'Compare official listings with your CV in this browser.', action: 'Browse careers', href: '/careers', icon: Briefcase },
  { eyebrow: 'Funding', title: 'Find an opportunity', description: 'Review records and follow the link to the official source.', action: 'Explore funding', href: '/opportunities', icon: Zap },
];

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
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const { user: authUser } = useAuth();

  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setProfileError(false);
    promiseWithTimeout(buildUserProfile(), HOME_PROFILE_TIMEOUT_MS, 'Workspace data took too long to load.')
      .then(next => { if (active) setProfile(next); })
      .catch(() => { if (active) setProfileError(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [loadAttempt]);

  const retryProfile = () => setLoadAttempt(attempt => attempt + 1);

  const projects = profile?.activeProjects || [];
  const papers = profile?.papers || [];
  const ideas = profile?.ideas || [];
  const workspaceWarnings = profile?.workspaceWarnings || [];
  const hasSourceWarning = source => workspaceWarnings.some(warning => warning.source === source);
  const displayName = profile?.user?.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
  const greeting = getLocalGreeting(displayName);
  const userType = profile?.user?.user_type;
  const defaultLevel = userType === 'student' ? 'student'
    : ['masters', 'phd'].includes(userType) ? 'researcher'
      : userType === 'professor' ? 'expert' : '';
  const eyraReady = !capabilitiesLoading && Boolean(capabilities?.ai);

  const recentSearches = (profile?.searches || []).filter(item => item.query).slice(0, 3);

  return (
    <div className="eylo-home min-h-[calc(100vh-4.5rem)] bg-background text-foreground">
      <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-6 sm:px-8 sm:pt-8">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_14px_40px_-30px_rgba(23,42,64,0.24)]">
          <div className="relative grid gap-8 px-6 pb-7 pt-7 sm:px-9 sm:pt-9 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-12 lg:pb-9">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-background/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">EYLO · Research workspace</span>
                <span className="text-xs text-muted-foreground">{greeting.greeting}</span>
              </div>
              <h1 className="max-w-xl text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.06em] text-foreground sm:text-6xl">Research,<br /><span className="font-serif font-medium italic text-primary">connected.</span></h1>
              <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">Follow a question from papers to people, projects and the opportunities around it.</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Evidence first</span>
                <span className="h-3 w-px bg-border" aria-hidden="true" />
                <span>Sources you can open</span>
                <span className="h-3 w-px bg-border" aria-hidden="true" />
                <span>Your work in one place</span>
              </div>
            </div>

            <div className="relative mx-auto hidden h-64 w-full max-w-[26rem] lg:block" aria-hidden="true">
              <div className="absolute inset-5 rounded-full border border-primary/10" />
              <div className="absolute inset-12 rounded-full border border-primary/10" />
              <svg viewBox="0 0 420 260" className="absolute inset-0 h-full w-full text-primary/30" fill="none">
                <path d="M70 150 157 79l92 68 91-75M70 150l106 47 73-50 91 40M157 79l19 118M249 147l91-75M249 147l91 43" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
                <circle cx="70" cy="150" r="5" fill="currentColor" /><circle cx="157" cy="79" r="5" fill="currentColor" /><circle cx="249" cy="147" r="5" fill="currentColor" /><circle cx="340" cy="72" r="5" fill="currentColor" /><circle cx="176" cy="197" r="5" fill="currentColor" /><circle cx="340" cy="190" r="5" fill="currentColor" />
              </svg>
              <span className="absolute left-2 top-[54%] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">Papers</span>
              <span className="absolute left-[31%] top-[10%] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">Ideas</span>
              <span className="absolute left-[48%] top-[49%] rounded-xl border border-primary/20 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/20">Your question</span>
              <span className="absolute right-0 top-[9%] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">People</span>
              <span className="absolute bottom-[6%] left-[34%] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">Projects</span>
              <span className="absolute bottom-[8%] right-0 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">Funding</span>
            </div>
          </div>

          <div className="border-t border-border/70 bg-background/55 px-5 py-5 sm:px-9 sm:py-6 lg:px-12">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Start here</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">What are you working on?</h2>
              </div>
              <button type="button" disabled={!eyraReady} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                <Search size={13} aria-hidden="true" /> Ask EYRA
              </button>
            </div>
            <GuidedSearch onSearch={onSearch} defaultLevel={defaultLevel} />
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Search results link back to academic sources. AI interpretations are labeled separately from retrieved evidence.</p>
          </div>
        </section>

        {loaded && workspaceWarnings.length > 0 && (
          <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D8E5EF] bg-white px-4 py-3 text-sm text-[#334A60]">
            <span>Some workspace data is temporarily unavailable. Retry to refresh the items that did not load.</span>
            <button type="button" onClick={retryProfile} className="min-h-9 rounded-lg border border-[#C8D9E8] px-3 text-xs font-semibold text-[#315F88] hover:bg-[#F3F8FC]">Retry loading data</button>
          </div>
        )}

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
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

          <aside aria-labelledby="pathways-heading">
            <div className="mb-5 border-b border-border pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Move it forward</p>
              <h2 id="pathways-heading" className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Research pathways</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Each tool takes you to a practical next step.</p>
            </div>
            <nav aria-label="Research pathways" className="divide-y divide-border">
              {START_POINTS.map(({ eyebrow, title, description, action, href, icon: Icon }) => (
                <Link key={href} to={href} className="group flex items-center gap-3 py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary/10"><Icon size={17} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</span>
                    <span className="mt-0.5 block text-sm font-semibold text-foreground group-hover:text-primary">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </Link>
              ))}
            </nav>
            <Link to="/library" className="mt-5 flex min-h-12 items-center justify-between rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:border-primary/25 hover:bg-secondary/40">
              <span className="inline-flex items-center gap-2"><BookOpen size={15} className="text-primary" aria-hidden="true" /> Open saved library</span>
              <ArrowRight size={14} className="text-muted-foreground" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
