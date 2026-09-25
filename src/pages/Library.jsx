import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ArrowRight, Award, BookOpen, ExternalLink, FileText, Search, Trash2, Users,
} from 'lucide-react';
import EyraResearchCompanion from '@/components/eyra/EyraResearchCompanion';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const TABS = [
  { key: 'papers', label: 'Papers', icon: FileText },
  { key: 'researchers', label: 'Researchers', icon: Users },
  { key: 'opportunities', label: 'Opportunities', icon: Award },
];

const EMPTY_COPY = {
  papers: {
    title: 'No saved papers yet',
    description: 'Search the literature and save the evidence you want to return to.',
    action: 'Find evidence',
    href: '/home',
  },
  researchers: {
    title: 'No saved researchers yet',
    description: 'Find authors and institutions that are relevant to your work.',
    action: 'Find researchers',
    href: '/researchers',
  },
  opportunities: {
    title: 'No saved opportunities yet',
    description: 'Review current funding records and keep the opportunities worth following.',
    action: 'Search funding',
    href: '/opportunities',
  },
};

export default function Library() {
  const [tab, setTab] = useState('papers');
  const [papers, setPapers] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadNotice, setLoadNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    setLoadNotice('');
    const results = await Promise.allSettled([
      base44.entities.SavedPaper.list('-created_date'),
      base44.entities.SavedResearcher.list('-created_date'),
      base44.entities.SavedOpportunity.list('-created_date'),
    ]);
    setPapers(results[0].status === 'fulfilled' ? results[0].value : []);
    setResearchers(results[1].status === 'fulfilled' ? results[1].value : []);
    setOpportunities(results[2].status === 'fulfilled' ? results[2].value : []);
    const failures = results.filter(result => result.status === 'rejected').length;
    if (failures) {
      setLoadNotice(`${failures} saved collection${failures === 1 ? '' : 's'} could not be loaded. The available collections remain usable.`);
    }
    setLoading(false);
  };

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filterItems = (items, fields) => {
    if (!normalizedQuery) return items;
    return items.filter(item => fields.some(field =>
      String(item[field] || '').toLowerCase().includes(normalizedQuery)
    ));
  };

  const filtered = useMemo(() => ({
    papers: filterItems(papers, ['title', 'authors', 'source', 'doi']),
    researchers: filterItems(researchers, ['name', 'institution', 'research_areas']),
    opportunities: filterItems(opportunities, ['title', 'description', 'type', 'agency']),
  }), [normalizedQuery, opportunities, papers, researchers]);

  const counts = {
    papers: papers.length,
    researchers: researchers.length,
    opportunities: opportunities.length,
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      if (pendingDelete.type === 'paper') {
        await base44.entities.SavedPaper.delete(pendingDelete.id);
        setPapers(previous => previous.filter(item => item.id !== pendingDelete.id));
      } else if (pendingDelete.type === 'researcher') {
        await base44.entities.SavedResearcher.delete(pendingDelete.id);
        setResearchers(previous => previous.filter(item => item.id !== pendingDelete.id));
      } else {
        await base44.entities.SavedOpportunity.delete(pendingDelete.id);
        setOpportunities(previous => previous.filter(item => item.id !== pendingDelete.id));
      }
      toast({ title: `${pendingDelete.label} removed` });
      setPendingDelete(null);
    } catch (error) {
      toast({
        title: `Could not remove ${pendingDelete.label.toLowerCase()}`,
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const currentItems = filtered[tab];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saved knowledge</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Everything you chose to keep — papers, people and opportunities — in one searchable place.
          </p>
        </div>
        <Link
          to="/home"
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:self-auto"
        >
          Find evidence <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>

      {loadNotice && (
        <div role="status" className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100">
          {loadNotice}
        </div>
      )}

      <div className="mb-6 grid divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`flex min-h-20 items-center gap-3 px-5 text-left transition-colors ${
              tab === key ? 'bg-secondary/50' : 'hover:bg-secondary/25'
            }`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              tab === key ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
            }`}>
              <Icon size={15} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xl font-semibold tabular-nums">{counts[key]}</span>
              <span className="block text-xs text-muted-foreground">{label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors ${
                tab === key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {label} <span className="ml-1 opacity-60">{counts[key]}</span>
            </button>
          ))}
        </div>

        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Search your library</span>
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search saved items…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
        </label>
      </div>

      {loading ? (
        <LibrarySkeleton tab={tab} />
      ) : currentItems.length === 0 ? (
        <EmptyState
          tab={tab}
          hasSearch={Boolean(normalizedQuery)}
          onClear={() => setSearchTerm('')}
        />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {tab === 'papers' && (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {filtered.papers.map(paper => (
                <article key={paper.id} className="group p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        {paper.source && <span>{paper.source}</span>}
                        {paper.year && <span>· {paper.year}</span>}
                        {paper.doi && <span className="truncate">· DOI {paper.doi}</span>}
                      </div>
                      <h2 className="text-sm font-semibold leading-6 text-foreground">{paper.title}</h2>
                      {paper.authors && <p className="mt-1 text-xs leading-5 text-muted-foreground">{paper.authors}</p>}
                      {paper.summary && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{paper.summary}</p>}
                      <EyraResearchCompanion paper={paper} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {paper.url && (
                        <a
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open source for ${paper.title}`}
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ type: 'paper', id: paper.id, title: paper.title, label: 'Paper' })}
                        aria-label={`Remove ${paper.title} from library`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === 'researchers' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.researchers.map(researcher => (
                <article key={researcher.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-foreground">{researcher.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{researcher.institution || 'Institution unavailable'}</p>
                      {researcher.research_areas && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{researcher.research_areas}</p>}
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                        <span><BookOpen size={10} className="mr-1 inline" />{(researcher.works_count || 0).toLocaleString()} works</span>
                        <span>{(researcher.citation_count || 0).toLocaleString()} citations</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {researcher.profile_url && (
                        <a
                          href={researcher.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open profile for ${researcher.name}`}
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ type: 'researcher', id: researcher.id, title: researcher.name, label: 'Researcher' })}
                        aria-label={`Remove ${researcher.name} from library`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === 'opportunities' && (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {filtered.opportunities.map(opportunity => (
                <article key={opportunity.id} className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                        {opportunity.type && <span className="capitalize">{opportunity.type}</span>}
                        {opportunity.agency && <span>· {opportunity.agency}</span>}
                        {opportunity.deadline && <span>· Deadline {opportunity.deadline}</span>}
                      </div>
                      <h2 className="text-sm font-semibold text-foreground">{opportunity.title}</h2>
                      {opportunity.description && <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">{opportunity.description}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {opportunity.url && (
                        <a
                          href={opportunity.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open official record for ${opportunity.title}`}
                          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete({ type: 'opportunity', id: opportunity.id, title: opportunity.title, label: 'Opportunity' })}
                        aria-label={`Remove ${opportunity.title} from library`}
                        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={open => !open && !deleting && setPendingDelete(null)}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.title ? `“${pendingDelete.title}” will be removed from your saved library.` : 'This saved item will be removed from your library.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LibrarySkeleton({ tab }) {
  const rows = tab === 'researchers' ? 4 : 5;
  return (
    <div className={tab === 'researchers' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'} role="status" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-5">
          <div className="h-3 w-24 animate-pulse rounded bg-secondary" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-secondary" />
          <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-secondary/80" />
          <div className="mt-4 h-3 w-full animate-pulse rounded bg-secondary/60" />
        </div>
      ))}
      <span className="sr-only">Loading saved library items</span>
    </div>
  );
}

function EmptyState({ tab, hasSearch, onClear }) {
  const config = EMPTY_COPY[tab];
  const Icon = TABS.find(item => item.key === tab)?.icon || FileText;

  if (hasSearch) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <Search size={20} className="mx-auto text-muted-foreground" />
        <h2 className="mt-4 text-sm font-semibold">No matches in this collection</h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Try a broader title, author, institution or source.</p>
        <button type="button" onClick={onClear} className="mt-5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
          Clear search
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Icon size={18} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-sm font-semibold text-foreground">{config.title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{config.description}</p>
      <Link to={config.href} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-xs font-semibold text-background">
        {config.action} <ArrowRight size={12} aria-hidden="true" />
      </Link>
    </div>
  );
}
