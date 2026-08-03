import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FolderOpen,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const EXAMPLES = [
  'Quantum machine learning',
  'Climate change startups',
  'CRISPR gene editing',
  'Federated learning',
];

const START_CARDS = [
  {
    title: 'Ask EYRA anything',
    description: 'Search papers, researchers, funding',
    action: 'Start searching',
    icon: Sparkles,
    type: 'search',
  },
  {
    title: 'Create a project',
    description: 'Keep everything in one place',
    action: 'New project',
    icon: FolderOpen,
    href: '/projects',
  },
  {
    title: 'Find funding',
    description: 'Grants, accelerators & calls',
    action: 'Explore',
    icon: Zap,
    href: '/radar',
  },
];

const SHORTCUTS = [
  { label: 'Daily Briefing', href: '/foryou', icon: Sparkles },
  { label: 'Opportunities', href: '/radar', icon: Zap },
  { label: 'Library', href: '/library', icon: BookOpen },
  { label: 'Future Me', href: '/futureme', icon: TrendingUp },
];

export default function Dashboard({ onSearch }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const { user } = useAuth();

  const metadata = user?.user_metadata || {};
  const firstName = (metadata.full_name || metadata.name || user?.email?.split('@')[0] || '')
    .trim()
    .split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (value) onSearch(value);
  };

  const searchExample = (value) => {
    setQuery(value);
    onSearch(value);
  };

  const focusSearch = () => {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background px-4 py-14 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-10 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {greeting}{firstName ? ', ' : ''}
            {firstName && <span className="impact-gradient">{firstName}</span>}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">What are we building today?</p>
        </header>

        <form onSubmit={submit} className="mb-3">
          <div className="flex items-center gap-2 rounded-2xl border border-primary/35 bg-card/80 p-2 shadow-[0_0_0_1px_rgba(57,130,246,0.05)] transition focus-within:border-primary/70 focus-within:shadow-[0_0_28px_-12px_rgba(59,130,246,0.45)]">
            <Sparkles className="ml-3 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search papers, researchers, funding..."
              aria-label="Search papers, researchers, funding"
              className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-xl eyra-gradient px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Search <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="mb-9 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => searchExample(example)}
              className="rounded-full border border-border/60 bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>

        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/65">
          Where would you like to start?
        </p>

        <section className="grid gap-3 sm:grid-cols-3">
          {START_CARDS.map((card) => {
            const Icon = card.icon;
            const content = (
              <>
                <span className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">{card.title}</span>
                <span className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{card.description}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {card.action} <ArrowRight className="h-3 w-3" />
                </span>
              </>
            );

            const classes = "flex min-h-44 flex-col rounded-2xl border border-border/70 bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_40px_-24px_rgba(59,130,246,0.6)]";
            return card.type === 'search' ? (
              <button key={card.title} type="button" onClick={focusSearch} className={`${classes} border-primary/45`}>
                {content}
              </button>
            ) : (
              <Link key={card.title} to={card.href} className={classes}>{content}</Link>
            );
          })}
        </section>

        <section className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHORTCUTS.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Link
                key={shortcut.label}
                to={shortcut.href}
                className="flex min-h-16 items-center justify-center gap-2 rounded-xl border border-border/70 bg-card px-3 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-secondary/40"
              >
                <Icon className="h-4 w-4 text-primary" />
                {shortcut.label}
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
