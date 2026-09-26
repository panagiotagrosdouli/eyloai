import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Trash2, Search, FileText, Users, Award,
  Calendar, ArrowRight, RotateCcw, Bookmark
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

function discoveryHref(search) {
  const params = new URLSearchParams({
    q: search.query || '',
    level: search.level || 'researcher',
    goal: search.goal || 'review',
    recency: search.recency || 'balanced',
  });
  return `/home?${params.toString()}`;
}

function profileLabel(value) {
  return String(value || '').replaceAll('_', ' ');
}

export default function History() {
  const [searches, setSearches] = useState([]);
  const [papers, setPapers] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadNotice, setLoadNotice] = useState('');
  const [activeTab, setActiveTab] = useState('discoveries');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const term = searchParams.get('q') || '';
    setSearchTerm(term);
    if (term) setActiveTab('discoveries');
  }, [searchParams]);

  const loadAll = async () => {
    setLoading(true);
    setLoadNotice('');
    const results = await Promise.allSettled([
      base44.entities.SearchHistory.list('-created_date', 50),
      base44.entities.SavedPaper.list('-created_date', 20),
      base44.entities.SavedResearcher.list('-created_date', 20),
      base44.entities.SavedOpportunity.list('-created_date', 20),
    ]);
    setSearches(results[0].status === 'fulfilled' ? results[0].value : []);
    setPapers(results[1].status === 'fulfilled' ? results[1].value : []);
    setResearchers(results[2].status === 'fulfilled' ? results[2].value : []);
    setOpportunities(results[3].status === 'fulfilled' ? results[3].value : []);
    if (results.some(result => result.status === 'rejected')) {
      setLoadNotice('Some activity collections could not be loaded. The available collections remain usable.');
    }
    setLoading(false);
  };

  const deleteSearch = async (id) => {
    try {
      await base44.entities.SearchHistory.delete(id);
      setSearches(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Entry removed' });
    } catch (error) {
      toast({ title: 'Could not remove this entry', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const toggleSearchSaved = async (search) => {
    const saved = !search.saved;
    try {
      await base44.entities.SearchHistory.update(search.id, {
        saved,
        saved_at: saved ? new Date().toISOString() : null,
      });
      setSearches(prev => prev.map(item => item.id === search.id ? { ...item, saved } : item));
      toast({ title: saved ? 'Search saved' : 'Removed from saved searches' });
    } catch (error) {
      toast({
        title: 'Could not update this search',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const matchesQuery = (item, fields) => !searchTerm.trim() || fields.some(field => String(item[field] || '').toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const visibleSearches = searches.filter(search => matchesQuery(search, ['query', 'goal', 'level', 'recency', 'results_summary']));
  const savedSearches = searches.filter(search => search.saved && matchesQuery(search, ['query', 'goal', 'level', 'recency', 'results_summary']));
  const visiblePapers = papers.filter(item => matchesQuery(item, ['title', 'authors', 'source', 'summary']));
  const visibleResearchers = researchers.filter(item => matchesQuery(item, ['name', 'institution', 'research_areas']));
  const visibleOpportunities = opportunities.filter(item => matchesQuery(item, ['title', 'agency', 'description', 'eligibility']));

  const TABS = [
    { key: 'discoveries', label: 'Discoveries', icon: Sparkles, count: visibleSearches.length },
    { key: 'saved', label: 'Saved searches', icon: Bookmark, count: savedSearches.length },
    { key: 'papers', label: 'Papers', icon: FileText, count: visiblePapers.length },
    { key: 'researchers', label: 'Researchers', icon: Users, count: visibleResearchers.length },
    { key: 'opportunities', label: 'Opportunities', icon: Award, count: visibleOpportunities.length },
  ];

  // Group searches by date
  const groupedSearches = visibleSearches.reduce((acc, s) => {
    const day = moment(s.created_date).calendar(null, {
      sameDay: '[Today]',
      lastDay: '[Yesterday]',
      lastWeek: 'dddd',
      sameElse: 'MMM D, YYYY',
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">Activity</h1>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search activity..." aria-label="Search activity" className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Searches Saved', value: savedSearches.length, icon: Bookmark, color: 'text-primary bg-primary/10' },
          { label: 'Papers Saved', value: papers.length, icon: FileText, color: 'text-accent bg-accent/10' },
          { label: 'Researchers', value: researchers.length, icon: Users, color: 'text-chart-3 bg-chart-3/10' },
          { label: 'Opportunities', value: opportunities.length, icon: Award, color: 'text-chart-4 bg-chart-4/10' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
              <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mx-auto mb-2`}>
                <Icon size={14} />
              </div>
              <div className="font-bold text-lg font-heading text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      {loadNotice && <div role="status" className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-100">{loadNotice}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 mb-6 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {t.label}
              <span className="text-xs opacity-50">{t.count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

          {/* Discoveries tab */}
          {activeTab === 'discoveries' && (
            visibleSearches.length === 0 ? (
              <EmptyState icon={Sparkles} label={searchTerm ? 'No matching searches' : 'No discoveries yet'} sub={searchTerm ? 'Try another term or clear the search.' : 'Start a discovery and your history will appear here'} actionLabel={searchTerm ? undefined : 'Start Discovering'} actionHref={searchTerm ? undefined : '/home'} />
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedSearches).map(([day, items]) => (
                  <div key={day}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      <Calendar size={11} />
                      {day}
                    </h3>
                    <div className="space-y-2">
                      {items.map(s => (
                        <div key={s.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Search size={14} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{s.query}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{moment(s.created_date).fromNow()}</span>
                              {s.results_summary && <span className="text-xs text-muted-foreground">· {s.results_summary}</span>}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {[s.level || 'researcher', s.goal || 'review', s.recency || 'balanced'].map(value => (
                                <span key={value} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                                  {profileLabel(value)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleSearchSaved(s)}
                              aria-pressed={Boolean(s.saved)}
                              className={`p-2 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 ${s.saved ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}
                              title={s.saved ? 'Remove from saved searches' : 'Save this search'}
                            >
                              <Bookmark size={12} fill={s.saved ? 'currentColor' : 'none'} />
                            </button>
                            <Link to={discoveryHref(s)} className="p-2 rounded-lg hover:bg-secondary transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" title="Re-run with the same research profile">
                              <RotateCcw size={12} className="text-muted-foreground" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => deleteSearch(s.id)}
                              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                              title="Delete search"
                            >
                              <Trash2 size={12} className="text-destructive/60" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Saved searches tab */}
          {activeTab === 'saved' && (
            savedSearches.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                label="No saved searches yet"
                sub="Save a useful discovery report and repeat the same level, goal and recency later"
                actionLabel="Start Discovering"
                actionHref="/home"
              />
            ) : (
              <div className="space-y-3">
                {savedSearches.map(s => (
                  <div key={s.id} className="group rounded-xl border border-primary/20 bg-card p-4 transition-all hover:border-primary/40 card-glow">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Bookmark size={14} className="text-primary" fill="currentColor" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground">{s.query}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[s.level || 'researcher', s.goal || 'review', s.recency || 'balanced'].map(value => (
                            <span key={value} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                              {profileLabel(value)}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {s.results_summary || 'Saved research profile'} · {moment(s.saved_at || s.created_date).fromNow()}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <Link
                          to={discoveryHref(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                        >
                          <RotateCcw size={12} /> Run again
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleSearchSaved(s)}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          title="Remove from saved searches"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Papers tab */}
          {activeTab === 'papers' && (
            visiblePapers.length === 0 ? (
              <EmptyState icon={FileText} label={searchTerm && papers.length ? 'No matching papers' : 'No saved papers'} sub={searchTerm && papers.length ? 'Try another term or clear the search.' : 'Save papers from discovery results'} actionLabel={searchTerm && papers.length ? undefined : 'Start Discovering'} actionHref={searchTerm && papers.length ? undefined : '/'} />
            ) : (
              <div className="space-y-3">
                {visiblePapers.map(p => (
                  <div key={p.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText size={13} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {p.source && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-semibold">{p.source}</span>}
                          {p.year && <span className="text-xs text-muted-foreground">{p.year}</span>}
                        </div>
                        <h4 className="font-medium text-sm text-foreground">{p.title}</h4>
                        {p.authors && <p className="text-xs text-muted-foreground mt-0.5">{p.authors}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{moment(p.created_date).fromNow()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Researchers tab */}
          {activeTab === 'researchers' && (
            visibleResearchers.length === 0 ? (
              <EmptyState icon={Users} label={searchTerm && researchers.length ? 'No matching researchers' : 'No saved researchers'} sub={searchTerm && researchers.length ? 'Try another term or clear the search.' : 'Save researchers from discovery results'} actionLabel={searchTerm && researchers.length ? undefined : 'Start Discovering'} actionHref={searchTerm && researchers.length ? undefined : '/'} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleResearchers.map(r => (
                  <div key={r.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                    <h4 className="font-medium text-sm text-foreground">{r.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.institution}</p>
                    {r.research_areas && <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-1">{r.research_areas}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{(r.works_count || 0).toLocaleString()} works</span>
                      <span>{moment(r.created_date).fromNow()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Opportunities tab */}
          {activeTab === 'opportunities' && (
            visibleOpportunities.length === 0 ? (
              <EmptyState icon={Award} label={searchTerm && opportunities.length ? 'No matching opportunities' : 'No saved opportunities'} sub={searchTerm && opportunities.length ? 'Try another term or clear the search.' : 'Save opportunities from discovery results'} actionLabel={searchTerm && opportunities.length ? undefined : 'Browse Opportunities'} actionHref={searchTerm && opportunities.length ? undefined : '/opportunities'} />
            ) : (
              <div className="space-y-3">
                {visibleOpportunities.map(o => (
                  <div key={o.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Award size={13} className="text-chart-3" />
                      </div>
                      <div className="flex-1">
                        {o.type && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-semibold">{o.type}</span>}
                        <h4 className="font-medium text-sm text-foreground mt-1">{o.title}</h4>
                        {o.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{o.description}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">{moment(o.created_date).fromNow()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

        </motion.div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, label, sub, actionLabel, actionHref }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <Icon size={22} className="text-muted-foreground" />
      </div>
      <p className="font-medium text-sm text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      {actionLabel && (
        <Link to={actionHref} className="mt-4 flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
          {actionLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}
