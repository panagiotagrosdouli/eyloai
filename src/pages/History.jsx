import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, Trash2, Search, FileText, Users, Award,
  TrendingUp, Calendar, Activity, ArrowRight, RotateCcw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

export default function History() {
  const [searches, setSearches] = useState([]);
  const [papers, setPapers] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('discoveries');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [s, p, r, o] = await Promise.all([
      base44.entities.SearchHistory.list('-created_date', 50),
      base44.entities.SavedPaper.list('-created_date', 20),
      base44.entities.SavedResearcher.list('-created_date', 20),
      base44.entities.SavedOpportunity.list('-created_date', 20),
    ]);
    setSearches(s); setPapers(p); setResearchers(r); setOpportunities(o);
    setLoading(false);
  };

  const deleteSearch = async (id) => {
    await base44.entities.SearchHistory.delete(id);
    setSearches(prev => prev.filter(s => s.id !== id));
    toast({ title: 'Entry removed' });
  };

  const TABS = [
    { key: 'discoveries', label: 'Discoveries', icon: Sparkles, count: searches.length },
    { key: 'papers', label: 'Papers', icon: FileText, count: papers.length },
    { key: 'researchers', label: 'Researchers', icon: Users, count: researchers.length },
    { key: 'opportunities', label: 'Opportunities', icon: Award, count: opportunities.length },
  ];

  // Group searches by date
  const groupedSearches = searches.reduce((acc, s) => {
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
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary" />
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">EYRA Activity</h1>
        </div>
        <p className="text-muted-foreground text-sm">Your discovery timeline and saved intelligence</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Discoveries', value: searches.length, icon: Search, color: 'text-primary bg-primary/10' },
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
            searches.length === 0 ? (
              <EmptyState icon={Sparkles} label="No discoveries yet" sub="Start a discovery and your history will appear here" actionLabel="Start Discovering" actionHref="/" />
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
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{moment(s.created_date).fromNow()}</span>
                              {s.results_summary && <span className="text-xs text-muted-foreground">· {s.results_summary}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Link to="/" className="p-2 rounded-lg hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100" title="Re-run discovery">
                              <RotateCcw size={12} className="text-muted-foreground" />
                            </Link>
                            <button
                              onClick={() => deleteSearch(s.id)}
                              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
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

          {/* Papers tab */}
          {activeTab === 'papers' && (
            papers.length === 0 ? (
              <EmptyState icon={FileText} label="No saved papers" sub="Save papers from discovery results" actionLabel="Start Discovering" actionHref="/" />
            ) : (
              <div className="space-y-3">
                {papers.map(p => (
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
            researchers.length === 0 ? (
              <EmptyState icon={Users} label="No saved researchers" sub="Save researchers from discovery results" actionLabel="Start Discovering" actionHref="/" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {researchers.map(r => (
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
            opportunities.length === 0 ? (
              <EmptyState icon={Award} label="No saved opportunities" sub="Save opportunities from discovery results" actionLabel="Browse Opportunities" actionHref="/opportunities" />
            ) : (
              <div className="space-y-3">
                {opportunities.map(o => (
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
