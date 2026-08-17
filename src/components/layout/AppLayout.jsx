import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Activity, Award, BookOpen, Brain, ChevronDown, FileEdit, FolderOpen, History,
  Home, LayoutDashboard, Lightbulb, Menu, Mic, MoreHorizontal, Presentation,
  Rocket, Search, Settings, Sparkles, Target, TrendingUp, Trophy, User, Users,
  Video, X, Zap,
} from 'lucide-react';
import EyraCommandCenter from '@/components/eyra/EyraCommandCenter';
import NotificationsBell from '@/components/monitoring/NotificationsBell';
import ServiceStatus from '@/components/system/ServiceStatus';
import { useCapabilities } from '@/lib/capabilities';
import { trackActivatedReturn } from '@/lib/product-analytics';

const PRIMARY_NAV = [
  { label: 'Home', path: '/home', icon: Home },
  { label: 'Projects', path: '/projects', icon: FolderOpen },
  { label: 'Library', path: '/library', icon: BookOpen },
  { label: 'For you', path: '/foryou', icon: Sparkles },
];

const TOOL_GROUPS = [
  {
    section: 'Discover',
    description: 'Search live records',
    items: [
      { label: 'Researchers', path: '/researchers', icon: Users, desc: 'Find authors and collaborators', badge: 'Live data' },
      { label: 'Opportunities', path: '/opportunities', icon: Award, desc: 'Search official funding calls', badge: 'Live data' },
      { label: 'Challenges', path: '/challenges', icon: Trophy, desc: 'Explore open research challenges', badge: 'Live data' },
      { label: 'Opportunity Radar', path: '/radar', icon: Zap, desc: 'Rank funding for your context', badge: 'EYRA' },
    ],
  },
  {
    section: 'Analyze',
    description: 'Reason with EYRA',
    items: [
      { label: 'Executive Briefing', path: '/briefing', icon: Brain, desc: 'A sourced strategic overview', badge: 'EYRA' },
      { label: 'Research Battlefield', path: '/battlefield', icon: Activity, desc: 'Map evidence and competitors', badge: 'EYRA' },
      { label: 'Impact Assessment', path: '/impact', icon: Target, desc: 'Test impact assumptions', badge: 'EYRA' },
      { label: 'Future Simulator', path: '/future', icon: Rocket, desc: 'Model three possible futures', badge: 'EYRA' },
      { label: 'Dream Team', path: '/dreamteam', icon: Users, desc: 'Build a collaborator shortlist', badge: 'EYRA' },
      { label: 'EYRA Voice', path: '/voice', icon: Mic, desc: 'Ask a sourced question by voice', badge: 'EYRA' },
    ],
  },
  {
    section: 'Create',
    description: 'Turn evidence into work',
    items: [
      { label: 'Idea Vault', path: '/ideas', icon: Lightbulb, desc: 'Capture and develop ideas', badge: 'Workspace' },
      { label: 'Grant Builder', path: '/grant-builder', icon: FileEdit, desc: 'Draft and track applications', badge: 'EYRA' },
      { label: 'Pitch Deck AI', path: '/pitchdeck', icon: Presentation, desc: 'Create a sourced PDF deck', badge: 'EYRA' },
      { label: 'Future Me', path: '/futureme', icon: TrendingUp, desc: 'Plan your research trajectory', badge: 'Workspace' },
      { label: 'Meetings', path: '/meetings', icon: Video, desc: 'Keep calls, notes and actions', badge: 'Workspace' },
    ],
  },
  {
    section: 'Account',
    description: 'History and settings',
    items: [
      { label: 'Profile', path: '/profile', icon: User, desc: 'Research identity and interests' },
      { label: 'Search history', path: '/history', icon: History, desc: 'Return to earlier discovery' },
      { label: 'Settings', path: '/settings', icon: Settings, desc: 'Preferences and accessibility' },
      { label: 'Plans & access', path: '/pricing', icon: Zap, desc: 'Current access and billing status' },
      { label: 'Institution Admin', path: '/institution', icon: LayoutDashboard, desc: 'Organization-level analytics', badge: 'Setup' },
    ],
  },
];

const ALL_TOOLS = TOOL_GROUPS.flatMap(group => group.items);

