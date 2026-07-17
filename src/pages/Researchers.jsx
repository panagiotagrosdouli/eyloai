import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { searchOpenAlexAuthors } from '@/lib/eyra-api';
import { Search, Bookmark, ExternalLink, BookOpen, Sparkles, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const QUICK_SEARCHES = [
  'Artificial intelligence', 'Cancer biology', 'Climate science',
  'Quantum physics', 'Genomics', 'Robotics', 'Neuroscience', 'NLP',
];

export default function Researchers() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchOpenAlexAuthors(q, 16);
      setResults(data);
    } catch {
      toast({ title: 'Search failed', description: 'Could not reach OpenAlex. Please try again.', variant: 'destructive' });
      setResults([]);
    }
    setLoading(false);
  };

  const saveResearcher = async (r) => {
    await base44.entities.SavedResearcher.create({
      name: r.name,
      institution: r.institution,
      research_areas: r.research_areas,
      works_count: r.works_count,
      citation_count: r.citation_count,
      profile_url: r.profile_url,
    });
    toast({ title: 'Researcher saved to library' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-1 text-foreground">Researchers</h1>
        <p className="text-muted-foreground text-sm">Discover experts and collaborators via OpenAlex — real data, real researchers</p>
      </div>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="relative max-w-2xl mb-4">
        <Sparkles size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by research field, topic, or name..."
          className="w-full h-12 pl-11 pr-36 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg eyra-gradient text-white text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center gap-2"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          Search
        </button>
      </form>

      {/* Quick search chips */}
      {!hasSearched && (
        <div className="flex flex-wrap gap-2 mb-8">
          {QUICK_SEARCHES.map(qs => (
            <button
              key={qs}
              onClick={() => handleSearch(qs)}
              className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              {qs}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full eyra-gradient flex items-center justify-center mb-3 animate-pulse-glow">
            <Users size={16} className="text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Searching OpenAlex for researchers...</p>
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={24} className="text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No researchers found. Try a different search term.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="text-xs text-muted-foreground mb-4">{results.length} researchers found via OpenAlex</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((r, i) => (
              <div key={r.id || i} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground">{r.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.institution}</p>
                    {r.country && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{r.country}</p>}
                    {r.research_areas && (
                      <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2">{r.research_areas}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen size={11} />
                        {(r.works_count || 0).toLocaleString()} works
                      </span>
                      <span>{(r.citation_count || 0).toLocaleString()} citations</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => saveResearcher(r)} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Save">
                      <Bookmark size={13} className="text-muted-foreground" />
                    </button>
                    {r.profile_url && (
                      <a href={r.profile_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <ExternalLink size={13} className="text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {!hasSearched && !loading && (
        <div className="grid gap-3 sm:grid-cols-3 mt-2">
          {[
            { title: 'Real Data', desc: 'Researchers sourced directly from OpenAlex — the world\'s largest open research graph', icon: '🔬' },
            { title: 'Full Profiles', desc: 'View publications, citation counts, institutions, and research areas', icon: '👤' },
            { title: 'Save & Collaborate', desc: 'Save researchers to your library and add them to projects', icon: '💾' },
          ].map(c => (
            <div key={c.title} className="p-5 rounded-xl border border-border bg-card">
              <div className="text-2xl mb-3">{c.icon}</div>
              <h4 className="font-semibold text-sm text-foreground mb-1">{c.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
