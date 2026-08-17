import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Activity, Award, BookOpen, Brain, ChevronDown, FileEdit, FolderOpen, History,
  Home, LayoutDashboard, LayoutGrid, Lightbulb, Menu, Mic, Presentation,
  Rocket, Search, Settings, Sparkles, Target, TrendingUp, Trophy, User, Users,
  Video, X, Zap,
} from 'lucide-react';
import EyraCommandCenter from '@/components/eyra/EyraCommandCenter';
import BrandLogo, { EyraOrb } from '@/components/brand/BrandLogo';
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
    section: 'Research',
    description: 'Find and organize source records',
    items: [
      { label: 'Researchers', path: '/researchers', icon: Users, desc: 'Authors, institutions and expertise', badge: 'Live sources' },
      { label: 'Funding search', path: '/opportunities', icon: Award, desc: 'Official opportunities and calls', badge: 'Official data' },
      { label: 'Open challenges', path: '/challenges', icon: Trophy, desc: 'Research and innovation challenges', badge: 'Live sources' },
      { label: 'Opportunity review', path: '/radar', icon: Zap, desc: 'Prioritize funding against your context', badge: 'Assisted' },
    ],
  },
  {
    section: 'Decision support',
    description: 'Evaluate evidence and choices',
    items: [
      { label: 'Executive briefing', path: '/briefing', icon: Brain, desc: 'A sourced view of priorities and risks', badge: 'Assisted' },
      { label: 'Research landscape', path: '/battlefield', icon: Activity, desc: 'Compare approaches and evidence gaps', badge: 'Assisted' },
      { label: 'Impact review', path: '/impact', icon: Target, desc: 'Test impact assumptions and pathways', badge: 'Assisted' },
      { label: 'Scenario planner', path: '/future', icon: Rocket, desc: 'Compare plausible project directions', badge: 'Assisted' },
      { label: 'Team planner', path: '/dreamteam', icon: Users, desc: 'Define roles and review expertise fit', badge: 'Assisted' },
      { label: 'Voice workspace', path: '/voice', icon: Mic, desc: 'Dictate a sourced research question', badge: 'Assisted' },
    ],
  },
  {
    section: 'Deliverables',
    description: 'Turn decisions into working outputs',
    items: [
      { label: 'Idea workspace', path: '/ideas', icon: Lightbulb, desc: 'Capture and develop research ideas', badge: 'Workspace' },
      { label: 'Grant workspace', path: '/grant-builder', icon: FileEdit, desc: 'Draft and track an application', badge: 'Assisted' },
      { label: 'Pitch deck', path: '/pitchdeck', icon: Presentation, desc: 'Build a sourced presentation', badge: 'Assisted' },
      { label: 'Professional path', path: '/futureme', icon: TrendingUp, desc: 'Plan skills, milestones and direction', badge: 'Workspace' },
      { label: 'Meetings', path: '/meetings', icon: Video, desc: 'Keep notes, decisions and actions', badge: 'Workspace' },
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
      className={`group flex min-h-[3.75rem] items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
        active ? 'border-primary/25 bg-primary/[0.07]' : 'border-transparent hover:border-border hover:bg-secondary/40'
      }`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground group-hover:text-foreground'}`}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{item.label}</span>
          {item.badge && <span className="inline-flex items-center gap-1 text-[8px] font-medium uppercase tracking-wide text-muted-foreground"><span className="h-1 w-1 rounded-full bg-current opacity-60" />{item.badge}</span>}
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
    const openEyra = () => {
      if (aiAvailable) setEyraOpen(true);
    };
    window.addEventListener('eylo:open-eyra', openEyra);
    return () => window.removeEventListener('eylo:open-eyra', openEyra);
  }, [aiAvailable]);

  useEffect(() => {
    setToolsOpen(false);
    setMobileOpen(false);
    setToolQuery('');
  }, [location.pathname]);

  return (
    <div className="eylo-app-canvas min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[90rem] items-center gap-2 px-4 sm:px-6">
          <Link to="/home" className="mr-3 flex shrink-0 items-center" aria-label="EYLO workspace home">
            <BrandLogo brand="eylo" size="nav" priority />
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
                <LayoutGrid size={14} aria-hidden="true" />Tools<ChevronDown size={12} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
              </button>

              {toolsOpen && (
                <div className="absolute left-0 top-full mt-2 w-[min(48rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 shadow-2xl shadow-black/30">
                  <div className="mb-3 flex flex-col justify-between gap-3 rounded-lg border border-border bg-secondary/25 px-4 py-3 sm:flex-row sm:items-center">
                    <div><p className="text-xs font-semibold">Workspace tools</p><p className="mt-0.5 text-[10px] text-muted-foreground">Choose an outcome, then keep the evidence and decisions in the same workspace.</p></div>
                    <div className="flex items-center gap-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground"><span>Research</span><span>→</span><span>Decide</span><span>→</span><span>Deliver</span></div>
                  </div>
                  <label className="relative block">
                    <span className="sr-only">Search EYLO tools</span>
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={toolQuery} onChange={event => setToolQuery(event.target.value)} autoFocus placeholder="Search by task, source, or output…"
                      className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40" />
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
          <div className="max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-border bg-background px-4 py-4 lg:hidden">
            <div className="mx-auto max-w-xl">
              <div className="grid grid-cols-2 gap-2">
                {PRIMARY_NAV.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return <Link key={item.path} to={item.path} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium ${active ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground'}`}><Icon size={15} />{item.label}</Link>;
                })}
              </div>
              <div className="my-4 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-foreground">Workspace tools</p><p className="mt-0.5 text-[10px] text-muted-foreground">Research → decide → deliver</p></div><ServiceStatus /></div>
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
            <EyraOrb className="h-12 w-12 rounded-2xl" decorative={false} /><span>EYRA</span>
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