function ToolLink({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`group flex min-h-[4.25rem] items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        active ? 'border-primary/25 bg-primary/[0.07]' : 'border-transparent hover:border-border hover:bg-secondary/40'
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground group-hover:text-foreground'}`}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{item.label}</span>
          {item.badge && <span className="rounded-md border border-border px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-muted-foreground">{item.badge}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.desc}</span>
      </span>
    </Link>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const [eyraOpen, setEyraOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolQuery, setToolQuery] = useState('');
  const toolsRef = useRef(null);
  const { data: capabilities, loading: capabilitiesLoading } = useCapabilities();
  const aiAvailable = !capabilitiesLoading && capabilities.ai;

  const isActive = path => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const toolsActive = ALL_TOOLS.some(item => isActive(item.path));
  const query = toolQuery.trim().toLowerCase();
  const visibleGroups = TOOL_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => !query || `${item.label} ${item.desc} ${item.badge || ''}`.toLowerCase().includes(query)),
  })).filter(group => group.items.length);

  useEffect(() => { trackActivatedReturn(); }, []);

  useEffect(() => {
    const close = event => {
      if (!toolsRef.current?.contains(event.target)) setToolsOpen(false);
    };
    const closeWithKeyboard = event => {
      if (event.key === 'Escape') {
        setToolsOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeWithKeyboard);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeWithKeyboard);
    };
  }, []);

  useEffect(() => {
    const open = event => {
      if (aiAvailable && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setEyraOpen(true);
      }
    };
    window.addEventListener('keydown', open);
    return () => window.removeEventListener('keydown', open);
  }, [aiAvailable]);

  useEffect(() => {
    setToolsOpen(false);
    setMobileOpen(false);
    setToolQuery('');
  }, [location.pathname]);

  return (
    <div className="eylo-app-canvas min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-4 sm:px-6">
          <Link to="/home" className="mr-3 flex shrink-0 items-center" aria-label="EYLO workspace home">
            <img src="/brand/eylo-logo.svg" alt="EYLO" className="h-9 w-auto max-w-[128px] object-contain" />
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Workspace navigation">
            {PRIMARY_NAV.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}>
                  <Icon size={14} aria-hidden="true" />{item.label}
                </Link>
              );
            })}

            <div ref={toolsRef} className="relative">
              <button type="button" onClick={() => setToolsOpen(value => !value)} aria-expanded={toolsOpen}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${toolsActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}>
                <MoreHorizontal size={14} aria-hidden="true" />All tools<ChevronDown size={12} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {toolsOpen && (
                <div className="absolute left-0 top-full mt-2 w-[min(46rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-3 shadow-2xl shadow-black/35">
                  <label className="relative block">
                    <span className="sr-only">Search EYLO tools</span>
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={toolQuery} onChange={event => setToolQuery(event.target.value)} autoFocus placeholder="Find a tool or action…"
                      className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40" />
                  </label>
                  <div className="mt-3 grid max-h-[70vh] gap-4 overflow-y-auto p-1 sm:grid-cols-2">
                    {visibleGroups.map(group => (
                      <section key={group.section}>
                        <div className="mb-1 px-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">{group.section}</p>
                          <p className="text-[10px] text-muted-foreground">{group.description}</p>
                        </div>
                        {group.items.map(item => <ToolLink key={item.path} item={item} active={isActive(item.path)} />)}
                      </section>
                    ))}
                  </div>
                  {!visibleGroups.length && <p className="py-8 text-center text-sm text-muted-foreground">No tool matches “{toolQuery}”.</p>}
                </div>
              )}
            </div>
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <ServiceStatus compact className="hidden xl:block" />
            <NotificationsBell />
            <button type="button" onClick={() => setEyraOpen(true)} disabled={!aiAvailable} title={aiAvailable ? 'Ask EYRA (Ctrl/⌘ K)' : 'EYRA is unavailable on this deployment'}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">
              <Sparkles size={14} />Ask EYRA<span className="rounded border border-current/15 px-1 py-0.5 font-mono text-[8px] opacity-60">⌘K</span>
            </button>
          </div>

          <button type="button" onClick={() => setMobileOpen(value => !value)} aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen}
            className="ml-auto rounded-xl p-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden">
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border bg-background px-4 py-4 lg:hidden">
            <div className="mx-auto max-w-xl">
              <div className="grid grid-cols-2 gap-2">
                {PRIMARY_NAV.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return <Link key={item.path} to={item.path} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium ${active ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground'}`}><Icon size={15} />{item.label}</Link>;
                })}
              </div>
              <div className="my-4 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All tools</p><ServiceStatus /></div>
              <div className="space-y-5">
                {TOOL_GROUPS.map(group => (
                  <section key={group.section}>
                    <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">{group.section}</p>
                    <div className="grid gap-1 sm:grid-cols-2">{group.items.map(item => <ToolLink key={item.path} item={item} active={isActive(item.path)} />)}</div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10 pb-24 lg:pb-0"><Outlet /></main>
      <EyraCommandCenter open={eyraOpen} onClose={() => setEyraOpen(false)} />

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl lg:hidden" aria-label="Primary mobile navigation">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          {[PRIMARY_NAV[0], PRIMARY_NAV[1]].map(item => {
            const Icon = item.icon; const active = isActive(item.path);
            return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={18} /><span>{item.label}</span></Link>;
          })}
          <button type="button" onClick={() => setEyraOpen(true)} disabled={!aiAvailable} className="-mt-6 flex flex-col items-center gap-1 text-[10px] font-semibold text-primary disabled:opacity-45" aria-label={aiAvailable ? 'Ask EYRA' : 'EYRA unavailable'}>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Sparkles size={20} /></span><span>EYRA</span>
          </button>
          {[PRIMARY_NAV[2], PRIMARY_NAV[3]].map(item => {
            const Icon = item.icon; const active = isActive(item.path);
            return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={18} /><span>{item.label}</span></Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
