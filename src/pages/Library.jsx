import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  FileText, Users, Award, Trash2, ExternalLink, Search,
  BookOpen, TrendingUp, BarChart3
} from 'lucide-react';
import EyraResearchCompanion from '@/components/eyra/EyraResearchCompanion';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const TABS = [
  { key: 'papers', label: 'Papers', icon: FileText },
  { key: 'researchers', label: 'Researchers', icon: Users },
  { key: 'opportunities', label: 'Opportunities', icon: Award },
];

export default function Library() {
  const [tab, setTab] = useState('papers');
  const [papers, setPapers] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [p, r, o] = await Promise.all([
      base44.entities.SavedPaper.list('-created_date'),
      base44.entities.SavedResearcher.list('-created_date'),
      base44.entities.SavedOpportunity.list('-created_date'),
    ]);
    setPapers(p); setResearchers(r); setOpportunities(o);
    setLoading(false);
  };

  const deletePaper = async (id) => {
    await base44.entities.SavedPaper.delete(id);
    setPapers(prev => prev.filter(p => p.id !== id));
    toast({ title: 'Paper removed' });
  };
  const deleteResearcher = async (id) => {
    await base44.entities.SavedResearcher.delete(id);
    setResearchers(prev => prev.filter(r => r.id !== id));
    toast({ title: 'Researcher removed' });
  };
  const deleteOpportunity = async (id) => {
    await base44.entities.SavedOpportunity.delete(id);
    setOpportunities(prev => prev.filter(o => o.id !== id));
    toast({ title: 'Opportunity removed' });
  };

  const filter = (items, fields) => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(item => fields.some(f => (item[f] || '').toLowerCase().includes(q)));
  };

  const counts = { papers: papers.length, researchers: researchers.length, opportunities: opportunities.length };
  const total = papers.length + researchers.length + opportunities.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-1 text-foreground">Research Library</h1>
        <p className="text-muted-foreground text-sm">Your curated knowledge base from EYRA discoveries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Saved Papers', value: papers.length, icon: FileText, color: 'text-primary bg-primary/10' },
          { label: 'Researchers', value: researchers.length, icon: Users, color: 'text-accent bg-accent/10' },
          { label: 'Opportunities', value: opportunities.length, icon: Award, color: 'text-chart-3 bg-chart-3/10' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
              <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mx-auto mb-2`}>
                <Icon size={14} />
              </div>
              <div className="font-bold text-xl font-heading">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search your library..."
          className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 mb-6">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {t.label}
              <span className="text-xs opacity-50">{counts[t.key]}</span>
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
          {/* Papers */}
          {tab === 'papers' && (
            <div className="space-y-3">
              {filter(papers, ['title', 'authors', 'source']).length === 0
                ? <EmptyState icon={FileText} label="No saved papers" sub="Save papers from discovery results" />
                : filter(papers, ['title', 'authors', 'source']).map(p => (
                  <div key={p.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {p.source && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p.source}</span>}
                          {p.year && <span className="text-xs text-muted-foreground">{p.year}</span>}
                        </div>
                        <h4 className="font-semibold text-sm text-foreground">{p.title}</h4>
                        {p.authors && <p className="text-xs text-muted-foreground mt-1">{p.authors}</p>}
                        {p.summary && <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{p.summary}</p>}
                        <EyraResearchCompanion paper={p} />
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors"><ExternalLink size={13} className="text-muted-foreground" /></a>}
                        <button onClick={() => deletePaper(p.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={13} className="text-destructive/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Researchers */}
          {tab === 'researchers' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {filter(researchers, ['name', 'institution', 'research_areas']).length === 0
                ? <EmptyState icon={Users} label="No saved researchers" sub="Save researchers from discovery results" />
                : filter(researchers, ['name', 'institution', 'research_areas']).map(r => (
                  <div key={r.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground">{r.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.institution}</p>
                        {r.research_areas && <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{r.research_areas}</p>}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span><BookOpen size={11} className="inline mr-1" />{(r.works_count || 0).toLocaleString()} works</span>
                          <span>{(r.citation_count || 0).toLocaleString()} citations</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {r.profile_url && <a href={r.profile_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors"><ExternalLink size={13} className="text-muted-foreground" /></a>}
                        <button onClick={() => deleteResearcher(r.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={13} className="text-destructive/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Opportunities */}
          {tab === 'opportunities' && (
            <div className="space-y-3">
              {filter(opportunities, ['title', 'description', 'type']).length === 0
                ? <EmptyState icon={Award} label="No saved opportunities" sub="Save opportunities from discovery results" />
                : filter(opportunities, ['title', 'description', 'type']).map(o => (
                  <div key={o.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {o.type && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground mb-2 inline-block">{o.type}</span>}
                        <h4 className="font-semibold text-sm text-foreground">{o.title}</h4>
                        {o.description && <p className="text-xs text-muted-foreground mt-1">{o.description}</p>}
                        {o.deadline && <p className="text-xs text-primary mt-2">Deadline: {o.deadline}</p>}
                      </div>
                      <button onClick={() => deleteOpportunity(o.id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                        <Trash2 size={13} className="text-destructive/60" />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, label, sub }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <p className="font-medium text-sm text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
