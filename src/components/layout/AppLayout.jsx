import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home, FolderOpen, User, Sparkles, ChevronDown,
  Menu, X, Zap, Brain, BookOpen, Settings, MoreHorizontal,
  Lightbulb, Users, TrendingUp, Video, Globe, Target,
  Rocket, Trophy, Award, Crown, Search
} from 'lucide-react';
import EyraCommandCenter from '@/components/eyra/EyraCommandCenter';
import NotificationsBell from '@/components/monitoring/NotificationsBell';

/* Primary nav — always visible, max 4 items to avoid clutter */
const PRIMARY_NAV = [
  { label: 'Home', path: '/home', icon: Home },
  { label: 'Projects', path: '/projects', icon: FolderOpen },
  { label: 'EYRA Feed', path: '/foryou', icon: Sparkles },
  { label: 'Profile', path: '/profile', icon: User },
];

/* All tools — revealed in dropdown */
const MORE_NAV = [
  {
    section: 'Intelligence',
    items: [
      { label: 'Executive Briefing', path: '/briefing', icon: Brain, desc: 'Strategic overview & insights' },
      { label: 'Opportunity Radar', path: '/radar', icon: Zap, desc: 'Grants, funding & calls' },
      { label: 'Future Me', path: '/futureme', icon: TrendingUp, desc: 'Design your future self' },
      { label: 'Future Simulator', path: '/future', icon: Rocket, desc: 'Model 3 possible futures' },
      { label: 'Idea Vault', path: '/ideas', icon: Lightbulb, desc: 'Capture & develop ideas' },
      { label: 'Research Battlefield', path: '/battlefield', icon: Globe, desc: 'Competitive landscape' },
      { label: 'Impact Predictor', path: '/impact', icon: Target, desc: 'Predict success probability' },
    ],
  },
  {
    section: 'Tools',
    items: [
      { label: 'Knowledge Library', path: '/library', icon: BookOpen, desc: 'Papers & researchers' },
      { label: 'Researchers', path: '/researchers', icon: Users, desc: 'Find collaborators' },
      { label: 'Dream Team', path: '/dreamteam', icon: Users, desc: 'Build your team' },
      { label: 'Opportunities', path: '/opportunities', icon: Award, desc: 'Grants & accelerators' },
      { label: 'Meetings', path: '/meetings', icon: Video, desc: 'Calls & notes' },
      { label: 'Challenges', path: '/challenges', icon: Trophy, desc: 'Competitions & prizes' },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'Settings', path: '/settings', icon: Settings, desc: 'Preferences & account' },
      { label: 'Pricing', path: '/pricing', icon: Crown, desc: 'Plans & features' },
    ],
  },
];

const ALL_MORE_ITEMS = MORE_NAV.flatMap(s => s.items);

