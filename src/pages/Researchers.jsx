import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { searchOpenAlexAuthors } from '@/lib/eyra-api';
import { Bookmark, ExternalLink, BookOpen, Search, Users, Loader2, CalendarDays, Mail, Copy, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';

const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';

const QUICK_SEARCHES = [
  'Artificial intelligence', 'Cancer biology', 'Climate science',
];

export default function Researchers() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [outreachResearcher, setOutreachResearcher] = useState(null);
  const [outreachDraft, setOutreachDraft] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [evidence, setEvidence] = useState({});
  const searchSequence = useRef(0);
  const evidenceRequests = useRef({});
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const term = searchParams.get('q');
    if (term) handleSearch(term);
  }, [searchParams]);

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    const requestId = ++searchSequence.current;
    setQuery(q);
    setLoading(true);
    setHasSearched(true);
    setSearchError('');
    try {
      const data = await searchOpenAlexAuthors(q, 16, { throwOnError: true });
      if (requestId === searchSequence.current) setResults(data);
    } catch {
      if (requestId === searchSequence.current) {
        setSearchError('OpenAlex is unavailable right now. Please retry your search.');
        setResults([]);
      }
    } finally {
      if (requestId === searchSequence.current) setLoading(false);
    }
  };

  const loadEvidence = async (researcher) => {
    const authorId = String(researcher.id || '').split('/').pop();
    if (!/^A[0-9]+$/.test(authorId)) return;
    const requestId = (evidenceRequests.current[authorId] || 0) + 1;
    evidenceRequests.current[authorId] = requestId;
    setEvidence(prev => ({ ...prev, [authorId]: { loading: true, papers: prev[authorId]?.papers || [], error: '' } }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const url = `https://api.openalex.org/works?filter=author.id:${encodeURIComponent(authorId)}&sort=cited_by_count:desc&per_page=5`;
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error('OpenAlex unavailable');
      const payload = await response.json();
      const papers = (payload.results || [])
        .filter(p => p.title && Number.isInteger(Number(p.publication_year)) && Number(p.publication_year) <= new Date().getFullYear())
        .map(p => ({
          title: p.title, year: p.publication_year,
          link: [p.doi, p.id].find(link => typeof link === 'string' && /^https:\/\/(doi\.org|openalex\.org)\//i.test(link)) || '',
          citations: p.cited_by_count || 0,
        }));
      if (evidenceRequests.current[authorId] === requestId) setEvidence(prev => ({ ...prev, [authorId]: { loading: false, papers, error: '' } }));
    } catch {
      if (evidenceRequests.current[authorId] === requestId) setEvidence(prev => ({ ...prev, [authorId]: { loading: false, papers: prev[authorId]?.papers || [], error: 'Unable to load OpenAlex publications. Please retry.' } }));
    } finally {
      clearTimeout(timeout);
    }
  };

  const prepareOutreach = (researcher) => {
    setOutreachResearcher(researcher);
    setCopyStatus('');
    setOutreachDraft(`Subject: Research collaboration inquiry

Dear ${researcher.name || 'Researcher'},

I am exploring ${query.trim() || '[your research topic]'} and came across your scholarly work through OpenAlex. I would appreciate the opportunity to learn more about your research and whether my interests might align with your current work.

I would be happy to share a short research proposal if helpful. Thank you for considering my inquiry.

Kind regards,
[Your name]`);
  };

  const copyOutreach = async () => {
    try {
      await navigator.clipboard.writeText(outreachDraft);
      setCopyStatus('Draft copied. Find and verify an official contact address before sending.');
    } catch {
      setCopyStatus('Copy was blocked by your browser. Select and copy the draft manually.');
    }
  };

  const saveResearcher = async (r) => {
    try {
      await base44.entities.SavedResearcher.create({
        openalex_id: r.openalex_id || r.id,
        source: 'OpenAlex',
        name: r.name,
        institution: r.institution,
        country: r.country,
        research_areas: r.research_areas,
        works_count: r.works_count,
        citation_count: r.citation_count,
        profile_url: r.profile_url,
      });
      toast({ title: 'Researcher saved to library' });
    } catch (error) {
      toast({ title: 'Could not save researcher', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="eylo-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="eylo-page-heading">Find researchers</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Explore real OpenAlex author records. Academic rank and PhD status are not verified by this search.</p>
      </div>

      {/* Search */}
      <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="relative max-w-2xl mb-4">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by research field, topic, or name..."
          className="w-full h-12 pl-11 pr-36 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-opacity flex items-center gap-2"
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

      {!loading && searchError && <div role="alert" className="mb-6 rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-4 text-sm text-foreground">{searchError} <button type="button" onClick={() => handleSearch(query)} className="ml-2 font-semibold text-primary underline">Retry</button></div>}

      {!loading && hasSearched && !searchError && results.length === 0 && (
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
              <div key={r.id || i} className="p-5 rounded-2xl border border-border/80 bg-card shadow-sm hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground" aria-hidden="true">{initials(r.name)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-foreground">{r.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.institution}</p>
                    {r.country && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{r.country}</p>}
                    {r.research_areas && (
                      <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2"><span className="font-medium">{r.research_topics_source || "OpenAlex research topics"}:</span> {r.research_areas}</p>
                    )}
                    {query.trim() && (() => {
                      const terms = [...new Set(query.toLowerCase().match(/[a-zα-ωάέήίόύώϊϋΐΰ0-9]{3,}/gi) || [])];
                      const topics = String(r.research_areas || '').toLowerCase();
                      const matching = terms.filter(term => topics.includes(term));
                      return (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          <span className="font-medium text-foreground">Topic fit:</span>{' '}
                          {matching.length
                            ? `The source lists topics sharing query terms: ${matching.slice(0, 4).join(', ')}. Check published work before considering supervision.`
                            : 'No direct keyword overlap in the available OpenAlex topics. This does not rule out a research match; review publications.'}
                        </p>
                      );
                    })()}
                    <p className="mt-2 text-[11px] text-muted-foreground">Source: OpenAlex · PhD status unverified · No sourced portrait available</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.profile_url && <a href={r.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"><ExternalLink size={13} aria-hidden="true" /> Verify source profile</a>}
                      <button type="button" onClick={() => loadEvidence(r)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"><BookOpen size={13} aria-hidden="true" /> View actual publications</button>
                      <button type="button" onClick={() => prepareOutreach(r)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"><Mail size={13} aria-hidden="true" /> Draft a message</button>
                      <Link to={`/meetings?person=${encodeURIComponent(r.name || '')}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"><CalendarDays size={13} aria-hidden="true" /> Plan a discussion</Link>
                    </div>
                    {(() => {
                      const state = evidence[String(r.id || '').split('/').pop()];
                      if (!state) return null;
                      return <div className="mt-3 rounded-xl border border-border bg-background p-3">
                        <p className="mb-2 text-xs font-semibold">Publications attributed to this OpenAlex author</p>
                        {state.loading && <p className="text-xs text-muted-foreground">Loading scholarly evidence…</p>}
                        {state.error && <p role="alert" className="text-xs text-destructive">{state.error} <button type="button" className="underline" onClick={() => loadEvidence(r)}>Retry</button></p>}
                        {!state.loading && !state.error && state.papers.length === 0 && <p className="text-xs text-muted-foreground">No publications returned.</p>}
                        {state.papers.map((p, index) => <a key={p.link || index} href={p.link || r.profile_url} target="_blank" rel="noopener noreferrer" className="block border-t border-border py-2 text-xs text-primary hover:underline">{p.title} {p.year ? `(${p.year})` : ''} · {p.citations} citations <ExternalLink size={11} className="inline" /></a>)}
                        <p className="mt-2 text-[11px] text-muted-foreground">Attribution is from OpenAlex. Check identity and publication relevance before contacting.</p>
                      </div>;
                    })()}
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Planning a discussion does not send an invitation. Contact details and identity must be verified independently.</p>
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

      {outreachResearcher && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOutreachResearcher(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="outreach-title" className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="outreach-title" className="text-xl font-semibold">Prepare a research inquiry</h2><p className="mt-1 text-sm text-muted-foreground">Draft for {outreachResearcher.name}. This does not send an email or imply they are accepting students.</p></div>
              <button type="button" onClick={() => setOutreachResearcher(null)} aria-label="Close message draft" className="rounded-lg p-2 hover:bg-secondary"><X size={18} /></button>
            </div>
            <label htmlFor="outreach-draft" className="mt-5 block text-sm font-medium">Edit your message before copying</label>
            <textarea id="outreach-draft" value={outreachDraft} onChange={event => { setOutreachDraft(event.target.value); setCopyStatus(''); }} rows={12} className="mt-2 w-full resize-y rounded-xl border border-border bg-background p-4 text-sm leading-6 text-foreground focus-visible:outline-primary" />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Only the researcher's OpenAlex record was found. Verify the intended recipient and official contact details independently. No email is automatically sent.</p>
            {copyStatus && <p role="status" className="mt-3 text-sm text-muted-foreground">{copyStatus}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {outreachResearcher.profile_url && <a href={outreachResearcher.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-secondary"><ExternalLink size={15} /> Verify author profile</a>}
              <button type="button" onClick={copyOutreach} disabled={!outreachDraft.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Copy size={15} /> Copy draft</button>
            </div>
          </section>
        </div>
      )}

      {!hasSearched && !loading && (
        <p className="mt-8 max-w-xl text-sm leading-6 text-muted-foreground">Profiles show scholarly authors, not confirmed PhD candidates or collaborators. We display initials rather than inventing headshots. Open a source record to verify current affiliations and identity.</p>
      )}
    </div>
  );
}