export default function AppLayout() {
  const location = useLocation();
  const [eyraOpen, setEyraOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolQuery, setToolQuery] = useState('');
  const dropdownRef = useRef(null);

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const isMoreActive = ALL_MORE_ITEMS.some(n => isActive(n.path));
  const normalizedToolQuery = toolQuery.trim().toLowerCase();
  const filteredMoreNav = MORE_NAV.map(section => ({
    ...section,
    items: section.items.filter(item =>
      !normalizedToolQuery
      || `${item.label} ${item.desc}`.toLowerCase().includes(normalizedToolQuery)),
  })).filter(section => section.items.length > 0);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
    setToolQuery('');
  }, [location.pathname]);

  const mobilePrimary = PRIMARY_NAV.slice(0, 2);
  const mobileSecondary = PRIMARY_NAV.slice(2);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-1">

          {/* Brand */}
          <Link to="/home" className="flex items-center flex-shrink-0 mr-4">
            <img
              src="/brand/eylo-logo.svg"
              alt="EYLO"
              className="h-9 w-auto max-w-[150px] rounded-lg bg-white/[0.03] object-contain px-1.5"
            />
          </Link>

          {/* Desktop primary nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1">
            {PRIMARY_NAV.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}

            {/* More dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isMoreActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <MoreHorizontal size={14} />
                Tools
                <ChevronDown size={11} className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl z-50 p-2 space-y-3 max-h-[80vh] overflow-y-auto"
                  style={{ boxShadow: '0 24px 64px -12px rgba(0,0,0,0.5)' }}
                >
                  <label className="relative block px-1 pt-1">
                    <Search size={13} className="pointer-events-none absolute left-4 top-1/2 mt-0.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only">Search EYLO tools</span>
                    <input
                      value={toolQuery}
                      onChange={event => setToolQuery(event.target.value)}
                      placeholder="Find a tool…"
                      className="h-9 w-full rounded-xl border border-border bg-secondary/40 pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
                    />
                  </label>
                  {filteredMoreNav.map(section => (
                    <div key={section.section}>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 py-1">{section.section}</p>
                      {section.items.map(item => {
                        const Icon = item.icon;
                        const active = isActive(item.path);
                        return (
                          <Link key={item.path} to={item.path}
                            className={`flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all ${
                              active ? 'bg-primary/10' : 'hover:bg-secondary/60'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary/15' : 'bg-secondary'}`}>
                              <Icon size={12} className={active ? 'text-primary' : 'text-muted-foreground'} />
                            </div>
                            <div>
                              <p className={`text-xs font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>{item.label}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                  {filteredMoreNav.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">No tools match “{toolQuery}”.</p>
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Ask EYRA CTA */}
          <div className="hidden md:flex items-center gap-2 ml-auto">
            <NotificationsBell />
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">EYRA Online</span>
            </div>
            <button
              onClick={() => setEyraOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Sparkles size={13} />
              Ask EYRA
            </button>
          </div>

          {/* Mobile burger */}
          <button
            type="button"
            className="lg:hidden ml-auto p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border/50 bg-card/98 backdrop-blur-xl px-4 py-4 max-h-[80vh] overflow-y-auto">
            {/* Primary */}
            <div className="space-y-1 mb-5">
              {PRIMARY_NAV.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link key={item.path} to={item.path}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    }`}
                  >
                    <Icon size={16} /> {item.label}
                  </Link>
                );
              })}
            </div>
            {/* More sections */}
            {MORE_NAV.map(section => (
              <div key={section.section} className="mb-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3 mb-1">{section.section}</p>
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link key={item.path} to={item.path}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      }`}
                    >
                      <Icon size={14} /> {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            <button
              onClick={() => { setEyraOpen(true); setMobileOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl eyra-gradient text-white text-sm font-semibold mt-2"
            >
              <img src="/brand/eyra.png" alt="EYRA" className="h-4 w-auto" />
              Ask EYRA
            </button>
          </div>
        )}
      </header>

      {/* ── Page content ─────────────────────────────── */}
      <main className="pb-24 lg:pb-0">
        <Outlet />
      </main>

      <EyraCommandCenter open={eyraOpen} onClose={() => setEyraOpen(false)} />

      {/* Floating EYRA button */}
      <button
        type="button"
        onClick={() => setEyraOpen(true)}
        className="fixed bottom-6 right-6 z-40 hidden lg:flex items-center gap-2 px-4 py-3 rounded-2xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-all active:scale-95"
        style={{ boxShadow: '0 8px 24px -6px hsla(213,94%,55%,0.4)' }}
        aria-label="Ask EYRA"
      >
        <div className="relative flex-shrink-0">
          <Sparkles size={15} className="text-white" />
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400 border border-background" />
        </div>
        <span>Ask EYRA</span>
      </button>

      {/* Mobile bottom navigation — keeps the five daily actions one tap away. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Primary mobile navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          {mobilePrimary.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setEyraOpen(true)}
            className="-mt-6 flex flex-col items-center gap-1 text-[10px] font-semibold text-primary"
            aria-label="Ask EYRA"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl eyra-gradient text-white shadow-lg shadow-primary/20">
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <span>EYRA</span>
          </button>

          {mobileSecondary.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label === 'EYRA Feed' ? 'Feed' : item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
